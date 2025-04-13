"use strict";

class gswaOscillator {
	static $nbCreated = 0;
	static $weakMap = new WeakMap();
	static $runningMap = new Map();
	#id = ++gswaOscillator.$nbCreated;
	#ctx = null;
	#type = "";
	#wave = "";
	#when = -1;
	#srcs = [];
	#bufDur = 0;
	#output = null;
	#waCrossfade = null;
	#wavetableData = {};

	constructor( ctx ) {
		this.#ctx = ctx;
		this.#output = ctx.createGain();
		gswaOscillator.$weakMap.set( this, 1 );
	}

	// .........................................................................
	$connect( ...args ) { return this.#output.connect( ...args ); }
	$disconnect( ...args ) { return this.#output.disconnect( ...args ); }
	$stop( when ) {
		gswaOscillator.$runningMap.set( this.#id, when || 0 );
		gswaOscillator.#clearRunningMap( this.#ctx.currentTime );
		this.#srcs.forEach( src => src.stop( when ) );
	}
	$start( when, Hz ) {
		const now = this.#ctx.currentTime;
		let started;

		if ( this.#when > -1 ) {
			console.error( "gswaOscillator: multiple $start calls" );
			return;
		}
		switch ( this.#type ) {
			case "buffer":
				if ( when >= now ) {
					started = true;
					this.#srcs[ 0 ].start( when );
				} else if ( when + this.#bufDur > now ) {
					started = true;
					this.#srcs[ 0 ].start( now, now - when );
				}
				break;
			case "osc":
			case "oscTable":
				this.#srcs.forEach( src => {
					if ( when >= now || !Number.isFinite( Hz ) ) {
						src.start( when );
					} else {
						const periods = ( now - when ) * Hz;
						const diff = Math.ceil( periods ) - periods;

						src.start( now + diff / Hz );
					}
				} );
				if ( this.#type === "oscTable" ) {
					this.#waCrossfade.$start( when );
					this.#waCrossfade.$setIndexCurve( [ 0, 1 ], when, 1 );
				}
				break;
		}
		if ( started ) {
			this.#when = when;
			gswaOscillator.$runningMap.set( this.#id, true );
		}
	}

	// .........................................................................
	get $type0() { return this.#srcs[ 0 ].type; }
	get $frequency0() { return this.#srcs[ 0 ].frequency; }

	// .........................................................................
	$connectToDetune( node ) {
		this.#srcs.forEach( src => node.connect( src.detune ) );
	}
	$setDetuneAtTime( val, when ) {
		GSUforEach( this.#srcs, src => GSUsetValueAtTime( src.detune, val, when ) );
	}
	$setDetuneCurveAtTime( val, when, dur ) {
		GSUforEach( this.#srcs, src => GSUsetValueCurveAtTime( src.detune, val, when, dur ) );
	}
	$setFrequencyAtTime( val, when ) {
		GSUforEach( this.#srcs, src => GSUsetValueAtTime( src.frequency, val, when ) );
	}
	$setFrequencyCurveAtTime( val, when, dur ) {
		GSUforEach( this.#srcs, src => GSUsetValueCurveAtTime( src.frequency, val, when, dur ) );
	}

	// .........................................................................
	set $buffer( buf ) {
		if ( this.#type ) {
			console.error( "gswaOscillator: multiple $buffer set" );
			return;
		}
		this.#type = "buffer";
		this.#srcs = [ ctx.createBufferSource() ];
		this.#srcs[ 0 ].buffer = buf;
		this.#bufDur = buf.duration;
	}
	set $type( w ) {
		if ( this.#type ) {
			console.error( "gswaOscillator: multiple $type set" );
			return;
		}
		this.#type = GSUisWavetableName( w ) ? "oscTable" : "osc";
		this.#wave = w;
		if ( this.#type === "osc" ) {
			this.#readyForSingleWave( this.#ctx, w );
		} else {
			this.#readyForWavetable( this.#ctx, w );
		}
	}

	// .........................................................................
	#readyForSingleWave( ctx, w ) {
		const osc = ctx.createOscillator();

		osc.connect( this.#output );
		gswaOscillator.#setOscWave( ctx, osc, w );
		this.#srcs = [ osc ];
	}
	#readyForWavetable( ctx, wtname ) {
		this.#srcs = gswaPeriodicWaves.$getWavetable( ctx, wtname ).map( ( pw, i ) => {
			const osc = ctx.createOscillator();

			osc.setPeriodicWave( pw );
			return osc;
		} );

		const len = this.#srcs.length;
		const sourceMap = this.#srcs.map( ( src, i, arr ) => [ len === 1 ? 0 : i / ( len - 1 ), src ] );

		this.#waCrossfade = new gswaCrossfade( ctx, sourceMap );
		this.#waCrossfade.$connect( this.#output );
	}
	static #setOscWave( ctx, osc, w ) {
		if ( w === "sine" || w === "triangle" || w === "sawtooth" ) { // 1.
			osc.type = w;
		} else {
			const pw = gswaPeriodicWaves.$get( ctx, w );

			if ( pw ) {
				osc.setPeriodicWave( pw );
			} else {
				osc.type = "sine";
			}
		}
	}

	// .........................................................................
	static #clearRunningMap( now ) {
		gswaOscillator.$runningMap.forEach( ( when, id ) => {
			if ( when !== true && when <= now ) {
				gswaOscillator.$runningMap.delete( id );
			}
		} );
	}
}

/*
1. Square is not considered as a native wave because of its normalization.
   This normalization is a problem only when the oscillator is used as an LFO.
   This means the square would never be fully -1 neither +1.
*/
