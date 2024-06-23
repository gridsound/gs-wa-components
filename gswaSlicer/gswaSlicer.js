"use strict";

class gswaSlicer {
	static $createBuffer( ctx, bufsrc, cropA, cropB, slices ) {
		const bufCropA = cropA * bufsrc.length | 0;
		const newlen = ( cropB - cropA ) * bufsrc.length | 0;
		const newbuf = ctx.createBuffer( bufsrc.numberOfChannels, newlen, ctx.sampleRate );

		Object.values( slices ).forEach( sli => {
			const obj = {
				$att: ctx.sampleRate * .01,
				$rel: ctx.sampleRate * .01,
				$srcInd: bufCropA + ( sli.x - ( sli.x - sli.y ) ) * newlen | 0,
				$dstInd: sli.x * newlen | 0,
				$cpyLen: sli.w * newlen | 0,
			};

			for ( let i = 0; i < bufsrc.numberOfChannels; ++i ) {
				obj.$srcArr = bufsrc.getChannelData( i );
				obj.$dstArr = newbuf.getChannelData( i );
				gswaSlicer.#copy( obj );
			}
		} );
		return newbuf;
	}
	static #copy( { $srcArr, $srcInd, $dstArr, $dstInd, $cpyLen, $att, $rel } ) {
		for ( let i = 0; i < $cpyLen; ++i ) {
			$dstArr[ $dstInd + i ] = $srcInd + i < $srcArr.length
				? $srcArr[ $srcInd + i ] * gswaSlicer.#env( i, $cpyLen, $att, $rel )
				: 0;
		}
	}
	static #env( i, len, att, rel ) {
		return i < len / 2
			? Math.min( i, att ) / att
			: Math.min( len - 1 - i, rel ) / rel;
	}
}
