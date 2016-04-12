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
	getWaveForm: function( width, height, colorLine, colorBack ) {
		var
			left,
			right,
			canvas,
			canvasCtx,
			y0
		;

		left = this.getPeaks( 0, width );
		right = this.getPeaks( 1, width );
		canvas = document.createElement( "canvas" );
		canvas.width = width;
		canvas.height = height;
		y0 = height / 2;
		canvasCtx = canvas.getContext('2d');
		if ( colorBack ) {
			canvasCtx.fillStyle = colorBack;
			canvasCtx.strokeStyle = colorBack;
		}
		if ( !colorLine && colorBack ) {
			canvasCtx.beginPath();		
			for ( var i = 0; i < width; i++) {
				canvasCtx.moveTo( i, 0 );
				canvasCtx.lineTo( i, y0 - ( left[ i ] * y0 ) );
				canvasCtx.moveTo( i, y0 + ( right[ i ] * y0 ) );
				canvasCtx.lineTo( i, height );
			}
			canvasCtx.stroke();
		} else if ( colorLine ) {
			if ( colorBack ) {
				canvasCtx.fillRect(0, 0, width, height);
				canvasCtx.strokeRect(0, 0, width, height);
			}
			console.log("toto");
			canvasCtx.fillStyle = colorLine;
			canvasCtx.strokeStyle = colorLine;
			canvasCtx.lineCap = "round";
			canvasCtx.beginPath();
			for ( var i = 0; i < width; i++) {
				canvasCtx.moveTo( i, y0 - ( left[ i ] * y0 ) );
				canvasCtx.lineTo( i, y0 + ( right[ i ] * y0 ) );
			}
			canvasCtx.stroke();
		}
		return canvas;
	}
}
