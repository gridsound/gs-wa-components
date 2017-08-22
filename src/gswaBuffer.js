"use strict";

window.gswaBuffer = function() {
	this.ABSNs = [];
};

gswaBuffer.regFilename = /(?:([^/]*)\.([a-zA-Z\d]*))?$/;

gswaBuffer.prototype = {
	setContext: function( ctx ) {
		this.ctx = ctx;
	},
	setData: function( data ) {
		if ( data ) {
			var reg, str = data.name || data;

			this.data = data;
			if ( typeof str === "string" ) {
				reg = gswaBuffer.regFilename.exec( str );
				this.filename = reg[ 0 ];
				this.name = reg[ 1 ];
			}
		}
	},
	load: function() {
		var dat = this.data;

		return (
			dat instanceof AudioBuffer ? Promise.resolve( this._setDataFromAudioBuffer( dat ) ) :
			dat instanceof ArrayBuffer ? this._setDataFromArrayBuffer( dat ) :
			dat instanceof Blob ? this._setDataFromBlob( dat ) :
			this._setDataFromURL( dat )
		);
	},
	unload: function() {
		this.stop();
		this.disconnect();
		this.buffer = null;
	},
	connect: function( node ) {
		this.connectedTo = node;
		this.ABSNs.forEach( function( absn ) {
			absn.connect( node );
		} );
	},
	disconnect: function() {
		this.connectedTo = null;
		this.ABSNs.forEach( function( absn ) {
			absn.disconnect();
		} );
	},
	start: function( when, offset, duration ) {
		var absn, ctx = this.ctx, buf = this.buffer;

		if ( ctx && buf ) {
			absn = ctx.createBufferSource();
			absn.buffer = buf;
			absn.onended = this._removeSource.bind( this, absn );
			absn.connect( this.connectedTo );
			this.ABSNs.push( absn );
			absn.start( when || 0, offset || 0,
				arguments.length > 2 ? duration : this.duration );
			return absn;
		}
	},
	stop: function() {
		this.ABSNs.forEach( function( absn ) {
			absn.onended = null;
			absn.stop();
		} );
		this.ABSNs.length = 0;
	},

	// private:
	_removeSource: function( absn ) {
		this.ABSNs.splice( this.ABSNs.indexOf( absn ), 1 );
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
