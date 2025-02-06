"use strict";

class gswaOscillator {
	#ctx = null;
	#osc = null;

	constructor( ctx ) {
		this.#ctx = ctx;
		this.#osc = ctx.createOscillator();
	}

	// .........................................................................
	$stop( ...args ) { return this.#osc.stop( ...args ); }
	$start( ...args ) { return this.#osc.start( ...args ); }
	$connect( ...args ) { return this.#osc.connect( ...args ); }
	$disconnect( ...args ) { return this.#osc.disconnect( ...args ); }

	// .........................................................................
	$getDetune() { return this.#osc.detune; }
	$getFrequency() { return this.#osc.frequency; }

	// .........................................................................
	$setType( w ) {
		if ( w === "sine" || w === "triangle" || w === "sawtooth" || w === "square" ) {
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
