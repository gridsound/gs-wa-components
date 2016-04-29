"use strict";

function walContext() {
	this.ctx = new AudioContext();
	this.destination = this.ctx.destination;
	this.buffers = [];
	this.nbPlaying = 0;
	this.gainNode = this.ctx.createGain();
	this.filters = this.createFilters();
	
	this.filters.pushBack( this.gainNode );
	this.filters.connect( this.ctx.destination );
	this.nodeIn = this.filters.nodeIn;
	delete this.filters.connect;
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
	},
	createFilters: function() {
		return new walContext.Filters( this );
	},
	loadSamples: function( sampleArr ) {
		$.each( sampleArr, function() {
			this.load();
		});
		return this;
	},
	playSamples: function( sampleArr ) {
		$.each( sampleArr, function() {
			this.start();
		});
		return this;
	},
	stopSamples: function( sampleArr ) {
		$.each( sampleArr, function() {
			this.stop();
		});
		return this;
	}
};
