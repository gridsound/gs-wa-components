"use strict";

class gswaFxWaveShaper {
	#ctx = null;
	#input = null;
	#output = null;
	#enable = false;
	#shaper = null;
	#data = GSUgetModel( "fx.waveshaper" );

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
			this.#shaper.disconnect();
		}
		this.#ctx = ctx;
		this.#input = ctx.createGain();
		this.#output = ctx.createGain();
		this.#shaper = ctx.createWaveShaper();
		this.$toggle( this.#enable );
		this.$change( this.#data );
	}
	$toggle( b ) {
		this.#enable = b;
		if ( this.#ctx ) {
			if ( b ) {
				this.#input.disconnect();
				this.#input.connect( this.#shaper );
				this.#shaper.connect( this.#output );
			} else {
				this.#shaper.disconnect();
				this.#input.connect( this.#output );
			}
		}
	}
	$change( obj ) {
		GSUdiffAssign( this.#data, obj );
		if ( obj.oversample ) {
			this.#shaper.oversample = obj.oversample;
		}
		if ( obj.curve ) {
			this.#setCurveData( this.#data.curve );
		}
	}
	#setCurveData( curveDots ) {
		const graphData = new Float32Array( GSUsampleDotLine( curveDots, 512 ).map( d => d[ 1 ] ) );

		this.#shaper.curve = this.#data.symmetry
			? this.#addGraphSymmetry( graphData )
			: graphData;
	}
	#addGraphSymmetry( curve ) {
		const cpy = [ ...curve ].reverse();

		cpy.forEach( ( v, i, arr ) => arr[ i ] *= -1 );
		return new Float32Array( cpy.concat( ...curve ).filter( ( v, i ) => i % 2 === 0 ) );
	}
	$liveChange( prop, val ) {
		if ( prop === "curve" ) {
			this.#setCurveData( val );
		}
	}
}

Object.freeze( gswaFxWaveShaper );
