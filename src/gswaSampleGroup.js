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
			this.bps = 60 / bpm;
			this.samples.forEach( function( smp ) {
				if ( smp.source instanceof gswaSampleGroup ) {
					smp.source.setBpm( bpm );
				}
			} );
			this._updateDur();
		}
	},
	start: function( when, offset, duration ) {
		var firstSmp = this.samples[ 0 ],
			bps = this.bps;

		if ( firstSmp ) {
			offset = ( offset || 0 ) * bps;
			duration = ( arguments.length > 2 ? duration : this.duration ) * bps;
			if ( !when || when < 0 ) {
				when = this.ctx.currentTime;
			}
			this.samples.forEach( function( smp ) {
				var smpsrc = smp.source,
					isgroup = smpsrc instanceof gswaSampleGroup ? bps : 1,
					smpwhen = smp.beat * bps - offset,
					smpoffset = smp.offset * isgroup,
					smpdur = smp.duration != null ? smp.duration : smp.source.duration;

				smpdur *= isgroup;
				if ( smpwhen < 0 ) {
					smpoffset -= smpwhen;
					smpdur += smpwhen;
				}
				if ( smpdur > 0 ) {
					smpdur += Math.min( duration - smpwhen - smpdur, 0 );
					if ( smpdur > 0 ) {
						smpsrc.start( when + Math.max( 0, smpwhen ),
							smpoffset / isgroup,
							smpdur / isgroup );
					}
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
			if ( --par[ this.id ].nb <= 0 ) {
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
			return cmp( a.beat, b.beat );
		} );
		this.samplesRev.sort( function( a, b ) {
			return cmp( that._beatEnd( b ), that._beatEnd( a ) );
		} );

		function cmp( a, b ) {
			return a < b ? -1 : a > b ? 1 : 0;
		}
	},
	_beatEnd: function( smp ) {
		var dur = smp.duration != null ? smp.duration : smp.source.duration;

		if ( smp.source instanceof gswaSampleGroup ) {
			dur /= this.bps;
		}
		return smp.beat + dur;
	}
};
