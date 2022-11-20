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
	#data = DAWCoreJSON.effects.delay();

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
		lg({bpm})
		this.#changeProp( "time", this.#data.time );
	}
	$setContext( ctx ) {
		if ( this.#ctx ) {
			this.#input.disconnect();
			this.#output.disconnect();
			this.#delayA.disconnect();
		}
		this.#ctx = ctx;
		this.#input = ctx.createGain();
		this.#output = ctx.createGain();
		this.#delayGainA = ctx.createGain();
		this.#delayGainB = ctx.createGain();
		this.#delayPanA = ctx.createStereoPanner();
		this.#delayPanB = ctx.createStereoPanner();
		this.#delayA = ctx.createDelay( 20 );
		this.#delayB = ctx.createDelay( 20 );
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
