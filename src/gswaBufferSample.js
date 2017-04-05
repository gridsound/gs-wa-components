"use strict";

window.gswaBufferSample = function() {
	this.bufferSources = [];
};

gswaBufferSample.prototype = {
	setContext: function( ctx ) {
		this.ctx = ctx;
	},
	setMetadata: function( obj ) {
		if ( obj ) {
			this.duration = this.duration || obj.duration;
		}
	},
	dropData: function() {
		this.stop();
		this.disconnect();
		this.buffer = null;
	},
	setDataFromAudioBuffer: function( audioBuffer ) {
		this.buffer = audioBuffer;
		this.setMetadata( audioBuffer );
		return audioBuffer;
	},
	setDataFromArrayBuffer: function( arrayBuffer ) {
		return this.ctx.decodeAudioData( arrayBuffer )
			.then( this.setDataFromAudioBuffer.bind( this ) );
	},
	setDataFromBlob: function( blob ) {
		var that = this,
			reader = new FileReader();

		return new Promise( function( resolve, reject ) {
			reader.onloadend = function() {
				resolve( that.setDataFromArrayBuffer( reader.result ) );
			};
			reader.readAsArrayBuffer( blob );
		} );
	},
	setDataFromURL: function( url ) {
		return fetch( url )
			.then( function( res ) { return res.arrayBuffer(); } )
			.then( this.setDataFromArrayBuffer.bind( this ) );
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
			bSource.onended = this._removeSource.bind( this, bSource );
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
	},

	// private:
	_removeSource: function( bSource ) {
		this.bufferSources.splice(
			this.bufferSources.indexOf( bSource ), 1 );
	}
};
