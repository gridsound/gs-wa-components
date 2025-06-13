"use strict";

class gswaCrossfade {
	static $PATH = "gswaCrossfadeProc.js";
	#node = null;
	#dest = null;

	static $loadModule( ctx ) {
		return ctx.audioWorklet.addModule( gswaCrossfade.$PATH );
	}

	constructor( ctx, sourceMap ) {
		const sourceIndMap = sourceMap.map( s => s[ 0 ] );
		const node = new AudioWorkletNode( ctx, "gswacrossfade", {
			numberOfOutputs: sourceIndMap.length,
			outputChannelCount: GSUnewArray( sourceIndMap.length, 1 ),
			processorOptions: {
				sourceMap: sourceIndMap,
			},
		} );

		this.#dest = GSUaudioGain( ctx );
		this.#node = node;
		GSUforEach( sourceMap, ( s, i ) => {
			const gain = GSUaudioGain( ctx );

			gain.gain.setValueAtTime( 0, 0 );
			node.connect( gain.gain, i );
			s[ 1 ].connect( gain ).connect( this.#dest );
		} );
	}

	$connect( ...args ) { this.#dest.connect( ...args ); }
	$disconnect( ...args ) { this.#dest.disconnect( ...args ); }
	$stop( when = 0 ) { GSUsetValueAtTime( this.#node.parameters.get( "start" ), 2, when ); }
	$start( when = 0 ) { GSUsetValueAtTime( this.#node.parameters.get( "start" ), 1, when ); }
	$setIndex( val, when ) { GSUsetValueAtTime( this.#node.parameters.get( "index" ), val, when ); }
	$setIndexCurve( curve, when, dur ) { GSUsetValueCurveAtTime( this.#node.parameters.get( "index" ), curve, when, dur ); }

	$destroy() {
		this.$stop();
		this.#dest.disconnect();
		this.#node.disconnect();
		this.#node = null;
	}
}
