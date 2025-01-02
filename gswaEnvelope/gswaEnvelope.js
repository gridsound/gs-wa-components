"use strict";

class gswaEnvelope {
	$node = null;
	#nodeStarted = false;
	#ctx = null;
	#data = Object.seal( {
		toggle: false,
		when: 0,
		duration: 0,
		...gswaEnvelope.#defEnv,
	} );
	static #defEnv = Object.freeze( {
		attack: .01,
		hold: 0,
		decay: .01,
		sustain: 1,
		release: .01,
	} );

	constructor( ctx ) {
		Object.seal( this );
		this.#ctx = ctx;
		this.$node = ctx.createConstantSource();
	}

	// .........................................................................
	$start( obj ) {
		const d = this.#data;
		const def = gswaEnvelope.#defEnv;

		Object.assign( d, obj );
		d.attack = Math.max( def.attack, d.attack );
		d.decay = Math.max( def.decay, d.decay );
		d.release = Math.max( def.release, d.release );
		this.#start();
	}
	$destroy() {
		this.#stop();
	}

	// .........................................................................
	#start() {
		const d = this.#data;
		const now = this.#ctx.currentTime;
		const par = this.$node.offset;
		const w = d.when;
		const dur = d.duration;
		const env = d.toggle ? d : gswaEnvelope.#defEnv;
		const Af = gswaEnvelope.#defEnv.attack;
		const A = env.attack;
		const H = env.hold;
		const D = env.decay;
		const S = env.sustain;
		const R = env.release;

		par.cancelScheduledValues( 0 );
		par.setValueAtTime( 0, now );
		if ( !this.#nodeStarted ) {
			this.#nodeStarted = true;
			this.$node.start();
		}
		if ( dur >= A + H + D ) {
			if ( now <= w ) {
				this.#attack( 1, w, A );
			} else if ( now < w + A ) {
				this.#attack( 1, now, w + A - now );
			} else if ( now < w + A + H ) {
				this.#attack( 1, now, Af );
			} else if ( now < w + A + H + D ) {
				this.#attack( S, now, w + A + H + D - now );
			} else if ( now < w + dur - Af ) {
				this.#attack( S, now, Af );
			}
			if ( now < w + A + H && S < 1 ) {
				par.setValueCurveAtTime( new Float32Array( [ 1, S ] ), w + A + H, D );
			}
		} else if ( now <= w ) {
			this.#attack( S, w, dur );
		} else if ( now <= w + dur ) {
			this.#attack( S, now, w + dur - now );
		} else {
			this.#attack( S, now, Af );
		}
		if ( Number.isFinite( dur ) ) {
			if ( now <= w + dur ) {
				this.#release( S, w + dur, R );
			} else if ( now < w + dur + R ) {
				this.#release( S, now + Af, w + dur + R - now );
			} else {
				this.#release( S, now + Af, Af );
			}
		}
	}
	#attack( top, when, dur ) {
		this.$node.offset.setValueCurveAtTime( new Float32Array( [ 0, top ] ), when, dur );
	}
	#release( top, when, dur ) {
		this.$node.offset.setValueCurveAtTime( new Float32Array( [ top, 0 ] ), when, dur );
	}
	#stop() {
		const d = this.#data;
		const now = this.#ctx.currentTime;
		const par = this.$node.offset;

		par.cancelScheduledValues( 0 );
		if ( Number.isFinite( d.duration ) ) {
			par.setValueAtTime( 0, now );
		} else {
			par.setValueAtTime( d.sustain, now );
			par.setValueCurveAtTime( new Float32Array( [ d.sustain, 0 ] ), now, d.release );
		}
	}
}

Object.freeze( gswaEnvelope );
