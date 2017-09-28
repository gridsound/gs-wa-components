"use strict";

function gswaScheduler() {};

gswaScheduler.prototype = {
	setContext( ctx ) {
		this.ctx = ctx;
	},
	setBPM( bpm ) {
		this.bps = bpm / 60;
		this._updateDur();
	},
	setData( data ) {
		this.data = data;
		this._updateDur();
	},
	currentTime() {
		return this.started
			? ( this.ctx.currentTime - this._startedTime ) * this.bps
			: 0;
	},
	stop() {
		if ( this.started ) {
			clearTimeout( this._timeout );
			this.onstop && this._smps.forEach( this.onstop );
			this._onended();
		}
	},
	startBeat( whenBeat, offsetBeat, durationBeat ) {
		return this.start(
			whenBeat / this.bps,
			offsetBeat / this.bps,
			durationBeat / this.bps );
	},
	start( when, off, dur ) {
		when = when || 0;
		off = off || 0;
		dur = dur || dur === 0 ? dur : this.duration;
		this.started = true;
		this._smps = [];
		this._startedTime = this.ctx.currentTime;
		this.data.forEach( smp => {
			var sWhn = this._sWhn( smp ) - off,
				sOff = this._sOff( smp ),
				sDur = this._sDur( smp ),
				sEnd = sWhn + sDur;

			if ( sWhn < 0 ) {
				sOff -= sWhn;
				sDur += sWhn;
				sWhn = 0;
			}
			if ( sEnd > dur ) {
				sDur -= sEnd - dur;
			}
			if ( sDur > 0 ) {
				this._smps.push( smp );
				this.onstart( smp, when + sWhn, sOff, sDur );
			}
		} );
		this._timeout = setTimeout( this._onended.bind( this ), dur * 1000 );
	},

	// private:
	_updateDur() {
		this.duration = this.data.reduce( ( dur, smp ) => {
			return Math.max( dur, this._sWhn( smp ) + this._sDur( smp ) );
		}, 0 );
	},
	_sWhn( smp ) { return "whenBeat" in smp ? smp.whenBeat / this.bps : smp.when; },
	_sOff( smp ) { return "offsetBeat" in smp ? smp.offsetBeat / this.bps : smp.offset || 0; },
	_sDur( smp ) { return "durationBeat" in smp ? smp.durationBeat / this.bps : smp.duration; },
	_onended() {
		delete this.started;
		delete this._smps;
		this.onended && this.onended( this.data );
	}
};
