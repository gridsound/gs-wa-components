"use strict";

class gswaBuffers {
	static #headerSize = 4;
	static #buflist = new Map();
	static #wtlist = new Map( [
		[ "sine",     gswaBuffers.#format( [ GSUmathWaveSine(     2048 ) ] ) ],
		[ "triangle", gswaBuffers.#format( [ GSUmathWaveTriangle( 2048 ) ] ) ],
		[ "sawtooth", gswaBuffers.#format( [ GSUmathWaveSawtooth( 2048 ) ] ) ],
		[ "square",   gswaBuffers.#format( [ GSUmathWaveSquare(   2048 ) ] ) ],
	] );

	// .........................................................................
	static $sabClear() {
		gswaBuffers.#wtlist.clear();
		gswaBuffers.#buflist.clear();
	}
	static $sabDeleteWavetable( id ) {
		gswaBuffers.#wtlist.delete( id );
	}
	static $sabDeleteBuffer( id ) {
		gswaBuffers.#buflist.delete( id );
	}
	static $sabGetWavetable( id ) {
		return gswaBuffers.#wtlist.get( id )?.$sab;
	}
	static $sabGetBuffer( id ) {
		return gswaBuffers.#buflist.get( id ) || [];
	}
	static $sabSetWavetable( id, waves ) {
		if ( __LOCALHOST__ ) {
			gswaBuffers.#check( waves );
		}
		if ( id in GSUmathWaveFns ) {
			return;
		}

		const arr = gswaBuffers.#wtlist.get( id )?.$arr;
		const wlen = waves[ 0 ].length;

		if ( arr && arr.length === gswaBuffers.#headerSize + waves.length * wlen ) {
			GSUforEach( waves, ( wv, i ) => arr.set( wv, gswaBuffers.#headerSize + i * wlen ) );
		} else {
			gswaBuffers.#wtlist.set( id, gswaBuffers.#format( waves ) );
		}
	}
	static $sabSetBuffer( id, buf ) {
		const arr = [
			gswaBuffers.#bufToSab( buf, 0 ),
			gswaBuffers.#bufToSab( buf, 1 ),
		];

		gswaBuffers.#buflist.set( id, arr );
		return arr;
	}

	// .........................................................................
	static #bufToSab( buf, chan ) {
		const arr = buf.getChannelData( chan );
		const sab = new SharedArrayBuffer( arr.length * Float32Array.BYTES_PER_ELEMENT );

		new Float32Array( sab ).set( arr, 0 );
		return sab;
	}
	static #format( wt ) {
		const N = wt.length;
		const L = wt[ 0 ].length;
		const sab = new SharedArrayBuffer( ( gswaBuffers.#headerSize + N * L ) * Float32Array.BYTES_PER_ELEMENT );
		const arr = new Float32Array( sab );

		arr[ 0 ] = N;
		arr[ 1 ] = L;
		arr[ 2 ] = 0;
		arr[ 3 ] = 0;
		for ( let w = 0; w < N; ++w ) {
			const wv = wt[ w ];
			const ind = gswaBuffers.#headerSize + w * L;

			for ( let s = 0; s < L; ++s ) {
				arr[ ind + s ] = wv[ s ];
			}
		}
		return Object.seal( {
			$sab: sab,
			$arr: arr,
		} );
	}
	static #check( wt ) {
		const N = wt?.length || 0;
		const L = wt?.[ 0 ]?.length || 0;
		let err = 0;

		if ( N < 0 ) {
			err = 1;
		} else if ( L < 2 && N !== 0 ) {
			err = 2;
		} else {
			for ( let i = 0; i < N && !err; ++i ) {
				const wv = wt[ i ];

				if ( wv.length !== L ) {
					err = 3;
				} else {
					for ( let j = 0; j < L && !err; ++j ) {
						if ( wv[ j ] < -1 || wv[ j ] > 1 ) {
							err = 4;
						}
					}
				}
			}
		}
		if ( err > 0 ) {
			throw new TypeError( `gswaBuffers: $sabSetWavetable, #err${ err }, (${ N }, ${ L }), #arg1 should be an Array (>=1) of same-size float-array (>=2) each float should be in [-1;1]` );
		}
	}
}
