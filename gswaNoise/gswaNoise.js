"use strict";

class gswaNoise {
	static #buffer = null;

	// .........................................................................
	static $initBuffer( ctx ) {
		const srate = ctx.sampleRate;
		const bufSize = 1 * srate;
		const buf = ctx.createBuffer( 2, bufSize, srate );
		const chan0 = buf.getChannelData( 0 );
		const chan1 = buf.getChannelData( 1 );

		for ( let i = 0; i < bufSize; ++i ) {
			chan0[ i ] = Math.random() * 2 - 1;
			chan1[ i ] = Math.random() * 2 - 1;
		}
		gswaNoise.#buffer = buf;
	}

	// .........................................................................
	static $startABSN( ctx, when, dur ) {
		const absn = ctx.createBufferSource();

		absn.buffer = gswaNoise.#buffer;
		absn.loop = true;
		absn.start( when );
		if ( Number.isFinite( dur ) ) {
			absn.stop( when + dur );
		}
		return absn;
	}
}
