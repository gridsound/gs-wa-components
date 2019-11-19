"use strict";

const gswaPeriodicWaves = Object.freeze( {
	list: new Map(),
	_cache: new Map(),

	clearCache() {
		this._cache.clear();
	},
	get( ctx, name ) {
		let p = this._cache.get( name );

		if ( !p ) {
			const w = gswaPeriodicWaves.list.get( name );

			p = ctx.createPeriodicWave( w.real, w.imag );
			this._cache.set( name, p );
		}
		return p;
	},
} );
