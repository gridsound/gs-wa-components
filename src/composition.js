"use strict";

/*
There are A LOT of things to improve in this JS file:
	* Try to avoid calling Array.sort when we know there is only ONE change.
	* There is a static samples Array who need to be synchronise with the samples creation/deletion.
	* composition.update() have to update the loop instantly.
*/

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
		var that = this;

		function modLoop( sec ) {
			return !that.isLooping || sec < that.loopEnd ? sec :
				that.loopWhen + ( sec - that.loopWhen ) % that.loopDuration;
		}

		if ( !arguments.length ) {
			return !this.isPlaying ? this._currentTime :
				modLoop( this._currentTime + this.wCtx.ctx.currentTime - this._startedTime );
		}
		if ( this.isPlaying ) {
			this._stop();
		}
		this._currentTime = modLoop( Math.max( 0, Math.min( sec, this.duration ) ) );
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
		clearTimeout( this.playTimeout );
		this.samples.forEach( function( smp ) {
			smp.stop();
		} );
	},
	_play: function() {
		this._startedTime = this.wCtx.ctx.currentTime;
		if ( this.isLooping ) {
			this._loopPlay();
		} else {
			this.samples.forEach( this._sampleStart, this );
		}
		this._updateEndTimeout();
	},
	_updateDuration: function() {
		var smp = this.samples[ this.samples.length - 1 ];

		this.duration = smp ? smp.when + smp.duration : 0;
	},
	_updateEndTimeout: function() {
		clearTimeout( this.endTimeout );
		if ( this.isPlaying && !this.isLooping ) {
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
		var currentTime = this.currentTime(),
			offset = smp.offset,
			duration = smp.duration,
			when = smp.when - currentTime;

		if ( when > -duration ) {
			if ( this.isLooping && smp.when + smp.duration > this.loopEnd ) {
				duration -= smp.when + smp.duration - this.loopEnd;
			}
			if ( when < 0 ) {
				offset -= when;
				duration += when;
				when = 0;
			}
			smp.start( when, offset, duration );
		}
	}
};
