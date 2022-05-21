"use strict";

class gswaLFO {
	ctx = null;
	#audioParam = null;
	#oscNode = null;
	#ampNode = null;
	#ampAttNode = null;

	constructor( ctx, audioParam ) {
		this.ctx = ctx;
		this.#audioParam = audioParam;
		this.data = Object.seal( {
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
		Object.seal( this );
	}

	// .........................................................................
	start( d ) {
		const data = this.data;

		data.toggle = d.toggle || false;
		data.when = d.when || this.ctx.currentTime;
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
	destroy() {
		if ( this.#oscNode ) {
			this.#stop( 0 );
			this.#oscNode.disconnect();
			this.#ampNode.disconnect();
			this.#ampAttNode.disconnect();
			this.#oscNode =
			this.#ampNode =
			this.#ampAttNode = null;
		}
	}
	change( obj ) {
		Object.assign( this.data, obj );
		if ( this.data.toggle ) {
			if ( !this.#oscNode ) {
				this.#start();
			} else {
				this.#change( obj );
			}
		} else if ( this.#oscNode ) {
			this.destroy();
		}
	}

	// .........................................................................
	#start() {
		const d = this.data;
		const osc = this.ctx.createOscillator();
		const amp = this.ctx.createGain();
		const ampAtt = this.ctx.createGain();

		this.#oscNode = osc;
		this.#ampNode = amp;
		this.#ampAttNode = ampAtt;
		this.#setType();
		this.#setAmpAtt();
		this.#setAmp();
		this.#setSpeed();
		osc.connect( ampAtt ).connect( amp ).connect( this.#audioParam );
		osc.start( d.when + d.delay - d.offset );
		if ( d.whenStop > 0 ) {
			this.#stop( d.whenStop );
		}
	}
	#stop( when ) {
		this.#oscNode.frequency.cancelScheduledValues( when );
		this.#ampNode.gain.cancelScheduledValues( when );
		this.#ampAttNode.gain.cancelScheduledValues( when );
		this.#oscNode.stop( when );
	}
	#change( obj ) {
		if ( "type" in obj ) {
			this.#setType();
		}
		if ( "absoluteSpeed" in obj ) {
			this.#oscNode.frequency.cancelScheduledValues( 0 );
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
		this.#oscNode.type = this.data.type;
	}
	#setAmpAtt() {
		const d = this.data;
		const now = this.ctx.currentTime;
		const atTime = d.when + d.delay - d.offset;
		const absAmp = Math.abs( d.absoluteAmp );

		if ( now <= atTime && d.attack > 0 ) {
			this.#ampAttNode.gain.setValueAtTime( 0, now );
			this.#ampAttNode.gain.setValueCurveAtTime( new Float32Array( [ 0, absAmp ] ), atTime, d.attack );
		} else {
			this.#ampAttNode.gain.setValueAtTime( absAmp, now );
		}
	}
	#setAmp() {
		gswaLFO.#setVariations( this.data, "absoluteAmp", "amp", this.#ampNode.gain, this.ctx.currentTime );
	}
	#setSpeed() {
		gswaLFO.#setVariations( this.data, "absoluteSpeed", "speed", this.#oscNode.frequency, this.ctx.currentTime );
	}
	static #setVariations( d, absProp, prop, nodeParam, now ) {
		const absVal = d[ absProp ];
		let started = false;

		d.variations.forEach( va => {
			const when = d.when - d.offset + va.when;
			const dur = va.duration;

			if ( when > now && dur > 0 ) {
				const ab = va[ prop ];

				if ( !started ) {
					started = true;
					nodeParam.setValueAtTime( absVal * ab[ 0 ], now );
				}
				nodeParam.setValueCurveAtTime( new Float32Array( [
					absVal * ab[ 0 ],
					absVal * ab[ 1 ],
				] ), when, dur );
			}
		} );
		if ( !started ) {
			nodeParam.setValueAtTime( absVal * d[ prop ], now );
		}
	}
}

Object.freeze( gswaLFO );
