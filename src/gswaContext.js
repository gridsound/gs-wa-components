"use strict";

function gswaContext() {
	this.ctx = new window.AudioContext();
	this.destination = this.ctx.destination;
	this.filters = this.createFilters();
	this.nbPlaying = 0;
	this.filters.connect( this.destination );
	this.nodeIn = this.filters.nodeIn;
	delete this.filters.connect;
};

gswaContext.prototype = {
	gain: function( vol ) {
		if ( !arguments.length ) {
			return this.filter.gain();
		}
		this.filter.gain( vol );
		return this;
	},
	createSample: function( wbuff ) {
		var smp = new gswaSample( this, wbuff );

		wbuff.samples.push( smp );
		return smp;
	},
	createBuffer: function() {
		return new gswaBuffer( this );
	},
	createFilters: function() {
		return new gswaFilters( this );
	},
	createComposition: function() {
		return new gswaComposition( this );
	}
};
