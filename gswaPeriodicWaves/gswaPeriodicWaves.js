"use strict";

class gswaPeriodicWaves {
	static #list = new Map();
	static #cache = new Map();

	static $clearCache() {
		gswaPeriodicWaves.#cache.clear();
	}
	static $get( ctx, name ) {
		let p = gswaPeriodicWaves.#cache.get( name );

		if ( !p ) {
			const w = gswaPeriodicWaves.#list.get( name );

			if ( w ) {
				p = ctx.createPeriodicWave( w.real, w.imag );
				gswaPeriodicWaves.#cache.set( name, p );
			}
		}
		return p;
	}
	static $loadWaves( waves ) {
		waves.forEach( ( [ name, w ] ) => {
			const imag = w.imag || w.real.map( () => 0 );
			const real = w.real || w.imag.map( () => 0 );

			real[ 0 ] =
			imag[ 0 ] = 0;
			gswaPeriodicWaves.#list.set( name, Object.freeze( {
				real: new Float32Array( real ),
				imag: new Float32Array( imag ),
			} ) );
		} );
		return gswaPeriodicWaves.#list;
	}
}
