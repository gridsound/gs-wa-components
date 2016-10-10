"use strict";

( function() {

walContext.Composition = function( wCtx ) {
	this.wCtx = wCtx;
	this.wSamples = [];
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
		var save,
			that = this,
			oldLast = this.lastSample;

		updateLastSample( this );
		if ( this.isPlaying ) {
			if ( smp.started ) {
				save = smp.fnOnended;
				smp.onended( function() {
					updateInLive( that, smp, action, oldLast );
					save();
					smp.onended( save );
				} );
				smp.stop();
			} else {
				updateInLive( this, smp, action, oldLast );
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
			load( this );
			play( this );
		}
		return this;
	},
	play: function() {
		if ( !this.isPlaying ) {
			this.isPlaying = true;
			this.isPaused = false;
			this._startedTime = this.wCtx.ctx.currentTime;
			load( this );
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
	if ( this.wSamples.indexOf( smp ) < 0 ) {
		this.wSamples.push( smp );
		smp.composition = this;
		this.update( smp );
	}
}

function remove( smp ) {
	var ind = this.wSamples.indexOf( smp );

	if ( ind > -1 ) {
		smp.composition = null;
		this.wSamples.splice( ind, 1 );
		this.update( smp, "rm" );
	}
}

function stop( cmp ) {
	clearTimeout( cmp.playTimeoutId );
	cmp.wSamples.forEach( function( smp ) {
		smp.stop();
	} );
}

function load( cmp ) {
	var ct = cmp.currentTime();

	cmp.wSamples.forEach( function( smp ) {
		if ( smp.getEndTime() > ct ) {
			smp.load();
		}
	} );
}

function play( cmp ) {
	var ct = cmp.currentTime();

	cmp.wSamples.forEach( function( smp ) {
		if ( smp.getEndTime() > ct ) {
			startSampleFrom( smp, ct );
		}
	} );
	updateTimeout( cmp );	
}

function updateLastSample( cmp ) {
	var end, last = null, maxend = 0;

	cmp.wSamples.forEach( function( ws ) {
		end = ws.getEndTime();
		if ( end > maxend ) {
			maxend = end;
			last = ws;
		}
	} );
	cmp.lastSample = last;
	cmp.duration = last ? last.getEndTime() : 0;
}

function updateTimeout( cmp ) {
	clearTimeout( cmp.playTimeoutId );
	updateLastSample( cmp ); // <-- this line is here just for fix a pb in GS...
	var sec = cmp.duration && cmp.duration - cmp.currentTime();
	if ( sec <= 0 ) {
		cmp.onended();
	} else {
		cmp.playTimeoutId = setTimeout( cmp.onended.bind( cmp ), sec * 1000 );
	}
}

function startSampleFrom( smp, currentTime ) {
	var start = smp.when - currentTime;

	smp.start( start,
		start > 0 ? smp.offset : smp.offset - start,
		start > 0 ? smp.duration : smp.duration + start
	);
}

function updateInLive( cmp, smp, action, oldLast ) {
	var ct = cmp.currentTime();
	if ( smp.getEndTime() > ct && action !== "rm" ) {
		smp.load();
		startSampleFrom( smp, ct );
	}
	if ( cmp.lastSample !== oldLast || action === "mv" ) {
		updateTimeout( cmp );
	}
}

} )();
