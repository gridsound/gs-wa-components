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
	static #envs = GSUdeepFreeze( {
		//          A  H  D  S     R  ?
		$gain:    [ 0, 0, 0, 1,    0,   ],
		$detune:  [ 0, 0, 0, 0,    0, 0 ],
		$lowpass: [ 0, 0, 0, 1, 9999, 0 ],
		$wtpos:   [ 0, 0, 0, 0,    0,   ],
	} );

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
			this.#removeOsc( prevCtx, "noise" );
		}
		this.$output = GSUaudioGain( ctx );
		oscs.forEach( kv => this.#addOsc( ctx, ...kv ) );
		this.#changeNoise( ctx, this.#data.noise );
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
			this.#oscList.forEach( o => this.#changeEnvsLfos( obj, o ) );
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
		this.#changeEnvsLfos( this.#data, o );
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
				case "detune": GSUaudioParamSet( waOsc.$detune, ( val + osc.detunefine ) ); break;
				case "detunefine": GSUaudioParamSet( waOsc.$detune, ( osc.detune + val ) ); break;
				case "unisonvoices": GSUaudioParamSet( waOsc.$unisonvoices, val ); break;
				case "unisondetune": GSUaudioParamSet( waOsc.$unisondetune, val ); break;
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
	#changeEnvsLfos( obj, o ) {
		const d = this.#data;
		const bps = this.#bps;
		const def = gswaSynth.#envs;
		const waEnvs = o.$waOsc.$envs;
		const waLfos = o.$waOsc.$lfos;

		obj.envs?.gain    && gswaSynth.#setEnv( bps, waEnvs.$gain,    d.envs.gain,    def.$gain );
		obj.envs?.detune  && gswaSynth.#setEnv( bps, waEnvs.$detune,  d.envs.detune,  def.$detune, d.envs.detune.amp );
		obj.envs?.lowpass && gswaSynth.#setEnv( bps, waEnvs.$lowpass, d.envs.lowpass, def.$lowpass, d.envs.lowpass.q );
		obj.envs?.wtpos   && gswaSynth.#setEnv( bps, waEnvs.$wtpos,   d.envs.wtpos,   def.$wtpos );
		obj.lfos?.pan     && gswaSynth.#setLfo( bps, waLfos.$pan,     d.lfos.pan      );
		obj.lfos?.gain    && gswaSynth.#setLfo( bps, waLfos.$gain,    d.lfos.gain     );
		obj.lfos?.detune  && gswaSynth.#setLfo( bps, waLfos.$detune,  d.lfos.detune   );
		obj.lfos?.wtpos   && gswaSynth.#setLfo( bps, waLfos.$wtpos,   d.lfos.wtpos    );
	}
	static #setEnv( bps, waParams, env, def, addValue ) {
		const ok = env.toggle;

		GSUaudioParamSet( waParams[ 0 ], ok ? env.attack  / bps : def[ 0 ] );
		GSUaudioParamSet( waParams[ 1 ], ok ? env.hold    / bps : def[ 1 ] );
		GSUaudioParamSet( waParams[ 2 ], ok ? env.decay   / bps : def[ 2 ] );
		GSUaudioParamSet( waParams[ 3 ], ok ? env.sustain       : def[ 3 ] );
		GSUaudioParamSet( waParams[ 4 ], ok ? env.release / bps : def[ 4 ] );
		if ( addValue !== undefined ) {
			GSUaudioParamSet( waParams[ 5 ], ok ? addValue : def[ 5 ] );
		}
	}
	static #setLfo( bps, waParams, lfo ) {
		const ok = lfo.toggle;

		GSUaudioParamSet( waParams[ 0 ], ok ? gswaOsc.$lfoWaveToIndex[ lfo.type ] : 0 );
		GSUaudioParamSet( waParams[ 1 ], ok ? lfo.delay / bps  : 0 );
		GSUaudioParamSet( waParams[ 2 ], ok ? lfo.attack / bps : 0 );
		GSUaudioParamSet( waParams[ 3 ], ok ? lfo.speed * bps  : 0 );
		GSUaudioParamSet( waParams[ 4 ], ok ? lfo.amp          : 0 );
	}
}

Object.freeze( gswaSynth );
