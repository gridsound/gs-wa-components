"use strict";

class gswaKeysScheduler {
	$scheduler = new gswaScheduler();
	$onstartkey = GSUnoop;
	$onstopkey = GSUnoop;
	#ctx = null;
	#synth = null;
	#startedKeys = new Map();

	constructor() {
		Object.seal( this );
		this.$scheduler.$delayStopCallback = 4;
		this.$scheduler.$ondatastart = this.#onstartKey.bind( this );
		this.$scheduler.$ondatastop = this.#onstopKey.bind( this );
	}

	// .........................................................................
	$setContext( ctx ) {
		this.#ctx = ctx;
		this.$scheduler.$currentTime = () => this.#ctx.currentTime;
		this.$scheduler.$enableStreaming( !( ctx instanceof OfflineAudioContext ) );
	}
	$setSynth( synth ) {
		this.#synth = synth;
	}
	$change( obj ) {
		this.$scheduler.$change( obj );
	}
	$start( when, off, dur ) {
		this.$scheduler.$start( when, off, dur );
	}
	$stop() {
		this.$scheduler.$stop();
	}

	// .........................................................................
	#onstartKey( startedId, blcs, when, off, dur ) {
		if ( this.#synth ) {
			this.$onstartkey( startedId, blcs, when, off, dur );
			this.#startedKeys.set( startedId, this.#synth.$synStartKey( this.#ctx, blcs, when, off, dur ) );
		}
	}
	#onstopKey( startedId ) {
		this.$onstopkey( startedId );
		this.#synth?.$synStopKey( this.#ctx, this.#startedKeys.get( startedId ) );
		this.#startedKeys.delete( startedId );
	}
}
