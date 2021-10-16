"use strict";

class gswaEncodeWAV {
	static encode( buffer, opt ) {
		const nbChannels = buffer.numberOfChannels,
			sampleRate = buffer.sampleRate,
			format = opt && opt.float32 ? 3 : 1,
			bitsPerSample = format === 3 ? 32 : 16,
			bytesPerSample = bitsPerSample / 8,
			bytesPerbloc = nbChannels * bytesPerSample,
			samples = nbChannels === 2
				? gswaEncodeWAV.#interleave( buffer.getChannelData( 0 ), buffer.getChannelData( 1 ) )
				: buffer.getChannelData( 0 ),
			dataSize = samples.length * bytesPerSample,
			arrBuffer = new ArrayBuffer( 44 + dataSize ),
			data = new DataView( arrBuffer );

		gswaEncodeWAV.#setString( data, 0, "RIFF" );           // FileTypeBlocID(4) : "RIFF"
		data.setUint32( 4, 36 + dataSize, true );              // FileSize(4)       : headerSize + dataSize - 8
		gswaEncodeWAV.#setString( data, 8, "WAVE" );           // FileFormatID(4)   : "WAVE"
		gswaEncodeWAV.#setString( data, 12, "fmt " );          // FormatBlocID(4)   : "fmt "
		data.setUint32( 16, 16, true );                        // BlocSize(4)       : 16
		data.setUint16( 20, format, true );                    // AudioFormat(2)    : Format du stockage dans le fichier (1: PCM, ...)
		data.setUint16( 22, nbChannels, true );                // nbChannels(2)     : 1, 2, ..., 6
		data.setUint32( 24, sampleRate, true );                // sampleRate(4)     : 11025, 22050, 44100
		data.setUint32( 28, sampleRate * bytesPerbloc, true ); // bytesPerSec(4)    : sampleRate * bytesPerbloc
		data.setUint16( 32, bytesPerbloc, true );              // bytesPerbloc(2)   : nbChannels * bitsPerSample / 8
		data.setUint16( 34, bitsPerSample, true );             // bitsPerSample(2)  : 8, 16, 24
		gswaEncodeWAV.#setString( data, 36, "data" );          // DataBlocID(4)     : "data"
		data.setUint32( 40, dataSize, true );                  // dataSize(4)       : fileSize - 44
		( format === 1
			? gswaEncodeWAV.#bufToInt16
			: gswaEncodeWAV.#bufToFloat32
		)( data, 44, samples );
		return arrBuffer;
	}

	// .........................................................................
	static #interleave( ldata, rdata ) {
		const len = ldata.length + rdata.length,
			arr = new Float32Array( len );

		for ( let i = 0, j = 0; i < len; ++j ) {
			arr[ i++ ] = ldata[ j ];
			arr[ i++ ] = rdata[ j ];
		}
		return arr;
	}
	static #setString( data, offset, str ) {
		for ( let i = 0; i < str.length; ++i ) {
			data.setUint8( offset + i, str.charCodeAt( i ) );
		}
	}
	static #bufToInt16( data, offset, samples ) {
		for ( let i = 0; i < samples.length; ++i ) {
			const s = Math.max( -1, Math.min( samples[ i ], 1 ) );

			data.setInt16( offset + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true );
		}
	}
	static #bufToFloat32( data, offset, samples ) {
		for ( let i = 0; i < samples.length; ++i ) {
			data.setFloat32( offset + i * 4, samples[ i ], true );
		}
	}
}
