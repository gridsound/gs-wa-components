"use strict";

( function() {

walContext.Composition = function( wCtx ) {
	this.wCtx = wCtx;
	this.samples = [];
	this.lastSample = null;
	this.isPlaying =
	this.isPaused = false;
	this.duration =
	this._startedTime =
	this._currentTime = 0;
	this.fnOnended =
	this.fnOnpaused = function() {};
};

walContext.Composition.prototype = {
	add: function( smp ) {
		if ( smp.forEach ) {
			smp.forEach( add, this );
		} else {
			add.call( this, smp );
		}
		return this;
	},
	remove: function( smp ) {
		if ( smp.forEach ) {
			smp.forEach( remove, this );
		} else {
			remove.call( this, smp );
		}
		return this;
	},
	update: function( smp, action ) {
		var save, that = this;

		if ( action !== "rm" ) {
			// TODO: improve this part:
			this.samples.sort( function( a, b ) {
				return a.when < b.when ? -1
					: a.when > b.when ? 1 : 0;
			} );
		}
		updateLastSample( this );
		if ( this.isPlaying ) {
			if ( smp.started ) {
				save = smp._userOnended;
				smp.onended( function() {
					_sampleUpdateLive( that, smp, action );
					smp.onended( save );
					save();
				} );
				smp.stop();
			} else {
				_sampleUpdateLive( this, smp, action );
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
			stop( this );
		}
		this._currentTime = Math.max( 0, Math.min( sec, this.duration ) );
		if ( this.isPlaying ) {
			this._startedTime = this.wCtx.ctx.currentTime;
			play( this );
		}
		return this;
	},
	play: function() {
		if ( !this.isPlaying ) {
			this.isPlaying = true;
			this.isPaused = false;
			this._startedTime = this.wCtx.ctx.currentTime;
			play( this );
		}
		return this;
	},
	stop: function() {
		if ( this.isPlaying || this.isPaused ) {
			stop( this );
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
			stop( this );
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
	}
};

function add( smp ) {
	if ( this.samples.indexOf( smp ) < 0 ) {
		this.samples.push( smp );
		smp.composition = this;
		this.update( smp, "ad" );
	}
}

function remove( smp ) {
	var ind = this.samples.indexOf( smp );

	if ( ind > -1 ) {
		smp.composition = null;
		this.samples.splice( ind, 1 );
		this.update( smp, "rm" );
	}
}

function stop( cmp ) {
	clearTimeout( cmp.playTimeoutId );
	cmp.samples.forEach( function( smp ) {
		smp.stop();
	} );
}

function play( cmp ) {
	var ct = cmp.currentTime();

	cmp.samples.forEach( function( smp ) {
		if ( _sampleGetEndTime( smp ) > ct ) {
			_sampleStart( smp, ct );
		}
	} );
	updateEndTimeout( cmp );	
}

function updateLastSample( cmp ) {
	var smp = cmp.samples[ cmp.samples.length - 1 ] || null,
		duration = smp ? _sampleGetEndTime( smp ) : 0;

	cmp.lastSample = smp;
	if ( Math.abs( cmp.duration - duration ) > 0.001 ) {
		cmp.duration = duration;
		updateEndTimeout( cmp );
	}
}

function updateEndTimeout( cmp ) {
	var sec = cmp.duration - cmp.currentTime();

	clearTimeout( cmp.playTimeoutId );
	if ( sec <= 0 ) {
		cmp.onended();
	} else {
		cmp.playTimeoutId = setTimeout( cmp.onended.bind( cmp ), sec * 1000 );
	}
}

function _sampleUpdateLive( cmp, smp, action ) {
	var ct = cmp.currentTime();

	if ( _sampleGetEndTime( smp ) > ct && action !== "rm" ) {
		_sampleStart( smp, ct );
	}
}

function _sampleStart( smp, currentTime ) {
	var start = smp.when - currentTime;

	smp.start( start,
		start > 0 ? smp.offset : smp.offset - start,
		start > 0 ? smp.duration : smp.duration + start
	);
}

function _sampleGetEndTime( smp ) {
	return smp.when + smp.duration;
}

} )();
