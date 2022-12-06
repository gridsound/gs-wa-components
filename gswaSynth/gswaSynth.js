"use strict";

class gswaSynth {
	static #nativeTypes = Object.freeze( [ "sine", "triangle", "sawtooth", "square" ] );
	static #startedMaxId = 0;
	$ctx = null;
	$output = null;
	#nyquist = 24000;
	#data = DAWCoreJSON.synth();
	#oscsCrud = DAWCoreUtils.$createUpdateDelete.bind( null, this.#data.oscillators,
		this.#addOsc.bind( this ),
		this.#changeOsc.bind( this ),
		this.#removeOsc.bind( this ) );
	#bps = 1;
	#startedKeys = new Map();

	constructor() {
		Object.seal( this );
	}

	// .........................................................................
	static #getHz( key ) {
		return 440 * ( 2 ** ( ( key - 57 ) / 12 ) );
	}

	// .........................................................................
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
		DAWCoreUtils.$deepAssign( this.#data, obj );
		if ( obj.env ) {
			this.#changeEnv( obj.env );
		}
		if ( obj.lfo ) {
			this.#changeLFO( obj.lfo );
		}
		if ( obj.oscillators ) {
			this.#oscsCrud( obj.oscillators );
		}
	}

	// .........................................................................
	#removeOsc( id ) {
		this.#startedKeys.forEach( key => {
			this.#destroyOscNode( key.oscNodes.get( id ) );
			key.oscNodes.delete( id );
		} );
	}
	#addOsc( id ) {
		this.#startedKeys.forEach( k => k.oscNodes.set( id, this.#createOscNode( k, id ) ) );
	}
	#changeOsc( id, obj ) {
		const now = this.$ctx.currentTime;
		const objEnt = Object.entries( obj );

		this.#startedKeys.forEach( key => {
			const nodes = key.oscNodes.get( id );

			objEnt.forEach( ( [ prop, val ] ) => {
				switch ( prop ) {
					case "type": this.#nodeOscSetType( nodes.oscNode, val ); break;
					case "pan": nodes.panNode.pan.setValueAtTime( val, now ); break;
					case "gain": nodes.gainNode.gain.setValueAtTime( val, now ); break;
					case "detune": nodes.oscNode.detune.setValueAtTime( val * 100, now ); break;
				}
			} );
		} );
	}
	#changeEnv( obj ) {
		this.#startedKeys.forEach( key => {
			const nobj = { ...obj };

			if ( "hold" in nobj ) { nobj.hold /= this.#bps; }
			if ( "decay" in nobj ) { nobj.decay /= this.#bps; }
			if ( "attack" in nobj ) { nobj.attack /= this.#bps; }
			if ( "release" in nobj ) { nobj.release /= this.#bps; }
			key.gainEnvNode.$start( nobj );
		} );
	}
	#changeLFO( obj ) {
		const nobj = { ...obj };

		if ( "delay" in nobj ) { nobj.delay /= this.#bps; }
		if ( "attack" in nobj ) { nobj.attack /= this.#bps; }
		if ( "amp" in nobj ) {
			nobj.absoluteAmp = nobj.amp;
			delete nobj.amp;
		}
		if ( "speed" in nobj ) {
			nobj.absoluteSpeed = nobj.speed * this.#bps;
			delete nobj.speed;
		}
		this.#startedKeys.forEach( key => key.gainLFO.$change( nobj ) );
	}

	// .........................................................................
	$startKey( blocks, when, off, dur ) {
		const id = ++gswaSynth.#startedMaxId;
		const blc0 = blocks[ 0 ][ 1 ];
		const blcLast = blocks[ blocks.length - 1 ][ 1 ];
		const blc0when = blc0.when;
		const atTime = when - off;
		const ctx = this.$ctx;
		const bps = this.#bps;
		const env = this.#data.env;
		const lfo = this.#data.lfo;
		const oscs = this.#data.oscillators;
		const lfoVariations = [];
		const gainLFOtarget = ctx.createGain();
		const key = Object.freeze( {
			when,
			off,
			dur,
			pan: blc0.pan,
			midi: blc0.key,
			gain: blc0.gain,
			lowpass: blc0.lowpass,
			highpass: blc0.highpass,
			attack: blc0.attack / bps || .005,
			release: blcLast.release / bps || .005,
			variations: [],
			oscNodes: new Map(),
			gainEnvNode: new gswaEnvelope( ctx ),
			gainLFO: new gswaLFO( ctx, gainLFOtarget.gain ),
			gainLFOtarget,
			gainNode: ctx.createGain(),
			panNode: ctx.createStereoPanner(),
			lowpassNode: ctx.createBiquadFilter(),
			highpassNode: ctx.createBiquadFilter(),
		} );

		if ( blocks.length > 1 ) {
			blocks.reduce( ( prev, [ , blc ] ) => {
				if ( prev ) {
					const prevWhen = prev.when - blc0when;
					const when = ( prevWhen + prev.duration ) / bps;
					const duration = ( blc.when - blc0when ) / bps - when;

					key.variations.push( {
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
					lfoVariations.push( {
						when,
						duration,
						amp: [ prev.gainLFOAmp, blc.gainLFOAmp ],
						speed: [ prev.gainLFOSpeed, blc.gainLFOSpeed ],
					} );
				}
				return blc;
			}, null );
		}
		key.lowpassNode.type = "lowpass";
		key.highpassNode.type = "highpass";
		key.panNode.pan.setValueAtTime( key.pan, atTime );
		key.gainNode.gain.setValueAtTime( key.gain, atTime );
		key.lowpassNode.frequency.setValueAtTime( this.#calcLowpass( key.lowpass ), atTime );
		key.highpassNode.frequency.setValueAtTime( this.#calcHighpass( key.highpass ), atTime );
		key.gainEnvNode.$start( {
			toggle: env.toggle,
			when: when - off,
			duration: dur + off,
			attack: env.attack / bps,
			hold: env.hold / bps,
			decay: env.decay / bps,
			sustain: env.sustain,
			release: env.release / bps,
		} );
		key.gainLFO.$start( {
			toggle: lfo.toggle,
			when,
			whenStop: Number.isFinite( dur ) ? when + dur + env.release / bps : 0,
			offset: off,
			type: lfo.type,
			delay: lfo.delay / bps,
			attack: lfo.attack / bps,
			absoluteAmp: lfo.amp,
			absoluteSpeed: lfo.speed * bps,
			amp: blc0.gainLFOAmp,
			speed: blc0.gainLFOSpeed,
			variations: lfoVariations,
		} );
		Object.keys( oscs ).forEach( id => key.oscNodes.set( id, this.#createOscNode( key, id ) ) );
		this.#scheduleVariations( key );
		key.gainLFOtarget
			.connect( key.gainEnvNode.node )
			.connect( key.gainNode )
			.connect( key.panNode )
			.connect( key.lowpassNode )
			.connect( key.highpassNode )
			.connect( this.$output );
		this.#startedKeys.set( id, key );
		return id;
	}

	// .........................................................................
	$stopAllKeys() {
		this.#startedKeys.forEach( ( key, id ) => this.$stopKey( id ) );
	}
	$stopKey( id ) {
		const key = this.#startedKeys.get( id );

		if ( key ) {
			if ( Number.isFinite( key.dur ) ) {
				this.#stopKey( id );
			} else {
				key.gainEnvNode.$destroy();
				setTimeout( this.#stopKey.bind( this, id ), ( this.#data.env.release + .1 ) / this.#bps * 1000 );
			}
		} else {
			console.error( "gswaSynth: stopKey id invalid", id );
		}
	}
	#stopKey( id ) {
		const key = this.#startedKeys.get( id );

		key.oscNodes.forEach( this.#destroyOscNode, this );
		key.gainLFO.$destroy();
		key.gainEnvNode.$destroy();
		this.#startedKeys.delete( id );
	}

	// .........................................................................
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

	// .........................................................................
	#scheduleVariations( key ) {
		key.variations.forEach( va => {
			const when = key.when - key.off + va.when;
			const dur = va.duration;
			const freqArr = new Float32Array( [
				gswaSynth.#getHz( va.midi[ 0 ] ),
				gswaSynth.#getHz( va.midi[ 1 ] )
			] );

			if ( when > this.$ctx.currentTime && dur > 0 ) {
				key.oscNodes.forEach( nodes => nodes.oscNode.frequency.setValueCurveAtTime( freqArr, when, dur ) );
				key.panNode.pan.setValueCurveAtTime( new Float32Array( va.pan ), when, dur );
				key.gainNode.gain.setValueCurveAtTime( new Float32Array( va.gain ), when, dur );
				key.lowpassNode.frequency.setValueCurveAtTime( new Float32Array( va.lowpass ), when, dur );
				key.highpassNode.frequency.setValueCurveAtTime( new Float32Array( va.highpass ), when, dur );
			}
		} );
	}

	// .........................................................................
	#createOscNode( key, id ) {
		const atTime = key.when - key.off;
		const env = this.#data.env;
		const osc = this.#data.oscillators[ id ];
		const oscNode = this.$ctx.createOscillator();
		const panNode = this.$ctx.createStereoPanner();
		const gainNode = this.$ctx.createGain();
		const nodes = Object.freeze( {
			oscNode,
			panNode,
			gainNode,
		} );

		this.#nodeOscSetType( oscNode, osc.type );
		oscNode.detune.setValueAtTime( osc.detune * 100, atTime );
		oscNode.frequency.setValueAtTime( gswaSynth.#getHz( key.midi ), atTime );
		panNode.pan.setValueAtTime( osc.pan, atTime );
		gainNode.gain.setValueAtTime( osc.gain, atTime );
		oscNode
			.connect( panNode )
			.connect( gainNode )
			.connect( key.gainLFOtarget );
		oscNode.start( key.when );
		if ( Number.isFinite( key.dur ) ) {
			oscNode.stop( key.when + key.dur + env.release / this.#bps );
		}
		return nodes;
	}
	#destroyOscNode( nodes ) {
		nodes.oscNode.stop();
		// nodes.oscNode.disconnect();
	}
	#nodeOscSetType( oscNode, type ) {
		if ( gswaSynth.#nativeTypes.indexOf( type ) > -1 ) {
			oscNode.type = type;
		} else {
			oscNode.setPeriodicWave( gswaPeriodicWaves.$get( this.$ctx, type ) );
		}
	}
}

Object.freeze( gswaSynth );
