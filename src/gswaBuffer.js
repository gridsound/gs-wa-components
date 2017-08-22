"use strict";

/*
If you try to use WebAudio on Safari, maybe you will have to use this:

gswaBuffer.prototype._setDataFromArrayBuffer = function( arrayBuffer ) {
	return new Promise( ( res, rej ) => {
		this.ctx.decodeAudioData( arrayBuffer, audioBuffer => {
			res( this._setDataFromAudioBuffer( audioBuffer ) );
		}, rej );
	} );
};
*/

window.gswaBuffer = function() {
	this.ABSNs = {};
	this.ABSNsLength =
	this._currId = 0;
};

gswaBuffer.prototype = {
	setContext( ctx ) {
		this.ctx = ctx;
	},
	load( data ) {
		return (
			data instanceof AudioBuffer ? Promise.resolve( this._setDataFromAudioBuffer( data ) ) :
			data instanceof ArrayBuffer ? this._setDataFromArrayBuffer( data ) :
			data instanceof Blob ? this._setDataFromBlob( data ) :
			this._setDataFromURL( data )
		);
	},
	unload() {
		this.stop();
		this.disconnect();
		delete this.buffer;
		delete this.duration;
	},
	connect( node ) {
		this.connectedTo = node;
		for ( var id in this.ABSNs ) {
			this.ABSNs[ id ].connect( node );
		}
	},
	disconnect() {
		this.connectedTo = null;
		for ( var id in this.ABSNs ) {
			this.ABSNs[ id ].disconnect();
		}
	},
	simpleStart() {
		var absn = this._newABSN();

		if ( absn ) {
			this._absn = absn;
			return ( this._promise = new Promise( function( resolve ) {
				absn.onended = resolve;
				absn.start();
			} ) );
		}
	},
	start( when, offset, duration ) {
		var absn = this._newABSN();

		if ( absn ) {
			absn.onended = this._removeSource.bind( this, this._currId );
			this.ABSNs[ this._currId++ ] = absn;
			++this.ABSNsLength;
			absn.start( when || 0, offset || 0,
				arguments.length > 2 ? duration : this.duration );
			return absn;
		}
	},
	stop() {
		if ( this._absn ) {
			this._absn.stop();
		}
		for ( var id in this.ABSNs ) {
			this.ABSNs[ id ].stop();
		}
	},

	// private:
	_newABSN() {
		var absn,
			ctx = this.ctx,
			buf = this.buffer;

		if ( ctx && buf ) {
			absn = ctx.createBufferSource();
			absn.buffer = buf;
			absn.connect( this.connectedTo );
		}
		return absn;
	},
	_removeSource( id ) {
		delete this.ABSNs[ id ];
		--this.ABSNsLength;
	},
	_setDataFromAudioBuffer( audioBuffer ) {
		this.buffer = audioBuffer;
		this.duration = audioBuffer.duration;
		return audioBuffer;
	},
	_setDataFromArrayBuffer( arrayBuffer ) {
		return this.ctx.decodeAudioData( arrayBuffer )
			.then( this._setDataFromAudioBuffer.bind( this ) );
	},
	_setDataFromBlob( blob ) {
		var that = this,
			reader = new FileReader();

		return new Promise( function( resolve, reject ) {
			reader.onloadend = function() {
				resolve( that._setDataFromArrayBuffer( reader.result ) );
			};
			reader.readAsArrayBuffer( blob );
		} );
	},
	_setDataFromURL( url ) {
		return fetch( url )
			.then( function( res ) { return res.arrayBuffer(); } )
			.then( this._setDataFromArrayBuffer.bind( this ) );
	}
};
