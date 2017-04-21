"use strict";

function gswaSampleGroup() {
	this.id = ++gswaSampleGroup.id;
	this.parents = {};
	this.samples = [];
	this.samplesRev = [];
	this.setBpm( 60 );
};

gswaSampleGroup.id = 0;
gswaSampleGroup.prototype = {
	empty: function() {
		var id = this.id;

		this.samples.forEach( function( smp ) {
			delete smp.source.parents[ id ];
		} );
		this.samples.length = 0;
		this.samplesRev.length = 0;
		this.update();
	},
	setBpm: function( bpm ) {
		if ( this.bpm !== bpm ) {
			this.bpm = bpm;
			this.bps = bpm / 60;
			this.samples.forEach( function( smp ) {
				if ( smp.source instanceof gswaSampleGroup ) {
					smp.source.setBpm( bpm );
				}
			} );
			this._updateDur();
		}
	},
	start: function( when, offset, duration ) {
		if ( this.duration ) {
			var bps = this.bps;

			when = when > 0 ? when : this.ctx.currentTime;
			offset = ( offset || 0 ) / bps;
			duration = ( duration != null ? duration : this.duration ) / bps;
			this.samples.forEach( function( smp ) {
				var src = smp.source,
					isgroup = src instanceof gswaSampleGroup,
					smpwhen = smp.when / bps - offset,
					smpoff = smp.offset,
					smpdur = smp.duration != null ? smp.duration : src.duration;

				if ( isgroup ) {
					smpoff /= bps;
					smpdur /= bps;
				}
				if ( smpwhen < 0 ) {
					smpoff -= smpwhen;
					smpdur += smpwhen;
				}
				smpdur += Math.min( duration - smpwhen - smpdur, 0 );
				if ( smpdur > 0 ) {
					if ( isgroup ) {
						smpoff *= bps;
						smpdur *= bps;
					}
					src.start( when + Math.max( 0, smpwhen ), smpoff, smpdur );
				}
			} );
		}
	},
	stop: function() {
		this.samples.forEach( function( smp ) {
			smp.source.stop();
		} );
	},
	addSample: function( smp ) {
		var par = smp.source.parents,
			id = this.id;

		if ( par ) {
			if ( !par[ id ] ) {
				par[ id ] = { obj: this, nb: 1 };
			} else {
				++par[ id ].nb;
			}
		}
		smp.offset = smp.offset || 0;
		this.samples.push( smp );
		this.samplesRev.push( smp );
		this.ctx = smp.source.ctx;
	},
	addSamples: function( arr ) {
		arr.forEach( this.addSample.bind( this ) );
	},
	removeSample: function( smp ) {
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
	removeSamples: function( arr ) {
		arr.forEach( this.removeSample.bind( this ) );
	},
	update: function() {
		var par = this.parents;

		this._sortSmp();
		this._updateDur();
		for ( var id in par ) {
			par[ id ].obj.update();
		}
	},

	// private:
	_updateDur: function() {
		var smp = this.samplesRev[ 0 ];

		this.duration = smp ? this._beatEnd( smp ) : 0;
	},
	_sortSmp: function() {
		var that = this;

		this.samples.sort( function( a, b ) {
			return cmp( a.when, b.when );
		} );
		this.samplesRev.sort( function( a, b ) {
			return cmp( that._beatEnd( b ), that._beatEnd( a ) );
		} );

		function cmp( a, b ) {
			return a < b ? -1 : a > b ? 1 : 0;
		}
	},
	_beatEnd: function( smp ) {
		var src = smp.source,
			dur = smp.duration != null ? smp.duration : src.duration;

		return smp.when + ( src._beatEnd ? dur : dur * this.bps );
	}
};
