"use strict";

class gswaFxFilter {
	ctx = null
	input = null
	output = null
	responseHzIn = null
	responseMagOut = null
	responsePhaseOut = null
	#filter = null
	#respSize = -1
	#enable = false
	#ctrl = new DAWCore.controllersFx.filter( {
		dataCallbacks: {
			type: this.#changeType.bind( this ),
			Q: this.#changeProp.bind( this, "Q" ),
			gain: this.#changeProp.bind( this, "gain" ),
			detune: this.#changeProp.bind( this, "detune" ),
			frequency: this.#changeProp.bind( this, "frequency" ),
		},
	} )

	constructor() {
		Object.seal( this );
	}

	// .........................................................................
	setContext( ctx ) {
		if ( this.ctx ) {
			this.input.disconnect();
			this.output.disconnect();
			this.#filter.disconnect();
		}
		this.ctx = ctx;
		this.input = ctx.createGain();
		this.output = ctx.createGain();
		this.#filter = ctx.createBiquadFilter();
		this.#ctrl.recall();
		this.toggle( this.#enable );
	}
	toggle( b ) {
		this.#enable = b;
		if ( this.ctx ) {
			if ( b ) {
				this.input.disconnect();
				this.input.connect( this.#filter );
				this.#filter.connect( this.output );
			} else {
				this.#filter.disconnect();
				this.input.connect( this.output );
			}
		}
	}
	change( obj ) {
		this.#ctrl.change( obj );
	}
	liveChange( prop, val ) {
		this.#changeProp( prop, val );
	}
	clear() {
		this.#ctrl.clear();
		this.#respSize = -1;
		this.responseHzIn =
		this.responseMagOut =
		this.responsePhaseOut = null;
	}
	updateResponse( size ) {
		this.#createResponseArrays( size );
		this.#filter.getFrequencyResponse(
			this.responseHzIn,
			this.responseMagOut,
			this.responsePhaseOut );
		return this.responseMagOut;
	}

	// .........................................................................
	#changeType( type ) {
		this.#filter.type = type;
	}
	#changeProp( prop, val ) {
		this.#filter[ prop ].setValueAtTime( val, this.ctx.currentTime );
	}
	#createResponseArrays( w ) {
		if ( w !== this.#respSize ) {
			const nyquist = this.ctx.sampleRate / 2,
				Hz = new Float32Array( w );

			this.#respSize = w;
			this.responseHzIn = Hz;
			this.responseMagOut = new Float32Array( w );
			this.responsePhaseOut = new Float32Array( w );
			for ( let i = 0; i < w; ++i ) {
				Hz[ i ] = nyquist * ( 2 ** ( i / w * 11 - 11 ) );
			}
		}
	}
}

Object.freeze( gswaFxFilter );

if ( typeof gswaEffects !== "undefined" ) {
	gswaEffects.fxsMap.set( "filter", gswaFxFilter );
}
