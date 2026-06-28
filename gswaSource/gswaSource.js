"use strict";

class gswaSource {
	static $nbCreated = 0;
	static $weakMap = new WeakMap();
	static $runningMap = new Map();
	#id = ++gswaSource.$nbCreated;
	#type = "";
	#when = -1;
	#src = null;
	#bufDur = 0;
	#output = null;

	constructor( ctx ) {
		this.#output = GSUaudioGain( ctx );
		gswaSource.$weakMap.set( this, 1 );
	}

	// .........................................................................
	$connect( ...args ) { return this.#output.connect( ...args ); }
	$disconnect( ...args ) { return this.#output.disconnect( ...args ); }
	$srcStop( ctx, when ) {
		gswaSource.$runningMap.set( this.#id, when || 0 );
		gswaSource.#clearRunningMap( ctx.currentTime );
		if ( this.#type === "osc" ) {
			this.#src.$stop( when );
		} else {
			this.#src.stop( when );
		}
	}
	$srcStart( ctx, when, Hz ) {
		const now = ctx.currentTime;
		let started;

		if ( this.#when > -1 ) {
			console.error( "gswaSource: $start, multiple calls" );
			return;
		}
		switch ( this.#type ) {
			case "buffer":
				if ( when >= now ) {
					started = true;
					this.#src.start( when );
				} else if ( when + this.#bufDur > now ) {
					started = true;
					this.#src.start( now, now - when );
				}
				break;
			case "osc":
				if ( when >= now || !Number.isFinite( Hz ) ) {
					this.#src.$start( when );
				} else {
					const periods = ( now - when ) * Hz;
					const diff = Math.ceil( periods ) - periods;

					this.#src.$start( now + diff / Hz );
				}
				break;
		}
		if ( started ) {
			this.#when = when;
			gswaSource.$runningMap.set( this.#id, true );
		}
	}

	// .........................................................................
	$connectToDetune( node ) {
		node.connect( this.#src.detune );
	}
	$setDetuneAtTime( val, when ) {
		GSUaudioParamSet( this.#src.detune, val, when );
	}
	$setDetuneCurveAtTime( val, when, dur ) {
		GSUaudioParamSetCurve( this.#src.detune, val, when, dur );
	}
	$setFrequencyAtTime( val, when ) {
		GSUaudioParamSet( this.#src.frequency, val, when );
	}
	$setFrequencyCurveAtTime( val, when, dur ) {
		GSUaudioParamSetCurve( this.#src.frequency, val, when, dur );
	}
	$setWavetableAtTime( val, when ) {
		GSUaudioParamSet( this.#src.wtpos, val, when );
	}
	$setWavetableCurveAtTime( val, when, dur ) {
		GSUaudioParamSetCurve( this.#src.wtpos, val, when, dur );
	}

	// .........................................................................
	$setBuffer( ctx, buf ) {
		if ( this.#type ) {
			console.error( "gswaSource: $setBuffer, multiple calls" );
			return;
		}
		if ( buf ) {
			const absn = GSUaudioBufferSource( ctx );

			absn.buffer = buf;
			absn.connect( this.#output );
			this.#src = absn;
			this.#type = "buffer";
			this.#bufDur = buf.duration;
		}
	}
	$setWavetable( ctx, wt ) {
		if ( this.#type ) {
			console.error( "gswaSource: $setWavetable, multiple calls" );
			return;
		}

		const osc = new gswaOscillator( ctx );

		osc.$init( ctx );
		osc.$connect( this.#output );
		osc.$setWavetable( gswaWTbuffers.$wtGetSharedBuffer( wt ) );
		this.#type = "osc";
		this.#src = osc;
	}

	// .........................................................................
	static #clearRunningMap( now ) {
		gswaSource.$runningMap.forEach( ( when, id ) => {
			if ( when !== true && when <= now ) {
				gswaSource.$runningMap.delete( id );
			}
		} );
	}
}
