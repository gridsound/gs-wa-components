"use strict";

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
	drawWaveForm: function( canvas, colorWave, colorBack ) {
		var
			l, r,
			i = 0,
			h = canvas.height,
			w = canvas.width,
			h2 = h / 2,
			canvasCtx = canvas.getContext( "2d" ),
			lChan = this.getPeaks( 0, w ),
			rChan = this.buffer.numberOfChannels > 1 ? this.getPeaks( 1, w ) : lChan
		;

		if ( colorBack && colorWave ) {
			canvasCtx.fillStyle = colorBack;
			canvasCtx.fillRect( 0, 0, w, h );
		}
		if ( colorBack || colorWave ) {
			canvasCtx.strokeStyle = colorWave || colorBack;
			canvasCtx.beginPath();
			for ( ; i < w; ++i ) {
				l = h2 * ( 1 - lChan[ i ] );
				r = h2 * ( 1 + rChan[ i ] );
				canvasCtx.moveTo( i, colorWave ? l : h );
				canvasCtx.lineTo( i, r );
				if ( !colorWave ) {
					canvasCtx.moveTo( i, l );
					canvasCtx.lineTo( i, 0 );
				}
			}
			canvasCtx.stroke();
		}
		return canvas;
	}
};
