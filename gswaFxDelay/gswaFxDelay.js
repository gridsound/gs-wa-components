"use strict";

class gswaFxDelay {
	#ctx = null;
	#bps = 1;
	#input = null;
	#output = null;
	#delayA = null;
	#delayB = null;
	#delayGainA = null;
	#delayGainB = null;
	#delayPanA = null;
	#delayPanB = null;
	#enable = false;
	#data = GSUgetModel( "fx.delay" );

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
		this.#changeProp( "time", this.#data.time );
	}
	$setContext( ctx ) {
		if ( this.#ctx ) {
			this.#input.disconnect();
			this.#output.disconnect();
			this.#delayA.disconnect();
			this.#delayB.disconnect();
		}
		this.#ctx = ctx;
		this.#input = GSUaudioGain( ctx );
		this.#output = GSUaudioGain( ctx );
		this.#delayGainA = GSUaudioGain( ctx );
		this.#delayGainB = GSUaudioGain( ctx );
		this.#delayPanA = GSUaudioStereoPanner( ctx );
		this.#delayPanB = GSUaudioStereoPanner( ctx );
		this.#delayA = GSUaudioDelay( ctx, 20 );
		this.#delayB = GSUaudioDelay( ctx, 20 );
		this.$toggle( this.#enable );
		this.$change( this.#data );
	}
	$toggle( b ) {
		this.#enable = b;
		if ( this.#ctx ) {
			if ( b ) {
				this.#input.disconnect();
				this.#input
					.connect( this.#delayGainA ).connect( this.#delayPanA ).connect( this.#delayA )
					.connect( this.#delayGainB ).connect( this.#delayPanB ).connect( this.#delayB )
					.connect( this.#delayGainA );
				this.#input.connect( this.#output );
				this.#delayA.connect( this.#output );
				this.#delayB.connect( this.#output );
			} else {
				this.#delayA.disconnect();
				this.#delayB.disconnect();
				this.#input.connect( this.#output );
			}
		}
	}
	$change( obj ) {
		"time" in obj && this.#changeProp( "time", obj.time );
		"gain" in obj && this.#changeProp( "gain", obj.gain );
		"pan" in obj && this.#changeProp( "pan", obj.pan );
	}
	$liveChange( prop, val ) {
		this.#changeProp( prop, val );
	}

	// .........................................................................
	#changeProp( prop, val ) {
		this.#data[ prop ] = val;
		switch ( prop ) {
			case "time":
				this.#delayA.delayTime.setValueAtTime( val / this.#bps, this.#ctx.currentTime );
				this.#delayB.delayTime.setValueAtTime( val / this.#bps, this.#ctx.currentTime );
				break;
			case "gain":
				this.#delayGainA.gain.setValueAtTime( val, this.#ctx.currentTime );
				this.#delayGainB.gain.setValueAtTime( val, this.#ctx.currentTime );
				break;
			case "pan":
				this.#delayPanA.pan.setValueAtTime( val, this.#ctx.currentTime );
				this.#delayPanB.pan.setValueAtTime( -val, this.#ctx.currentTime );
				break;
		}
	}
}

Object.freeze( gswaFxDelay );
