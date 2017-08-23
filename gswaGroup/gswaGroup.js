"use strict";

function gswaGroup() {
	this.id = ++gswaGroup.id;
	this.parents = {};
	this.samples = [];
	this.samplesRev = [];
	this._onendedResolve = [];
	this.setBpm( 60 );
};

gswaGroup.id = 0;
gswaGroup.prototype = {
	setContext( ctx ) {
		this.ctx = ctx;
	},
	setBpm( bpm ) {
		if ( this.bpm !== bpm ) {
			this.bpm = bpm;
			this.bps = bpm / 60;
			this.samples.forEach( function( smp ) {
				if ( smp.source instanceof gswaGroup ) {
					smp.source.setBpm( bpm );
				}
			} );
			this._updateDur();
		}
	},
	empty() {
		var id = this.id;

		this.samples.forEach( function( smp ) {
			delete smp.source.parents[ id ];
		} );
		this.samples.length = 0;
		this.samplesRev.length = 0;
		this.update();
	},
	start( when, offset, duration ) {
		return new Promise( resolve => {
			this._onendedResolve.push( resolve );
			setTimeout( resolve, this._start(
				when || this.ctx.currentTime,
				offset || 0,
				duration != null ? duration : this.duration
			) * 1000 );
		} );
	},
	startBeat( wBeat, oBeat, dBeat ) {
		var argLen = arguments.length;

		return this.start(
			argLen > 0 ? wBeat / this.bps : undefined,
			argLen > 1 ? oBeat / this.bps : undefined,
			argLen > 2 ? dBeat / this.bps : undefined );
	},
	stop() {
		this.samples.forEach( function( smp ) {
			smp.source.stop();
		} );
		this._onendedResolve.forEach( function( resolve ) {
			resolve();
		} );
		this._onendedResolve.length = 0;
	},
	addSample( smp ) {
		var par = smp.source.parents,
			id = this.id;

		if ( par ) {
			if ( !par[ id ] ) {
				par[ id ] = { obj: this, nb: 1 };
			} else {
				++par[ id ].nb;
			}
		}
		this.samples.push( smp );
		this.samplesRev.push( smp );
	},
	addSamples( arr ) {
		arr.forEach( this.addSample.bind( this ) );
	},
	removeSample( smp ) {
		var par = smp.source.parents,
			ind = this.samples.indexOf( smp );

		if ( ind > 0 ) {
			if ( par && --par[ this.id ].nb <= 0 ) {
				delete par[ this.id ];
			}
			this.samples.splice( ind, 1 );
			this.samplesRev.splice( this.samplesRev.indexOf( smp ), 1 );
		}
	},
	removeSamples( arr ) {
		arr.forEach( this.removeSample.bind( this ) );
	},
	update() {
		this._sortSmp();
		this._updateDur();
		for ( var id in this.parents ) {
			this.parents[ id ].obj.update();
		}
	},

	// private:
	_updateDur() {
		var smp = this.samplesRev[ 0 ];

		this.duration = smp ? this._smpEnd( smp ) : 0;
		this.durationBeat = this.duration * this.bps;
	},
	_sortSmp() {
		this.samples.sort( ( a, b ) => cmp( this._smpWhen( a ), this._smpWhen( b ) ) );
		this.samplesRev.sort( ( a, b ) => cmp( this._smpEnd( b ), this._smpEnd( a ) ) );

		function cmp( a, b ) {
			return a < b ? -1 : a > b ? 1 : 0;
		}
	},
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
			: smp.duration != null
				? smp.duration
				: "durationBeat" in smp.source
					? smp.source.durationBeat / this.bps
					: smp.source.duration;
	},
	_smpEnd( smp ) {
		return this._smpWhen( smp ) + this._smpDuration( smp );
	},
	_start( when, offset, duration ) {
		if ( this.duration ) {
			this.samples.forEach( smp => {
				var src = smp.source,
					isgroup = src instanceof gswaGroup,
					smpwhen = this._smpWhen( smp ) - offset,
					smpoff = this._smpOffset( smp ),
					smpdur = this._smpDuration( smp ),
					smpend = smpwhen + smpdur;

				if ( smpwhen < 0 ) {
					smpoff -= smpwhen;
					smpdur += smpwhen;
				}
				if ( smpend > duration ) {
					smpdur -= smpend - duration;
				}
				if ( smpdur > 0 ) {
					smpwhen = when + Math.max( 0, smpwhen );
					src[ isgroup ? "_start" : "start" ]( smpwhen, smpoff, smpdur );
				}
			} );
			return this.duration;
		}
		return 0;
	}
};
