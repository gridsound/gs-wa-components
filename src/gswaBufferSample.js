"use strict";

( function() {

function gswaBufferSample() {
	this.bufferSources = [];
};

gswaBufferSample.prototype = {
	setContext: function( ctx ) {
		this.ctx = ctx;
	},
	setBuffer: function( buffer ) {
		this.buffer = buffer;
		this.duration = buffer.duration;
	},
	connect: function( node ) {
		this.connectedTo = node;
		this.bufferSources.forEach( function( bsrc ) {
			bsrc.connect( node );
		} );
	},
	disconnect: function() {
		this.connectedTo = null;
		this.bufferSources.forEach( function( bsrc ) {
			bsrc.disconnect();
		} );
	},
	start: function( when, offset, duration ) {
		var bSource, ctx = this.ctx, buf = this.buffer;

		if ( ctx && buf ) {
			bSource = ctx.createBufferSource();
			bSource.buffer = buf;
			bSource.onended = _removeSource.bind( this, bSource );
			bSource.connect( this.connectedTo );
			this.bufferSources.push( bSource );
			bSource.start( when || 0, offset || 0,
				arguments.length > 2 ? duration : this.duration );
			return bSource;
		}
	},
	stop: function() {
		this.bufferSources.forEach( function( bSource ) {
			bSource.onended = null;
			bSource.stop();
		} );
		this.bufferSources.length = 0;
	}
};

function _removeSource( bSource ) {
	this.bufferSources.splice(
		this.bufferSources.findIndex( function( _bSource ) {
			return bSource === _bSource;
		} ), 1 );
}

} )();
