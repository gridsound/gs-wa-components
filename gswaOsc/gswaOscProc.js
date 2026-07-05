class gswaOscProc extends AudioWorkletProcessor {
	static #wtdataHeaderSize = 4;
	#keys = new Map();
	#wtdata = null; // SharedArrayBuffer [ N, L, 0, 0, ...N*L ]
	#ok = true;
	#currentTimeInt = 0;

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
			case "push": {
				const k = d.key;
				const pan = Math.max( -1, Math.min( 1, k.pan ?? 0 ) );
				const angle = ( pan + 1 ) * .25 * Math.PI;

				this.#keys.set( d.id, {
					$id: d.id,
					$phase: 0,
					$phaseB: 0,
					$when: k.when,
					$whenEnd: k.when + k.duration,
					$key: {
						$when: k.when,
						$duration: k.duration,
						$frequency: k.frequency ?? 440,
						$detune: k.detune ?? 0,
						$wtpos: k.wtpos ?? 0,
						$phase: k.phase ?? 0,
						$gain: k.gain ?? 1,
						$gainL: Math.cos( angle ),
						$gainR: Math.sin( angle ),
					},
				} );
			} break;
		}
	}

	process( _inputs, outputs ) {
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
					this.#process_keys( chanL, chanR, wtdata, nbWaves, waveLen );
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
	#process_keys( chanL, chanR, wtdata, nbWaves, waveLen ) {
		for ( const o of this.#keys.values() ) {
			if ( o.$whenEnd <= currentTime ) {
				this.#keys.delete( o.$id );
			} else if ( o.$when < currentTime + chanL.length / sampleRate ) {
				gswaOscProc.#process_key( chanL, chanR, o, wtdata, nbWaves, waveLen );
			}
		}
	}
	static #process_key( chanL, chanR, o, wtdata, nbWaves, waveLen ) {
		const chanLen = chanL.length;
		const gainL = o.$key.$gain * o.$key.$gainL;
		const gainR = o.$key.$gain * o.$key.$gainR;

		o.$phaseB = o.$phase;
		for ( let i = 0; i < chanLen; ++i ) {
			const now = currentTime + i / sampleRate;

			if ( o.$when <= now && now < o.$whenEnd ) {
				const s = gswaOscProc.#process_key_sample( o, wtdata, nbWaves, waveLen );

				chanL[ i ] += gainL * s;
				chanR[ i ] += gainR * s;
			}
		}
		o.$phase = o.$phaseB;
	}
	static #process_key_sample( o, wtdata, nbWaves, waveLen ) {
		const fEff = o.$key.$frequency * 2 ** ( o.$key.$detune / 1200 );
		const phaseInc = fEff / sampleRate;
		const tPosi = Math.max( 0, Math.min( 1, o.$key.$wtpos ) ) * ( nbWaves - 1 );
		const tLoww = tPosi | 0;
		const tHigh = Math.min( tLoww + 1, nbWaves - 1 );
		const tFrac = tPosi - tLoww;

		o.$phaseB += phaseInc;
		if ( o.$phaseB >= 1 ) {
			o.$phaseB -= Math.floor( o.$phaseB );
		}

		let phaseC = o.$key.$phase + o.$phaseB;

		if ( phaseC >= 1 ) { phaseC -= Math.floor( phaseC ); }
		if ( phaseC <  0 ) { phaseC += 1; }

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
}

registerProcessor( "gswaOscProc", gswaOscProc );
