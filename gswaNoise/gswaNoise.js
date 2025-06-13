"use strict";

class gswaNoise {
	static #duration = 4;
	static #buffers = {
		white: null,
		pink: null,
		brown: null,
	};
	static #loops = {
		white: gswaNoise.#loopWhite,
		pink: gswaNoise.#loopPink,
		brown: gswaNoise.#loopBrown,
	};

	// .........................................................................
	static $initBuffer( ctx ) {
		gswaNoise.#buffers.white = gswaNoise.$createBuffer( ctx, gswaNoise.#duration, "white" );
		gswaNoise.#buffers.pink = gswaNoise.$createBuffer( ctx, gswaNoise.#duration, "pink" );
		gswaNoise.#buffers.brown = gswaNoise.$createBuffer( ctx, gswaNoise.#duration, "brown" );
	}
	static $createBuffer( ctx, dur, color = "white" ) {
		const bufSize = dur * ctx.sampleRate;
		const buf = GSUaudioBuffer( ctx, 2, bufSize, ctx.sampleRate );
		const chan0 = buf.getChannelData( 0 );
		const chan1 = buf.getChannelData( 1 );

		gswaNoise.#loops[ color ]( bufSize, chan0, chan1 );
		return buf;
	}
	static $startABSN( ctx, when, dur, color = "white" ) {
		const absn = GSUaudioBufferSource( ctx );

		absn.buffer = gswaNoise.#buffers[ color ];
		absn.loop = true;
		absn.start( when, Math.random() * gswaNoise.#duration );
		if ( Number.isFinite( dur ) ) {
			absn.stop( when + dur );
		}
		return absn;
	}

	// .........................................................................
	static #loopWhite( bufSize, chan0, chan1 ) {
		for ( let i = 0; i < bufSize; ++i ) {
			chan0[ i ] = Math.random() * 2 - 1;
			chan1[ i ] = Math.random() * 2 - 1;
		}
	}
	static #loopPink( bufSize, chan0, chan1 ) {
		gswaNoise.#loopPink2( bufSize, chan0 );
		gswaNoise.#loopPink2( bufSize, chan1 );
	}
	static #loopPink2( bufSize, chan ) {
		let b0, b1, b2, b3, b4, b5, b6;

		b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0;
		for ( let i = 0; i < bufSize; ++i ) {
			const white = Math.random() * 2 - 1;

			b0 = .99886 * b0 + white * .0555179;
			b1 = .99332 * b1 + white * .0750759;
			b2 = .96900 * b2 + white * .1538520;
			b3 = .86650 * b3 + white * .3104856;
			b4 = .55000 * b4 + white * .5329522;
			b5 = -.7616 * b5 - white * .0168980;
			chan[ i ] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * .5362;
			chan[ i ] *= .18; // gain
			b6 = white * .115926;
		}
	}
	static #loopBrown( bufSize, chan0, chan1 ) {
		gswaNoise.#loopBrown2( bufSize, chan0 );
		gswaNoise.#loopBrown2( bufSize, chan1 );
	}
	static #loopBrown2( bufSize, chan ) {
		let lastOut = 0;

		for ( let i = 0; i < bufSize; ++i ) {
			const white = Math.random() * 2 - 1;

			chan[ i ] = ( lastOut + ( .02 * white ) ) / 1.02;
			lastOut = chan[ i ];
			chan[ i ] *= 5; // gain
		}
	}
}
