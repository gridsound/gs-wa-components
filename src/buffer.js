"use strict";

(function() {

function waveform( wbuf, canvas, color, inverted ) {
	var
		i = 0,
		w = canvas.width,
		h = canvas.height,
		h2 = h / 2,
		canvasCtx = canvas.getContext( "2d" ),
		lChan = wbuf.getPeaks( 0, w ),
		rChan = wbuf.buffer.numberOfChannels > 1 ? wbuf.getPeaks( 1, w ) : lChan
	;

	canvasCtx.strokeStyle = color ;
	canvasCtx.beginPath();
	if ( inverted ) {
		for ( ; i < w; ++i ) {
			canvasCtx.moveTo( i, h );
			canvasCtx.lineTo( i, h2 * ( 1 + rChan[ i ] ) );
			canvasCtx.moveTo( i, h2 * ( 1 - lChan[ i ] ) );
			canvasCtx.lineTo( i, 0 );
		}
	} else {
		for ( ; i < w; ++i ) {
			canvasCtx.moveTo( i, h2 * ( 1 - lChan[ i ] ) );
			canvasCtx.lineTo( i, h2 * ( 1 + rChan[ i ] ) );
		}
	}
	canvasCtx.stroke();
	return canvas;
}

walContext.Buffer = function( wCtx, file, fn ) {
	var
		that = this,
		reader = new FileReader()
	;

	this.wCtx = wCtx;
	this.isReady = false;

	function decode( fileBuffer ) {
		that.wCtx.ctx.decodeAudioData( fileBuffer, function( buffer ) {
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

walContext.Buffer.prototype = {
	createSample: function() {
		var wSample = new walContext.Sample( this.wCtx, this );
		return wSample;
	},
	getPeaks: function( channelId, nbPeaks, timeA, timeB ) {
		timeA = timeA || 0;
		timeB = timeB || this.buffer.duration;
		
		var
			a, b, max,
			x = 0,
			peaks = new Array( nbPeaks ),
			buf = this.buffer.getChannelData( channelId ),
			bufRangeSize = ( timeB - timeA ) * this.buffer.sampleRate,
			bufTimeA = timeA * this.buffer.sampleRate,
			sampleSize = bufRangeSize / nbPeaks,
			peaksIncr = sampleSize / 10
		;

		for ( ; x < nbPeaks; ++x ) {
			a = bufTimeA + x * sampleSize;
			b = a + sampleSize;
			max = 0;
			for ( ; a < b; a += peaksIncr ) {
				max = Math.max( max, Math.abs( buf[ ~~a ] ) );
			}
			peaks[ x ] = max;
		}
		return peaks;
	},
	drawWaveform: function( canvas, color ) {
		return waveform( this, canvas, color );
	},
	drawInvertedWaveform: function( canvas, color ) {
		return waveform( this, canvas, color, true );
	}
};

})();
