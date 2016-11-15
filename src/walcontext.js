"use strict";

window.AudioContext = window.AudioContext || window.webkitAudioContext;

function walContext() {
	this.ctx = new window.AudioContext();
	this.destination = this.ctx.destination;
	this.filters = this.createFilters();
	this.nbPlaying = 0;
	this.filters.connect( this.destination );
	this.nodeIn = this.filters.nodeIn;
	delete this.filters.connect;
};

walContext.prototype = {
	gain: function( vol ) {
		if ( !arguments.length ) {
			return this.filter.gain();
		}
		this.filter.gain( vol );
		return this;
	},
	createSample: function( wbuff ) {
		var smp = new walContext.Sample( this, wbuff );

		wbuff.samples.push( smp );
		return smp;
	},
	createBuffer: function() {
		return new walContext.Buffer( this );
	},
	createFilters: function() {
		return new walContext.Filters( this );
	},
	createComposition: function() {
		return new walContext.Composition( this );
	}
};
