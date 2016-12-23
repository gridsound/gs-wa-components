"use strict";

Object.assign( walContext.Composition.prototype, {
	loop: function( when, duration ) {
		this.isLooping = when !== false;
		if ( this.isLooping ) {
			this.loopWhen = when;
			this.loopDuration = duration;
			this.loopEnd = when + duration;
		} else {
			clearTimeout( this._loopTimeout );
		}
		if ( this.isPlaying ) {
			this.currentTime( this.currentTime() );
		}
		return this;
	},

	// private:
	_loopPlay: function() {
		clearTimeout( this._loopTimeout );
		this.samples.some( function( smp ) {
			if ( smp.when < this.loopEnd ) {
				this._sampleStart( smp, 0, this.currentTime(), this.loopEnd );
			} else {
				return true;
			}
		}, this );
		if ( this.currentTime() >= this.loopWhen ) {
			this._loopStart();
		} else {
			this._loopTimeout = setTimeout( this._loopStart.bind( this ),
				( this.loopWhen - this.currentTime() ) * 1000 );
		}
	},
	_loopStart: function() {
		this._loopN = Math.ceil( 2 / this.loopDuration );
		this._loopNbStarted = 1;
		this._loopTimeout = setInterval( this._loopTimer.bind( this ), 1000 );
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
			var smp, i, l = 0, smpi = this.getSampleAt( this.loopWhen );

			if ( smpi > -1 ) {
				while ( l++ < this._loopN ) {
					for ( i = smpi; ( smp = this.samples[ i ] ) && smp.when < this.loopEnd; ++i ) {
						this._sampleStart( smp, this._loopRemain() * this.loopDuration,
							this.loopWhen, this.loopEnd );
					}
					++this._loopNbStarted;
				}
			}
		}
	},
	_loopUpdate: function( smp ) {
		this._sampleStart( smp, 0, this.currentTime(), this.loopEnd );
		if ( smp.when + smp.duration > this.loopWhen && smp.when < this.loopEnd ) {
			for ( var l = 1; l < this._loopRemain(); ++l ) {
				this._sampleStart( smp,
					l * this.loopDuration - ( this.currentTime() - this.loopWhen ),
					this.loopWhen, this.loopEnd );
			}
		}
	}
} );
