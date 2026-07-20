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
		this.#oscCrud( obj.oscillators, ctx );
		GSUdiffAssign( this.#data, obj );
		if ( obj.noise ) {
			this.#changeNoise( ctx, obj.noise );
		}
		if ( obj.envs || obj.lfos ) {
			this.#changeEnvsLfos( obj );
		}
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
			const keys = { keys: this.#createKeys( allBlocks, when ) };

			this.#oscList.forEach( o => {
				if ( !o.$ready ) {
					this.#setOscWave( o, this.#data.oscillators[ o.$id ].wave );
					this.#setOscSource( o, this.#data.oscillators[ o.$id ].source );
				}
				o.$waOsc.$oscPushNote( id, keys, when, off, dur );
			} );
			return id;
		}
	}
	#createKeys( blcs, when ) {
		return blcs.map( ( [ , blc ] ) => ( {
			when: when + ( blc.when - blcs[ 0 ][ 1 ].when ) / this.#bps,
			duration: blc.duration / this.#bps,
			frequency: gswaSynth.#getHz( blc.key ),
			gain: blc.gain,
			pan: blc.pan,
			lowpass: blc.lowpass,
			highpass: blc.highpass,
			lfoGainAmp: blc.gainLFOAmp,
			lfoGainFrequency: blc.gainLFOSpeed,
		} ) );
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
				case "wavetable":
				case "wave": this.#setOscWave( o, val ); break;
				case "source": this.#setOscSource( o, val ); break;
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
	#changeNoise( ctx, obj ) {
		if ( obj.toggle !== undefined ) {
			obj.toggle
				? this.#addOsc( ctx, "noise", this.#data.noise )
				: this.#removeOsc( ctx, "noise" );
		} else if ( this.#oscList.has( "noise" ) ) {
			this.#changeOsc( ctx, "noise", obj );
		}
	}
	#changeEnvsLfos( obj ) {
		const d = this.#data;
		const bps = this.#bps;
		const envGn = d.envs.gain;
		const envDt = d.envs.detune;
		const envLp = d.envs.lowpass;
		const envWt = d.envs.wtpos;
		const lfoGn = d.lfos.gain;
		const lfoDt = d.lfos.detune;

		this.#oscList.forEach( o => {
			if ( obj.envs?.gain ) {
				GSUaudioParamSet( o.$waOsc.$envGnAtt, envGn.toggle ? envGn.attack / bps  : 0 );
				GSUaudioParamSet( o.$waOsc.$envGnHld, envGn.toggle ? envGn.hold / bps    : 0 );
				GSUaudioParamSet( o.$waOsc.$envGnDec, envGn.toggle ? envGn.decay / bps   : 0 );
				GSUaudioParamSet( o.$waOsc.$envGnSus, envGn.toggle ? envGn.sustain       : 1 );
				GSUaudioParamSet( o.$waOsc.$envGnRel, envGn.toggle ? envGn.release / bps : 0 );
			}
			if ( obj.envs?.detune ) {
				GSUaudioParamSet( o.$waOsc.$envDtAtt, envDt.toggle ? envDt.attack / bps  : 0 );
				GSUaudioParamSet( o.$waOsc.$envDtHld, envDt.toggle ? envDt.hold / bps    : 0 );
				GSUaudioParamSet( o.$waOsc.$envDtDec, envDt.toggle ? envDt.decay / bps   : 0 );
				GSUaudioParamSet( o.$waOsc.$envDtSus, envDt.toggle ? envDt.sustain       : 0 );
				GSUaudioParamSet( o.$waOsc.$envDtRel, envDt.toggle ? envDt.release / bps : 0 );
				GSUaudioParamSet( o.$waOsc.$envDtAmp, envDt.toggle ? envDt.amp * 100     : 0 );
			}
			if ( obj.envs?.lowpass ) {
				GSUaudioParamSet( o.$waOsc.$envLpAtt, envLp.toggle ? envLp.attack / bps  :    0 );
				GSUaudioParamSet( o.$waOsc.$envLpHld, envLp.toggle ? envLp.hold / bps    :    0 );
				GSUaudioParamSet( o.$waOsc.$envLpDec, envLp.toggle ? envLp.decay / bps   :    0 );
				GSUaudioParamSet( o.$waOsc.$envLpSus, envLp.toggle ? envLp.sustain       :    1 );
				GSUaudioParamSet( o.$waOsc.$envLpRel, envLp.toggle ? envLp.release / bps : 9999 );
				GSUaudioParamSet( o.$waOsc.$envLpQ,   envLp.toggle ? envLp.q             :    0 );
			}
			if ( obj.envs?.wtpos ) {
				GSUaudioParamSet( o.$waOsc.$envWtAtt, envWt.toggle ? envWt.attack / bps  :    0 );
				GSUaudioParamSet( o.$waOsc.$envWtHld, envWt.toggle ? envWt.hold / bps    :    0 );
				GSUaudioParamSet( o.$waOsc.$envWtDec, envWt.toggle ? envWt.decay / bps   :    0 );
				GSUaudioParamSet( o.$waOsc.$envWtSus, envWt.toggle ? envWt.sustain       :    0 );
				GSUaudioParamSet( o.$waOsc.$envWtRel, envWt.toggle ? envWt.release / bps : 9999 );
			}
			if ( obj.lfos?.gain ) {
				GSUaudioParamSet( o.$waOsc.$lfoGnWav, lfoGn.toggle ? gswaOsc.$lfoWaveToIndex[ lfoGn.type ] : 0 );
				GSUaudioParamSet( o.$waOsc.$lfoGnDel, lfoGn.toggle ? lfoGn.delay / bps  : 0 );
				GSUaudioParamSet( o.$waOsc.$lfoGnAtt, lfoGn.toggle ? lfoGn.attack / bps : 0 );
				GSUaudioParamSet( o.$waOsc.$lfoGnFrq, lfoGn.toggle ? lfoGn.speed * bps  : 0 );
				GSUaudioParamSet( o.$waOsc.$lfoGnAmp, lfoGn.toggle ? lfoGn.amp          : 0 );
			}
			if ( obj.lfos?.detune ) {
				GSUaudioParamSet( o.$waOsc.$lfoDtWav, lfoDt.toggle ? gswaOsc.$lfoWaveToIndex[ lfoDt.type ] : 0 );
				GSUaudioParamSet( o.$waOsc.$lfoDtDel, lfoDt.toggle ? lfoDt.delay / bps  : 0 );
				GSUaudioParamSet( o.$waOsc.$lfoDtAtt, lfoDt.toggle ? lfoDt.attack / bps : 0 );
				GSUaudioParamSet( o.$waOsc.$lfoDtFrq, lfoDt.toggle ? lfoDt.speed * bps  : 0 );
				GSUaudioParamSet( o.$waOsc.$lfoDtAmp, lfoDt.toggle ? lfoDt.amp * 100    : 0 );
			}
		} );
	}
}

Object.freeze( gswaSynth );
