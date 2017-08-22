"use strict";

window.gswaBuffer = function() {
	this.ABSNs = {};
	this.ABSNsLength =
	this._currId = 0;
};

gswaBuffer.prototype = {
	setContext: function( ctx ) {
		this.ctx = ctx;
	},
	load: function( data ) {
		return (
			data instanceof AudioBuffer ? Promise.resolve( this._setDataFromAudioBuffer( data ) ) :
			data instanceof ArrayBuffer ? this._setDataFromArrayBuffer( data ) :
			data instanceof Blob ? this._setDataFromBlob( data ) :
			this._setDataFromURL( data )
		);
	},
	unload: function() {
		this.stop();
		this.disconnect();
		delete this.buffer;
		delete this.duration;
	},
	connect: function( node ) {
		this.connectedTo = node;
		for ( var id in this.ABSNs ) {
			this.ABSNs[ id ].connect( node );
		}
	},
	disconnect: function() {
		this.connectedTo = null;
		for ( var id in this.ABSNs ) {
			this.ABSNs[ id ].disconnect();
		}
	},
	start: function( when, offset, duration ) {
		var absn,
			ctx = this.ctx,
			buf = this.buffer;

		if ( ctx && buf ) {
			absn = ctx.createBufferSource();
			absn.buffer = buf;
			absn.connect( this.connectedTo );
			absn.onended = this._removeSource.bind( this, this._currId );
			this.ABSNs[ this._currId++ ] = absn;
			++this.ABSNsLength;
			absn.start( when || 0, offset || 0,
				arguments.length > 2 ? duration : this.duration );
			return absn;
		}
	},
	stop: function() {
		var id, absn, ABSNs = this.ABSNs;

		for ( id in ABSNs ) {
			absn = ABSNs[ id ];
			absn.onended = null;
			absn.stop();
			delete ABSNs[ id ];
		}
		this.ABSNsLength = 0;
	},

	// private:
	_removeSource: function( id ) {
		delete this.ABSNs[ id ];
		--this.ABSNsLength;
	},
	_setDataFromAudioBuffer: function( audioBuffer ) {
		this.buffer = audioBuffer;
		this.duration = audioBuffer.duration;
		return audioBuffer;
	},
	_setDataFromArrayBuffer: function( arrayBuffer ) {
		return this.ctx.decodeAudioData( arrayBuffer )
			.then( this._setDataFromAudioBuffer.bind( this ) );
	},
	_setDataFromBlob: function( blob ) {
		var that = this,
			reader = new FileReader();

		return new Promise( function( resolve, reject ) {
			reader.onloadend = function() {
				resolve( that._setDataFromArrayBuffer( reader.result ) );
			};
			reader.readAsArrayBuffer( blob );
		} );
	},
	_setDataFromURL: function( url ) {
		return fetch( url )
			.then( function( res ) { return res.arrayBuffer(); } )
			.then( this._setDataFromArrayBuffer.bind( this ) );
	}
};
