"use strict";

class gswaWTbuffers {
	static #headerSize = 4;
	static #list = new Map( [
		[ "sine",     gswaWTbuffers.#format( [ GSUmathWaveSine(     2048 ) ] ) ],
		[ "triangle", gswaWTbuffers.#format( [ GSUmathWaveTriangle( 2048 ) ] ) ],
		[ "sawtooth", gswaWTbuffers.#format( [ GSUmathWaveSawtooth( 2048 ) ] ) ],
		[ "square",   gswaWTbuffers.#format( [ GSUmathWaveSquare(   2048 ) ] ) ],
	] );

	// .........................................................................
	static $wtClear() {
		this.#list.clear();
	}
	static $wtDelete( id ) {
		this.#list.delete( id );
	}
	static $wtGetSharedBuffer( id ) {
		return this.#list.get( id ).$sab;
	}
	static $wtSet( id, waves ) {
		if ( __LOCALHOST__ ) {
			gswaWTbuffers.#check( waves );
		}
		if ( id in GSUmathWaveFns ) {
			return;
		}

		const arr = this.#list.get( id )?.$arr;
		const wlen = waves[ 0 ].length;

		if ( arr && arr.length === gswaWTbuffers.#headerSize + waves.length * wlen ) {
			GSUforEach( waves, ( wv, i ) => arr.set( wv, gswaWTbuffers.#headerSize + i * wlen ) );
		} else {
			this.#list.set( id, gswaWTbuffers.#format( waves ) );
		}
	}

	// .........................................................................
	static #format( wt ) {
		const N = wt.length;
		const L = wt[ 0 ].length;
		const sab = new SharedArrayBuffer( ( gswaWTbuffers.#headerSize + N * L ) * Float32Array.BYTES_PER_ELEMENT );
		const arr = new Float32Array( sab );

		arr[ 0 ] = N;
		arr[ 1 ] = L;
		arr[ 2 ] = 0;
		arr[ 3 ] = 0;
		for ( let w = 0; w < N; ++w ) {
			const wv = wt[ w ];
			const ind = gswaWTbuffers.#headerSize + w * L;

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
			throw new TypeError( `gswaWTbuffers: $wtSet, #err${err}, (${N}, ${L}), #arg1 should be an Array (>=1) of same-size float-array (>=2) each float should be in [-1;1]` );
		}
	}
}
