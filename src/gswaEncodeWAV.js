"use strict";

( function() {

window.gswaEncodeWAV = function( buffer, opt ) {
	var numChannels = buffer.numberOfChannels,
		sampleRate = buffer.sampleRate,
		format = opt && opt.float32 ? 3 : 1,
		bitsPerSample = format === 3 ? 32 : 16,
		bytesPerSample = bitsPerSample / 8,
		blockAlign = numChannels * bytesPerSample,
		samples = numChannels === 2
			? interleave( buffer.getChannelData( 0 ), buffer.getChannelData( 1 ) )
			: buffer.getChannelData( 0 ),
		arrBuffer = new ArrayBuffer( 44 + samples.length * bytesPerSample ),
		view = new DataView( arrBuffer );

	writeString( view, 0, "RIFF" );
	view.setUint32( 4, 36 + samples.length * bytesPerSample, true ); // RIFF chunk length
	writeString( view, 8, "WAVE" );
	writeString( view, 12, "fmt " );
	view.setUint32( 16, 16, true ); // format chunk length
	view.setUint16( 20, format, true );
	view.setUint16( 22, numChannels, true );
	view.setUint32( 24, sampleRate, true );
	view.setUint32( 28, sampleRate * blockAlign, true ); // byteRate
	view.setUint16( 32, blockAlign, true );
	view.setUint16( 34, bitsPerSample, true );
	writeString( view, 36, "data" ); // data chunk identifier
	view.setUint32( 40, samples.length * bytesPerSample, true ); // data chunk length
	( format === 1 ? bufToInt16 : bufToFloat32 )( view, 44, samples ); // Raw PCM
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

function writeString( view, offset, str ) {
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
