"use strict";

class gswaBPMTap {
	static #stack = []
	static #timeBefore = 0
	static #stackLimit = 20

	static reset() {
		gswaBPMTap.#timeBefore =
		gswaBPMTap.#stack.length = 0;
	}
	static tap() {
		const time = Date.now(),
			timeBefore = gswaBPMTap.#timeBefore;

		gswaBPMTap.#timeBefore = time;
		if ( timeBefore ) {
			const bpm = 60000 / ( time - timeBefore ),
				stack = gswaBPMTap.#stack,
				lastBpm = stack.length
					? stack[ stack.length - 1 ]
					: 0;

			if ( lastBpm && ( bpm < lastBpm / 1.5 || bpm > lastBpm * 1.5 ) ) {
				stack.length = 0;
			} else {
				if ( stack.unshift( bpm ) > gswaBPMTap.#stackLimit ) {
					stack.length = gswaBPMTap.#stackLimit;
				}
				return +( stack.reduce( ( sum, bpm ) => sum + bpm, 0 ) / stack.length ).toFixed( 2 );
			}
		}
		return 0;
	}
}
