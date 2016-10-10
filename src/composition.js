"use strict";

( function() {

walContext.Composition = function( wCtx ) {
	this.wCtx = wCtx;
	this.wSamples = [];
	this.lastSample = null;
	this.isPlaying =
	this.isPaused = false;
	this.duration =
	this.startedTime =
	this._currentTime = 0;
	this.fnOnended =
	this.fnOnpaused = function() {};
};

function updateLastSample( compo ) {
	var end, last = null, maxend = 0;
	compo.wSamples.forEach( function( ws ) {
		end = ws.getEndTime();
		if ( end > maxend ) {
			maxend = end;
			last = ws;
		}
	} );
	compo.lastSample = last;
	compo.duration = last ? last.getEndTime() : 0;
}

function updateTimeout( compo ) {
	clearTimeout( compo.playTimeoutId );
	updateLastSample( compo ); // <-- this line is here just for fix a pb in GS...
	var sec = compo.duration && compo.duration - compo.currentTime();
	if ( sec <= 0 ) {
		compo.onended();
	} else {
		compo.playTimeoutId = setTimeout( compo.onended.bind( compo ), sec * 1000 );
	}
}

function startSampleFrom( ws, currentTime ) {
	var start = ws.when - currentTime;
	ws.start( start,
		start > 0 ? ws.offset : ws.offset - start,
		start > 0 ? ws.duration : ws.duration + start
	);
}

function updateInLive( compo, ws, action, oldLast ) {
	var ct = compo.currentTime();
	if ( ws.getEndTime() > ct && action !== "rm" ) {
		ws.load();
		startSampleFrom( ws, ct );
	}
	if ( compo.lastSample !== oldLast || action === "mv" ) {
		updateTimeout( compo );
	}
}

function softStop( compo ) {
	clearTimeout( compo.playTimeoutId );
	compo.wSamples.forEach( function( ws ) {
		ws.stop();
	} );
}

function softLoad( compo ) {
	var ct = compo.currentTime();
	compo.wSamples.forEach( function( ws ) {
		if ( ws.getEndTime() > ct ) {
			ws.load();
		}
	} );
}

function softPlay( compo ) {
	var ct = compo.currentTime();
	compo.wSamples.forEach( function( ws ) {
		if ( ws.getEndTime() > ct ) {
			startSampleFrom( ws, ct );
		}
	} );
	updateTimeout( compo );	
}

walContext.Composition.prototype = {
	add: function( waSample ) {
		if ( waSample.forEach ) {
			waSample.forEach( add, this );
		} else {
			add.call( this, waSample );
		}
		return this;
	},
	remove: function( waSample ) {
		if ( waSample.forEach ) {
			waSample.forEach( remove, this );
		} else {
			remove.call( this, waSample );
		}
		return this;
	},
	update: function( ws, action ) {
		var that = this,
			oldLast = this.lastSample,
			save;

		updateLastSample( this );
		if ( this.isPlaying ) {
			if ( ws.started ) {
				save = ws.fnOnended;
				ws.onended( function() {
					updateInLive( that, ws, action, oldLast );
					save();
					ws.onended( save );
				} );
				ws.stop();
			} else {
				updateInLive( this, ws, action, oldLast );
			}
		}
		return this;
	},
	currentTime: function( sec ) {
		if ( !arguments.length ) {
			return this._currentTime +
				( this.isPlaying && this.wCtx.ctx.currentTime - this.startedTime );
		}
		if ( this.isPlaying ) {
			softStop( this );
		}
		this._currentTime = Math.max( 0, Math.min( sec, this.duration ) );
		if ( this.isPlaying ) {
			this.startedTime = this.wCtx.ctx.currentTime;
			softLoad( this );
			softPlay( this );
		}
		return this;
	},
	play: function() {
		if ( !this.isPlaying ) {
			this.isPlaying = true;
			this.isPaused = false;
			this.startedTime = this.wCtx.ctx.currentTime;
			softLoad( this );
			softPlay( this );
		}
		return this;
	},
	stop: function() {
		if ( this.isPlaying || this.isPaused ) {
			softStop( this );
			this.onended();
		}
		return this;
	},
	pause: function() {
		if ( this.isPlaying ) {
			this.isPlaying = false;
			this.isPaused = true;
			this._currentTime += this.wCtx.ctx.currentTime - this.startedTime;
			this.startedTime = 0;
			softStop( this );
			this.fnOnpaused();
		}
	},
	onended: function( fn ) {
		if ( typeof fn === "function" ) {
			this.fnOnended = fn;
		} else {
			this.isPlaying =
			this.isPaused = false;
			this.startedTime =
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

} )();
