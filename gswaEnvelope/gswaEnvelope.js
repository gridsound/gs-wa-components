"use strict";

class gswaEnvelope {
	$node = null;
	#nodeStarted = false;
	#ctx = null;
	#defEnv = {
		amp: 1,
		attack: .001,
		hold: 0,
		decay: .001,
		sustain: 1,
		release: .001,
	};
	#data = Object.seal( {
		toggle: false,
		when: 0,
		duration: 0,
		...this.#defEnv,
	} );

	constructor( ctx, target ) {
		Object.seal( this );
		this.#ctx = ctx;
		this.$node = ctx.createConstantSource();
		this.#defEnv.amp = target === "detune" ? 0 : 1;
		Object.freeze( this.#defEnv );
	}

	// .........................................................................
	$start( obj ) {
		const d = this.#data;
		const def = this.#defEnv;

		Object.assign( d, obj );
		d.attack = Math.max( def.attack, d.attack );
		d.decay = Math.max( def.decay, d.decay );
		d.release = Math.max( def.release, d.release );
		this.#start();
	}
	$stop( when ) {
		this.#stop( when ?? this.#ctx.currentTime );
	}
	$destroy() {
		this.#stop( this.#ctx.currentTime );
	}

	// .........................................................................
	#start() {
		const d = this.#data;
		const now = this.#ctx.currentTime;
		const par = this.$node.offset;
		const w = d.when;
		const dur = d.duration;
		const env = d.toggle ? d : this.#defEnv;
		const Af = this.#defEnv.attack;
		const amp = env.amp;
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
				this.#attack( 1 * amp, w, A );
			} else if ( now < w + A ) {
				this.#attack( 1 * amp, now, w + A - now );
			} else if ( now < w + A + H ) {
				this.#attack( 1 * amp, now, Af );
			} else if ( now < w + A + H + D ) {
				this.#attack( S * amp, now, w + A + H + D - now );
			} else if ( now < w + dur - Af ) {
				this.#attack( S * amp, now, Af );
			}
			if ( now < w + A + H && S < 1 ) {
				par.setValueCurveAtTime( new Float32Array( [ amp, S * amp ] ), w + A + H, D );
			}
		} else if ( now <= w ) {
			this.#attack( S * amp, w, dur );
		} else if ( now <= w + dur ) {
			this.#attack( S * amp, now, w + dur - now );
		} else {
			this.#attack( S * amp, now, Af );
		}
		if ( Number.isFinite( dur ) ) {
			if ( now <= w + dur ) {
				this.#release( S * amp, w + dur, R );
			} else if ( now < w + dur + R ) {
				this.#release( S * amp, now + Af, w + dur + R - now );
			} else {
				this.#release( S * amp, now + Af, Af );
			}
		}
	}
	#attack( top, when, dur ) {
		this.$node.offset.setValueCurveAtTime( new Float32Array( [ 0, top ] ), when, dur );
	}
	#release( top, when, dur ) {
		this.$node.offset.setValueCurveAtTime( new Float32Array( [ top, 0 ] ), when, dur );
	}
	#stop( when ) {
		const d = this.#data;
		const env = d.toggle ? d : this.#defEnv;
		const par = this.$node.offset;

		par.cancelScheduledValues( 0 );
		if ( Number.isFinite( d.duration ) ) {
			par.setValueAtTime( 0, when );
			this.$node.stop( when );
		} else {
			par.setValueAtTime( env.sustain * env.amp, when );
			this.#release( env.sustain * env.amp, when, env.release );
			this.$node.stop( when + env.release );
		}
	}
}

Object.freeze( gswaEnvelope );
