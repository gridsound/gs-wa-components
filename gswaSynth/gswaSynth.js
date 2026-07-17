"use strict";

class gswaSynth {
	static #maxId = 0;
	$getAudioBuffer = null;
	$output = null;
	#bps = 1;
	#data = GSUgetModel( "synth" );
	#oscList = new Map();
	#oscCrud = GSUcreateUpdateDelete.bind( null, this.#data.oscillators,
		this.#addOsc.bind( this ),
		this.#changeOsc.bind( this ),
		this.#removeOsc.bind( this ) );

	constructor() {
		Object.seal( this );
	}

	// ..........................................................................
	static #getHz( key ) {
		return 440 * ( 2 ** ( ( key - 57 ) / 12 ) );
	}

	// ..........................................................................
	$synSetContext( ctx, prevCtx ) {
		const oscs = Object.entries( this.#data.oscillators );

		if ( prevCtx ) {
			this.$synStopAllKeys();
			oscs.forEach( kv => this.#removeOsc( prevCtx, kv[ 0 ] ) );
		}
		this.$output = GSUaudioGain( ctx );
		oscs.forEach( kv => this.#addOsc( ctx, ...kv ) );
	}
	$synSetBPM( bpm ) {
		this.#bps = bpm / 60;
	}
	$synChange( ctx, obj ) {
		const d = this.#data;
		const envGn = d.envs.gain;
		const envDt = d.envs.detune;
		const envLp = d.envs.lowpass;
		const lfoGn = d.lfos.gain;
		const bps = this.#bps;
		const noise = obj.noise;

		this.#oscCrud( obj.oscillators, ctx );
		GSUdiffAssign( d, obj );
		if ( noise ) {
			if ( noise.toggle !== undefined ) {
				noise.toggle
					? this.#addOsc( ctx, "noise", d.noise )
					: this.#removeOsc( ctx, "noise" );
			} else if ( this.#oscList.has( "noise" ) ) {
				this.#changeOsc( ctx, "noise", noise );
			}
		}
		this.#oscList.forEach( o => {
			// envGn
			GSUaudioParamSet( o.$waOsc.$envGnAtt, envGn.toggle ? envGn.attack / bps  : 0 );
			GSUaudioParamSet( o.$waOsc.$envGnHld, envGn.toggle ? envGn.hold / bps    : 0 );
			GSUaudioParamSet( o.$waOsc.$envGnDec, envGn.toggle ? envGn.decay / bps   : 0 );
			GSUaudioParamSet( o.$waOsc.$envGnSus, envGn.toggle ? envGn.sustain       : 1 );
			GSUaudioParamSet( o.$waOsc.$envGnRel, envGn.toggle ? envGn.release / bps : 0 );
			// envDt
			GSUaudioParamSet( o.$waOsc.$envDtAtt, envDt.toggle ? envDt.attack / bps  : 0 );
			GSUaudioParamSet( o.$waOsc.$envDtHld, envDt.toggle ? envDt.hold / bps    : 0 );
			GSUaudioParamSet( o.$waOsc.$envDtDec, envDt.toggle ? envDt.decay / bps   : 0 );
			GSUaudioParamSet( o.$waOsc.$envDtSus, envDt.toggle ? envDt.sustain       : 0 );
			GSUaudioParamSet( o.$waOsc.$envDtRel, envDt.toggle ? envDt.release / bps : 0 );
			GSUaudioParamSet( o.$waOsc.$envDtAmp, envDt.toggle ? envDt.amp * 100     : 0 );
			// envLp
			GSUaudioParamSet( o.$waOsc.$envLpAtt, envLp.toggle ? envLp.attack / bps  : 0 );
			GSUaudioParamSet( o.$waOsc.$envLpHld, envLp.toggle ? envLp.hold / bps    : 0 );
			GSUaudioParamSet( o.$waOsc.$envLpDec, envLp.toggle ? envLp.decay / bps   : 0 );
			GSUaudioParamSet( o.$waOsc.$envLpSus, envLp.toggle ? envLp.sustain       : 1 );
			GSUaudioParamSet( o.$waOsc.$envLpRel, envLp.toggle ? envLp.release / bps : 0 );
			GSUaudioParamSet( o.$waOsc.$envLpQ,   envLp.toggle ? envLp.q             : 0 );
			// lfoGn
			GSUaudioParamSet( o.$waOsc.$lfoGnWav, lfoGn.toggle ? gswaOsc.$lfoWaveToIndex[ lfoGn.type ] : 0 );
			GSUaudioParamSet( o.$waOsc.$lfoGnDel, lfoGn.toggle ? lfoGn.delay / bps  : 0 );
			GSUaudioParamSet( o.$waOsc.$lfoGnAtt, lfoGn.toggle ? lfoGn.attack / bps : 0 );
			GSUaudioParamSet( o.$waOsc.$lfoGnFrq, lfoGn.toggle ? lfoGn.speed * bps  : 1 );
			GSUaudioParamSet( o.$waOsc.$lfoGnAmp, lfoGn.toggle ? lfoGn.amp          : 0 );
		} );
	}
	$synStopAllKeys() {
		this.#oscList.forEach( obj => obj.$waOsc.$oscClear() );
	}
	$synStopKey( id ) {
		this.#oscList.forEach( obj => obj.$waOsc.$oscPopNote( id ) );
	}
	$synStartKey( allBlocks, when, off, dur ) {
		if ( allBlocks.length > 0 ) { // ??
			const id = `${ ++gswaSynth.#maxId }`;
			const key = this.#createKey( allBlocks, when );

			this.#oscList.forEach( o => {
				if ( !o.$ready ) {
					this.#setOscWave( o, this.#data.oscillators[ o.$id ].wave );
					this.#setOscSource( o, this.#data.oscillators[ o.$id ].source );
				}
				o.$waOsc.$oscPushNote( id, key, when, off, dur );
			} );
			return id;
		}
	}

	// ..........................................................................
	#removeOsc( _ctx, id ) {
		this.#oscList.get( id )?.$waOsc.$oscKill();
		this.#oscList.delete( id );
	}
	#addOsc( ctx, id, osc ) {
		const waOsc = new gswaOsc( ctx );
		const o = {
			$id: id,
			$ready: !!osc.color,
			$waOsc: waOsc,
		};

		this.#oscList.set( id, o );
		this.#changeOsc2( o, osc, osc );
		waOsc.$oscConnect( this.$output );
	}
	#changeOsc( _ctx, id, obj ) {
		const o = this.#oscList.get( id );
		const osc = this.#data.oscillators[ id ];

		this.#changeOsc2( o, osc, obj );
	}
	#changeOsc2( o, osc, obj ) {
		const waOsc = o.$waOsc;

		GSUforEach( obj, ( val, prop ) => {
			switch ( prop ) {
				case "source": this.#setOscSource( o, val ); break;
				case "wave": this.#setOscWave( o, val ); break;
				case "color": o.$waOsc.$oscSource( "noise", val ); break;
				case "pan": GSUaudioParamSet( waOsc.$pan, val ); break;
				case "gain": GSUaudioParamSet( waOsc.$gain, val ); break;
				case "phaze": GSUaudioParamSet( waOsc.$phase, val ); break;
				case "detune": GSUaudioParamSet( waOsc.$detune, ( val + osc.detunefine ) * 100 ); break;
				case "detunefine": GSUaudioParamSet( waOsc.$detune, ( osc.detune + val ) * 100 ); break;
				case "unisonvoices": GSUaudioParamSet( waOsc.$unisonvoices, val ); break;
				case "unisondetune": GSUaudioParamSet( waOsc.$unisondetune, val * 100 ); break;
				case "unisonblend": GSUaudioParamSet( waOsc.$unisonblend, val ); break;
			}
		} );
	}
	#setOscSource( o, source ) {
		if ( source ) {
			const buf = this.$getAudioBuffer( source );

			o.$ready = !!buf;
			if ( buf ) {
				o.$waOsc.$oscSource( "buffer", ...gswaBuffers.$sabSetBuffer( source, buf ) );
			}
		}
	}
	#setOscWave( o, wave ) {
		if ( wave ) {
			const sab = gswaBuffers.$sabGetWavetable( wave );

			o.$ready = !!sab;
			if ( sab ) {
				o.$waOsc.$oscSource( "wavetable", sab );
			}
		}
	}

	// .........................................................................
	#createKey( blcs, when ) {
		const d = this.#data;
		const bps = this.#bps;
		const envLp = d.envs.lowpass;
		const lfoGn = d.lfos.gain;
		const lfoDt = d.lfos.detune;

		return {
			lfos: {
				detune: lfoDt.toggle && {
					wave: lfoDt.type,
					delay: lfoDt.delay / bps,
					attack: lfoDt.attack / bps,
					frequency: lfoDt.speed * bps,
					amp: lfoDt.amp * 100,
				},
			},
			keys: blcs.map( ( [ , blc ] ) => ( {
				when: when + ( blc.when - blcs[ 0 ][ 1 ].when ) / bps,
				duration: blc.duration / bps,
				frequency: gswaSynth.#getHz( blc.key ),
				gain: blc.gain,
				pan: blc.pan,
				lowpass: blc.lowpass,
				highpass: blc.highpass,
				lfoGainAmp: blc.gainLFOAmp,
				lfoGainFrequency: blc.gainLFOSpeed,
			} ) ),
		};
	}
}

Object.freeze( gswaSynth );
