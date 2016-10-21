"use strict";

( function() {

walContext.Buffer = function( wCtx, file, resolve, reject ) {
	var that = this,
		reader = new FileReader();

	this.wCtx = wCtx;
	this.isReady = false;

	function decode( fileBuffer ) {
		that.wCtx.ctx.decodeAudioData( fileBuffer, function( buffer ) {
			that.buffer = buffer;
			that.isReady = true;
			resolve( that );
		}, reject );
	}

	// If `file` is a file waiting to be read.
	if ( file.name ) {
		reader.addEventListener( "loadend", function() {
			decode( reader.result );
		} );
		reader.readAsArrayBuffer( file );

	// If `file` is already a fileBuffer.
	} else {
		decode( file );
	}
};

walContext.Buffer.prototype = {
	getPeaks: function( channelId, nbPeaks, offset, dur ) {
		offset = offset || 0;
		dur = dur === undefined
			? this.buffer.duration - offset
			: Math.min( dur, this.buffer.duration - offset );
		
		var a, b, max,
			x = 0,
			peaks = new Array( nbPeaks ),
			buf = this.buffer.getChannelData( channelId ),
			samplesLen = dur * this.buffer.sampleRate,
			offsetInd = offset * this.buffer.sampleRate,
			samplesPerPeaks = samplesLen / nbPeaks,
			samplesIncr = ~~Math.max( 1, samplesPerPeaks / 10 );

		for ( ; x < nbPeaks; ++x ) {
			a = offsetInd + x * samplesPerPeaks;
			b = a + samplesPerPeaks;
			max = 0;
			for ( ; a < b; a += samplesIncr ) {
				max = Math.max( max, Math.abs( buf[ ~~a ] ) );
			}
			peaks[ x ] = max;
		}
		return peaks;
	}
};

} )();
