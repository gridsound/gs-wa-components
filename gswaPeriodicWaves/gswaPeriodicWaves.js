"use strict";

class gswaPeriodicWaves {
	static list = new Map();
	static #cache = new Map();

	static clearCache() {
		gswaPeriodicWaves.#cache.clear();
	}
	static get( ctx, name ) {
		let p = gswaPeriodicWaves.#cache.get( name );

		if ( !p ) {
			const w = gswaPeriodicWaves.list.get( name );

			p = ctx.createPeriodicWave( w.real, w.imag );
			gswaPeriodicWaves.#cache.set( name, p );
		}
		return p;
	}
}
