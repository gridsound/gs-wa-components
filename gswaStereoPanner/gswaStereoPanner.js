"use strict";

class gswaStereoPanner {
	#stereo = null;
	#splitter = null;
	#left = null;
	#right = null;
	#merger = null;

	constructor( ctx ) {
		Object.freeze( this );
		this.#stereo = ctx.createStereoPanner(); // 1.
		this.#splitter = ctx.createChannelSplitter( 2 );
		this.#left = ctx.createGain();
		this.#right = ctx.createGain();
		this.#merger = ctx.createChannelMerger( 2 );
		this.#stereo.connect( this.#splitter );
		this.#splitter.connect( this.#left, 0 );
		this.#splitter.connect( this.#right, 1 );
		this.#left.connect( this.#merger, 0, 0 );
		this.#right.connect( this.#merger, 0, 1 );
	}

	// .........................................................................
	$connect( ...args ) {
		return this.#merger.connect( ...args );
	}
	$disconnect( ...args ) {
		return this.#merger.disconnect( ...args );
	}
	$getInput() {
		return this.#stereo;
	}
	$getValue() {
		return this.#right.gain.value - this.#left.gain.value;
	}
	$setValueAtTime( value, when ) {
		GSUsetValueAtTime( this.#left.gain, gswaStereoPanner.#calcL( value ), when );
		GSUsetValueAtTime( this.#right.gain, gswaStereoPanner.#calcR( value ), when );
	}
	$setValueCurveAtTime( arr, when, dur ) {
		GSUsetValueCurveAtTime( this.#left.gain, arr.map( gswaStereoPanner.#calcL ), when, dur );
		GSUsetValueCurveAtTime( this.#right.gain, arr.map( gswaStereoPanner.#calcR ), when, dur );
	}

	// .........................................................................
	static #calcL( pan ) { return Math.min( 1 - pan, 1 ); }
	static #calcR( pan ) { return Math.min( 1 + pan, 1 ); }
}

/*
1. We need a native stereoPanner to convert a mono signal into stereo. Maybe
   there is a simpler way.
*/
