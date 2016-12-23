"use strict";

( function() {

walContext.encodeWAV = function( buffer, opt ) {
	var numChannels = buffer.numberOfChannels,
		sampleRate = buffer.sampleRate,
		format = opt && opt.float32 ? 3 : 1,
		bitDepth = format === 3 ? 32 : 16,
		result = numChannels === 2
			? interleave( buffer.getChannelData( 0 ), buffer.getChannelData( 1 ) )
			: buffer.getChannelData( 0 );

	return encodeWAV( result, format, sampleRate, numChannels, bitDepth );
};

function interleave( ldata, rdata ) {
	var i = 0,
		idata = 0,
		len = ldata.length + rdata.length,
		arr = new Float32Array( len );

	while ( i < len ) {
		arr[ i++ ] = ldata[ idata ];
		arr[ i++ ] = rdata[ idata++ ];
	}
	return arr;
}

function encodeWAV( samples, format, sampleRate, numChannels, bitDepth ) {
	var bytesPerSample = bitDepth / 8,
		blockAlign = numChannels * bytesPerSample,
		buffer = new ArrayBuffer( 44 + samples.length * bytesPerSample ),
		view = new DataView( buffer );

	writeString( view, 0, "RIFF" );                                  // RIFF identifier
	view.setUint32( 4, 36 + samples.length * bytesPerSample, true ); // RIFF chunk length
	writeString( view, 8, "WAVE" );                                  // RIFF type
	writeString( view, 12, "fmt " );                                 // format chunk identifier
	view.setUint32( 16, 16, true );                                  // format chunk length
	view.setUint16( 20, format, true );                              // sample format ( raw )
	view.setUint16( 22, numChannels, true );                         // channel count
	view.setUint32( 24, sampleRate, true );                          // sample rate
	view.setUint32( 28, sampleRate * blockAlign, true );             // byte rate ( sample rate * block align )
	view.setUint16( 32, blockAlign, true );                          // block align ( channel count * bytes per sample )
	view.setUint16( 34, bitDepth, true );                            // bits per sample
	writeString( view, 36, "data" );                                 // data chunk identifier
	view.setUint32( 40, samples.length * bytesPerSample, true );     // data chunk length
	if ( format === 1 ) {                                            // Raw PCM
		floatTo16BitPCM( view, 44, samples );
	} else {
		writeFloat32( view, 44, samples );
	}
	return buffer;
}

function writeString( view, offset, string ) {
	for ( var i = 0; i < string.length; ++i ) {
		view.setUint8( offset + i, string.charCodeAt( i ) );
	}
}

function floatTo16BitPCM( output, offset, input ) {
	for ( var i = 0; i < input.length; ++i, offset += 2 ) {
		var s = Math.max( -1, Math.min( input[ i ], 1 ) );

		output.setInt16( offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true );
	}
}

function writeFloat32( output, offset, input ) {
	for ( var i = 0; i < input.length; ++i, offset += 4 ) {
		output.setFloat32( offset, input[ i ], true );
	}
}

} )();
