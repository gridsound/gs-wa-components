"use strict";

(function() {

function colorPix( data, index, color ) {
	data[ index ] = color[ 0 ];    
	data[ index + 1 ] = color[ 1 ];    
	data[ index + 2 ] = color[ 2 ];
	data[ index + 3 ] = color[ 3 ];    
}

function waveform( wbuf, canvas, color, inverted ) {
	var
		img,
		y, ymin, ymax,
		x = 0,
		w = canvas.width,
		h = canvas.height,
		h2 = h / 2,
		canvasCtx = canvas.getContext( "2d" ),
		lChan = wbuf.getPeaks( 0, w ),
		rChan = wbuf.buffer.numberOfChannels > 1 ? wbuf.getPeaks( 1, w ) : lChan
	;

	if ( inverted ) {
		canvasCtx.fillStyle = "rgba(" +
			color[ 0 ] + "," +
			color[ 1 ] + "," +
			color[ 2 ] + "," +
			color[ 3 ] + ")";
		canvasCtx.fillRect( 0, 0, w, h );
		color = [ 0, 0, 0, 0 ];
	}

	img = inverted
		? canvasCtx.getImageData( 0, 0, w, h )
		: canvasCtx.createImageData( w, h );

	for ( ; x < w; ++x ) {
		ymin = ~~( h2 * ( 1 - lChan[ x ] ) );
		ymax = ~~( h2 * ( 1 + rChan[ x ] ) );
		for( y = ymin; y <= ymax ; ++y ) {
			colorPix( img.data, ( y * w + x ) * 4, color );
		}
		colorPix( img.data, ( h2 * w + x ) * 4, color );
	}
	canvasCtx.putImageData( img, 0, 0 );
	return canvas;
}

walContext.Buffer.prototype.drawWaveform = function( canvas, color ) {
	return waveform( this, canvas, color );
};

walContext.Buffer.prototype.drawInvertedWaveform = function( canvas, color ) {
	return waveform( this, canvas, color, true );
};

})();