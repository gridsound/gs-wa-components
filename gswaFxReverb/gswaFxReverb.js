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
	#enable = false;
	#data = DAWCoreJSON_effects_reverb();

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
	$setBPM( bpm ) {
		this.#bps = bpm / 60;
		this.#changeProp( "delay", this.#data.delay );
	}
	$setContext( ctx ) {
		if ( this.#ctx ) {
			this.#input.disconnect();
			this.#output.disconnect();
			this.#convolver.disconnect();
		}
		this.#ctx = ctx;
		this.#input = ctx.createGain();
		this.#output = ctx.createGain();
		this.#dryGain = ctx.createGain();
		this.#wetGain = ctx.createGain();
		this.#wetDelay = ctx.createDelay( 5 );
		this.#convolver = ctx.createConvolver();
		this.$toggle( this.#enable );
		this.$change( this.#data );

		fetch( "ir-reverb0_1-1_5-15000-1000.wav" )
			.then( res => res.arrayBuffer() )
			.then( arr => ctx.decodeAudioData( arr ) )
			.then( buf => {
				lg( "reverb IR loaded" );
				this.#convolver.buffer = buf;
			} );
	}
	$toggle( b ) {
		this.#enable = b;
		if ( this.#ctx ) {
			if ( b ) {
				this.#input.disconnect();
				this.#input
					.connect( this.#dryGain )
					.connect( this.#output );
				this.#input
					.connect( this.#wetGain )
					.connect( this.#wetDelay )
					.connect( this.#convolver )
					.connect( this.#output );
			} else {
				this.#dryGain.disconnect();
				this.#wetGain.disconnect();
				this.#wetDelay.disconnect();
				this.#convolver.disconnect();
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
	#changeProp( prop, val ) {
		const now = this.#ctx.currentTime;

		switch ( prop ) {
			case "dry": this.#dryGain.gain.setValueAtTime( val, now ); break;
			case "wet": this.#wetGain.gain.setValueAtTime( val, now ); break;
			case "delay": this.#wetDelay.delayTime.setValueAtTime( val / this.#bps, now ); break;
		}
	}
}

Object.freeze( gswaFxReverb );
