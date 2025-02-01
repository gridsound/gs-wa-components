"use strict";

class gswaOscillator {
	#osc = null;

	constructor( ctx ) {
		this.#osc = ctx.createOscillator();
	}

	// .........................................................................
	$stop( ...args ) { return this.#osc.stop( ...args ); }
	$start( ...args ) { return this.#osc.start( ...args ); }
	$connect( ...args ) { return this.#osc.connect( ...args ); }
	$disconnect( ...args ) { return this.#osc.disconnect( ...args ); }
	$setPeriodicWave( ...args ) { return this.#osc.setPeriodicWave( ...args ); }

	// .........................................................................
	$getDetune() { return this.#osc.detune; }
	$getFrequency() { return this.#osc.frequency; }
	$setType( type ) {
		this.#osc.type = type;
	}
}
