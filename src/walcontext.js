"use strict";

function walContext() {
	this.ctx = new AudioContext();
	this.buffers = [];
	this.gain = this.ctx.createGain();
	this.nbPlaying = 0;
	this.gain.connect( this.ctx.destination );	
};

walContext.prototype = {
	createBuffer: function( file, fn ) {
		var buf = new walContext.Buffer( this, file, fn );
		this.buffers.push( buf );
		return buf;
	}
};
