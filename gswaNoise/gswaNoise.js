"use strict";

class gswaNoise {
	static #buffer = null;
	static #duration = 4;

	// .........................................................................
	static $initBuffer( ctx ) {
		gswaNoise.#buffer = gswaNoise.$createBuffer( ctx, gswaNoise.#duration );
	}
	static $createBuffer( ctx, dur ) {
		const bufSize = dur * ctx.sampleRate;
		const buf = ctx.createBuffer( 2, bufSize, ctx.sampleRate );
		const chan0 = buf.getChannelData( 0 );
		const chan1 = buf.getChannelData( 1 );

		for ( let i = 0; i < bufSize; ++i ) {
			chan0[ i ] = Math.random() * 2 - 1;
			chan1[ i ] = Math.random() * 2 - 1;
		}
		return buf;
	}
	static $startABSN( ctx, when, dur ) {
		const absn = ctx.createBufferSource();

		absn.buffer = gswaNoise.#buffer;
		absn.loop = true;
		absn.start( when, Math.random() * gswaNoise.#duration );
		if ( Number.isFinite( dur ) ) {
			absn.stop( when + dur );
		}
		return absn;
	}
}
