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
		this.#left.gain.setValueAtTime( Math.min( 1 - value, 1 ), when );
		this.#right.gain.setValueAtTime( Math.min( 1 + value, 1 ), when );
	}
}
