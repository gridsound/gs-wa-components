"use strict";

class gswaFxReverb {
	#ctx = null;
	#bps = 1;
	#input = null;
	#output = null;
	#dryGain = null;
	#wetGain = null;
	#wetDelay = null;
	#convolver = null;
	#wetConstant = null; // 1.
	#enable = false;
	#updateBufferDeb = GSUdebounce( this.#updateBuffer.bind( this ), .1 );
	#data = GSUgetModel( "fx.reverb" );

	constructor() {
		Object.seal( this );
	}

	// .........................................................................
	$getInput() {
		return this.#input;
	}
	$getOutput() {
		return this.#output;
	}
	$getPropValue( prop ) {
		const val = this.#getAudioParam( prop ).value;

		return prop === "delay" ? val * this.#bps : val;
	}
	$setAutomationValue( prop, val, when ) {
		this.#changeProp( prop, val, when );
	}
	$setAutomationCurveNormalized( prop, arr, when, dur ) {
		const par = this.#getAudioParam( prop );
		let arr2 = arr;

		switch ( prop ) {
			case "wet": arr2 = arr.map( n => n * 10 ); break;
			case "delay": arr2 = arr.map( n => n / this.#bps * 2 ); break;
		}
		GSUaudioParamSetCurve( par, arr2, when, dur );
	}
	$stopAutomations() {
		GSUaudioParamCancel( this.#dryGain.gain );
		GSUaudioParamCancel( this.#wetGain.gain );
		GSUaudioParamCancel( this.#wetDelay.delayTime );
	}
	#getAudioParam( prop ) {
		switch ( prop ) {
			case "dry": return this.#dryGain.gain;
			case "wet": return this.#wetGain.gain;
			case "delay": return this.#wetDelay.delayTime;
		}
	}
	$setBPM( bpm ) {
		this.#bps = bpm / 60;
		this.#changeProp( "delay", this.#data.delay );
		this.#updateBufferDeb();
	}
	$setContext( ctx ) {
		if ( this.#ctx ) {
			this.#disconnect();
		}
		this.#ctx = ctx;
		this.#createNodes( ctx );
		this.$toggle( this.#enable );
		this.$change( this.#data );
	}
	$toggle( b ) {
		this.#enable = b;
		if ( this.#ctx ) {
			if ( b ) {
				this.#input.disconnect();
				this.#input
					.connect( this.#dryGain )
					.connect( this.#output );
				this.#wetConstant
					.connect( this.#wetGain );
				this.#input
					.connect( this.#wetGain )
					.connect( this.#convolver )
					.connect( this.#wetDelay )
					.connect( this.#output );
			} else {
				this.#dryGain.disconnect();
				this.#wetGain.disconnect();
				this.#wetDelay.disconnect();
				this.#convolver.disconnect();
				this.#wetConstant.disconnect();
				this.#input.connect( this.#output );
			}
		}
	}
	$change( obj ) {
		Object.assign( this.#data, obj );
		GSUforEach( obj, ( val, prop ) => {
			this.#changeProp( prop, val );
		} );
	}
	$liveChange( prop, val ) {
		this.#changeProp( prop, val );
	}

	// .........................................................................
	#changeProp( prop, val, when = 0 ) {
		const par = this.#getAudioParam( prop );

		switch ( prop ) {
			case "dry":
			case "wet": GSUaudioParamSet( par, val, when ); break;
			case "delay": GSUaudioParamSet( par, val / this.#bps, when ); break;
			case "fadein":
			case "decay": this.#updateBufferDeb(); break;
		}
	}
	#updateBuffer() {
		this.#convolver.buffer = gswaReverbIR.$createIR( this.#ctx, this.#data.fadein / this.#bps, this.#data.decay / this.#bps );
	}
	#createNodes( ctx ) {
		this.#input = GSUaudioGain( ctx );
		this.#output = GSUaudioGain( ctx );
		this.#dryGain = GSUaudioGain( ctx );
		this.#wetGain = GSUaudioGain( ctx );
		this.#wetDelay = GSUaudioDelay( ctx, 30 );
		this.#convolver = GSUaudioConvolver( ctx );
		this.#wetConstant = GSUaudioConstantSource( ctx );
	}
	#disconnect() {
		this.#input.disconnect();
		this.#output.disconnect();
		this.#dryGain.disconnect();
		this.#wetGain.disconnect();
		this.#wetDelay.disconnect();
		this.#convolver.disconnect();
		this.#wetConstant.disconnect();
	}
}

Object.freeze( gswaFxReverb );

/*
1. Needed for Chrome, the delayNode seems to stop sending when it stop receiving.
*/
