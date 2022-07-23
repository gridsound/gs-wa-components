"use strict";

class gswaDrumsScheduler {
	scheduler = new gswaScheduler();
	#drumrows = null;
	#startedDrums = new Map();

	constructor() {
		Object.seal( this );

		this.scheduler.ondatastart = this.#onstartDrum.bind( this );
		this.scheduler.ondatastop = this.#onstopDrum.bind( this );
		this.scheduler.ondatapropchange = this.#onchangeDrum.bind( this );
	}

	// .........................................................................
	$setContext( ctx ) {
		this.scheduler.currentTime = () => ctx.currentTime;
		this.scheduler.$enableStreaming( !( ctx instanceof OfflineAudioContext ) );
	}
	$setDrumrows( drumrows ) {
		this.#drumrows = drumrows;
	}
	$change( obj ) {
		const cpy = DAWCoreUtils.deepCopy( obj );

		Object.values( cpy ).forEach( drum => {
			if ( drum && "when" in drum ) { // 1.
				drum.duration = this.#drumrows.$getPatternDurationByRowId( drum.row );
			}
		} );
		this.scheduler.$change( cpy );
	}
	$start( when, off, dur ) {
		this.scheduler.$start( when, off, dur );
	}
	$stop() {
		this.scheduler.$stop();
	}

	// .........................................................................
	#onstartDrum( startedId, [ [ , drum ] ], when, off ) {
		if ( "gain" in drum ) {
			this.#startedDrums.set( startedId,
				this.#drumrows.$startDrum( drum, when, off, drum.duration ) );
		} else {
			this.#drumrows.$startDrumcut( drum, when );
		}
	}
	#onstopDrum( startedId ) {
		this.#drumrows.$stopDrum( this.#startedDrums.get( startedId ) );
		this.#startedDrums.delete( startedId );
	}
	#onchangeDrum( startedId, prop, val ) {
		this.#drumrows.$changeDrumProp( startedId, prop, val );
	}
}

/*
1. The `if` check if the `drum` is new and not updating.
*/
