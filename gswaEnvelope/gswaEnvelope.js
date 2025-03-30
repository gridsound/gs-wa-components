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
		const { q, ...obj2 } = obj;

		Object.assign( d, obj2 );
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
		let Rmax = amp * S;

		if ( now < w + A + H + D ) {
			const dots = [
				{ x: 0,         y: 0 },
				{ x: A,         y: amp },
				{ x: A + H,     y: amp },
				{ x: A + H + D, y: Rmax },
			];
			const offset = now - w;
			const xa = Math.max( 0, offset );
			const xb = Math.min( dur, A + H + D );
			const dotsSampled = GSUsampleDotLine( dots, 128, xa, xb ).map( d => d[ 1 ] );

			Rmax = dotsSampled.at( -1 );
			GSUsetValueCurveAtTime( par, dotsSampled, offset > 0 ? now : w, xb - xa );
		} else {
			GSUsetValueAtTime( par, Rmax, now );
		}
		if ( !this.#nodeStarted ) {
			this.#nodeStarted = true;
			this.$node.start();
		}
		if ( Number.isFinite( dur ) ) {
			if ( now <= w + dur ) {
				this.#release( Rmax, w + dur, R );
			} else if ( now < w + dur + R ) {
				this.#release( Rmax, now + Af, w + dur + R - now );
			} else {
				this.#release( Rmax, now + Af, Af );
			}
		}
	}
	#release( top, when, dur ) {
		GSUsetValueCurveAtTime( this.$node.offset, [ top, 0 ], when, dur );
	}
	#stop( when ) {
		const d = this.#data;
		const env = d.toggle ? d : this.#defEnv;
		const par = this.$node.offset;

		par.cancelScheduledValues( 0 );
		if ( Number.isFinite( d.duration ) ) {
			this.$node.stop( when );
		} else {
			this.#release( env.sustain * env.amp, when, env.release );
			this.$node.stop( when + env.release );
		}
	}
}

Object.freeze( gswaEnvelope );
