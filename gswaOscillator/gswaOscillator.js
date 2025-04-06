"use strict";

class gswaOscillator {
	static $nbCreated = 0;
	static $weakMap = new WeakMap();
	static $runningMap = new Map();
	#ctx = null;
	#src = null;
	#id = ++gswaOscillator.$nbCreated;

	constructor( ctx, mode ) {
		this.#ctx = ctx;
		this.#src = mode === "buffer"
			? ctx.createBufferSource()
			: ctx.createOscillator();
		gswaOscillator.$weakMap.set( this.#src, 1 );
	}

	// .........................................................................
	$stop( when ) {
		gswaOscillator.$runningMap.set( this.#id, when || 0 );
		gswaOscillator.$runningMap.forEach( ( when, id ) => {
			if ( when !== true && when <= this.#ctx.currentTime ) {
				gswaOscillator.$runningMap.delete( id );
			}
		} );
		return this.#src.stop( when );
	}
	$start( when, Hz ) {
		const now = this.#ctx.currentTime;

		gswaOscillator.$runningMap.set( this.#id, true );
		if ( when >= now || !Number.isFinite( Hz ) ) {
			this.#src.start( when );
		} else {
			const periods = ( now - when ) * Hz;
			const diff = Math.ceil( periods ) - periods;

			this.#src.start( now + diff / Hz );
		}
	}
	$connect( ...args ) { return this.#src.connect( ...args ); }
	$disconnect( ...args ) { return this.#src.disconnect( ...args ); }

	// .........................................................................
	get $type() { return this.#src.type; }
	get $detune() { return this.#src.detune; }
	get $frequency() { return this.#src.frequency; }
	set $buffer( buf ) { this.#src.buffer = buf; }

	// .........................................................................
	set $type( w ) {
		if ( w === "sine" || w === "triangle" || w === "sawtooth" ) { // 1.
			this.#src.type = w;
		} else {
			const pw = gswaPeriodicWaves.$get( this.#ctx, w );

			if ( pw ) {
				this.#src.setPeriodicWave( pw );
			} else {
				this.#src.type = "sine";
			}
		}
	}
}

/*
1. Square is not considered as a native wave because of its normalization.
   This normalization is a problem only when the oscillator is used as an LFO.
   This means the square would never be fully -1 neither +1.
*/
