"use strict";

walContext.Composition = function( wCtx ) {
	this.wCtx = wCtx;
	this.samples = [];
	this.isPlaying =
	this.isPaused = false;
	this.oldDuration =
	this.duration =
	this._startedTime =
	this._currentTime = 0;
	this._bpm = 60;
	this.fnOnended =
	this.fnOnpaused = function() {};
	this.onended = this.onended.bind( this );
	this._add = this._add.bind( this );
	this._remove = this._remove.bind( this );
	this._sampleStart = this._sampleStart.bind( this );
};

walContext.Composition.prototype = {
	bpm: function( bpm ) {
		if ( !arguments.length ) {
			return this._bpm;
		}
		bpm = Math.max( 1, bpm );
		if ( bpm !== this._bpm ) {
			var bpmOld = this._bpm / 60,
				bpmDiff = bpmOld / ( bpm / 60 ),
				timeOld = this.currentTime();

			wa.composition.samples.forEach( function( smp ) {
				smp.when *= bpmDiff;
			} );
			this._bpm = bpm;
			this._updateDuration();
			this.currentTime( timeOld * bpmDiff );
		}
		return this;
	},
	add: function( smp ) {
		smp.forEach ? smp.forEach( this._add ) : this._add( smp );
		return this;
	},
	remove: function( smp ) {
		smp.forEach ? smp.forEach( this._remove ) : this._remove( smp );
		return this;
	},
	update: function( smp, action ) {
		if ( action !== "rm" ) {
			// TODO: improve this part:
			this.samples.sort( function( a, b ) {
				return a.when < b.when ? -1
					: a.when > b.when ? 1 : 0;
			} );
		}
		this._updateDuration();
		if ( this.oldDuration !== this.duration ) {
			this._updateEndTimeout();
		}
		if ( this.isPlaying ) {
			smp.stop();
			if ( action !== "rm" ) {
				this._sampleStart( smp );
			}
		}
		return this;
	},
	currentTime: function( sec ) {
		if ( !arguments.length ) {
			return this._currentTime +
				( this.isPlaying && this.wCtx.ctx.currentTime - this._startedTime );
		}
		if ( this.isPlaying ) {
			this._stop();
		}
		this._currentTime = Math.max( 0, Math.min( sec, this.duration ) );
		if ( this.isPlaying ) {
			this._play();
		}
		return this;
	},
	play: function() {
		if ( !this.isPlaying ) {
			this.isPlaying = true;
			this.isPaused = false;
			this._play();
		}
		return this;
	},
	stop: function() {
		if ( this.isPlaying || this.isPaused ) {
			this._stop();
			this.onended();
		}
		return this;
	},
	pause: function() {
		if ( this.isPlaying ) {
			this.isPlaying = false;
			this.isPaused = true;
			this._currentTime += this.wCtx.ctx.currentTime - this._startedTime;
			this._startedTime = 0;
			this._stop();
			this.fnOnpaused();
		}
		return this;
	},
	onended: function( fn ) {
		if ( typeof fn === "function" ) {
			this.fnOnended = fn;
		} else {
			this.isPlaying =
			this.isPaused = false;
			this._startedTime =
			this._currentTime = 0;
			this.fnOnended();
		}
		return this;
	},

	// private:
	_add: function( smp ) {
		if ( this.samples.indexOf( smp ) < 0 ) {
			this.samples.push( smp );
			smp.composition = this;
			this.update( smp, "ad" );
		}
	},
	_remove: function( smp ) {
		var ind = this.samples.indexOf( smp );

		if ( ind > -1 ) {
			smp.composition = null;
			this.samples.splice( ind, 1 );
			this.update( smp, "rm" );
		}
	},
	_stop: function() {
		clearTimeout( this.endTimeout );
		this.samples.forEach( function( smp ) {
			smp.stop();
		} );
	},
	_play: function() {
		this._startedTime = this.wCtx.ctx.currentTime;
		this.samples.forEach( this._sampleStart );
		this._updateEndTimeout();
	},
	_updateDuration: function() {
		var smp = this.samples[ this.samples.length - 1 ];

		this.duration = smp ? smp.when + smp.duration : 0;
	},
	_updateEndTimeout: function() {
		clearTimeout( this.endTimeout );
		if ( this.isPlaying ) {
			var sec = this.duration - this.currentTime();

			this.oldDuration = this.duration;
			if ( sec <= 0 ) {
				this.onended();
			} else {
				this.endTimeout = setTimeout( this.onended, sec * 1000 );
			}
		}
	},
	_sampleStart: function( smp ) {
		var when = smp.when - this.currentTime();

		if ( when >= 0 ) {
			smp.start( when, smp.offset, smp.duration );
		} else if ( when > -smp.duration ) {
			smp.start( 0, smp.offset - when, smp.duration + when );
		}
	}
};
