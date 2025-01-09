"use strict";

class gswaStereoPanner {
	#splitter = null;
	#left = null;
	#right = null;
	#merger = null;

	constructor( ctx ) {
		Object.freeze( this );
		this.#splitter = ctx.createChannelSplitter( 2 );
		this.#left = ctx.createGain();
		this.#right = ctx.createGain();
		this.#merger = ctx.createChannelMerger( 2 );
		this.#splitter.connect( this.#left, 0 );
		this.#splitter.connect( this.#right, 1 );
		this.#left.connect( this.#merger, 0, 0 );
		this.#right.connect( this.#merger, 0, 1 );
	}

	connect( ...args ) {
		return this.#merger.connect( ...args );
	}
	disconnect( ...args ) {
		return this.#merger.disconnect( ...args );
	}
	getInput() {
		return this.#splitter;
	}
	getValue() {
		return this.#right.gain.value - this.#left.gain.value;
	}
	setValueAtTime( value, when ) {
		this.#left.gain.setValueAtTime( gswaStereoPanner.#calcL( value ), when );
		this.#right.gain.setValueAtTime( gswaStereoPanner.#calcR( value ), when );
	}
	setValueCurveAtTime( arr, when, dur ) {
		this.#left.gain.setValueCurveAtTime( arr.map( gswaStereoPanner.#calcL ), when, dur );
		this.#right.gain.setValueCurveAtTime( arr.map( gswaStereoPanner.#calcR ), when, dur );
	}

	// .........................................................................
	static #calcL( pan ) { return Math.min( 1 - pan, 1 ); }
	static #calcR( pan ) { return Math.min( 1 + pan, 1 ); }
}
