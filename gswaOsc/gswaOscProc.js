"use strict";

class gswaOscProc extends AudioWorkletProcessor {
	static #wtdataHeaderSize = 4;
	static #filterCoefUpdateRate = 32;
	static #filterMinFreq = 20;
	static #unisonMaxVoices = 9;
	#ok = true;
	#keys = new Map();
	#wtdata = null; // SharedArrayBuffer [ N, L, 0, 0, ...N*L ]
	#wtdataN = 0;
	#wtdataL = 0;
	#currentTimeInt = 0;

	static get parameterDescriptors() {
		return [
			{ automationRate: "a-rate", name: "pan",          defaultValue: 0, minValue:   -1, maxValue:   1 },
			{ automationRate: "a-rate", name: "gain",         defaultValue: 1                                },
			{ automationRate: "a-rate", name: "phase",        defaultValue: 0, minValue:    0, maxValue:   1 },
			{ automationRate: "a-rate", name: "detune",       defaultValue: 0                                },
			{ automationRate: "a-rate", name: "unisonvoices", defaultValue: 1, minValue:    1, maxValue:   9 },
			{ automationRate: "a-rate", name: "unisondetune", defaultValue: 0, minValue:    0, maxValue: 200 },
			{ automationRate: "a-rate", name: "unisonblend",  defaultValue: 0, minValue:    0, maxValue:   1 },
		];
	}

	constructor( opt ) {
		super( opt );
		this.port.onmessage = this.#onmsg.bind( this );
	}

	#onmsg( e ) {
		const [ type, a0, a1 ] = e.data;

		switch ( type ) {
			case "kill":
				this.#ok = false;
				break;
			case "clear":
				this.#clear();
				break;
			case "wavetable":
				this.#wtdata = new Float32Array( a0 );
				this.port.postMessage( [ "ready" ] );
				break;
			case "push":
				this.#keys.set( a0, gswaOscProc.#format_new_key( a0, a1 ) );
				break;
		}
	}

	// .........................................................................
	#clear() {
		for ( const o of this.#keys.values() ) {
			if ( o.$_when >= currentTime || o.$_whenEnd <= currentTime ) {
				this.#keys.delete( o.$_id );
			} else if ( o.$_whenEnd > currentTime ) {
				o.$envs.$gain.$release = .1;
				o.$_whenEnd = currentTime + .1;
			}
		}
	}

	// .........................................................................
	static #format_new_key_coeff() {
		return {
			$counter: 0,
			$x1: 0, $x2: 0,
			$y1: 0, $y2: 0,
			$b0: 1, $b1: 0, $b2: 0,
			$a1: 0, $a2: 0,
		};
	}
	static #format_new_key( id, d ) {
		const klast = d.keys.at( -1 );
		const envGain = d.envs?.gain;
		const envDetune = d.envs?.detune;
		const envLP = d.envs?.lowpass;
		const lfoGain = d.lfos?.gain;
		const lfoDetune = d.lfos?.detune;
		const release = envGain?.release ?? .01;

		return {
			$_id: id,
			$_keyInd: 0,
			$_when: d.keys[ 0 ].when,
			$_whenEnd: klast.when + klast.duration + release,
			$_lp: gswaOscProc.#format_new_key_coeff(),
			$_hp: gswaOscProc.#format_new_key_coeff(),
			$_unisonPhase: new Float64Array( gswaOscProc.#unisonMaxVoices ),
			$_unisonPhaseB: new Float64Array( gswaOscProc.#unisonMaxVoices ),
			$envs: {
				$gain: {
					$attack: envGain?.attack ?? .01,
					$hold: envGain?.hold ?? 0,
					$decay: envGain?.decay ?? 0,
					$sustain: envGain?.sustain ?? 1,
					$release: release,
				},
				$detune: {
					$attack: envDetune?.attack ?? 0,
					$hold: envDetune?.hold ?? 0,
					$decay: envDetune?.decay ?? 0,
					$sustain: envDetune?.sustain ?? 0,
					$release: envDetune?.release ?? 0,
					$pitch: envDetune?.pitch ?? 0,
				},
				$lowpass: {
					$attack: envLP?.attack ?? 0,
					$hold: envLP?.hold ?? 0,
					$decay: envLP?.decay ?? 0,
					$sustain: envLP?.sustain ?? 1,
					$release: envLP?.release ?? .01,
					$q: envLP?.q ?? 0,
				},
			},
			$lfos: {
				$gain: {
					$wave: lfoGain?.wave ?? "sine",
					$delay: lfoGain?.delay ?? 0,
					$attack: lfoGain?.attack ?? 0,
					$frequency: lfoGain?.frequency ?? 1,
					$amp: gswaOscProc.#math_clamp( lfoGain?.amp ?? 0, -1, 1 ),
					$_phase: 0,
					$_phaseB: 0,
				},
				$detune: {
					$wave: lfoDetune?.wave ?? "sine",
					$delay: lfoDetune?.delay ?? 0,
					$attack: lfoDetune?.attack ?? 0,
					$frequency: lfoDetune?.frequency ?? 1,
					$amp: gswaOscProc.#math_clamp( lfoDetune?.amp ?? 0, -1200, 1200 ),
					$_phase: 0,
					$_phaseB: 0,
				},
			},
			$keys: d.keys.map( k => ( {
				$when: k.when,
				$duration: k.duration,
				$frequency: k.frequency ?? 440,
				$wtpos: k.wtpos ?? 0,
				$gain: k.gain ?? 1,
				$pan: gswaOscProc.#math_clamp( k.pan ?? 0, -1, 1 ),
				$lowpass: gswaOscProc.#math_clamp( k.lowpass ?? 1, 0, 1 ),
				$highpass: gswaOscProc.#math_clamp( k.highpass ?? 1, 0, 1 ),
				$lfoGainAmp: gswaOscProc.#math_clamp( k.lfoGainAmp ?? 1, 0, 4 ),
				$lfoGainFrequency: gswaOscProc.#math_clamp( k.lfoGainFrequency ?? 1, 0, 4 ),
				$lfoDetuneAmp: gswaOscProc.#math_clamp( k.lfoDetuneAmp ?? 1, 0, 4 ),
				$lfoDetuneFrequency: gswaOscProc.#math_clamp( k.lfoDetuneFrequency ?? 1, 0, 4 ),
			} ) ),
		};
	}

	// .........................................................................
	process( _inputs, outputs, params ) {
		const chanL = outputs[ 0 ]?.[ 0 ];
		const chanR = outputs[ 0 ]?.[ 1 ];
		const wtdata = this.#wtdata;

		this.#process_debug();
		if ( chanR ) {
			chanL.fill( 0 );
			chanR.fill( 0 );
			if ( wtdata ) {
				this.#wtdataN = wtdata[ 0 ] | 0;
				this.#wtdataL = wtdata[ 1 ] | 0;

				if (
					this.#wtdataN > 0 &&
					this.#wtdataL > 1 &&
					wtdata.length === gswaOscProc.#wtdataHeaderSize + this.#wtdataN * this.#wtdataL
				) {
					this.#process_keys( chanL, chanR, params );
				}
			}
		}
		return this.#ok;
	}
	#process_debug() {
		if ( currentTime > this.#currentTimeInt ) {
			console.log( `processing... ${ this.#keys.size }` );
			this.#currentTimeInt = gswaOscProc.#math_floor( currentTime ) + 1;
		}
	}
	#process_keys( chanL, chanR, params ) {
		for ( const o of this.#keys.values() ) {
			if ( o.$_whenEnd <= currentTime ) {
				this.#keys.delete( o.$_id );
			} else if ( o.$_when < currentTime + chanL.length / sampleRate ) {
				this.#process_key( chanL, chanR, params, o );
			}
		}
	}
	#process_key( chanL, chanR, params, o ) {
		const chanLen = chanL.length;
		const apPan = params.pan;
		const apGain = params.gain;
		const apPhase = params.phase;
		const apDetune = params.detune;
		const apUnisonVoices = params.unisonvoices;
		const apUnisonDetune = params.unisondetune;
		const apUnisonBlend = params.unisonblend;
		const keys = o.$keys;
		const envGain = o.$envs.$gain;
		const envDetune = o.$envs.$detune;
		const envLP = o.$envs.$lowpass;
		const lfoGain = o.$lfos.$gain;
		const lfoDetune = o.$lfos.$detune;

		lfoGain.$_phaseB = lfoGain.$_phase;
		lfoDetune.$_phaseB = lfoDetune.$_phase;
		o.$_unisonPhaseB.set( o.$_unisonPhase );
		for ( let i = 0; i < chanLen; ++i ) {
			const now = currentTime + i / sampleRate;

			if ( o.$_when <= now && now < o.$_whenEnd ) {
				while (
					o.$_keyInd < keys.length - 1 &&
					now >= keys[ o.$_keyInd ].$when + keys[ o.$_keyInd ].$duration
				) {
					++o.$_keyInd;
				}

				const key = keys[ o.$_keyInd ];
				let keyPan = key.$pan;
				let keyGain = key.$gain;
				let keyWtpos = key.$wtpos;
				let keyLowpass = key.$lowpass;
				let keyHighpass = key.$highpass;
				let keyFrequency = key.$frequency;
				let keyLfoGainAmp = key.$lfoGainAmp;
				let keyLfoGainFrequency = key.$lfoGainFrequency;
				let keyLfoDetuneAmp = key.$lfoDetuneAmp;
				let keyLfoDetuneFrequency = key.$lfoDetuneFrequency;

				if ( now < key.$when ) {
					const prev = keys[ o.$_keyInd - 1 ];
					const prevEnd = prev.$when + prev.$duration;
					const gapLen = key.$when - prevEnd;
					const frac = gapLen > 0 ? gswaOscProc.#math_clamp( ( now - prevEnd ) / gapLen, 0, 1 ) : 1;

					keyPan = prev.$pan + ( keyPan - prev.$pan ) * frac;
					keyGain = prev.$gain + ( keyGain - prev.$gain ) * frac;
					keyWtpos = prev.$wtpos + ( keyWtpos - prev.$wtpos ) * frac;
					keyLowpass = prev.$lowpass + ( keyLowpass - prev.$lowpass ) * frac;
					keyHighpass = prev.$highpass + ( keyHighpass - prev.$highpass ) * frac;
					keyFrequency = prev.$frequency + ( keyFrequency - prev.$frequency ) * frac;
					keyLfoGainAmp = prev.$lfoGainAmp + ( keyLfoGainAmp - prev.$lfoGainAmp ) * frac;
					keyLfoGainFrequency = prev.$lfoGainFrequency + ( keyLfoGainFrequency - prev.$lfoGainFrequency ) * frac;
					keyLfoDetuneAmp = prev.$lfoDetuneAmp + ( keyLfoDetuneAmp - prev.$lfoDetuneAmp ) * frac;
					keyLfoDetuneFrequency = prev.$lfoDetuneFrequency + ( keyLfoDetuneFrequency - prev.$lfoDetuneFrequency ) * frac;
				}

				const elapsed = now - o.$_when;
				const remaining = o.$_whenEnd - now;
				const envGainVal = gswaOscProc.#process_env( envGain, elapsed, remaining );
				const envDetuneVal = gswaOscProc.#process_env( envDetune, elapsed, remaining );
				const lfoGainVal = gswaOscProc.#process_lfo(
					lfoGain,
					lfoGain.$amp * keyLfoGainAmp,
					lfoGain.$frequency * keyLfoGainFrequency,
					elapsed
				) + 1;
				const lfoDetuneVal = gswaOscProc.#process_lfo(
					lfoDetune,
					lfoDetune.$amp * keyLfoDetuneAmp,
					lfoDetune.$frequency * keyLfoDetuneFrequency,
					elapsed
				);

				const apPanI = apPan[ apPan.length > 1 ? i : 0 ];
				const apGainI = apGain[ apGain.length > 1 ? i : 0 ];
				const apPhaseI = apPhase[ apPhase.length > 1 ? i : 0 ];
				const apDetuneI = apDetune[ apDetune.length > 1 ? i : 0 ];
				const apUnisonVoicesI = apUnisonVoices[ apUnisonVoices.length > 1 ? i : 0 ];
				const apUnisonDetuneI = apUnisonDetune[ apUnisonDetune.length > 1 ? i : 0 ];
				const apUnisonBlendI = apUnisonBlend[ apUnisonBlend.length > 1 ? i : 0 ];
				const baseDetune = apDetuneI + envDetuneVal * envDetune.$pitch + lfoDetuneVal;

				const smp = this.#process_unison(
					o,
					keyFrequency,
					keyWtpos,
					apPhaseI,
					baseDetune,
					Math.round( apUnisonVoicesI ),
					apUnisonDetuneI,
					apUnisonBlendI,
				);
				const smp2 = smp * apGainI * keyGain * envGainVal * lfoGainVal;
				const smp3 = gswaOscProc.#process_lowpass( o.$_lp, smp2, envLP, keyLowpass, elapsed, remaining );
				const smp4 = gswaOscProc.#process_highpass( o.$_hp, smp3, keyHighpass );
				const pan = gswaOscProc.#math_clamp( apPanI + keyPan, -1, 1 );

				chanL[ i ] += smp4 * ( pan > 0 ? 1 - pan : 1 );
				chanR[ i ] += smp4 * ( pan < 0 ? 1 + pan : 1 );
			}
		}
		lfoGain.$_phase = lfoGain.$_phaseB;
		lfoDetune.$_phase = lfoDetune.$_phaseB;
		o.$_unisonPhase.set( o.$_unisonPhaseB );
	}

	// .........................................................................
	#process_unison( o, frequency, wtpos, apPhaseI, baseDetune, univoices, unidetune, uniblend ) {
		let val = 0;
		let div = 0;

		for ( let v = 0; v < univoices; ++v ) {
			const uDetu = gswaOscProc.#process_unison_detune( univoices, v );
			const uGain = gswaOscProc.#process_unison_gain( univoices, v, uniblend );
			const detune = baseDetune + uDetu * unidetune;
			const smp = this.#process_wavetable(
				o.$_unisonPhaseB,
				v,
				frequency,
				wtpos,
				apPhaseI,
				detune,
			);

			val += uGain * smp;
			div += uGain;
		}
		return val / div;
	}
	static #process_unison_detune( nb, v ) {
		return nb === 1
			? 0
			: -1 + 2 * v / ( nb - 1 );
	}
	static #process_unison_gain( nb, v, blend ) {
		const midF = nb / 2;
		const midI = midF | 0;

		return ( v === midI || ( midF === midI && v === midI - 1 ) ) ? 1 : blend;
	}

	// .........................................................................
	#process_wavetable( phaseArr, voiceInd, frequency, wtpos, apPhaseI, detune ) {
		const wtdata = this.#wtdata;
		const nbWaves = this.#wtdataN;
		const waveLen = this.#wtdataL;
		const fEff = frequency * 2 ** ( detune / 1200 );
		const phaseInc = fEff / sampleRate;
		const tPosi = gswaOscProc.#math_clamp( wtpos, 0, 1 ) * ( nbWaves - 1 );
		const tLoww = tPosi | 0;
		const tHigh = gswaOscProc.#math_min( tLoww + 1, nbWaves - 1 );
		const tFrac = tPosi - tLoww;

		let phaseB = phaseArr[ voiceInd ] + phaseInc;
		if ( phaseB >= 1 ) {
			phaseB -= gswaOscProc.#math_floor( phaseB );
		}
		phaseArr[ voiceInd ] = phaseB;

		let phaseC = apPhaseI + phaseB;

		if ( phaseC >= 1 ) { phaseC -= gswaOscProc.#math_floor( phaseC ); }
		if ( phaseC <  0 ) { ++phaseC; }

		const sPosi = phaseC * waveLen;
		const sLoww = gswaOscProc.#math_floor( sPosi );
		const sHigh = ( sLoww + 1 ) % waveLen;
		const sFrac = sPosi - sLoww;

		const baseA = gswaOscProc.#wtdataHeaderSize + tLoww * waveLen;
		const baseB = gswaOscProc.#wtdataHeaderSize + tHigh * waveLen;
		const smpA = wtdata[ baseA + sLoww ] + sFrac * ( wtdata[ baseA + sHigh ] - wtdata[ baseA + sLoww ] );
		const smpB = wtdata[ baseB + sLoww ] + sFrac * ( wtdata[ baseB + sHigh ] - wtdata[ baseB + sLoww ] );

		return smpA + tFrac * ( smpB - smpA );
	}

	// .........................................................................
	static #process_env( e, t, remaining ) {
		let val;

		if ( t < e.$attack ) {
			val = e.$attack <= 0 ? 1 : t / e.$attack;
		} else if ( t < e.$attack + e.$hold ) {
			val = 1;
		} else if ( t < e.$attack + e.$hold + e.$decay ) {
			val = e.$decay <= 0 ? e.$sustain : 1 - ( 1 - e.$sustain ) * ( t - e.$attack - e.$hold ) / e.$decay;
		} else {
			val = e.$sustain;
		}
		if ( e.$release > 0 ) {
			val *= gswaOscProc.#math_clamp( remaining / e.$release, 0, 1 );
		} else if ( remaining <= 0 ) {
			val = 0;
		}
		return val;
	}

	// .........................................................................
	static #process_lfo( lfo, amp, hz, elapsed ) {
		const sinceDelay = elapsed - lfo.$delay;

		lfo.$_phaseB += hz / sampleRate;
		if ( lfo.$_phaseB >= 1 ) {
			lfo.$_phaseB -= gswaOscProc.#math_floor( lfo.$_phaseB );
		}
		if ( sinceDelay > 0 && amp !== 0 ) {
			const depth = lfo.$attack > 0 ? gswaOscProc.#math_clamp( sinceDelay / lfo.$attack, 0, 1 ) : 1;
			const wave = gswaOscProc.#process_lfo_wave( lfo.$wave, lfo.$_phaseB );

			return wave * amp * depth;
		}
		return 0;
	}
	static #process_lfo_wave( type, p ) {
		switch ( type ) {
			case "square": return p < .5 ? 1 : -1;
			case "sawtooth": return p < .5 ? 2 * p : 2 * p - 2;
			case "triangle": return (
				p < .25 ? 4 * p :
				p < .75 ? 2 - 4 * p :
				4 * p - 4
			);
		}
		return Math.sin( p * 2 * Math.PI );
	}

	// .........................................................................
	static #process_lowpass( cf, x, envLP, keyLowpass, elapsed, remaining ) {
		if ( ( cf.$counter % gswaOscProc.#filterCoefUpdateRate ) === 0 ) {
			const envVal = gswaOscProc.#process_env( envLP, elapsed, remaining );
			const openness = gswaOscProc.#math_clamp( envVal * keyLowpass, 0, 1 );
			const maxFreq = sampleRate * .45;
			const cutoff = gswaOscProc.#filterMinFreq * ( maxFreq / gswaOscProc.#filterMinFreq ) ** openness;
			const q = .707 + gswaOscProc.#math_max( 0, envLP.$q );

			gswaOscProc.#process_filter_coeffs_recalc( cf, cutoff, q, "lp" );
		}
		return gswaOscProc.#process_filter_coeffs_update( cf, x );
	}
	static #process_highpass( cf, x, keyHighpass ) {
		if ( ( cf.$counter % gswaOscProc.#filterCoefUpdateRate ) === 0 ) {
			const openness = gswaOscProc.#math_clamp( keyHighpass, 0, 1 );
			const maxFreq = sampleRate * .45;
			const cutoff = gswaOscProc.#filterMinFreq * ( maxFreq / gswaOscProc.#filterMinFreq ) ** ( 1 - openness );

			gswaOscProc.#process_filter_coeffs_recalc( cf, cutoff, .707, "hp" );
		}
		return gswaOscProc.#process_filter_coeffs_update( cf, x );
	}
	static #process_filter_coeffs_update( cf, x ) {
		const y0 = cf.$b0 * x + cf.$b1 * cf.$x1 + cf.$b2 * cf.$x2 - cf.$a1 * cf.$y1 - cf.$a2 * cf.$y2;

		++cf.$counter;
		cf.$x2 = cf.$x1;
		cf.$x1 = x;
		cf.$y2 = cf.$y1;
		cf.$y1 = y0;
		return y0;
	}
	static #process_filter_coeffs_recalc( o, hz, q, type ) {
		const w0 = 2 * Math.PI * gswaOscProc.#math_clamp( hz, 1, sampleRate * .49 ) / sampleRate;
		const alpha = Math.sin( w0 ) / ( 2 * q );
		const cosw0 = Math.cos( w0 );
		const a0 = 1 + alpha;

		if ( type === "lp" ) {
			o.$b0 = ( ( 1 - cosw0 ) / 2 ) / a0;
			o.$b1 = ( 1 - cosw0 ) / a0;
		} else {
			o.$b0 = ( ( 1 + cosw0 ) / 2 ) / a0;
			o.$b1 = ( -( 1 + cosw0 ) ) / a0;
		}
		o.$b2 = o.$b0;
		o.$a1 = ( -2 * cosw0 ) / a0;
		o.$a2 = ( 1 - alpha ) / a0;
	}

	// .........................................................................
	static #math_min( a, b ) {
		return a < b ? a : b;
	}
	static #math_max( a, b ) {
		return a > b ? a : b;
	}
	static #math_floor( a ) {
		return ( a < 0 ? a - 1 : a ) | 0;
	}
	static #math_clamp( n, a, b ) {
		return (
			n < a ? a :
			n > b ? b : n
		);
	}
}

registerProcessor( "gswaOscProc", gswaOscProc );
