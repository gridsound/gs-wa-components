"use strict";

class gswaLFO {
	$node = null;
	#ctx = null;
	#oscNode = null;
	#ampNode = null;
	#ampAttNode = null;
	#data = Object.seal( {
		toggle: false,
		when: 0,
		whenStop: 0,
		offset: 0,
		type: "",
		delay: 0,
		attack: 0,
		absoluteAmp: 0,
		absoluteSpeed: 0,
		amp: 0,
		speed: 0,
		variations: [],
	} );

	constructor( ctx ) {
		this.#ctx = ctx;
		this.$node = this.#ctx.createGain();
		Object.seal( this );
	}

	// .........................................................................
	$start( d ) {
		const data = this.#data;

		data.toggle = d.toggle || false;
		data.when = d.when || this.#ctx.currentTime;
		data.whenStop = d.whenStop
			? Math.max( d.when + d.delay + d.attack + .1, d.whenStop )
			: 0;
		data.offset = d.offset || 0;
		data.type = d.type || "sine";
		data.delay = d.delay || 0;
		data.attack = d.attack || 0;
		data.amp = "amp" in d ? d.amp : 1;
		data.speed = "speed" in d ? d.speed : 1;
		data.absoluteAmp = "absoluteAmp" in d ? d.absoluteAmp : 1;
		data.absoluteSpeed = "absoluteSpeed" in d ? d.absoluteSpeed : 4;
		data.variations = d.variations || [];
		if ( data.toggle && !this.#oscNode ) {
			this.#start();
		}
	}
	$destroy() {
		if ( this.#oscNode ) {
			this.#stop( 0 );
			this.#oscNode.$disconnect();
			this.#ampNode.disconnect();
			this.#ampAttNode.disconnect();
			this.#oscNode =
			this.#ampNode =
			this.#ampAttNode = null;
		}
	}
	$change( obj ) {
		Object.assign( this.#data, obj );
		if ( this.#data.toggle ) {
			if ( !this.#oscNode ) {
				this.#start();
			} else {
				this.#change( obj );
			}
		} else if ( this.#oscNode ) {
			this.$destroy();
		}
	}

	// .........................................................................
	#start() {
		this.#oscNode = new gswaOscillator( this.#ctx );
		this.#ampNode = this.#ctx.createGain();
		this.#ampAttNode = this.#ctx.createGain();
		this.#oscNode.$connect( this.#ampAttNode ).connect( this.#ampNode ).connect( this.$node );
		this.#setType();
		this.#setAmpAtt();
		this.#setAmp();
		this.#start2();
		if ( this.#data.whenStop > 0 ) {
			this.#stop( this.#data.whenStop );
		}
	}
	#start2() {
		const d = this.#data;
		const Hz = this.#setSpeed();

		this.#oscNode.$start( d.when + d.delay - d.offset, Hz );
	}
	#stop( when ) {
		this.#oscNode.$frequency.cancelScheduledValues( when );
		this.#ampNode.gain.cancelScheduledValues( when );
		this.#ampAttNode.gain.cancelScheduledValues( when );
		this.#oscNode.$stop( when );
	}
	#change( obj ) {
		if ( "type" in obj ) {
			this.#setType();
		}
		if ( "absoluteSpeed" in obj ) {
			this.#oscNode.$frequency.cancelScheduledValues( 0 );
			this.#setSpeed();
		}
		if ( "absoluteAmp" in obj ) {
			this.#ampNode.gain.cancelScheduledValues( 0 );
			this.#setAmp();
		}
		if ( "when" in obj || "offset" in obj || "delay" in obj || "attack" in obj ) {
			this.#ampAttNode.gain.cancelScheduledValues( 0 );
			this.#setAmpAtt();
		}
	}
	#setType() {
		this.#oscNode.$type = this.#data.type;
	}
	#setAmpAtt() {
		const d = this.#data;
		const now = this.#ctx.currentTime;
		const atTime = d.when + d.delay - d.offset;

		if ( now <= atTime && d.attack > 0 ) {
			this.#ampAttNode.gain.setValueAtTime( 0, now );
			this.#ampAttNode.gain.setValueCurveAtTime( new Float32Array( [ 0, 1 ] ), atTime, d.attack );
		} else {
			this.#ampAttNode.gain.setValueAtTime( 1, now );
		}
	}
	#setAmp() {
		gswaLFO.#setVariations( this.#data, "absoluteAmp", "amp", this.#ampNode.gain, this.#ctx.currentTime );
	}
	#setSpeed() {
		return gswaLFO.#setVariations( this.#data, "absoluteSpeed", "speed", this.#oscNode.$frequency, this.#ctx.currentTime );
	}
	static #setVariations( d, absProp, prop, nodeParam, now ) {
		const absVal = d[ absProp ];
		let started = null;

		d.variations.forEach( va => {
			const when = d.when - d.offset + va.when;
			const dur = Math.max( .00001, va.duration );

			if ( when > now ) {
				const ab = va[ prop ];

				if ( !started ) {
					started = absVal * ab[ 0 ];
					GSUsetValueAtTime( nodeParam, started, now );
				}
				GSUsetValueCurveAtTime( nodeParam, [
					absVal * ab[ 0 ],
					absVal * ab[ 1 ],
				], when, dur );
			}
		} );
		if ( !started ) {
			started = absVal * d[ prop ];
			GSUsetValueAtTime( nodeParam, started, now );
		}
		return started;
	}
}

Object.freeze( gswaLFO );
