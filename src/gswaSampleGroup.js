"use strict";

function gswaSampleGroup() {
	this.samples = [];
	this.samplesRev = [];
	this.duration = 0;
};

gswaSampleGroup.prototype = {
	stretch: function( factor ) {
		this.samples.forEach( function( smp ) {
			smp.whenRel *= factor;
		} );
		this._updateDur();
	},
	start: function( when, offset, duration ) {
		var firstSmp = this.samples[ 0 ];

		if ( firstSmp ) {
			offset = offset || 0;
			duration = arguments.length > 2 ? duration : this.duration;
			if ( !when ) {
				when = firstSmp.sample.ctx.currentTime;
			}
			this.samples.forEach( function( smp ) {
				var sWhenRel = smp.whenRel - offset,
					sDuration = smp.duration,
					sOffset = smp.offset;

				if ( sWhenRel < 0 ) {
					sOffset -= sWhenRel;
					sDuration += sWhenRel;
				}
				if ( sDuration > 0 ) {
					sDuration += Math.min( duration - sWhenRel - sDuration, 0 );
					if ( sDuration > 0 ) {
						smp.sample.start( when + sWhenRel, sOffset, sDuration );
					}
				}
			} );
		}
	},
	stop: function() {
		this.samples.forEach( function( smp ) {
			smp.sample.stop();
		} );
	},
	addSample: function( smp ) {
		smp.offset = smp.offset || 0;
		smp.duration = smp.duration || smp.sample.duration;
		this.samples.push( smp );
		this.samplesRev.push( smp );
	},
	addSamples: function( arr ) {
		arr.forEach( this.addSample.bind( this ) );
	},
	removeSample: function( smp ) {
		this.samples.splice( this.samples.indexOf( smp ), 1 );
		this.samplesRev.splice( this.samplesRev.indexOf( smp ), 1 );
	},
	removeSamples: function( arr ) {
		arr.forEach( this.removeSample.bind( this ) );
	},
	update: function() {
		this._sortSmp();
		this._updateDur();
	},

	// private:
	_updateDur: function() {
		var smp = this.samplesRev[ 0 ];

		this.duration = smp ? smp.whenRel + smp.duration : 0;
	},
	_sortSmp: function() {
		this.samples.sort( function( a, b ) {
			return cmp( a.whenRel, b.whenRel );
		} );
		this.samplesRev.sort( function( a, b ) {
			return cmp( b.whenRel + b.duration, a.whenRel + a.duration );
		} );

		function cmp( a, b ) {
			return a < b ? -1 : a > b ? 1 : 0;
		}
	}
};
