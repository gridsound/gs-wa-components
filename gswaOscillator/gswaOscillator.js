"use strict";

class gswaOscillator {
	static $nbCreated = 0;
	static $weakMap = new WeakMap();
	static $runningMap = new Map();
	#ctx = null;
	#osc = null;
	#id = ++gswaOscillator.$nbCreated;

	constructor( ctx ) {
		this.#ctx = ctx;
		this.#osc = ctx.createOscillator();
		gswaOscillator.$weakMap.set( this.#osc, 1 );
	}

	// .........................................................................
	stop( when ) {
		gswaOscillator.$runningMap.set( this.#id, when || 0 );
		gswaOscillator.$runningMap.forEach( ( when, id ) => {
			if ( when !== true && when <= this.#ctx.currentTime ) {
				gswaOscillator.$runningMap.delete( id );
			}
		} );
		return this.#osc.stop( when );
	}
	start( when ) {
		gswaOscillator.$runningMap.set( this.#id, true );
		return this.#osc.start( when );
	}
	connect( ...args ) { return this.#osc.connect( ...args ); }
	disconnect( ...args ) { return this.#osc.disconnect( ...args ); }

	// .........................................................................
	get type() { return this.#osc.type; }
	get detune() { return this.#osc.detune; }
	get frequency() { return this.#osc.frequency; }

	// .........................................................................
	set type( w ) {
		if ( w === "sine" || w === "triangle" || w === "sawtooth" ) { // 1.
			this.#osc.type = w;
		} else {
			const pw = gswaPeriodicWaves.$get( this.#ctx, w );

			if ( pw ) {
				this.#osc.setPeriodicWave( pw );
			} else {
				this.#osc.type = "sine";
			}
		}
	}
}

/*
1. Square is not considered as a native wave because of its normalization.
   This normalization is a problem only when the oscillator is used as an LFO.
   This means the square would never be fully -1 neither +1.
*/
