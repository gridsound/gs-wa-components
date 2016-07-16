"use strict";

( function() {

walContext.Buffer.prototype.waveformSVG = function( svg, w, h ) {
	var x,
		h2a = h / 2 - .5,
		h2b = h / 2 + .5,
		d = "M0 " + h2a,
		path = svg ? svg.firstChild : document.createElement( "path" ),
		lChan = this.getPeaks( 0, w ),
		rChan = this.buffer.numberOfChannels > 1 ? this.getPeaks( 1, w ) : lChan;

	if ( !svg ) {
		svg = document.createElement( "svg" );
		svg.appendChild( path );
	}

	for ( x = 0; x < w; ++x ) {
		d += " L" + x + " " + ( h2a - lChan[ x ] * h2a );
	}
	for ( x = w - 1; x >= 0; --x ) {
		d += " L" + x + " " + ( h2b + rChan[ x ] * h2a );
	}
	path.setAttribute( "d", d );
	svg.setAttribute( "viewBox", "0 0 " + w + " " + h );
	return svg;
};

function colorPix( data, index, color ) {
	data[ index ] = color[ 0 ];    
	data[ index + 1 ] = color[ 1 ];    
	data[ index + 2 ] = color[ 2 ];
	data[ index + 3 ] = color[ 3 ];    
}

function waveform( wbuf, canvasImg, color, inverted ) {
	var x, y, ymin, ymax,
		data = canvasImg.data,
		w = canvasImg.width,
		h = canvasImg.height,
		h2 = h / 2,
		lChan = wbuf.getPeaks( 0, w ),
		rChan = wbuf.buffer.numberOfChannels > 1 ? wbuf.getPeaks( 1, w ) : lChan;

	if ( inverted ) {
		for ( x = 0; x < data.length; x += 4 ) {
			colorPix( data, x, color );
		}
		color = [ 0, 0, 0, 0 ];
	}

	for ( x = 0; x < w; ++x ) {
		ymin = ~~( h2 * ( 1 - lChan[ x ] ) );
		ymax = ~~( h2 * ( 1 + rChan[ x ] ) );
		for( y = ymin; y <= ymax ; ++y ) {
			colorPix( data, ( y * w + x ) * 4, color );
		}
		colorPix( data, ( h2 * w + x ) * 4, color );
	}
	return canvasImg;
}

walContext.Buffer.prototype.drawWaveform = function( canvasImg, color ) {
	return waveform( this, canvasImg, color );
};

walContext.Buffer.prototype.drawInvertedWaveform = function( canvasImg, color ) {
	return waveform( this, canvasImg, color, true );
};

} )();
