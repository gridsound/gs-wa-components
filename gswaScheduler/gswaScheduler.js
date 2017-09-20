"use strict";

function gswaScheduler() {
	this.startedSamples = {};
	this._setBPM( 60 );
	this._setData( {} );
};

gswaScheduler.prototype = {
	setData( data ) {
		this.data = data;
		this._updateDuration();
	},
	setBPM( bpm ) {
		// ... diff
		this.bpm = bpm;
		this.bps = bpm / 60;
	},
	stop() {
		var smpId, smp,
			stack = this.startedSamples;

		for ( smpId in stack ) {
			this.onstop( stack[ smpId ] );
			delete stack[ smpId ];
		}
	},
	start( when, offset, duration ) {
		var smpId, smp,
			sWhen, sOff, sDur, sEnd,
			data = this.data;

		for ( smpId in data ) {
			smp = data[ smpId ];
			sWhen = this._smpWhen( smp ) - offset;
			sOff = this._smpOffset( smp );
			sDur = this._smpDuration( smp );
			sEnd = sWhen + sDur;

			if ( sWhen < 0 ) {
				sOff -= sWhen;
				sDur += sWhen;
				sWhen = 0;
			}
			if ( sEnd > duration ) {
				sDur -= sEnd - duration;
			}
			if ( sDur > 0 ) {
				this.onstart( when + sWhen, sOff, sDur );
			}
		}
	},
	startBeat( whenBeat, offsetBeat, durationBeat ) {
		return this.start(
			whenBeat / this.bps,
			offsetBeat / this.bps,
			durationBeat / this.bps );
	},

	// private:
	_smpWhen( smp ) {
		return "whenBeat" in smp
			? smp.whenBeat / this.bps
			: smp.when;
	},
	_smpOffset( smp ) {
		return "offsetBeat" in smp
			? smp.offsetBeat / this.bps
			: smp.offset || 0;
	},
	_smpDuration( smp ) {
		return "durationBeat" in smp
			? smp.durationBeat / this.bps
			: smp.duration;
	},
	_smpEnd( smp ) {
		return this._smpWhen( smp ) + this._smpDuration( smp );
	},
	_updateDuration() {
		var smpId,
			dat = this.data,
			dur = 0;

		for ( smpId in dat ) {
			dur = Math.max( dur, this._smpEnd( dat[ smpId ] ) );
		}
		this.duration = dur;
	}
};
