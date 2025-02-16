"use strict";

class gswaSynth {
	static #startedMaxId = 0;
	$ctx = null;
	$output = null;
	$getAudioBuffer = GSUnoop;
	#nyquist = 24000;
	#data = GSUgetModel( "synth" );
	#oscsCrud = GSUcreateUpdateDelete.bind( null, this.#data.oscillators,
		this.#addOsc.bind( this ),
		this.#changeOsc.bind( this ),
		this.#removeOsc.bind( this ) );
	#bps = 1;
	#startedKeys = new Map();

	constructor() {
		Object.seal( this );
	}

	// ..........................................................................
	static #getHz( key ) {
		return 440 * ( 2 ** ( ( key - 57 ) / 12 ) );
	}

	// ..........................................................................
	$setContext( ctx ) {
		const oscs = Object.entries( this.#data.oscillators );

		this.$stopAllKeys();
		this.$ctx = ctx;
		this.#nyquist = ctx.sampleRate / 2;
		this.$output = ctx.createGain();
		oscs.forEach( kv => this.#removeOsc( kv[ 0 ] ) );
		oscs.forEach( kv => this.#addOsc( ...kv ) );
	}
	$setBPM( bpm ) {
		this.#bps = bpm / 60;
	}
	$change( obj ) {
		this.#oscsCrud( obj.oscillators );
		GSUdiffAssign( this.#data, obj );
		this.#changeEnvs( obj.envs );
		this.#changeLFOs( obj.lfos );
	}

	// ..........................................................................
	#removeOsc( id ) {
		this.#startedKeys.forEach( key => {
			this.#destroyOscNode( key.$oscNodes.get( id ) );
			key.$oscNodes.delete( id );
		} );
	}
	#addOsc( id, osc ) {
		this.#startedKeys.forEach( key => key.$oscNodes.set( id, this.#createOscNode( key, osc, 0, this.#data.envs.gain ) ) );
	}
	#changeOsc( id, obj ) {
		const now = this.$ctx.currentTime;
		const objEnt = Object.entries( obj );
		const osc = this.#data.oscillators[ id ];

		this.#startedKeys.forEach( key => {
			const nodes = key.$oscNodes.get( id );

			objEnt.forEach( ( [ prop, val ] ) => {
				switch ( prop ) {
					case "wave": this.#oscChangeProp( osc, nodes, "wave", val, now, 0 ); break;
					case "phaze": this.#oscChangeProp( osc, nodes, "phaze", key.$midi, now, 0 ); break;
					case "pan": nodes.panNode.$setValueAtTime( val, now ); break;
					case "gain": nodes.gainNode.gain.setValueAtTime( val, now ); break;
					case "detune": this.#oscChangeProp( osc, nodes, "detune", key.$midi, now, 0 ); break;
					case "detunefine": this.#oscChangeProp( osc, nodes, "detune", key.$midi, now, 0 ); break;
					case "unisondetune": this.#oscChangeProp( osc, nodes, "unisondetune", key.$midi, now, 0 ); break;
					case "unisonblend": this.#oscChangeProp( osc, nodes, "unisonblend", val, now, 0 ); break;
				}
			} );
		} );
	}
	#changeEnvs( envs ) {
		if ( envs ) {
			const gainEnv = envs.gain && gswaSynth.#changeEnvsFormat( envs.gain, this.#bps );
			const detuneEnv = envs.detune && gswaSynth.#changeEnvsFormat( envs.detune, this.#bps );

			GSUforEach( this.#startedKeys, key => {
				gainEnv && key.$gainEnv.$start( gainEnv );
				detuneEnv && key.$detuneEnv.$start( detuneEnv );
			} );
		}
	}
	#changeLFOs( lfos ) {
		if ( lfos ) {
			const gainLFO = lfos.gain && gswaSynth.#changeLFOformat( "gain", lfos.gain, this.#bps );
			const detuneLFO = lfos.detune && gswaSynth.#changeLFOformat( "detune", lfos.detune, this.#bps );

			this.#startedKeys.forEach( key => {
				gainLFO && key.$gainLFO.$change( gainLFO );
				detuneLFO && key.$detuneLFO.$change( detuneLFO );
			} );
		}
	}
	static #changeEnvsFormat( env, bps ) {
		const nobj = { ...env };

		if ( "hold" in nobj ) { nobj.hold /= bps; }
		if ( "decay" in nobj ) { nobj.decay /= bps; }
		if ( "attack" in nobj ) { nobj.attack /= bps; }
		if ( "release" in nobj ) { nobj.release /= bps; }
		return nobj;
	}
	static #changeLFOformat( target, lfo, bps ) {
		const nobj = { ...lfo };

		if ( "delay" in nobj ) { nobj.delay /= bps; }
		if ( "attack" in nobj ) { nobj.attack /= bps; }
		if ( "amp" in nobj ) {
			nobj.absoluteAmp = nobj.amp;
			if ( target === "detune" ) {
				nobj.absoluteAmp *= 100;
			}
			delete nobj.amp;
		}
		if ( "speed" in nobj ) {
			nobj.absoluteSpeed = nobj.speed * bps;
			delete nobj.speed;
		}
		return nobj;
	}

	// ..........................................................................
	$startKey( allBlocks, when, off, dur ) {
		const blocks = allBlocks.filter( ( [ , blc ] ) => ( blc.when + blc.duration ) / this.#bps >= off ); // 1.
		const firstWhen = allBlocks[ 0 ][ 1 ].when;
		const firstWhe2 = blocks[ 0 ][ 1 ].when;
		const diffWhen = firstWhe2 - firstWhen;
		const off2 = off - diffWhen / this.#bps;

		return this.#startKey2( blocks, when, off2, dur );
	}
	#startKey2( blocks, when, off, dur ) {
		const id = ++gswaSynth.#startedMaxId;
		const blc0 = blocks[ 0 ][ 1 ];
		const blcLast = blocks[ blocks.length - 1 ][ 1 ];
		const blc0when = blc0.when;
		const atTime = when - off;
		const ctx = this.$ctx;
		const bps = this.#bps;
		const envG = this.#data.envs.gain;
		const envD = this.#data.envs.detune;
		const lfoG = this.#data.lfos.gain;
		const lfoD = this.#data.lfos.detune;
		const oscs = this.#data.oscillators;
		const gainLFOvariations = [];
		const detuneLFOvariations = [];
		const key = Object.freeze( {
			$when: when,
			$off: off,
			$dur: dur,
			$pan: blc0.pan,
			$midi: blc0.key,
			$gain: blc0.gain,
			$lowpass: blc0.lowpass,
			$highpass: blc0.highpass,
			$attack: blc0.attack / bps || .005,
			$release: blcLast.release / bps || .005,
			$variations: [],
			$oscNodes: new Map(),
			$gainEnv: new gswaEnvelope( ctx, "gain" ),
			$gainEnvNode: ctx.createGain(),
			$detuneEnv: new gswaEnvelope( ctx, "detune" ),
			$gainLFO: new gswaLFO( ctx ),
			$gainLFOtarget: ctx.createGain(),
			$detuneLFO: new gswaLFO( ctx ),
			$gainNode: ctx.createGain(),
			$panNode: new gswaStereoPanner( ctx ),
			$lowpassNode: ctx.createBiquadFilter(),
			$highpassNode: ctx.createBiquadFilter(),
		} );

		if ( blocks.length > 1 ) {
			blocks.reduce( ( prev, [ , blc ] ) => {
				if ( prev ) {
					const prevWhen = prev.when - blc0when;
					const when = ( prevWhen + prev.duration ) / bps;
					const duration = ( blc.when - blc0when ) / bps - when;

					key.$variations.push( {
						when,
						duration,
						pan: [ prev.pan, blc.pan ],
						midi: [ prev.key, blc.key ],
						gain: [ prev.gain, blc.gain ],
						lowpass: [
							this.#calcLowpass( prev.lowpass ),
							this.#calcLowpass( blc.lowpass ),
						],
						highpass: [
							this.#calcHighpass( prev.highpass ),
							this.#calcHighpass( blc.highpass ),
						],
					} );
					gainLFOvariations.push( {
						when,
						duration,
						amp: [ prev.gainLFOAmp, blc.gainLFOAmp ],
						speed: [ prev.gainLFOSpeed, blc.gainLFOSpeed ],
					} );
				}
				return blc;
			}, null );
		}
		key.$lowpassNode.type = "lowpass";
		key.$highpassNode.type = "highpass";
		key.$panNode.$setValueAtTime( key.$pan, atTime );
		key.$gainNode.gain.setValueAtTime( key.$gain, atTime );
		key.$lowpassNode.frequency.setValueAtTime( this.#calcLowpass( key.$lowpass ), atTime );
		key.$highpassNode.frequency.setValueAtTime( this.#calcHighpass( key.$highpass ), atTime );
		key.$gainEnv.$start( {
			toggle: envG.toggle,
			when: when - off,
			duration: dur + off,
			attack: envG.attack / bps,
			hold: envG.hold / bps,
			decay: envG.decay / bps,
			sustain: envG.sustain,
			release: envG.release / bps,
		} );
		key.$detuneEnv.$start( {
			toggle: envD.toggle,
			when: when - off,
			duration: dur + off,
			amp: envD.amp * 100,
			attack: envD.attack / bps,
			hold: envD.hold / bps,
			decay: envD.decay / bps,
			sustain: envD.sustain,
			release: envD.release / bps,
		} );
		key.$gainLFO.$start( {
			toggle: lfoG.toggle,
			when,
			whenStop: Number.isFinite( dur ) ? when + dur + envG.release / bps : 0,
			offset: off,
			type: lfoG.type,
			delay: lfoG.delay / bps,
			attack: lfoG.attack / bps,
			absoluteAmp: lfoG.amp,
			absoluteSpeed: lfoG.speed * bps,
			amp: blc0.gainLFOAmp,
			speed: blc0.gainLFOSpeed,
			variations: gainLFOvariations,
		} );
		key.$detuneLFO.$start( {
			toggle: lfoD.toggle,
			when,
			whenStop: Number.isFinite( dur ) ? when + dur + envG.release / bps : 0,
			offset: off,
			type: lfoD.type,
			delay: lfoD.delay / bps,
			attack: lfoD.attack / bps,
			absoluteAmp: lfoD.amp * 100,
			absoluteSpeed: lfoD.speed * bps,
			amp: 1,
			speed: 1,
			variations: detuneLFOvariations,
		} );
		Object.entries( oscs ).forEach( ( [ id, osc ], i ) => key.$oscNodes.set( id, this.#createOscNode( key, osc, i, envG ) ) );
		this.#scheduleVariations( key );
		key.$gainEnvNode.gain.setValueAtTime( 0, 0 );
		key.$gainEnv.$node.connect( key.$gainEnvNode.gain );
		key.$gainLFO.$node.connect( key.$gainLFOtarget.gain );
		key.$gainLFOtarget
			.connect( key.$gainEnvNode )
			.connect( key.$gainNode )
			.connect( key.$panNode.$getInput() );
		key.$panNode
			.$connect( key.$lowpassNode )
			.connect( key.$highpassNode )
			.connect( this.$output );
		this.#startedKeys.set( id, key );
		return id;
	}

	// ..........................................................................
	$stopAllKeys() {
		this.#startedKeys.forEach( ( key, id ) => this.$stopKey( id ) );
	}
	$stopKey( id ) {
		const key = this.#startedKeys.get( id );

		if ( key ) {
			if ( Number.isFinite( key.$dur ) ) {
				this.#stopKey( id );
			} else {
				key.$gainEnv.$stop();
				key.$detuneEnv.$stop();
				setTimeout( this.#stopKey.bind( this, id ), ( this.#data.envs.gain.release + .1 ) / this.#bps * 1000 );
			}
		} else {
			console.error( "gswaSynth: stopKey id invalid", id );
		}
	}
	#stopKey( id ) {
		const key = this.#startedKeys.get( id );

		key.$oscNodes.forEach( this.#destroyOscNode, this );
		key.$gainLFO.$destroy();
		key.$detuneLFO.$destroy();
		key.$gainEnv.$destroy();
		key.$detuneEnv.$destroy();
		this.#startedKeys.delete( id );
	}

	// ..........................................................................
	#calcLowpass( val ) {
		return this.#calcExp( val, this.#nyquist, 2 );
	}
	#calcHighpass( val ) {
		return this.#calcExp( 1 - val, this.#nyquist, 3 );
	}
	#calcExp( x, total, exp ) {
		return exp === 0
			? x
			: Math.expm1( x ) ** exp / ( ( Math.E - 1 ) ** exp ) * total;
	}

	// ..........................................................................
	#scheduleVariations( key ) {
		key.$variations.forEach( va => {
			const when = key.$when - key.$off + va.when;
			const dur = va.duration;

			if ( when > this.$ctx.currentTime && dur > 0 ) {
				key.$oscNodes.forEach( ( nodes, oscId ) => this.#oscChangeProp( this.#data.oscillators[ oscId ], nodes, "frequency", va.midi, when, dur ) );
				key.$panNode.$setValueCurveAtTime( new Float32Array( va.pan ), when, dur );
				key.$gainNode.gain.setValueCurveAtTime( new Float32Array( va.gain ), when, dur );
				key.$lowpassNode.frequency.setValueCurveAtTime( new Float32Array( va.lowpass ), when, dur );
				key.$highpassNode.frequency.setValueCurveAtTime( new Float32Array( va.highpass ), when, dur );
			}
		} );
	}

	// ..........................................................................
	#createOscNode( key, osc, ind, env ) {
		const now = this.$ctx.currentTime;
		const uniNodes = [];
		const panNode = new gswaStereoPanner( this.$ctx );
		const gainNode = this.$ctx.createGain();
		const dur = key.$dur + env.release / this.#bps;
		const nodes = Object.seal( {
			absn: null,
			uniNodes,
			panNode,
			gainNode,
		} );

		panNode.$setValueAtTime( osc.pan, now );
		gainNode.gain.setValueAtTime( osc.gain, now );
		panNode.$connect( gainNode ).connect( key.$gainLFOtarget );
		if ( osc.wave === "noise" ) {
			nodes.absn = gswaNoise.$startABSN( this.$ctx, key.$when, dur );
			nodes.absn.connect( panNode.$getInput() );
		} else {
			for ( let i = 0; i < osc.unisonvoices; ++i ) {
				const uniGain = this.$ctx.createGain();
				const uniSrc = osc.source
					? this.$ctx.createBufferSource()
					: ( new gswaOscillator( this.$ctx ) );

				uniSrc.connect( uniGain ).connect( panNode.$getInput() );
				key.$detuneEnv.$node.connect( uniSrc.detune );
				key.$detuneLFO.$node.connect( uniSrc.detune );
				uniNodes.push( [ uniSrc, uniGain ] );
			}
			if ( osc.source ) {
				this.#oscChangeProp( osc, nodes, "source", osc.source, now, 0 );
			} else {
				this.#oscChangeProp( osc, nodes, "wave", osc.wave, now, 0 );
				this.#oscChangeProp( osc, nodes, "frequency", key.$midi, now, 0 );
			}
			this.#oscChangeProp( osc, nodes, "detune", key.$midi, now, 0 );
			this.#oscChangeProp( osc, nodes, "unisonblend", osc.unisonblend, now, 0 );

			const orderOffset = .0000001 * ind; // 2.
			const phazeOffset = 1 / gswaSynth.#getHz( key.$midi ) * osc.phaze;

			uniNodes.forEach( n => n[ 0 ].start( key.$when + phazeOffset + orderOffset ) );
			if ( Number.isFinite( dur ) ) {
				uniNodes.forEach( n => n[ 0 ].stop( key.$when + dur ) );
			}
		}
		return nodes;
	}
	#destroyOscNode( nodes ) {
		nodes.absn?.stop();
		nodes.uniNodes.forEach( n => n[ 0 ].stop() );
	}
	#oscChangeProp( osc, nodes, prop, val, when, dur ) {
		const uniNodes = nodes.uniNodes;

		switch ( prop ) {
			case "wave":
				uniNodes.forEach( n => n[ 0 ].type = val );
				break;
			case "source": {
				const buf = this.$getAudioBuffer( val );

				uniNodes.forEach( n => {
					n[ 0 ].buffer = buf;
				} );
			} break;
			case "detune":
				uniNodes.forEach( ( n, i ) => {
					n[ 0 ].detune.cancelScheduledValues( 0 );
					n[ 0 ].detune.setValueAtTime( gswaSynth.#calcUnisonDetune( osc, val, i ), when );
				} );
				break;
			case "frequency":
				if ( osc.source ) {
					dur
						? uniNodes.forEach( ( n, i ) => n[ 0 ].detune.setValueCurveAtTime( gswaSynth.#calcUnisonDetune( osc, val, i ), when, dur ) )
						: uniNodes.forEach( ( n, i ) => n[ 0 ].detune.setValueAtTime( gswaSynth.#calcUnisonDetune( osc, val, i ), when ) );
				} else {
					const val2 = Array.isArray( val )
						? new Float32Array( [
							gswaSynth.#getHz( val[ 0 ] ),
							gswaSynth.#getHz( val[ 1 ] ),
						] )
						: gswaSynth.#getHz( val );

					dur
						? uniNodes.forEach( ( n, i ) => n[ 0 ].frequency.setValueCurveAtTime( val2, when, dur ) )
						: uniNodes.forEach( ( n, i ) => n[ 0 ].frequency.setValueAtTime( val2, when ) );
				}
				break;
			case "unisondetune":
				uniNodes.forEach( ( n, i ) => {
					n[ 0 ].detune.cancelScheduledValues( 0 );
					n[ 0 ].detune.setValueAtTime( gswaSynth.#calcUnisonDetune( osc, val, i ), when );
				} );
				break;
			case "unisonblend":
				uniNodes.forEach( ( n, i ) => n[ 1 ].gain.setValueAtTime( gswaSynth.#calcUnisonGain( osc, val, i ), when ) );
				break;
		}
	}
	static #calcUnisonDetune( osc, midi, v ) {
		const uniDetune = osc.unisonvoices > 1
			? osc.unisondetune / -2 + v * ( osc.unisondetune / ( osc.unisonvoices - 1 ) )
			: 0;
		const det = ( osc.detune + osc.detunefine + uniDetune ) * 100;

		if ( osc.wave ) {
			return typeof midi === "number"
				? det
				: new Float32Array( [ det, det ] );
		}
		if ( typeof midi === "number" ) {
			return det + ( midi - ( 72 - 12 ) ) * 100;
		}
		return new Float32Array( [
			det + ( midi[ 0 ] - ( 72 - 12 ) ) * 100,
			det + ( midi[ 1 ] - ( 72 - 12 ) ) * 100,
		] );
	}
	static #calcUnisonGain( osc, blend, v ) {
		const same = 1 / osc.unisonvoices;
		const even = osc.unisonvoices % 2 === 0;
		const midVoice = Math.floor( osc.unisonvoices / 2 );
		const midGainOdd = same + ( 1 - blend ) * ( 1 - same );
		const midGainEven = same + ( 1 - blend ) * ( .5 - same );
		const gain = ( 1 - ( even ? midGainEven * 2 : midGainOdd ) ) / ( osc.unisonvoices - 1 - even );

		return v === midVoice
			? even ? midGainEven : midGainOdd
			: v === midVoice - 1
				? even ? midGainEven : gain
				: gain;
	}
}

Object.freeze( gswaSynth );

/*
1. We do not need to update blocks' `when` because only their intervals count.
2. We add a little timing to be sure we start the oscillators in the same order
   each time, to avoid random chaos...
*/
