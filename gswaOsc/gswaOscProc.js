"use strict";

class gswaOscProc extends AudioWorkletProcessor {
	static #wtdataHeaderSize = 4;
	#ok = true;
	#keys = new Map();
	#wtdata = null; // SharedArrayBuffer [ N, L, 0, 0, ...N*L ]
	#currentTimeInt = 0;

	static get parameterDescriptors() {
		return [
			{ automationRate: "a-rate", name: "pan",    defaultValue: 0, minValue: -1, maxValue: 1 },
			{ automationRate: "a-rate", name: "gain",   defaultValue: 1                            },
			{ automationRate: "a-rate", name: "phase",  defaultValue: 0, minValue:  0, maxValue: 1 },
			{ automationRate: "a-rate", name: "detune", defaultValue: 0                            },
		];
	}

	constructor( opt ) {
		super( opt );
		this.port.onmessage = this.#onmsg.bind( this );
	}

	#onmsg( e ) {
		const d = e.data;

		switch ( d.type ) {
			case "kill":
				this.#ok = false;
				break;
			case "wavetable":
				this.#wtdata = new Float32Array( d.buffer );
				this.port.postMessage( { type: "ready" } );
				break;
			case "push":
				this.#keys.set( d.id, gswaOscProc.#format_new_key( d ) );
				break;
		}
	}

	static #format_new_key( d ) {
		const klast = d.keys.at( -1 );
		const envGain = d.envs?.gain;
		const envDetune = d.envs?.detune;
		const release = envGain?.release ?? .01;

		return {
			$id: d.id,
			$phase: 0,
			$phaseB: 0,
			$keyInd: 0,
			$when: d.keys[ 0 ].when,
			$whenEnd: klast.when + klast.duration + release,
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
			},
			$keys: d.keys.map( k => ( {
				$when: k.when,
				$duration: k.duration,
				$frequency: k.frequency ?? 440,
				$wtpos: k.wtpos ?? 0,
				$gain: k.gain ?? 1,
				$pan: gswaOscProc.#mathClamp( k.pan ?? 0, -1, 1 ),
			} ) ),
		};
	}

	process( _inputs, outputs, params ) {
		const chanL = outputs[ 0 ]?.[ 0 ];
		const chanR = outputs[ 0 ]?.[ 1 ];
		const wtdata = this.#wtdata;

		this.#process_debug();
		if ( chanR ) {
			chanL.fill( 0 );
			chanR.fill( 0 );
			if ( wtdata ) {
				const nbWaves = wtdata[ 0 ] | 0;
				const waveLen = wtdata[ 1 ] | 0;

				if ( nbWaves > 0 && waveLen > 1 && wtdata.length === gswaOscProc.#wtdataHeaderSize + nbWaves * waveLen ) {
					this.#process_keys( chanL, chanR, params, wtdata, nbWaves, waveLen );
				}
			}
		}
		return this.#ok;
	}
	#process_debug() {
		if ( currentTime > this.#currentTimeInt ) {
			console.log( "processing..." );
			this.#currentTimeInt = Math.floor( currentTime ) + 1;
		}
	}
	#process_keys( chanL, chanR, params, wtdata, nbWaves, waveLen ) {
		for ( const o of this.#keys.values() ) {
			if ( o.$whenEnd <= currentTime ) {
				this.#keys.delete( o.$id );
			} else if ( o.$when < currentTime + chanL.length / sampleRate ) {
				gswaOscProc.#process_key( chanL, chanR, params, o, wtdata, nbWaves, waveLen );
			}
		}
	}
	static #process_key( chanL, chanR, params, o, wtdata, nbWaves, waveLen ) {
		const chanLen = chanL.length;
		const apPan = params.pan;
		const apGain = params.gain;
		const apPhase = params.phase;
		const apDetune = params.detune;
		const keys = o.$keys;
		const envGain = o.$envs.$gain;
		const envDetune = o.$envs.$detune;

		o.$phaseB = o.$phase;
		for ( let i = 0; i < chanLen; ++i ) {
			const now = currentTime + i / sampleRate;

			if ( o.$when <= now && now < o.$whenEnd ) {
				while (
					o.$keyInd < keys.length - 1 &&
					now >= keys[ o.$keyInd ].$when + keys[ o.$keyInd ].$duration
				) {
					++o.$keyInd;
				}

				const key = keys[ o.$keyInd ];
				let keyPan;
				let keyGain;
				let keyWtpos;
				let keyFrequency;

				if ( now >= key.$when ) {
					keyPan = key.$pan;
					keyGain = key.$gain;
					keyWtpos = key.$wtpos;
					keyFrequency = key.$frequency;
				} else {
					const prev = keys[ o.$keyInd - 1 ];
					const prevEnd = prev.$when + prev.$duration;
					const gapLen = key.$when - prevEnd;
					const frac = gapLen > 0 ? gswaOscProc.#mathClamp( ( now - prevEnd ) / gapLen, 0, 1 ) : 1;

					keyPan = prev.$pan + ( key.$pan - prev.$pan ) * frac;
					keyGain = prev.$gain + ( key.$gain - prev.$gain ) * frac;
					keyWtpos = prev.$wtpos + ( key.$wtpos - prev.$wtpos ) * frac;
					keyFrequency = prev.$frequency + ( key.$frequency - prev.$frequency ) * frac;
				}

				const elapsed = now - o.$when;
				const remaining = o.$whenEnd - now;
				const envGainVal = gswaOscProc.#process_env( envGain, elapsed, remaining );
				const envDetuneVal = gswaOscProc.#process_env( envDetune, elapsed, remaining );

				const apPanI = apPan[ apPan.length > 1 ? i : 0 ];
				const apGainI = apGain[ apGain.length > 1 ? i : 0 ];
				const apPhaseI = apPhase[ apPhase.length > 1 ? i : 0 ];
				const apDetuneI = apDetune[ apDetune.length > 1 ? i : 0 ];
				const pan = gswaOscProc.#mathClamp( apPanI + keyPan, -1, 1 );
				const s =
					apGainI *
					keyGain *
					envGainVal *
					gswaOscProc.#process_key_sample(
						o,
						keyFrequency,
						keyWtpos,
						apPhaseI,
						apDetuneI + envDetuneVal * envDetune.$pitch,
						wtdata,
						nbWaves,
						waveLen
					);

				chanL[ i ] += s * ( pan > 0 ? 1 - pan : 1 );
				chanR[ i ] += s * ( pan < 0 ? 1 + pan : 1 );
			}
		}
		o.$phase = o.$phaseB;
	}
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
			val *= gswaOscProc.#mathClamp( remaining / e.$release, 0, 1 );
		} else if ( remaining <= 0 ) {
			val = 0;
		}
		return val;
	}
	static #process_key_sample( o, frequency, wtpos, apPhaseI, detune, wtdata, nbWaves, waveLen ) {
		const fEff = frequency * 2 ** ( detune / 1200 );
		const phaseInc = fEff / sampleRate;
		const tPosi = gswaOscProc.#mathClamp( wtpos, 0, 1 ) * ( nbWaves - 1 );
		const tLoww = tPosi | 0;
		const tHigh = Math.min( tLoww + 1, nbWaves - 1 );
		const tFrac = tPosi - tLoww;

		o.$phaseB += phaseInc;
		if ( o.$phaseB >= 1 ) {
			o.$phaseB -= Math.floor( o.$phaseB );
		}

		let phaseC = apPhaseI + o.$phaseB;

		if ( phaseC >= 1 ) { phaseC -= Math.floor( phaseC ); }
		if ( phaseC <  0 ) { ++phaseC; }

		const sPosi = phaseC * waveLen;
		const sLoww = Math.floor( sPosi ) | 0;
		const sHigh = ( sLoww + 1 ) % waveLen;
		const sFrac = sPosi - sLoww;

		const baseA = gswaOscProc.#wtdataHeaderSize + tLoww * waveLen;
		const baseB = gswaOscProc.#wtdataHeaderSize + tHigh * waveLen;
		const smpA = wtdata[ baseA + sLoww ] + sFrac * ( wtdata[ baseA + sHigh ] - wtdata[ baseA + sLoww ] );
		const smpB = wtdata[ baseB + sLoww ] + sFrac * ( wtdata[ baseB + sHigh ] - wtdata[ baseB + sLoww ] );

		return smpA + tFrac * ( smpB - smpA );
	}

	// .........................................................................
	static #mathClamp( n, a, b ) {
		return (
			n < a ? a :
			n > b ? b : n
		);
	}
}

registerProcessor( "gswaOscProc", gswaOscProc );
