"use strict";

class gswaKeysScheduler {
	scheduler = new gswaScheduler()
	#synth = null
	#startedKeys = new Map()

	constructor() {
		Object.seal( this );

		this.scheduler.delayStopCallback = 4;
		this.scheduler.ondatastart = this.#onstartKey.bind( this );
		this.scheduler.ondatastop = this.#onstopKey.bind( this );
	}

	setContext( ctx ) {
		this.scheduler.currentTime = () => ctx.currentTime;
		this.scheduler.enableStreaming( !( ctx instanceof OfflineAudioContext ) );
	}
	setSynth( synth ) {
		this.#synth = synth;
	}
	change( obj ) {
		this.scheduler.change( obj );
	}
	start( when, off, dur ) {
		this.scheduler.start( when, off, dur );
	}
	stop() {
		this.scheduler.stop();
	}

	#onstartKey( startedId, blcs, when, off, dur ) {
		this.#startedKeys.set( startedId,
			this.#synth.startKey( blcs, when, off, dur ) );
	}
	#onstopKey( startedId ) {
		this.#synth.stopKey( this.#startedKeys.get( startedId ) );
		this.#startedKeys.delete( startedId );
	}
}
