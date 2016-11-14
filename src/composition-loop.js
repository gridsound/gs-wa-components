"use strict";

Object.assign( walContext.Composition.prototype, {
	loop: function( when, duration ) {
		this.isLooping = when !== false;
		if ( this.isLooping ) {
			this.loopWhen = when;
			this.loopDuration = duration;
			this.loopEnd = when + duration;
		} else {
			clearTimeout( this.playTimeout );
		}
		if ( this.isPlaying ) {
			this.currentTime( this.currentTime() );
		}
		return this;
	},

	// private:
	_loopPlay: function() {
		clearTimeout( this.playTimeout );
		this.samples.some( function( smp ) {
			if ( smp.when < this.loopEnd ) {
				this._sampleStart( smp );
			} else {
				return true;
			}
		}, this );
		this._loopN = Math.max( 1, 2 / this.loopDuration );
		this._loopNbStarted = 1;
		this._loopSamples = this.samples.filter( function( smp ) {
			return this.loopWhen < smp.when + smp.duration && smp.when < this.loopEnd;
		}, this );
		if ( this.currentTime() >= this.loopWhen ) {
			this._loopStart();
		} else {
			this.playTimeout = setTimeout( this._loopStart.bind( this ), ( this.loopWhen - this.currentTime() ) * 1000 );
		}
	},
	_loopStart: function() {
		this.playTimeout = setInterval( this._loopTimer.bind( this ), 1000 );
		this._loopTimer();
	},
	_loopRemain: function() {
		return this._loopNbStarted - (
			this.wCtx.ctx.currentTime - this._startedTime +
			this._currentTime - this.loopWhen
		) / this.loopDuration;
	},
	_loopTimer: function() {
		if ( this._loopRemain() < this._loopN ) {
			for ( var i = 0; i < this._loopN; ++i ) {
				this._loopSamples.forEach( function( smp ) {
					var when = smp.when,
						offset = smp.offset,
						duration = smp.duration;

					if ( when + duration > this.loopEnd ) {
						duration -= when + duration - this.loopEnd;
					}
					when -= this.loopWhen;
					if ( when < 0 ) {
						offset -= when;
						duration += when;
						when = 0;
					}
					smp.start( when + this._loopRemain() * this.loopDuration, offset, duration );
				}, this );
				++this._loopNbStarted;
			}
		}
	}
} );
