"use strict";

function gswaSampleGroup() {
	this.samples = [];
	this.samplesRev = [];
	this.updateDuration();
};

gswaSampleGroup.prototype = {
	stretch: function( factor ) {
		this.samples.forEach( function( smp ) {
			smp.whenRel *= factor;
		} );
		this.updateDuration();
	},
	start: function( when, offset, duration ) {
		this.samples.forEach( function( smp ) {
			smp.sample.start( when + smp.whenRel, smp.offset, smp.duration );
		} );
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
	delSample: function( smp ) {
		del( this.samples );
		del( this.samplesRev );

		function del( arr ) {
			arr.splice( arr.findIndex( function( _smp ) {
				return _smp === smp;
			} ), 1 );
		}
	},
	delSamples: function( arr ) {
		arr.forEach( this.delSample.bind( this ) );
	},
	updateDuration: function() {
		this.duration = this.samplesRev.length && this.samplesRev[ 0 ].duration;
	},
	updateAllSamples: function() {
		this.samples.sort( function( a, b ) {
			return cmp( a.whenRel, b.whenRel );
		} );
		this.samplesRev.sort( function( a, b ) {
			return cmp( b.whenRel + b.duration, a.whenRel + a.duration );
		} );

		function cmp( a, b ) {
			return a < b ? 1 : a > b ? -1 : 0;
		}
	}
};
