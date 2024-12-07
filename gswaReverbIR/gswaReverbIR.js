"use strict";

class gswaReverbIR {
	static $createIR( ctx, fadein, decay ) {
		const dur = fadein + decay;
		const buf = dur > 0
			? gswaNoise.$createBuffer( ctx, dur )
			: ctx.createBuffer( 2, 1, ctx.sampleRate );

		if ( dur > 0 ) {
			const len = buf.length;
			const fadeinLen = fadein / dur * len | 0;
			const decayLen = len - fadeinLen;
			const chan0 = buf.getChannelData( 0 );
			const chan1 = buf.getChannelData( 1 );

			for ( let i = 0; i < fadeinLen; ++i ) {
				const v = GSUeaseInCirc( i / fadeinLen );

				chan0[ i ] *= v;
				chan1[ i ] *= v;
			}
			for ( let i = 0; i < decayLen; ++i ) {
				const v = 1 - GSUeaseOutCirc( i / decayLen );

				chan0[ fadeinLen + i ] *= v;
				chan1[ fadeinLen + i ] *= v;
			}
		}
		return buf;
	}
}
