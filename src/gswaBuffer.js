"use strict";

window.gswaBuffer = function() {
	this.ABSNs = {};
	this.ABSNsLength =
	this._currId = 0;
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
