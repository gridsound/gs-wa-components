"use strict";

class gswaFxWaveShaper {
	#ctx = null;
	#input = null;
	#output = null;
	#enable = false;
	#shaper = null;
	#data = DAWCoreJSON.effects.waveshaper();
	#dotlineSVG = GSUcreateElement( "gsui-dotlinesvg" );

	constructor() {
		Object.seal( this );
		this.#dotlineSVG.$setSVGSize( 100, 100 );
		this.#dotlineSVG.$setDataBox( "-1 -1 1 1" );
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
		if ( obj.curve ) {
			this.#dotlineSVG.$setCurve( this.#data.curve );
			this.#shaper.curve = this.#dotlineSVG.$getCurveFloat32( 512 );
		}
		if ( obj.oversample ) {
			this.#shaper.oversample = obj.oversample;
		}
	}
	$liveChange( prop, val ) {
	}
}

Object.freeze( gswaFxWaveShaper );
