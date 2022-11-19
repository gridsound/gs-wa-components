"use strict";

class gswaFxFilter {
	#ctx = null;
	#input = null;
	#output = null;
	#filter = null;
	#enable = false;
	#responseSize = -1;
	#responseHzIn = null;
	#responseMagOut = null;
	#responsePhaseOut = null;
	#data = DAWCoreJSON.effects.filter();

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
	$setContext( ctx ) {
		if ( this.#ctx ) {
			this.#input.disconnect();
			this.#output.disconnect();
			this.#filter.disconnect();
		}
		this.#ctx = ctx;
		this.#input = ctx.createGain();
		this.#output = ctx.createGain();
		this.#filter = ctx.createBiquadFilter();
		this.$toggle( this.#enable );
		this.$change( this.#data );
	}
	$toggle( b ) {
		this.#enable = b;
		if ( this.#ctx ) {
			if ( b ) {
				this.#input.disconnect();
				this.#input.connect( this.#filter );
				this.#filter.connect( this.#output );
			} else {
				this.#filter.disconnect();
				this.#input.connect( this.#output );
			}
		}
	}
	$change( obj ) {
		Object.assign( this.#data, obj );
		"type" in obj && this.#changeType( obj.type );
		"Q" in obj && this.#changeProp( "Q", obj.Q );
		"gain" in obj && this.#changeProp( "gain", obj.gain );
		"detune" in obj && this.#changeProp( "detune", obj.detune );
		"frequency" in obj && this.#changeProp( "frequency", obj.frequency );
	}
	$liveChange( prop, val ) {
		this.#changeProp( prop, val );
	}
	$updateResponse( size ) {
		this.#createResponseArrays( size );
		this.#filter.getFrequencyResponse(
			this.#responseHzIn,
			this.#responseMagOut,
			this.#responsePhaseOut );
		return this.#responseMagOut;
	}

	// .........................................................................
	#changeType( type ) {
		this.#filter.type = type;
	}
	#changeProp( prop, val ) {
		this.#filter[ prop ].setValueAtTime( val, this.#ctx.currentTime );
	}
	#createResponseArrays( w ) {
		if ( w !== this.#responseSize ) {
			const nyquist = this.#ctx.sampleRate / 2;
			const Hz = new Float32Array( w );

			this.#responseSize = w;
			this.#responseHzIn = Hz;
			this.#responseMagOut = new Float32Array( w );
			this.#responsePhaseOut = new Float32Array( w );
			for ( let i = 0; i < w; ++i ) {
				Hz[ i ] = nyquist * ( 2 ** ( i / w * 11 - 11 ) );
			}
		}
	}
}

Object.freeze( gswaFxFilter );
