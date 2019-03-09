"use strict";

class gswaStereoPanner {
	constructor( ctx ) {
		this._splitter = ctx.createChannelSplitter( 2 );
		this._left = ctx.createGain();
		this._right = ctx.createGain();
		this._merger = ctx.createChannelMerger( 2 );
		this._splitter.connect( this._left, 0 );
		this._splitter.connect( this._right, 1 );
		this._left.connect( this._merger, 0, 0 );
		this._right.connect( this._merger, 0, 1 );
	}

	connect() {
		return this._merger.connect.apply( this._merger, arguments );
	}
	disconnect() {
		return this._merger.disconnect.apply( this._merger, arguments );
	}
	getInput() {
		return this._splitter;
	}
	getValue() {
		return this._right.gain.value - this._left.gain.value;
	}
	setValueAtTime( value, when ) {
		this._left.gain.setValueAtTime( Math.min( 1 - value, 1 ), when );
		this._right.gain.setValueAtTime( Math.min( 1 + value, 1 ), when );
	}
}
