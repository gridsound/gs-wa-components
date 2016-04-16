"use strict";

function walContext() {
	this.ctx = new AudioContext();
	this.destination = this.ctx.destination;
	this.buffers = [];
	this.nbPlaying = 0;
	this.filters = new walContext.Filters( this );

	this.globalGain = this.ctx.createGain();
	this.globalGain.connect( this.destination );
	this.nodeIn = this.globalGain;
};

walContext.prototype = {
	gain: function( vol ) {
		if ( !arguments.length ) {
			return this.globalGain.gain.value;
		}
		this.globalGain.gain.value = vol;
		return this;
	},
	createBuffer: function( file, fn ) {
		var buf = new walContext.Buffer( this, file, fn );
		this.buffers.push( buf );
		return buf;
	},
	createFilter: function() {
		return new walContext.Filter( this );
	}
};