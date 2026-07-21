"use strict";

class gswaOscProc extends AudioWorkletProcessor {
	static #bufferRootFreq = 523.251; // C4 (MIDI)
	static #wtdataHeaderSize = 4;
	static #filterCoefUpdateRate = 32;
	static #filterMinFreq = 20;
	static #unisonMaxVoices = 9;
	#ok = true;
	#keys = new Map();
	#noise = null; // String "white" | "pink" | "brown"
	#wtdata = null; // SharedArrayBuffer [ N, L, 0, 0, ...N*L ]
	#bufferL = null;
	#bufferR = null;
	#wtdataN = 0;
	#wtdataL = 0;
	#release = 10;
	#ap = gswaOscProc.#freeze( {
		$osc: gswaOscProc.#seal( { $pn: 0, $gn: 0, $ph: 0, $dt: 0 } ),
		$uni: gswaOscProc.#seal( [ 1, 0, 0 ] ),
		$envs: gswaOscProc.#freeze( {
			$gain: gswaOscProc.#seal( { $att: 0, $hld: 0, $dec: 0, $sus: 0, $rel: 0 } ),
			$detune: gswaOscProc.#seal( { $att: 0, $hld: 0, $dec: 0, $sus: 0, $rel: 0, $amp: 0 } ),
			$lowpass: gswaOscProc.#seal( { $att: 0, $hld: 0, $dec: 0, $sus: 0, $rel: 0, $q: 0 } ),
			$wtpos: gswaOscProc.#seal( { $att: 0, $hld: 0, $dec: 0, $sus: 0, $rel: 0 } ),
		} ),
		$lfos: gswaOscProc.#freeze( {
			$gain: gswaOscProc.#seal( { $wav: 0, $del: 0, $att: 0, $frq: 0, $amp: 0 } ),
			$detune: gswaOscProc.#seal( { $wav: 0, $del: 0, $att: 0, $frq: 0, $amp: 0 } ),
		} ),
	} );
	#lfoGnFrq = 0;
	#lfoGnDel = 0;
	#lfoDtFrq = 0;
	#lfoDtDel = 0;
	// #debugTime = 0;
	#noiseFn = null;
	static #noiseFns = gswaOscProc.#freeze( {
		white: gswaOscProc.#process_noise_white,
		pink: gswaOscProc.#process_noise_pink,
		brown: gswaOscProc.#process_noise_brown,
	} );

	// .........................................................................
	static #seal( o ) { return Object.seal( o ); }
	static #freeze( o ) { return Object.freeze( o ); }
	static #math_min( a, b ) { return a < b ? a : b; }
	static #math_max( a, b ) { return a > b ? a : b; }
	static #math_floor( a ) { return ( a < 0 ? a - 1 : a ) | 0; }
	static #math_clamp( n, a, b ) { return n < a ? a : n > b ? b : n; }

	// .........................................................................
	static #audparF( arr, i ) { return arr[ arr.length > 1 ? i : 0 ]; }
	static #audparI( arr, i ) { return Math.round( gswaOscProc.#audparF( arr, i ) ); }
	static #audpar( name, n, a, b ) {
		return {
			name,
			defaultValue: n,
			minValue: a,
			maxValue: b,
			automationRate: "a-rate",
		};
	}
	static get parameterDescriptors() {
		return [
			gswaOscProc.#audpar( "pan",          0,    -1,    1 ),
			gswaOscProc.#audpar( "gain",         1,     0,    1 ),
			gswaOscProc.#audpar( "phase",        0,     0,    1 ),
			gswaOscProc.#audpar( "detune",       0,   -24,   24 ),
			// uni
			gswaOscProc.#audpar( "unisonvoices", 1,     1,    9 ),
			gswaOscProc.#audpar( "unisondetune", 0,     0,  200 ),
			gswaOscProc.#audpar( "unisonblend",  0,     0,    1 ),
			// envGn
			gswaOscProc.#audpar( "envGnAtt",     0,     0, 9999 ),
			gswaOscProc.#audpar( "envGnHld",     0,     0, 9999 ),
			gswaOscProc.#audpar( "envGnDec",     0,     0, 9999 ),
			gswaOscProc.#audpar( "envGnSus",     1,     0,    1 ),
			gswaOscProc.#audpar( "envGnRel",     0,     0, 9999 ),
			// envDt
			gswaOscProc.#audpar( "envDtAtt",     0,     0, 9999 ),
			gswaOscProc.#audpar( "envDtHld",     0,     0, 9999 ),
			gswaOscProc.#audpar( "envDtDec",     0,     0, 9999 ),
			gswaOscProc.#audpar( "envDtSus",     0,     0,    1 ),
			gswaOscProc.#audpar( "envDtRel",     0,     0, 9999 ),
			gswaOscProc.#audpar( "envDtAmp",     0,   -24,   24 ),
			// envLp
			gswaOscProc.#audpar( "envLpAtt",     0,     0, 9999 ),
			gswaOscProc.#audpar( "envLpHld",     0,     0, 9999 ),
			gswaOscProc.#audpar( "envLpDec",     0,     0, 9999 ),
			gswaOscProc.#audpar( "envLpSus",     1,     0,    1 ),
			gswaOscProc.#audpar( "envLpRel",  9999,     0, 9999 ),
			gswaOscProc.#audpar( "envLpQ",       0,     0,   25 ),
			// envWt
			gswaOscProc.#audpar( "envWtAtt",     0,     0, 9999 ),
			gswaOscProc.#audpar( "envWtHld",     0,     0, 9999 ),
			gswaOscProc.#audpar( "envWtDec",     0,     0, 9999 ),
			gswaOscProc.#audpar( "envWtSus",     0,     0,    1 ),
			gswaOscProc.#audpar( "envWtRel",  9999,     0, 9999 ),
			// lfoGn
			gswaOscProc.#audpar( "lfoGnWav",     0,     0,    3 ),
			gswaOscProc.#audpar( "lfoGnDel",     0,     0, 9999 ),
			gswaOscProc.#audpar( "lfoGnAtt",     0,     0, 9999 ),
			gswaOscProc.#audpar( "lfoGnFrq",     0,     0, 9999 ),
			gswaOscProc.#audpar( "lfoGnAmp",     0,    -1,    1 ),
			// lfoDt
			gswaOscProc.#audpar( "lfoDtWav",     0,     0,    3 ),
			gswaOscProc.#audpar( "lfoDtDel",     0,     0, 9999 ),
			gswaOscProc.#audpar( "lfoDtAtt",     0,     0, 9999 ),
			gswaOscProc.#audpar( "lfoDtFrq",     0,     0, 9999 ),
			gswaOscProc.#audpar( "lfoDtAmp",     0,   -12,   12 ),
		];
	}

	// .........................................................................
	constructor( opt ) {
		super( opt );
		this.port.onmessage = this.#onmsg.bind( this );
	}
	#onmsg( e ) {
		const [ type, a0, a1, a2, a3, a4 ] = e.data;

		switch ( type ) {
			case "kill":
				this.#ok = false;
				break;
			case "clear":
				this.#clear();
				break;
			case "source":
				this.#noise = a0 !== "noise" ? null : a1;
				this.#noiseFn = a0 !== "noise" ? null : gswaOscProc.#noiseFns[ a1 ];
				this.#wtdata = a0 !== "wavetable" ? null : gswaOscProc.#newArray( a1 );
				this.#bufferL = a0 !== "buffer" ? null : gswaOscProc.#newArray( a1 );
				this.#bufferR = a0 !== "buffer" ? null : gswaOscProc.#newArray( a2 );
				this.port.postMessage( [ "ready" ] );
				break;
			case "push":
				this.#keys.set( a0, this.#format_new_key( a0, a1, a2, a3, a4 ) );
				break;
			case "pop":
				this.#popKey( a0 );
				break;
		}
	}

	// .........................................................................
	#clear() {
		for ( const o of this.#keys.values() ) {
			this.#stopKey( o );
		}
	}
	#popKey( id ) {
		const o = this.#keys.get( id );

		if ( o ) {
			this.#stopKey( o );
		}
	}
	#stopKey( o ) {
		if ( o.$_when >= currentTime || o.$_whenEnd + this.#release <= currentTime ) {
			this.#keys.delete( o.$_id );
		} else if ( o.$_whenEnd > currentTime ) {
			o.$_whenEnd = currentTime;
		}
	}

	// .........................................................................
	static #newArray( n ) {
		return new Float32Array( n );
	}
	static #format_new_key_coeff() {
		return {
			$count: 0,
			$x1: 0, $x2: 0,
			$y1: 0, $y2: 0,
			$b0: 1, $b1: 0, $b2: 0,
			$a1: 0, $a2: 0,
		};
	}
	#format_new_key( id, d, when, offset, duration ) {
		const lfoGnPhase = this.#lfoGnFrq * ( offset - this.#lfoGnDel ) % 1;
		const lfoDtPhase = this.#lfoDtFrq * ( offset - this.#lfoDtDel ) % 1;

		return {
			$_id: id,
			$_keyInd: 0,
			$_when: when,
			$_offset: offset,
			$_whenEnd: when + duration,
			$_lpL: gswaOscProc.#format_new_key_coeff(),
			$_lpR: gswaOscProc.#format_new_key_coeff(),
			$_hpL: gswaOscProc.#format_new_key_coeff(),
			$_hpR: gswaOscProc.#format_new_key_coeff(),
			$_unisonPhaseLA: gswaOscProc.#newArray( gswaOscProc.#unisonMaxVoices ),
			$_unisonPhaseLB: gswaOscProc.#newArray( gswaOscProc.#unisonMaxVoices ),
			$_unisonPhaseRA: gswaOscProc.#newArray( gswaOscProc.#unisonMaxVoices ),
			$_unisonPhaseRB: gswaOscProc.#newArray( gswaOscProc.#unisonMaxVoices ),
			$_noisePink: [ 0, 0, 0, 0, 0, 0, 0 ],
			$_noiseBrown: [ 0 ],
			$_lfoGnPhase: [ lfoGnPhase, lfoGnPhase ],
			$_lfoDtPhase: [ lfoDtPhase, lfoDtPhase ],
			$keys: d.keys.map( k => ( {
				$when: k.when,
				$duration: k.duration,
				$frequency: k.frequency ?? 440,
				$gain: k.gain ?? 1,
				$pan: gswaOscProc.#math_clamp( k.pan ?? 0, -1, 1 ),
				$lowpass: gswaOscProc.#math_clamp( k.lowpass ?? 1, 0, 1 ),
				$highpass: gswaOscProc.#math_clamp( k.highpass ?? 1, 0, 1 ),
				$lfoGnAmp: gswaOscProc.#math_clamp( k.lfoGainAmp ?? 1, 0, 4 ),
				$lfoGnFrq: gswaOscProc.#math_clamp( k.lfoGainFrequency ?? 1, 0, 4 ),
				$lfoDtAmp: gswaOscProc.#math_clamp( k.lfoDetuneAmp ?? 1, 0, 4 ),
				$lfoDtFrq: gswaOscProc.#math_clamp( k.lfoDetuneFrequency ?? 1, 0, 4 ),
			} ) ),
		};
	}

	// .........................................................................
	process( _inputs, outputs, params ) {
		const chanL = outputs[ 0 ]?.[ 0 ];
		const chanR = outputs[ 0 ]?.[ 1 ];
		const wtdata = this.#wtdata;

		// this.#process_debug();
		if ( chanR ) {
			if ( wtdata ) {
				this.#wtdataN = wtdata[ 0 ] | 0;
				this.#wtdataL = wtdata[ 1 ] | 0;
				if (
					this.#wtdataN < 1 ||
					this.#wtdataL < 2 ||
					wtdata.length !== gswaOscProc.#wtdataHeaderSize + this.#wtdataN * this.#wtdataL
				) {
					return false;
				}
			}
			if ( wtdata || this.#noise || ( this.#bufferL && this.#bufferR ) ) {
				this.#process_keys( chanL, chanR, params );
			}
		}
		return this.#ok;
	}
	// #process_debug() {
	// 	if ( currentTime > this.#debugTime ) {
	// 		console.log( `processing... ${ this.#keys.size }` );
	// 		this.#debugTime = gswaOscProc.#math_floor( currentTime ) + 1;
	// 	}
	// }
	#process_keys( chanL, chanR, params ) {
		for ( const o of this.#keys.values() ) {
			if ( o.$_whenEnd + this.#release <= currentTime ) {
				this.#keys.delete( o.$_id );
			} else if ( o.$_when < currentTime + chanL.length / sampleRate ) {
				this.#process_key( chanL, chanR, params, o );
			}
		}
	}
	#map_params( p, i ) {
		const o = this.#ap;
		const envs = o.$envs;
		const lfos = o.$lfos;

		o.$osc.$pn = gswaOscProc.#audparF( p.pan, i );
		o.$osc.$gn = gswaOscProc.#audparF( p.gain, i );
		o.$osc.$ph = gswaOscProc.#audparF( p.phase, i );
		o.$osc.$dt = gswaOscProc.#audparF( p.detune, i );
		// uni
		o.$uni[ 0 ] = gswaOscProc.#audparI( p.unisonvoices, i );
		o.$uni[ 1 ] = gswaOscProc.#audparF( p.unisondetune, i );
		o.$uni[ 2 ] = gswaOscProc.#audparF( p.unisonblend, i );
		// envGn
		envs.$gain.$att = gswaOscProc.#audparF( p.envGnAtt, i );
		envs.$gain.$hld = gswaOscProc.#audparF( p.envGnHld, i );
		envs.$gain.$dec = gswaOscProc.#audparF( p.envGnDec, i );
		envs.$gain.$sus = gswaOscProc.#audparF( p.envGnSus, i );
		envs.$gain.$rel = gswaOscProc.#audparF( p.envGnRel, i );
		// envDt
		envs.$detune.$att = gswaOscProc.#audparF( p.envDtAtt, i );
		envs.$detune.$hld = gswaOscProc.#audparF( p.envDtHld, i );
		envs.$detune.$dec = gswaOscProc.#audparF( p.envDtDec, i );
		envs.$detune.$sus = gswaOscProc.#audparF( p.envDtSus, i );
		envs.$detune.$rel = gswaOscProc.#audparF( p.envDtRel, i );
		envs.$detune.$amp = gswaOscProc.#audparF( p.envDtAmp, i );
		// envLp
		envs.$lowpass.$att = gswaOscProc.#audparF( p.envLpAtt, i );
		envs.$lowpass.$hld = gswaOscProc.#audparF( p.envLpHld, i );
		envs.$lowpass.$dec = gswaOscProc.#audparF( p.envLpDec, i );
		envs.$lowpass.$sus = gswaOscProc.#audparF( p.envLpSus, i );
		envs.$lowpass.$rel = gswaOscProc.#audparF( p.envLpRel, i );
		envs.$lowpass.$q = gswaOscProc.#audparF( p.envLpQ, i );
		// envWt
		envs.$wtpos.$att = gswaOscProc.#audparF( p.envWtAtt, i );
		envs.$wtpos.$hld = gswaOscProc.#audparF( p.envWtHld, i );
		envs.$wtpos.$dec = gswaOscProc.#audparF( p.envWtDec, i );
		envs.$wtpos.$sus = gswaOscProc.#audparF( p.envWtSus, i );
		envs.$wtpos.$rel = gswaOscProc.#audparF( p.envWtRel, i );
		// lfoGn
		lfos.$gain.$wav = gswaOscProc.#audparI( p.lfoGnWav, i );
		lfos.$gain.$del = gswaOscProc.#audparF( p.lfoGnDel, i );
		lfos.$gain.$att = gswaOscProc.#audparF( p.lfoGnAtt, i );
		lfos.$gain.$amp = gswaOscProc.#audparF( p.lfoGnAmp, i );
		lfos.$gain.$frq = gswaOscProc.#audparF( p.lfoGnFrq, i );
		// lfoDt
		lfos.$detune.$wav = gswaOscProc.#audparI( p.lfoDtWav, i );
		lfos.$detune.$del = gswaOscProc.#audparF( p.lfoDtDel, i );
		lfos.$detune.$att = gswaOscProc.#audparF( p.lfoDtAtt, i );
		lfos.$detune.$amp = gswaOscProc.#audparF( p.lfoDtAmp, i );
		lfos.$detune.$frq = gswaOscProc.#audparF( p.lfoDtFrq, i );
	}
	#process_key( chanL, chanR, params, o ) {
		const ap = this.#ap;
		const keys = o.$keys;
		const chanLen = chanL.length;

		o.$_lfoGnPhase[ 1 ] = o.$_lfoGnPhase[ 0 ];
		o.$_lfoDtPhase[ 1 ] = o.$_lfoDtPhase[ 0 ];
		o.$_unisonPhaseLB.set( o.$_unisonPhaseLA );
		o.$_unisonPhaseRB.set( o.$_unisonPhaseRA );
		for ( let i = 0; i < chanLen; ++i ) {
			const now = currentTime + i / sampleRate;
			const nowOff = now + o.$_offset;

			if ( o.$_when <= now && now < o.$_whenEnd + this.#release ) {
				while (
					o.$_keyInd < keys.length - 1 &&
					nowOff >= keys[ o.$_keyInd ].$when + keys[ o.$_keyInd ].$duration
				) {
					++o.$_keyInd;
				}

				const key = keys[ o.$_keyInd ];
				let keyPn = key.$pan;
				let keyGn = key.$gain;
				let keyLp = key.$lowpass;
				let keyHp = key.$highpass;
				let keyFrq = key.$frequency;
				let keyLfoGnAmp = key.$lfoGnAmp;
				let keyLfoGnFrq = key.$lfoGnFrq;
				let keyLfoDtAmp = key.$lfoDtAmp;
				let keyLfoDtFrq = key.$lfoDtFrq;

				if ( nowOff < key.$when ) {
					const prev = keys[ o.$_keyInd - 1 ];
					const prevEnd = prev.$when + prev.$duration;
					const gapLen = key.$when - prevEnd;
					const frac = gapLen > 0 ? gswaOscProc.#math_clamp( ( nowOff - prevEnd ) / gapLen, 0, 1 ) : 1;

					keyPn = prev.$pan + ( keyPn - prev.$pan ) * frac;
					keyGn = prev.$gain + ( keyGn - prev.$gain ) * frac;
					keyLp = prev.$lowpass + ( keyLp - prev.$lowpass ) * frac;
					keyHp = prev.$highpass + ( keyHp - prev.$highpass ) * frac;
					keyFrq = prev.$frequency + ( keyFrq - prev.$frequency ) * frac;
					keyLfoGnAmp = prev.$lfoGnAmp + ( keyLfoGnAmp - prev.$lfoGnAmp ) * frac;
					keyLfoGnFrq = prev.$lfoGnFrq + ( keyLfoGnFrq - prev.$lfoGnFrq ) * frac;
					keyLfoDtAmp = prev.$lfoDtAmp + ( keyLfoDtAmp - prev.$lfoDtAmp ) * frac;
					keyLfoDtFrq = prev.$lfoDtFrq + ( keyLfoDtFrq - prev.$lfoDtFrq ) * frac;
				}
				this.#map_params( params, i );
				this.#release = ap.$envs.$gain.$rel;
				this.#lfoGnFrq = ap.$lfos.$gain.$frq;
				this.#lfoGnDel = ap.$lfos.$gain.$del;
				this.#lfoDtFrq = ap.$lfos.$detune.$frq;
				this.#lfoDtDel = ap.$lfos.$detune.$del;
				ap.$lfos.$gain.$amp *= keyLfoGnAmp;
				ap.$lfos.$gain.$frq *= keyLfoGnFrq;
				ap.$lfos.$detune.$amp *= keyLfoDtAmp;
				ap.$lfos.$detune.$frq *= keyLfoDtFrq;

				const t = nowOff - o.$_when;
				const envGnRest = o.$_whenEnd + this.#release - now;
				const envDtRest = envGnRest - ( this.#release - ap.$envs.$detune.$rel );
				const envLpRest = envGnRest - ( this.#release - ap.$envs.$lowpass.$rel );
				const envWtRest = envGnRest - ( this.#release - ap.$envs.$wtpos.$rel );
				const envGnVal = gswaOscProc.#process_env( ap.$envs.$gain, t, envGnRest );
				const envDtVal = gswaOscProc.#process_env( ap.$envs.$detune, t, envDtRest );
				const envWtVal = gswaOscProc.#process_env( ap.$envs.$wtpos, t, envWtRest );
				const lfoGnVal = gswaOscProc.#process_lfo( o.$_lfoGnPhase, ap.$lfos.$gain, t );
				const lfoDtVal = gswaOscProc.#process_lfo( o.$_lfoDtPhase, ap.$lfos.$detune, t );
				const finalPan = gswaOscProc.#math_clamp( ap.$osc.$pn + keyPn, -1, 1 );
				const finalGain = ap.$osc.$gn * keyGn * envGnVal * ( 1 + lfoGnVal );
				const finalDetune = ap.$osc.$dt + envDtVal * ap.$envs.$detune.$amp + lfoDtVal;
				let smpL;
				let smpR;

				gswaOscProc.#process_lowpass_coeffs_recalc( o.$_lpL, keyLp, ap.$envs.$lowpass, t, envLpRest );
				gswaOscProc.#process_lowpass_coeffs_recalc( o.$_lpR, keyLp, ap.$envs.$lowpass, t, envLpRest );
				gswaOscProc.#process_highpass_coeffs_recalc( o.$_hpL, keyHp );
				gswaOscProc.#process_highpass_coeffs_recalc( o.$_hpR, keyHp );
				if ( this.#wtdata ) {
					smpL = this.#process_unison_wavetable( o.$_unisonPhaseLB, keyFrq, envWtVal, ap.$osc.$ph, finalDetune );
					smpL = gswaOscProc.#process_filter_coeffs_update( o.$_lpL, smpL );
					smpL = gswaOscProc.#process_filter_coeffs_update( o.$_hpL, smpL );
					smpR = smpL;
				} else if ( this.#noise ) {
					smpL = this.#noiseFn( o );
					smpR = this.#noiseFn( o );
					smpL = gswaOscProc.#process_filter_coeffs_update( o.$_lpL, smpL );
					smpR = gswaOscProc.#process_filter_coeffs_update( o.$_lpR, smpR );
					smpL = gswaOscProc.#process_filter_coeffs_update( o.$_hpL, smpL );
					smpR = gswaOscProc.#process_filter_coeffs_update( o.$_hpR, smpR );
				} else {
					smpL = this.#process_unison_buffer( o.$_unisonPhaseLB, keyFrq, finalDetune, this.#bufferL );
					smpR = this.#process_unison_buffer( o.$_unisonPhaseRB, keyFrq, finalDetune, this.#bufferR );
					smpL = gswaOscProc.#process_filter_coeffs_update( o.$_lpL, smpL );
					smpR = gswaOscProc.#process_filter_coeffs_update( o.$_lpR, smpR );
					smpL = gswaOscProc.#process_filter_coeffs_update( o.$_hpL, smpL );
					smpR = gswaOscProc.#process_filter_coeffs_update( o.$_hpR, smpR );
				}
				chanL[ i ] += smpL * finalGain * ( finalPan > 0 ? 1 - finalPan : 1 );
				chanR[ i ] += smpR * finalGain * ( finalPan < 0 ? 1 + finalPan : 1 );
			}
		}
		o.$_lfoGnPhase[ 0 ] = o.$_lfoGnPhase[ 1 ];
		o.$_lfoDtPhase[ 0 ] = o.$_lfoDtPhase[ 1 ];
		o.$_unisonPhaseLA.set( o.$_unisonPhaseLB );
		o.$_unisonPhaseRA.set( o.$_unisonPhaseRB );
	}

	// .........................................................................
	static #process_noise_white() {
		return Math.random() * 2 - 1;
	}
	static #process_noise_pink( o ) {
		const b = o.$_noisePink;
		const white = gswaOscProc.#process_noise_white();
		let smp;

		b[ 0 ] = .99886 * b[ 0 ] + white * .0555179;
		b[ 1 ] = .99332 * b[ 1 ] + white * .0750759;
		b[ 2 ] = .96900 * b[ 2 ] + white * .1538520;
		b[ 3 ] = .86650 * b[ 3 ] + white * .3104856;
		b[ 4 ] = .55000 * b[ 4 ] + white * .5329522;
		b[ 5 ] = -.7616 * b[ 5 ] - white * .0168980;
		smp = b[ 0 ] + b[ 1 ] + b[ 2 ] + b[ 3 ] + b[ 4 ] + b[ 5 ] + b[ 6 ] + white * .5362;
		smp *= .18; // gain
		b[ 6 ] = white * .115926;
		return smp;
	}
	static #process_noise_brown( o ) {
		const b = o.$_noiseBrown;
		const white = gswaOscProc.#process_noise_white();
		let smp = ( b[ 0 ] + ( .02 * white ) ) / 1.02;

		b[ 0 ] = smp;
		smp *= 5; // gain
		return smp;
	}

	// .........................................................................
	#process_unison_buffer( phaseArr, frequency, baseDetune, buf ) {
		const [ univoices, unidetune, uniblend ] = this.#ap.$uni;
		let val = 0;
		let div = 0;

		for ( let v = 0; v < univoices; ++v ) {
			const uDetu = gswaOscProc.#process_unison_detune( univoices, v );
			const uGain = gswaOscProc.#process_unison_gain( univoices, v, uniblend );
			const detune = baseDetune + uDetu * unidetune;
			const smp = gswaOscProc.#process_buffer(
				phaseArr,
				v,
				frequency,
				detune,
				buf,
			);

			val += uGain * smp;
			div += uGain;
		}
		return val / div;
	}
	#process_unison_wavetable( phaseArr, frequency, wtpos, apPhaseI, baseDetune ) {
		const [ univoices, unidetune, uniblend ] = this.#ap.$uni;
		let val = 0;
		let div = 0;

		for ( let v = 0; v < univoices; ++v ) {
			const uDetu = gswaOscProc.#process_unison_detune( univoices, v );
			const uGain = gswaOscProc.#process_unison_gain( univoices, v, uniblend );
			const detune = baseDetune + uDetu * unidetune;
			const smp = gswaOscProc.#process_wavetable(
				phaseArr,
				v,
				frequency,
				wtpos,
				apPhaseI,
				detune,
				this.#wtdata,
				this.#wtdataN,
				this.#wtdataL,
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

		return v === midI || ( midF === midI && v === midI - 1 ) ? 1 : blend;
	}

	// .........................................................................
	static #process_buffer( phaseArr, voiceInd, frequency, detune, buf ) {
		const pos = phaseArr[ voiceInd ];

		if ( pos >= buf.length - 1 ) {
			return 0;
		}

		const rate = ( frequency * 2 ** ( detune / 12 ) ) / gswaOscProc.#bufferRootFreq;
		const i0 = pos | 0;
		const i1 = gswaOscProc.#math_min( i0 + 1, buf.length - 1 );
		const frac = pos - i0;
		const smp = buf[ i0 ] + frac * ( buf[ i1 ] - buf[ i0 ] );

		phaseArr[ voiceInd ] = pos + rate;
		return smp;
	}
	static #process_wavetable( phaseArr, voiceInd, frequency, wtpos, apPhaseI, detune, wtdata, nbWaves, waveLen ) {
		const fEff = frequency * 2 ** ( detune / 12 );
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
	static #process_env( env, t, remain ) {
		let val;

		if ( t < env.$att ) {
			val = env.$att <= 0 ? 1 : t / env.$att;
		} else if ( t < env.$att + env.$hld ) {
			val = 1;
		} else if ( t < env.$att + env.$hld + env.$dec ) {
			val = env.$dec <= 0 ? env.$sus : 1 - ( 1 - env.$sus ) * ( t - env.$att - env.$hld ) / env.$dec;
		} else {
			val = env.$sus;
		}
		if ( env.$rel > 0 ) {
			val *= gswaOscProc.#math_clamp( remain / env.$rel, 0, 1 );
		} else if ( remain <= 0 ) {
			val = 0;
		}
		return val;
	}

	// .........................................................................
	static #process_lfo( phase, lfo, t ) {
		const sinceDelay = t - lfo.$del;

		phase[ 1 ] += lfo.$frq / sampleRate;
		if ( phase[ 1 ] >= 1 ) {
			phase[ 1 ] -= gswaOscProc.#math_floor( phase[ 1 ] );
		}
		if ( sinceDelay > 0 && lfo.$amp !== 0 ) {
			const depth = lfo.$att > 0 ? gswaOscProc.#math_clamp( sinceDelay / lfo.$att, 0, 1 ) : 1;
			const smp = gswaOscProc.#process_lfo_wave( lfo.$wave, phase[ 1 ] );

			return smp * lfo.$amp * depth;
		}
		return 0;
	}
	static #process_lfo_wave( wave, p ) {
		switch ( wave ) {
			case 3: return p < .5 ? 1 : -1;
			case 2: return p < .5 ? 2 * p : 2 * p - 2;
			case 1: return (
				p < .25 ? 4 * p :
				p < .75 ? 2 - 4 * p :
				4 * p - 4
			);
		}
		return Math.sin( p * 2 * Math.PI );
	}

	// .........................................................................
	static #process_lowpass_coeffs_recalc( cf, keyLp, env, t, remain ) {
		if ( ( cf.$count % gswaOscProc.#filterCoefUpdateRate ) === 0 ) {
			const envVal = gswaOscProc.#process_env( env, t, remain );
			const openness = gswaOscProc.#math_clamp( envVal * keyLp, 0, 1 );
			const maxFreq = sampleRate * .45;
			const cutoff = gswaOscProc.#filterMinFreq * ( maxFreq / gswaOscProc.#filterMinFreq ) ** openness;
			const q = .707 + gswaOscProc.#math_max( 0, env.$q );

			gswaOscProc.#process_filter_coeffs_recalc( cf, cutoff, q, "lp" );
		}
	}
	static #process_highpass_coeffs_recalc( cf, keyHp ) {
		if ( ( cf.$count % gswaOscProc.#filterCoefUpdateRate ) === 0 ) {
			const openness = gswaOscProc.#math_clamp( keyHp, 0, 1 );
			const maxFreq = sampleRate * .45;
			const cutoff = gswaOscProc.#filterMinFreq * ( maxFreq / gswaOscProc.#filterMinFreq ) ** ( 1 - openness );

			gswaOscProc.#process_filter_coeffs_recalc( cf, cutoff, .707, "hp" );
		}
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
	static #process_filter_coeffs_update( cf, x ) {
		const y0 =
			cf.$b0 * x +
			cf.$b1 * cf.$x1 +
			cf.$b2 * cf.$x2 -
			cf.$a1 * cf.$y1 -
			cf.$a2 * cf.$y2;

		++cf.$count;
		cf.$x2 = cf.$x1;
		cf.$x1 = x;
		cf.$y2 = cf.$y1;
		cf.$y1 = y0;
		return y0;
	}
}

registerProcessor( "gswaOscProc", gswaOscProc );
