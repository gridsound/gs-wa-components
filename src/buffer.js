"use strict";

WalContext.Buffer = function( ctx, file, fn ) {
	var
		that = this,
		reader = new FileReader()
	;

	this.ctx = ctx;
	this.isReady = false;

	function decode( fileBuffer ) {
		that.ctx.decodeAudioData( fileBuffer, function( buffer ) {
			that.buffer = buffer;
			that.isReady = true;
			if ( fn ) {
				fn( that );
			}
		});
	}

	// If `file` is a file waiting to be read.
	if ( file.name ) {
		reader.addEventListener( "loadend", function() {
			decode( reader.result );
		});
		reader.readAsArrayBuffer( file );

	// If `file` is already a fileBuffer.
	} else {
		decode( file );
	}
};

WalContext.Buffer.prototype = {
	createSample: function( dest ) {
		var wSample = new WalContext.Sample( this.ctx, this, dest );
		return wSample;
	}
}
