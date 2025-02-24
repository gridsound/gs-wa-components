"use strict";

class gswaPeriodicWaves {
	static #list = new Map();
	static #cache = new Map();

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
				p = ctx.createPeriodicWave( w.real, w.imag, { disableNormalization: name === "square" || name.startsWith( "custom" ) } );
				gswaPeriodicWaves.#cache.set( name, p );
			}
		}
		return p;
	}
	static $delete( name ) {
		gswaPeriodicWaves.#list.delete( name );
		gswaPeriodicWaves.#cache.delete( name );
	}
	static $loadWaves( waves ) {
		waves.forEach( w => gswaPeriodicWaves.#loadWave( ...w ) );
		return gswaPeriodicWaves.#list;
	}
	static $loadCustom( name, points ) {
		const curve = GSUsampleDottedCurve( points, 2 ** 11 );
		const wave = GSUifft( {
			real: curve.reverse(),
			imag: GSUnewArray( curve.length, 0 ),
		} );

		gswaPeriodicWaves.#cache.delete( name );
		gswaPeriodicWaves.#loadWave( name, wave, "noFirstZero" );
		return wave;
	}
	static #loadWave( name, wave, noFirstZero ) {
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
