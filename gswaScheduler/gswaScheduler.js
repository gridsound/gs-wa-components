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
		var curr = this._currentTime();

		return this._loop && curr > ( this._loopB * this.bps )
			? ( this._loopA * this.bps ) + ( curr - ( this._loopB * this.bps ) ) % ( this._loopDur * this.bps )
			: curr;
	},
	stop() {
		if ( this.started ) {
			this._loop
				? clearInterval( this._timeID )
				: clearTimeout( this._timeID );
			delete this._loop;
			this.onstop && this._smps.forEach( this.onstop );
			this._onended();
		}
	},
	startBeat( whn, off, dur, loopA, loopB ) {
		return this.start(
			this.ctx.currentTime + (
			whn   == null ? 0 : whn / this.bps ),
			off   == null ? 0 : off / this.bps,
			dur   == null ? null : dur / this.bps,
			loopA == null ? null : loopA / this.bps,
			loopB == null ? null : loopB / this.bps
		);
	},
	start( when, off, dur, loopA, loopB ) {
		when = when || this.ctx.currentTime;
		off = off || 0;
		dur = Number.isFinite( dur ) ? dur : this.duration - off;
		this.started = true;
		this._startedWhen = when;
		this._startedOffset = off;
		this._loop = Number.isFinite( loopA );
		if ( this._loop ) {
			var loopDur = loopB - loopA;

			this._loopA = loopA;
			this._loopDur = loopDur;
			this._loopB = loopB;
			this._whenLoopStop = loopB - this._startedOffset + this._startedWhen;
			this._scheduleLoop( loopA, loopDur );
			this._timeID = setInterval( this._scheduleLoop.bind( this, loopA, loopDur ), 1000 );
			dur = loopB - off;
		} else {
			this._timeID = setTimeout( this._onended.bind( this ), dur * 1000 );
		}
		this._start( when, off, dur );
	},

	// private:
	_start( when, off, dur ) {
		this._smps = [];
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
	},
	_currentTime() {
		return this.started
			? ( this.ctx.currentTime -
				this._startedWhen +
				this._startedOffset ) * this.bps
			: 0;
	},

	// private:
	_updateDur() {
		this.duration = this.data.reduce( ( dur, smp ) => {
			return Math.max( dur, this._sWhn( smp ) + this._sDur( smp ) );
		}, 0 );
	},
	_scheduleLoop( loopA, loopDur ) {
		while ( this._whenLoopStop < this.ctx.currentTime + 2 ) {
			this._start( this._whenLoopStop, loopA, loopDur );
			this._whenLoopStop += loopDur;
		}
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
