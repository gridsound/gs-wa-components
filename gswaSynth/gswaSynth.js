"use strict";

class gswaSynth {
	ctx = null
	output = null
	nyquist = 24000
	gsdata = new DAWCore.controllers.synth( {
		dataCallbacks: {
			addOsc: this.#addOsc.bind( this ),
			removeOsc: this.#removeOsc.bind( this ),
			changeOsc: this.#changeOsc.bind( this ),
			changeEnv: this.#changeEnv.bind( this ),
			changeLFO: this.#changeLFO.bind( this ),
		},
	} )
	#bps = 1
	#startedKeys = new Map()

	constructor() {
		Object.seal( this );
	}

	// .........................................................................
	setContext( ctx ) {
		this.stopAllKeys();
		this.ctx = ctx;
		this.nyquist = ctx.sampleRate / 2;
		this.output = ctx.createGain();
		this.gsdata.recall();
	}
	setBPM( bpm ) {
		this.#bps = bpm / 60;
	}
	change( obj ) {
		this.gsdata.change( obj );
	}

	// .........................................................................
	#removeOsc( id ) {
		this.#startedKeys.forEach( key => {
			this.#destroyOscNode( key.oscNodes.get( id ) );
			key.oscNodes.delete( id );
		} );
	}
	#addOsc( id, osc ) {
		this.#startedKeys.forEach( k => k.oscNodes.set( id, this.#createOscNode( k, id ) ) );
	}
	#changeOsc( id, obj ) {
		const now = this.ctx.currentTime,
			objEnt = Object.entries( obj );

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
			key.gainEnvNode.start( nobj );
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
		this.#startedKeys.forEach( key => key.LFONode.change( nobj ) );
	}

	// .........................................................................
	startKey( blocks, when, off, dur ) {
		const id = ++gswaSynth._startedMaxId.value,
			blc0 = blocks[ 0 ][ 1 ],
			blcLast = blocks[ blocks.length - 1 ][ 1 ],
			blc0when = blc0.when,
			atTime = when - off,
			ctx = this.ctx,
			bps = this.#bps,
			env = this.gsdata.data.env,
			lfo = this.gsdata.data.lfo,
			oscs = this.gsdata.data.oscillators,
			lfoVariations = [],
			key = Object.freeze( {
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
				LFONode: new gswaLFO( ctx ),
				gainNode: ctx.createGain(),
				panNode: ctx.createStereoPanner(),
				lowpassNode: ctx.createBiquadFilter(),
				highpassNode: ctx.createBiquadFilter(),
			} );

		if ( blocks.length > 1 ) {
			blocks.reduce( ( prev, [ , blc ] ) => {
				if ( prev ) {
					const prevWhen = prev.when - blc0when,
						when = ( prevWhen + prev.duration ) / bps,
						duration = ( blc.when - blc0when ) / bps - when;

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
		key.gainEnvNode.start( {
			toggle: env.toggle,
			when: when - off,
			duration: dur + off,
			attack: env.attack / bps,
			hold: env.hold / bps,
			decay: env.decay / bps,
			sustain: env.sustain,
			release: env.release / bps,
		} );
		key.LFONode.start( {
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
		key.LFONode.node
			.connect( key.gainEnvNode.node )
			.connect( key.gainNode )
			.connect( key.panNode )
			.connect( key.lowpassNode )
			.connect( key.highpassNode )
			.connect( this.output );
		this.#startedKeys.set( id, key );
		return id;
	}

	// .........................................................................
	stopAllKeys() {
		this.#startedKeys.forEach( ( key, id ) => this.stopKey( id ) );
	}
	stopKey( id ) {
		const key = this.#startedKeys.get( id );

		if ( key ) {
			if ( Number.isFinite( key.dur ) ) {
				this.#stopKey( id );
			} else {
				key.gainEnvNode.destroy();
				setTimeout( this.#stopKey.bind( this, id ), ( this.gsdata.data.env.release + .1 ) / this.#bps * 1000 );
			}
		} else {
			console.error( "gswaSynth: stopKey id invalid", id );
		}
	}
	#stopKey( id ) {
		const key = this.#startedKeys.get( id );

		key.oscNodes.forEach( this.#destroyOscNode, this );
		key.LFONode.destroy();
		key.gainEnvNode.destroy();
		this.#startedKeys.delete( id );
	}

	// .........................................................................
	#calcLowpass( val ) {
		return this.#calcExp( val, this.nyquist, 2 );
	}
	#calcHighpass( val ) {
		return this.#calcExp( 1 - val, this.nyquist, 3 );
	}
	#calcExp( x, total, exp ) {
		return exp === 0
			? x
			: Math.expm1( x ) ** exp / ( ( Math.E - 1 ) ** exp ) * total;
	}

	// .........................................................................
	#scheduleVariations( key ) {
		key.variations.forEach( va => {
			const when = key.when - key.off + va.when,
				dur = va.duration,
				freqArr = new Float32Array( [
					gswaSynth.midiKeyToHz[ va.midi[ 0 ] ],
					gswaSynth.midiKeyToHz[ va.midi[ 1 ] ]
				] );

			if ( when > this.ctx.currentTime && dur > 0 ) {
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
		const atTime = key.when - key.off,
			env = this.gsdata.data.env,
			osc = this.gsdata.data.oscillators[ id ],
			oscNode = this.ctx.createOscillator(),
			panNode = this.ctx.createStereoPanner(),
			gainNode = this.ctx.createGain(),
			nodes = Object.freeze( {
				oscNode,
				panNode,
				gainNode,
			} );

		this.#nodeOscSetType( oscNode, osc.type );
		oscNode.detune.setValueAtTime( osc.detune * 100, atTime );
		oscNode.frequency.setValueAtTime( gswaSynth.midiKeyToHz[ key.midi ], atTime );
		panNode.pan.setValueAtTime( osc.pan, atTime );
		gainNode.gain.setValueAtTime( osc.gain, atTime );
		oscNode
			.connect( panNode )
			.connect( gainNode )
			.connect( key.LFONode.node );
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
		if ( gswaSynth.nativeTypes.indexOf( type ) > -1 ) {
			oscNode.type = type;
		} else {
			oscNode.setPeriodicWave( gswaPeriodicWaves.get( this.ctx, type ) );
		}
	}
}

gswaSynth._startedMaxId = Object.seal( { value: 0 } );
gswaSynth.nativeTypes = Object.freeze( [ "sine", "triangle", "sawtooth", "square" ] );
gswaSynth.midiKeyToHz = [];

Object.freeze( gswaSynth );
