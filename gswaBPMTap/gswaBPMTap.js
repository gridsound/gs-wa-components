"use strict";

const gswaBPMTap = {
	_stack: [],
	_timeBefore: 0,
	_stackLimit: 10,

	reset() {
		this._timeBefore =
		this._stack.length = 0;
	},
	tap() {
		const time = Date.now(),
			timeBefore = this._timeBefore;

		this._timeBefore = time;
		if ( timeBefore ) {
			const bpm = 60000 / ( time - timeBefore ),
				stack = this._stack,
				lastBpm = stack.length
					? stack[ stack.length - 1 ]
					: 0;

			if ( lastBpm && ( bpm < lastBpm / 1.5 || bpm > lastBpm * 1.5 ) ) {
				stack.length = 0;
			} else {
				if ( stack.unshift( bpm ) > this._stackLimit ) {
					stack.length = this._stackLimit;
				}
				return stack.reduce( ( sum, bpm ) => sum + bpm, 0 ) / stack.length;
			}
		}
		return 0;
	},
}
