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
	#csTime = null;
	#csGain = null;
	#csPan = null;
	#gainNegPan = null;
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
			this.#disconnect();
		}
		this.#ctx = ctx;
		this.#createNodes( ctx );
		this.#createConstantSourceLayer( ctx );
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
				this.#delayGainA.disconnect();
				this.#delayGainB.disconnect();
				this.#delayPanA.disconnect();
				this.#delayPanB.disconnect();
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
		const now = this.#ctx.currentTime;

		this.#data[ prop ] = val;
		switch ( prop ) {
			case "time": this.#csTime.offset.setValueAtTime( val / this.#bps, now ); break;
			case "gain": this.#csGain.offset.setValueAtTime( val, now ); break;
			case "pan": this.#csPan.offset.setValueAtTime( val, now ); break;
		}
	}
	#createNodes( ctx ) {
		this.#input = GSUaudioGain( ctx );
		this.#output = GSUaudioGain( ctx );
		this.#delayGainA = GSUaudioGain( ctx );
		this.#delayGainB = GSUaudioGain( ctx );
		this.#delayPanA = GSUaudioStereoPanner( ctx );
		this.#delayPanB = GSUaudioStereoPanner( ctx );
		this.#delayA = GSUaudioDelay( ctx, 20 );
		this.#delayB = GSUaudioDelay( ctx, 20 );
		this.#delayGainA.gain.value = 0;
		this.#delayGainB.gain.value = 0;
		this.#delayA.delayTime.value = 0;
		this.#delayB.delayTime.value = 0;
		this.#delayPanA.pan.value = 0;
		this.#delayPanB.pan.value = 0;
	}
	#createConstantSourceLayer( ctx ) {
		this.#csTime = ctx.createConstantSource();
		this.#csGain = ctx.createConstantSource();
		this.#csPan = ctx.createConstantSource();
		this.#gainNegPan = ctx.createGain();
		this.#gainNegPan.gain.value = -1;
		this.#csTime.connect( this.#delayA.delayTime );
		this.#csTime.connect( this.#delayB.delayTime );
		this.#csGain.connect( this.#delayGainA.gain );
		this.#csGain.connect( this.#delayGainB.gain );
		this.#csPan.connect( this.#delayPanA.pan );
		this.#csPan.connect( this.#gainNegPan ).connect( this.#delayPanB.pan );
		this.#csTime.start();
		this.#csGain.start();
		this.#csPan.start();
	}
	#disconnect() {
		this.#input.disconnect();
		this.#output.disconnect();
		this.#delayA.disconnect();
		this.#delayB.disconnect();
		this.#delayGainA.disconnect();
		this.#delayGainB.disconnect();
		this.#delayPanA.disconnect();
		this.#delayPanB.disconnect();
		this.#csTime.stop();
		this.#csGain.stop();
		this.#csPan.stop();
		this.#csTime.disconnect();
		this.#csGain.disconnect();
		this.#csPan.disconnect();
		this.#gainNegPan.disconnect();
	}
}

Object.freeze( gswaFxDelay );
