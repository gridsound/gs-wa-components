"use strict";

class gswaOscillatorProc extends AudioWorkletProcessor {
	static #headerSize = 4;
    #startTime = Infinity;
    #stopTime = Infinity;
	#wtdata = null; // SharedArrayBuffer [ N, L, 0, 0, ...N*L ]
	#phase = 0;
	#currentTimeInt = 0;

	static get parameterDescriptors() {
		return [
			{ automationRate: "a-rate", name: "phase",     defaultValue:   0, minValue: 0, maxValue:     1 },
			{ automationRate: "a-rate", name: "frequency", defaultValue: 440, minValue: 0, maxValue: 24000 },
			{ automationRate: "a-rate", name: "detune",    defaultValue:   0                               },
			{ automationRate: "a-rate", name: "wtpos",     defaultValue:   0, minValue: 0, maxValue:     1 },
		];
	}

	constructor( opt ) {
		super( opt );
		this.port.onmessage = this.#onmsg.bind( this );
	}
	#onmsg( e ) {
		switch ( e.data.type ) {
			case "start": this.#startTime = e.data.when; break;
			case "stop": this.#stopTime = e.data.when; break;
			case "reset":
				this.#phase = 0;
				this.#startTime = Infinity;
				this.#stopTime = Infinity;
				break;
			case "wavetable":
				this.#wtdata = new Float32Array( e.data.buffer );
				this.port.postMessage( { type: "ready" } );
				break;
		}
	}

	process( _inputs, outputs, params ) {
		if ( currentTime > this.#currentTimeInt ) {
			console.log( "process ......." );
			this.#currentTimeInt = Math.floor( currentTime ) + 1;
		}

		if ( currentTime >= this.#stopTime ) {
			this.port.postMessage( { type: "ended" } );
			return false;
		}

		const wtdata = this.#wtdata;
		const chan = outputs[ 0 ]?.[ 0 ];

		if ( !chan || !wtdata ) {
			chan?.fill( 0 );
			return true;
		}

		const nbWaves = wtdata[ 0 ] | 0;
		const waveLen = wtdata[ 1 ] | 0;

		if (
			currentTime < this.#startTime ||
			nbWaves < 1 ||
			waveLen < 2 ||
			wtdata.length !== gswaOscillatorProc.#headerSize + nbWaves * waveLen
		) {
			chan.fill( 0 );
			return true;
		}

		const apFreq = params[ "frequency" ];
		const apDetu = params[ "detune" ];
		const apPhas = params[ "phase" ];
		const apWtpo = params[ "wtpos" ];
		const chanLen = chan.length;
		let phase = this.#phase;

		for ( let i = 0; i < chanLen; ++i ) {
			const apFreqI = apFreq.length > 1 ? apFreq[ i ] : apFreq[ 0 ];
			const apDetuI = apDetu.length > 1 ? apDetu[ i ] : apDetu[ 0 ];
			const apPhasI = apPhas.length > 1 ? apPhas[ i ] : apPhas[ 0 ];
			const apWtpoI = apWtpo.length > 1 ? apWtpo[ i ] : apWtpo[ 0 ];
			const fEff = apFreqI * 2 ** ( apDetuI / 1200 );
			const phaseInc = fEff / sampleRate;
			const tPosi = Math.max( 0, Math.min( 1, apWtpoI ) ) * ( nbWaves - 1 ); // [ 0, 1 ] -> [ 0, len - 1 ]
			const tLoww = tPosi | 0;
			const tHigh = Math.min( tLoww + 1, nbWaves - 1 );
			const tFrac = tPosi - tLoww;

			phase += phaseInc;
			if ( phase >= 1 ) {
				phase -= Math.floor( phase ); // keep in [0, 1)
			}

			let phase2 = phase + apPhasI;

			if ( phase2 >= 1 ) { phase2 -= Math.floor( phase2 ); }
			if ( phase2 <  0 ) { phase2 += 1; }

			const sPosi = phase2 * waveLen;
			const sLoww = Math.floor( sPosi ) | 0;
			const sHigh = ( sLoww + 1 ) % waveLen;
			const sFrac = sPosi - sLoww;

			const baseA = gswaOscillatorProc.#headerSize + tLoww * waveLen;
			const baseB = gswaOscillatorProc.#headerSize + tHigh * waveLen;
			const smpA = wtdata[ baseA + sLoww ] + sFrac * ( wtdata[ baseA + sHigh ] - wtdata[ baseA + sLoww ] );
			const smpB = wtdata[ baseB + sLoww ] + sFrac * ( wtdata[ baseB + sHigh ] - wtdata[ baseB + sLoww ] );

			chan[ i ] = smpA + tFrac * ( smpB - smpA );
		}
		this.#phase = phase;
		return true;
	}
}

registerProcessor( "gswaOscillatorProc", gswaOscillatorProc );
