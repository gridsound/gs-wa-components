"use strict";

class gswaLFO {
	constructor( ctx ) {
		const node = ctx.createGain();

		this.ctx = ctx;
		this.node = node;
		this._oscNode =
		this._ampNode =
		this._ampAttNode = null;
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
		if ( data.toggle && !this._oscNode ) {
			this._start();
		}
	}
	destroy() {
		if ( this._oscNode ) {
			this._stop( 0 );
			this._oscNode.disconnect();
			this._ampNode.disconnect();
			this._ampAttNode.disconnect();
			this._oscNode =
			this._ampNode =
			this._ampAttNode = null;
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
			amp = this.ctx.createGain(),
			ampAtt = this.ctx.createGain();

		this._oscNode = osc;
		this._ampNode = amp;
		this._ampAttNode = ampAtt;
		this._setType();
		this._setAmpAtt();
		this._setAmp();
		this._setSpeed();
		osc.connect( ampAtt ).connect( amp ).connect( this.node.gain );
		osc.start( d.when + d.delay - d.offset );
		if ( d.whenStop > 0 ) {
			this._stop( d.whenStop );
		}
	}
	_stop( when ) {
		this._oscNode.frequency.cancelScheduledValues( when );
		this._ampNode.gain.cancelScheduledValues( when );
		this._ampAttNode.gain.cancelScheduledValues( when );
		this._oscNode.stop( when );
	}
	_change( obj ) {
		if ( "type" in obj ) {
			this._setType();
		}
		if ( "absoluteSpeed" in obj ) {
			this._oscNode.frequency.cancelScheduledValues( 0 );
			this._setSpeed();
		}
		if ( "absoluteAmp" in obj ) {
			this._ampNode.gain.cancelScheduledValues( 0 );
			this._setAmp();
		}
		if ( "when" in obj || "offset" in obj || "delay" in obj || "attack" in obj ) {
			this._ampAttNode.gain.cancelScheduledValues( 0 );
			this._setAmpAtt();
		}
	}
	_setType() {
		this._oscNode.type = this.data.type;
	}
	_setAmpAtt() {
		const d = this.data,
			now = this.ctx.currentTime,
			atTime = d.when + d.delay - d.offset;

		if ( now <= atTime && d.attack > 0 ) {
			this._ampAttNode.gain.setValueAtTime( 0, atTime );
			this._ampAttNode.gain.setValueCurveAtTime( new Float32Array( [ 0, d.absoluteAmp ] ), atTime, d.attack );
		} else {
			this._ampAttNode.gain.setValueAtTime( d.absoluteAmp, now );
		}
	}
	_setAmp() {
		gswaLFO._setVariations( this.data, "absoluteAmp", "amp",
			this._ampNode.gain, this.ctx.currentTime );
	}
	_setSpeed() {
		gswaLFO._setVariations( this.data, "absoluteSpeed", "speed",
			this._oscNode.frequency, this.ctx.currentTime );
	}
	static _setVariations( d, absProp, prop, nodeParam, now ) {
		const absVal = d[ absProp ];
		let started = false;

		d.variations.forEach( va => {
			const when = d.when - d.offset + va.when,
				dur = va.duration;

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
