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
	#csNodes = {
		time: null,
		gain: null,
		pan: null,
	};
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
	$getPropValue( prop ) {
		const val = this.#csNodes[ prop ].offset.value;

		return prop !== "time" ? val : val * this.#bps;
	}
	$setAutomation( prop, arr, when, dur ) {
		GSUaudioParamSetCurve( this.#csNodes[ prop ].offset, arr.map( this.#formatAutomat( prop ) ), when, dur );
	}
	#formatAutomat( prop ) {
		switch ( prop ) {
			case "time": return n => n / this.#bps * 2;
			case "gain": return n => n * .95;
			case "pan": return n => n * 2 - 1;
		}
	}
	$stopAutomations() {
		GSUforEach( this.#csNodes, cs => GSUaudioParamCancel( cs.offset ) );
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
		this.#data[ prop ] = val;
		this.#csNodes[ prop ].offset.setValueAtTime( prop !== "time" ? val : val / this.#bps, this.#ctx.currentTime );
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
		this.#delayPanA.pan.value = 0;
		this.#delayPanB.pan.value = 0;
		this.#delayA.delayTime.value = 0;
		this.#delayB.delayTime.value = 0;
	}
	#createConstantSourceLayer( ctx ) {
		GSUforEach( this.#csNodes, ( _, k, obj ) => obj[ k ] = ctx.createConstantSource() );
		this.#gainNegPan = ctx.createGain();
		this.#gainNegPan.gain.value = -1;
		this.#csNodes.time.connect( this.#delayA.delayTime );
		this.#csNodes.time.connect( this.#delayB.delayTime );
		this.#csNodes.gain.connect( this.#delayGainA.gain );
		this.#csNodes.gain.connect( this.#delayGainB.gain );
		this.#csNodes.pan.connect( this.#delayPanA.pan );
		this.#csNodes.pan.connect( this.#gainNegPan ).connect( this.#delayPanB.pan );
		this.#csNodes.time.offset.value = 0;
		this.#csNodes.gain.offset.value = .5;
		this.#csNodes.pan.offset.value = -.5;
		GSUforEach( this.#csNodes, cs => cs.start() );
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
		GSUforEach( this.#csNodes, cs => {
			cs.stop();
			cs.disconnect();
		} );
		this.#gainNegPan.disconnect();
	}
}

Object.freeze( gswaFxDelay );
