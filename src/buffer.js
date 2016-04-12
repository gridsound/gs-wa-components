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
			bufTimeA = ~~( timeA * this.buffer.sampleRate ),
			sampleSize = bufRangeSize / nbPeaks,
			peaksIncr = ~~( sampleSize / 10 )
		;

		for ( ; x < nbPeaks; ++x ) {
			a = ~~( bufTimeA + x * sampleSize );
			b = ~~( a + sampleSize );
			max = 0;
			for ( ; a < b; a += peaksIncr ) {
				max = Math.max( max, Math.abs( buf[ a ] ) );
			}
			peaks[ x ] = max;
		}
		return peaks;
	},
	getWaveForm: function( width, height, colorWave, colorBack ) {
		var
			leftChan = this.getPeaks( 0, width ),
			rightChan = this.getPeaks( 1, width ),
			canvas = document.createElement( "canvas" ),
			canvasCtx = canvas.getContext('2d'),
			m = height / 2
		;

		canvas.width = width;
		canvas.height = height;
		if ( !colorBack && !colorWave )
			return null;
		if ( colorBack && colorWave) {
			canvasCtx.fillStyle = colorBack;
			canvasCtx.fillRect( 0, 0, width, height );
		}
		canvasCtx.strokeStyle = colorWave || colorBack;
		canvasCtx.lineCap = "round";
		canvasCtx.beginPath();
		for ( var i = 0; i < width; i++ ) {
			var l = m * ( 1 - leftChan[ i ] );
			var r = m * ( 1 + rightChan[ i ] );
			canvasCtx.moveTo( i, colorWave ? l : height );
			canvasCtx.lineTo( i, r );
			if ( !colorWave ) {
				canvasCtx.moveTo( i, l );
				canvasCtx.lineTo( i, 0 );
			}
		}
		canvasCtx.stroke();
	
		return canvas;
	}
}
