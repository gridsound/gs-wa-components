"use strict";

class gswaLFO {
	constructor( ctx ) {
		const node = ctx.createGain();

		this.ctx = ctx;
		this.node = node;
		this._oscNode =
		this._ampNode = null;
		this.data = Object.seal( {
			toggle: false,
			when: 0,
			whenStop: 0,
			offset: 0,
			type: "",
			delay: 0,
			attack: 0,
			amp: 0,
			speed: 0,
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
		data.speed = "speed" in d ? d.speed : 4;
		if ( data.toggle && !this._oscNode ) {
			this._start();
		}
	}
	destroy() {
		if ( this._oscNode ) {
			this._stop( 0 );
			this._oscNode.disconnect();
			this._ampNode.disconnect();
			this._oscNode =
			this._ampNode = null;
		}
	}
	change( obj ) {
		Object.assign( this.data, obj );
		if ( this.data.toggle ) {
			if ( !this._oscNode ) {
				this._start();
			} else {
				this._change( obj );
			}
		} else if ( this._oscNode ) {
			this.destroy();
		}
	}

	// .........................................................................
	_start() {
		const d = this.data,
			osc = this.ctx.createOscillator(),
			amp = this.ctx.createGain();

		this._oscNode = osc;
		this._ampNode = amp;
		this._setAmp();
		this._setType();
		this._setSpeed();
		osc.connect( amp ).connect( this.node.gain );
		osc.start( d.when + d.delay - d.offset );
		if ( d.whenStop > 0 ) {
			this._stop( d.whenStop );
		}
	}
	_stop( when ) {
		this._oscNode.frequency.cancelScheduledValues( when );
		this._ampNode.gain.cancelScheduledValues( when );
		this._oscNode.stop( when );
	}
	_change( obj ) {
		if ( "type" in obj ) {
			this._setType();
		}
		if ( "speed" in obj ) {
			this._oscNode.frequency.cancelScheduledValues( 0 );
			this._setSpeed();
		}
		if ( "when" in obj || "offset" in obj ||
			"delay" in obj || "attack" in obj || "amp" in obj
		) {
			this._ampNode.gain.cancelScheduledValues( 0 );
			this._setAmp();
		}
	}
	_setType() {
		this._oscNode.type = this.data.type;
	}
	_setSpeed() {
		this._oscNode.frequency.setValueAtTime( this.data.speed, this.ctx.currentTime );
	}
	_setAmp() {
		const d = this.data,
			now = this.ctx.currentTime,
			atTime = d.when + d.delay - d.offset;

		if ( now <= atTime && d.attack > 0 ) {
			this._ampNode.gain.setValueAtTime( 0, atTime );
			this._ampNode.gain.setValueCurveAtTime( new Float32Array( [ 0, d.amp ] ), atTime, d.attack );
		} else {
			this._ampNode.gain.setValueAtTime( d.amp, now );
		}
	}
}

Object.freeze( gswaLFO );
