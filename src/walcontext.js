"use strict";

function walContext() {
	this.ctx = new AudioContext();
	this.buffers = [];
	this.gainNode = this.ctx.createGain();
	this.analyser = this.ctx.createAnalyser();
	this.nbPlaying = 0;

	this.gainNode.connect( this.ctx.destination );
	this.analyser.connect( this.gainNode );
	this.destination = this.analyser;
};

walContext.prototype = {
	gain: function( vol ) {
		if ( !arguments.length ) {
			return this.gainNode.gain.value;
		}
		this.gainNode.gain.value = vol;
		return this;
	},
	createBuffer: function( file, fn ) {
		var buf = new walContext.Buffer( this, file, fn );
		this.buffers.push( buf );
		return buf;
	}
};
