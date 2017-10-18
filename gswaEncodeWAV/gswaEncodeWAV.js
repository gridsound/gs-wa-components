"use strict";

( function() {

window.gswaEncodeWAV = function( buffer, opt ) {
	var nbChannels = buffer.numberOfChannels,
		sampleRate = buffer.sampleRate,
		format = opt && opt.float32 ? 3 : 1,
		bitsPerSample = format === 3 ? 32 : 16,
		bytesPerSample = bitsPerSample / 8,
		bytesPerbloc = nbChannels * bytesPerSample,
		samples = nbChannels === 2
			? interleave( buffer.getChannelData( 0 ), buffer.getChannelData( 1 ) )
			: buffer.getChannelData( 0 ),
		dataSize = samples.length * bytesPerSample,
		arrBuffer = new ArrayBuffer( 44 + dataSize ),
		view = new DataView( arrBuffer );

	viewSetString( view, 0, "RIFF" );                      // FileTypeBlocID(4) : "RIFF"
	view.setUint32( 4, 36 + dataSize, true );              // FileSize(4)       : headerSize + dataSize - 8
	viewSetString( view, 8, "WAVE" );                      // FileFormatID(4)   : "WAVE"
	viewSetString( view, 12, "fmt " );                     // FormatBlocID(4)   : "fmt "
	view.setUint32( 16, 16, true );                        // BlocSize(4)       : 16
	view.setUint16( 20, format, true );                    // AudioFormat(2)    : Format du stockage dans le fichier (1: PCM, ...)
	view.setUint16( 22, nbChannels, true );                // nbChannels(2)     : 1, 2, ..., 6
	view.setUint32( 24, sampleRate, true );                // sampleRate(4)     : 11025, 22050, 44100
	view.setUint32( 28, sampleRate * bytesPerbloc, true ); // bytesPerSec(4)    : sampleRate * bytesPerbloc
	view.setUint16( 32, bytesPerbloc, true );              // bytesPerbloc(2)   : nbChannels * bitsPerSample / 8
	view.setUint16( 34, bitsPerSample, true );             // bitsPerSample(2)  : 8, 16, 24
	viewSetString( view, 36, "data" );                     // DataBlocID(4)     : "data"
	view.setUint32( 40, dataSize, true );                  // dataSize(4)       : fileSize - 44

	( format === 1 ? bufToInt16 : bufToFloat32 )( view, 44, samples );
	return arrBuffer;
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

function viewSetString( view, offset, str ) {
	for ( var i = 0; i < str.length; ++i ) {
		view.setUint8( offset + i, str.charCodeAt( i ) );
	}
}

function bufToInt16( view, offset, samples ) {
	for ( var s, i = 0; i < samples.length; ++i, offset += 2 ) {
		s = Math.max( -1, Math.min( samples[ i ], 1 ) );
		view.setInt16( offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true );
	}
}

function bufToFloat32( view, offset, samples ) {
	for ( var i = 0; i < samples.length; ++i, offset += 4 ) {
		view.setFloat32( offset, samples[ i ], true );
	}
}

} )();
