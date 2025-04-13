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
		this.#changeNoise( obj.noise );
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

			if ( obj.wave ) {
				this.#oscChangeProp( osc, nodes, "wave", obj.wave, now, 0 );
			}
			if ( obj.waveCustom ) {
				nodes.uniNodes.forEach( n => {
					n[ 0 ].$type = "sine"; // 3.
					n[ 0 ].$type = osc.wave;
				} );
			}
			objEnt.forEach( ( [ prop, val ] ) => {
				switch ( prop ) {
					case "phaze": this.#oscChangeProp( osc, nodes, "phaze", key.$midi, now, 0 ); break;
					case "pan": nodes.panNode.$setValueAtTime( val, now ); break;
					case "gain": GSUsetValueAtTime( nodes.gainNode.gain, val, now ); break;
					case "detune": this.#oscChangeProp( osc, nodes, "detune", key.$midi, now, 0 ); break;
					case "detunefine": this.#oscChangeProp( osc, nodes, "detune", key.$midi, now, 0 ); break;
					case "unisondetune": this.#oscChangeProp( osc, nodes, "unisondetune", key.$midi, now, 0 ); break;
					case "unisonblend": this.#oscChangeProp( osc, nodes, "unisonblend", val, now, 0 ); break;
				}
			} );
		} );
	}
	#changeNoise( obj ) {
		if ( obj ) {
			const now = this.$ctx.currentTime;

			GSUforEach( this.#startedKeys, key => {
				if ( obj.toggle || "color" in obj ) {
					this.#destroyNoiseNodes( key );
					this.#createNoiseNodes( key );
				} else if ( obj.toggle === false ) {
					this.#destroyNoiseNodes( key );
				} else if ( this.#data.noise.toggle ) {
					if ( "gain" in obj ) {
						GSUsetValueAtTime( key.$noiseNodes.gainNode.gain, obj.gain, now );
					}
					if ( "pan" in obj ) {
						key.$noiseNodes.panNode.$setValueAtTime( obj.pan, now );
					}
				}
			} );
		}
	}
	#changeEnvs( envs ) {
		if ( envs ) {
			const gainEnv = envs.gain && gswaSynth.#changeEnvsFormat( envs.gain, this.#bps );
			const detuneEnv = envs.detune && gswaSynth.#changeEnvsFormat( envs.detune, this.#bps );
			const lowpassEnv = envs.lowpass && gswaSynth.#changeEnvsFormat( envs.lowpass, this.#bps );

			GSUforEach( this.#startedKeys, key => {
				gainEnv && key.$gainEnv.$start( gainEnv );
				detuneEnv && key.$detuneEnv.$start( detuneEnv );
				lowpassEnv && key.$lowpassEnv.$start( lowpassEnv );
				if ( envs.lowpass && "q" in envs.lowpass ) {
					GSUsetValueAtTime( key.$lowpassEnvNode.Q, envs.lowpass.q, 0 );
				}
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
		if ( allBlocks.length > 0 ) {
			const blocks = allBlocks.filter( ( [ , blc ] ) => ( blc.when + blc.duration ) / this.#bps >= off ); // 1.

			if ( blocks.length > 0 ) {
				const firstWhen = allBlocks[ 0 ][ 1 ].when;
				const firstWhe2 = blocks[ 0 ][ 1 ].when;
				const diffWhen = firstWhe2 - firstWhen;
				const off2 = off - diffWhen / this.#bps;

				return this.#startKey2( blocks, when, off2, dur );
			}
		}
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
		const envLP = this.#data.envs.lowpass;
		const lfoG = this.#data.lfos.gain;
		const lfoD = this.#data.lfos.detune;
		const oscs = this.#data.oscillators;
		const gainLFOvariations = [];
		const detuneLFOvariations = [];
		const maxDetune = 144 * 100;
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
			$noiseNodes: {},
			$oscNodes: new Map(),
			$gainEnv: new gswaEnvelope( ctx, "gain" ),
			$gainEnvNode: ctx.createGain(),
			$detuneEnv: new gswaEnvelope( ctx, "detune" ),
			$lowpassEnv: new gswaEnvelope( ctx, "lowpass" ),
			$lowpassEnvNode: ctx.createBiquadFilter(),
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
							prev.lowpass * maxDetune,
							blc.lowpass * maxDetune,
						],
						highpass: [
							-prev.highpass * maxDetune,
							-blc.highpass * maxDetune,
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
		GSUsetValueAtTime( key.$gainNode.gain, key.$gain, atTime );
		GSUsetValueAtTime( key.$lowpassNode.frequency, 10, atTime );
		GSUsetValueAtTime( key.$highpassNode.frequency, this.#nyquist, atTime );
		GSUsetValueAtTime( key.$lowpassNode.detune, key.$lowpass * maxDetune, atTime );
		GSUsetValueAtTime( key.$highpassNode.detune, -key.$highpass * maxDetune, atTime );
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
		key.$lowpassEnv.$start( {
			toggle: envLP.toggle,
			when: when - off,
			duration: dur + off,
			amp: maxDetune,
			attack: envLP.attack / bps,
			hold: envLP.hold / bps,
			decay: envLP.decay / bps,
			sustain: envLP.sustain,
			release: envLP.release / bps,
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
		this.#createNoiseNodes( key );
		Object.entries( oscs ).forEach( ( [ id, osc ], i ) => key.$oscNodes.set( id, this.#createOscNode( key, osc, i, envG ) ) );
		this.#scheduleVariations( key );
		GSUsetValueAtTime( key.$gainEnvNode.gain, 0, 0 );
		GSUsetValueAtTime( key.$lowpassEnvNode.frequency, 10, 0 );
		GSUsetValueAtTime( key.$lowpassEnvNode.detune, 0, 0 );
		GSUsetValueAtTime( key.$lowpassEnvNode.Q, envLP.q, 0 );
		key.$lowpassEnvNode.type = "lowpass";
		key.$gainEnv.$node.connect( key.$gainEnvNode.gain );
		key.$gainLFO.$node.connect( key.$gainLFOtarget.gain );
		key.$lowpassEnv.$node.connect( key.$lowpassEnvNode.detune );
		if ( envLP.toggle ) {
			key.$gainLFOtarget
				.connect( key.$lowpassEnvNode )
				.connect( key.$gainEnvNode );
		} else {
			key.$gainLFOtarget
				.connect( key.$gainEnvNode )
		}
		key.$gainEnvNode
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
				key.$lowpassEnv.$stop();
				setTimeout( this.#stopKey.bind( this, id ), ( this.#data.envs.gain.release + .1 ) / this.#bps * 1000 );
			}
		} else {
			console.error( "gswaSynth: stopKey id invalid", id );
		}
	}
	#stopKey( id ) {
		const key = this.#startedKeys.get( id );

		this.#destroyNoiseNodes( key );
		key.$oscNodes.forEach( this.#destroyOscNode, this );
		key.$gainLFO.$destroy();
		key.$detuneLFO.$destroy();
		key.$gainEnv.$destroy();
		key.$detuneEnv.$destroy();
		key.$lowpassEnv.$destroy();
		this.#startedKeys.delete( id );
	}

	// ..........................................................................
	#scheduleVariations( key ) {
		key.$variations.forEach( va => {
			const when = key.$when - key.$off + va.when;
			const dur = Math.max( .00001, va.duration );

			if ( when > this.$ctx.currentTime ) {
				key.$oscNodes.forEach( ( nodes, oscId ) => this.#oscChangeProp( this.#data.oscillators[ oscId ], nodes, "frequency", va.midi, when, dur ) );
				key.$panNode.$setValueCurveAtTime( va.pan, when, dur );
				GSUsetValueCurveAtTime( key.$gainNode.gain, va.gain, when, dur );
				GSUsetValueCurveAtTime( key.$lowpassNode.detune, va.lowpass, when, dur );
				GSUsetValueCurveAtTime( key.$highpassNode.detune, va.highpass, when, dur );
			}
		} );
	}

	// ..........................................................................
	#createNoiseNodes( key ) {
		const d = this.#data;

		if ( d.noise.toggle ) {
			const now = this.$ctx.currentTime;
			const dur = key.$dur + d.envs.gain.release / this.#bps;
			const panNode = new gswaStereoPanner( this.$ctx );
			const gainNode = this.$ctx.createGain();
			const absn = gswaNoise.$startABSN( this.$ctx, key.$when, dur, d.noise.color );

			key.$noiseNodes.absn = absn;
			key.$noiseNodes.panNode = panNode;
			key.$noiseNodes.gainNode = gainNode;
			panNode.$setValueAtTime( d.noise.pan, now );
			GSUsetValueAtTime( gainNode.gain, d.noise.gain, now );
			absn.connect( panNode.$getInput() );
			panNode.$connect( gainNode ).connect( key.$gainLFOtarget );
		}
	}
	#destroyNoiseNodes( key ) {
		key.$noiseNodes.absn?.stop();
	}
	#createOscNode( key, osc, ind, env ) {
		const now = this.$ctx.currentTime;
		const uniNodes = [];
		const panNode = new gswaStereoPanner( this.$ctx );
		const gainNode = this.$ctx.createGain();
		const dur = key.$dur + env.release / this.#bps;
		const nodes = Object.seal( {
			uniNodes,
			panNode,
			gainNode,
		} );

		panNode.$setValueAtTime( osc.pan, now );
		GSUsetValueAtTime( gainNode.gain, osc.gain, now );
		panNode.$connect( gainNode ).connect( key.$gainLFOtarget );
		for ( let i = 0; i < osc.unisonvoices; ++i ) {
			const uniGain = this.$ctx.createGain();
			const uniSrc = new gswaOscillator( this.$ctx );

			uniSrc.$connect( uniGain ).connect( panNode.$getInput() );
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
		uniNodes.forEach( n => {
			n[ 0 ].$connectToDetune( key.$detuneEnv.$node );
			n[ 0 ].$connectToDetune( key.$detuneLFO.$node );
		} );

		const orderOffset = .0000001 * ind; // 2.
		const phazeOffset = 1 / gswaSynth.#getHz( key.$midi ) * osc.phaze;

		uniNodes.forEach( n => n[ 0 ].$start( key.$when + phazeOffset + orderOffset ) );
		if ( Number.isFinite( dur ) ) {
			uniNodes.forEach( n => n[ 0 ].$stop( key.$when + dur ) );
		}
		return nodes;
	}
	#destroyOscNode( nodes ) {
		nodes.uniNodes.forEach( n => n[ 0 ].$stop() );
	}
	#oscChangeProp( osc, nodes, prop, val, when, dur ) {
		const uniNodes = nodes.uniNodes;

		switch ( prop ) {
			case "source": {
				const buf = this.$getAudioBuffer( val );

				uniNodes.forEach( n => n[ 0 ].$buffer = buf );
			} break;
			case "wave": uniNodes.forEach( n => n[ 0 ].$type = val ); break;
			case "detune":
			case "unisondetune": uniNodes.forEach( ( n, i ) => n[ 0 ].$setDetuneAtTime( gswaSynth.#calcUnisonDetune( osc, val, i ), when ) ); break;
			case "unisonblend":  uniNodes.forEach( ( n, i ) => GSUsetValueAtTime( n[ 1 ].gain, gswaSynth.#calcUnisonGain(   osc, val, i ), when ) ); break;
			case "frequency":
				if ( osc.source ) {
					dur
						? uniNodes.forEach( ( n, i ) => n[ 0 ].$setDetuneCurveAtTime( gswaSynth.#calcUnisonDetune( osc, val, i ), when, dur ) )
						: uniNodes.forEach( ( n, i ) => n[ 0 ].$setDetuneAtTime(      gswaSynth.#calcUnisonDetune( osc, val, i ), when ) );
				} else {
					const val2 = Array.isArray( val )
						? [
							gswaSynth.#getHz( val[ 0 ] ),
							gswaSynth.#getHz( val[ 1 ] ),
						]
						: gswaSynth.#getHz( val );

					dur
						? uniNodes.forEach( n => n[ 0 ].$setFrequencyCurveAtTime( val2, when, dur ) )
						: uniNodes.forEach( n => n[ 0 ].$setFrequencyAtTime( val2, when ) );
				}
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
				: [ det, det ];
		}
		if ( typeof midi === "number" ) {
			return det + ( midi - ( 72 - 12 ) ) * 100;
		}
		return [
			det + ( midi[ 0 ] - ( 72 - 12 ) ) * 100,
			det + ( midi[ 1 ] - ( 72 - 12 ) ) * 100,
		];
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
3. Forcing the wave change.
*/
