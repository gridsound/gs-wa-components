"use strict";

class gswaPeriodicWaves {
	static #list = new Map();
	static #cache = new Map();
	static #wavetableList = new Map();

	static $debug() {
		return {
			gswaPeriodicWaves_nbList: gswaPeriodicWaves.#list.size,
			gswaPeriodicWaves_nbCache: gswaPeriodicWaves.#cache.size,
		};
	}
	static $clearCache() {
		gswaPeriodicWaves.#cache.clear();
	}
	static $get( ctx, name ) {
		let p = gswaPeriodicWaves.#cache.get( name );

		if ( !p ) {
			const w = gswaPeriodicWaves.#list.get( name );

			if ( w ) {
				p = GSUaudioPeriodicWave( ctx, w.real, w.imag, { disableNormalization: name === "square" || name.startsWith( "custom" ) } );
				gswaPeriodicWaves.#cache.set( name, p );
			}
		}
		return p;
	}
	static $getWavetable( ctx, name ) {
		return gswaPeriodicWaves.#wavetableList.get( name )
			.map( wname => gswaPeriodicWaves.$get( ctx, wname ) );
	}
	static $delete( name ) {
		const wt = gswaPeriodicWaves.#wavetableList.get( name );

		if ( wt ) {
			wt.forEach( wname => gswaPeriodicWaves.#deleteWave( wname ) );
			gswaPeriodicWaves.#wavetableList.delete( name );
		} else {
			gswaPeriodicWaves.#deleteWave( name );
		}
	}
	static $loadWaves( waves ) {
		waves.forEach( w => gswaPeriodicWaves.#loadWaveImagReal( ...w ) );
		return gswaPeriodicWaves.#list;
	}
	static $addWavetable( name, obj ) {
		const wt = [];
		const ret = [];
		const objEnt = Object.entries( obj ).sort( ( a, b ) => a[ 1 ].index - b[ 1 ].index );

		objEnt.forEach( kv => {
			const wname = `${ name }.${ kv[ 0 ] }`;

			wt.push( wname );
			ret.push( gswaPeriodicWaves.#loadWaveDots( wname, kv[ 1 ].curve ) );
		} );
		gswaPeriodicWaves.#wavetableList.set( name, wt );
		return ret;
	}
	static $updateWavetable( name, obj, objSource ) {
		if ( !gswaPeriodicWaves.#wavetableList.has( name ) ) {
			return gswaPeriodicWaves.$addWavetable( name, obj );
		}
		GSUforEach( obj, ( w, wId ) => {
			const wname = `${ name }.${ wId }`;

			if ( !w ) {
				gswaPeriodicWaves.#deleteWave( wname );
			} else if ( w.curve ) {
				gswaPeriodicWaves.#deleteWave( wname );
				gswaPeriodicWaves.#loadWaveDots( wname, objSource[ wId ].curve );
			}
		} );

		const objEnt = Object.entries( objSource ).sort( ( a, b ) => a[ 1 ].index - b[ 1 ].index );
		const wt = objEnt.map( kv => `${ name }.${ kv[ 0 ] }` );

		gswaPeriodicWaves.#wavetableList.set( name, wt );
		return [ gswaPeriodicWaves.#list.get( wt[ 0 ] ) ];
	}

	// .........................................................................
	static #deleteWave( name ) {
		gswaPeriodicWaves.#list.delete( name );
		gswaPeriodicWaves.#cache.delete( name );
	}
	static #loadWaveDots( name, points ) {
		const curve = GSUarrayResize( points, 2 ** 11 );
		const wave = GSUmathIFFT( {
			real: curve.reverse(),
			imag: GSUnewArray( curve.length, 0 ),
		} );

		gswaPeriodicWaves.#cache.delete( name );
		gswaPeriodicWaves.#loadWaveImagReal( name, wave, "noFirstZero" );
		return wave;
	}
	static #loadWaveImagReal( name, wave, noFirstZero ) {
		const imag = wave.imag || wave.real.map( () => 0 );
		const real = wave.real || wave.imag.map( () => 0 );

		if ( noFirstZero !== "noFirstZero" ) {
			real[ 0 ] =
			imag[ 0 ] = 0;
		}
		gswaPeriodicWaves.#list.set( name, Object.freeze( {
			real: new Float32Array( real ),
			imag: new Float32Array( imag ),
		} ) );
	}
}
