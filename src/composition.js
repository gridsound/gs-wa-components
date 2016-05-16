"use strict";

(function() {

walContext.Composition = function( wCtx ) {
	this.wCtx = wCtx;
	this.wSamples = [];
	this.lastSample = null;
	this.duration = 0;
	this.isPlaying = false;
	this.isPaused = false;
	this.startedTime = 0;
	this._currentTime = 0;
	this.fnOnended = function() {};
	this.fnOnpaused = function() {};
};

function startSampleFrom( ws, compoOffset ) {
	var start = ws.when - compoOffset;
	var offset = start >= 0 ? ws.offset : ws.offset - start;
	ws.start( start, Math.max( offset, 0 ) );
}

function updateTimeout( compo ) {
	var sec = compo.lastSample
			? ( compo.duration - compo.currentTime() ) * 1000
			: 0;

	clearTimeout( compo.playTimeoutId );
	if ( sec <= 0 ) {
		compo.onended();
	} else {
		compo.playTimeoutId = setTimeout( compo.onended.bind( compo ), sec );
	}
}

function updateInLive( compo, ws, action, oldLast ) {
	if ( ws.getEndTime() > compo.currentTime() && action != "rm" ) {
		ws.load();
		startSampleFrom( ws, compo.currentTime() );
	}
	if ( compo.lastSample != oldLast || action == "mv" ) {
		updateTimeout( compo );
	}
}

function softStop( compo ) {
	compo.wSamples.forEach( function( ws ) {
		ws.stop();
	});
}

function softLoad( compo ) {
	var ct = compo.currentTime();
	compo.wSamples.forEach( function( ws ) {
		if ( ws.getEndTime() > ct ) {
			ws.load();
		}
	});
}

function softPlay( compo ) {
	var ct = compo.currentTime();
	compo.wSamples.forEach( function( ws ) {
		if ( ws.getEndTime() > ct ) {
			startSampleFrom( ws, ct );
		}
	});
	updateTimeout( compo );	
}

walContext.Composition.prototype = {
	addSamples: function( wSamplesArr ) {
		var that = this;
		wSamplesArr.forEach( function( ws ) {
			if ( that.wSamples.indexOf( ws ) === -1 ) {
				that.wSamples.push( ws );
				ws.setComposition( ws );
				that.update( ws );
			}
		});
	},
	removeSamples: function( wSamplesArr ) {
		var
			that = this,
			index
		;
		wSamplesArr.forEach( function( ws ) {
			if ( ( index = that.wSamples.indexOf( ws ) ) !== -1 ) {
				that.wSamples.splice( index, 1 );
				ws.setComposition( null );
				that.update( ws, "rm" );
			}
		});
	},
	update: function( ws, action ) {
		var
			that = this,
			oldLast = this.lastSample,
			save
		;
		this.lastSample = this.getLastSample();
		this.duration = this.lastSample ? this.lastSample.getEndTime() : 0;
		if ( this.isPlaying ) {
			if ( ws.started ) {
				save = ws.fnOnended;
				ws.onended( function() {
					updateInLive( that, ws, action, oldLast );
					save();
					ws.onended( save );
				});
				ws.stop();
			} else {
				updateInLive( this, ws, action, oldLast );
			}
		}
	},
	currentTime: function( sec ) {
		if ( !arguments.length ) {
			return this.isPlaying
				? this._currentTime + wa.wctx.ctx.currentTime - this.startedTime
				: this._currentTime;
		}
		if ( this.isPlaying ) {
			softStop( this );
		}
		this._currentTime = !this.lastSample || sec <= 0 ? 0
			: Math.min( sec, this.duration );
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
			this.startedTime = wa.wctx.ctx.currentTime;
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
			this._currentTime += wa.wctx.ctx.currentTime - this.startedTime;
			this.startedTime = 0;
			softStop( this );
			clearTimeout( this.playTimeoutId );
			this.fnOnpaused();
		}
	},
	getLastSample: function( ignored ) {
		var s = null, sEnd = 0, end;
		if ( this.wSamples.length && !( ignored && this.wSamples.length == 1 ) ) {
			this.wSamples.forEach( function( ws ) {
				if ( ws != ignored && ( sEnd < ( end = ws.getEndTime() ) ) ) {
					s = ws;
					sEnd = end;
				}
			});
		}
		return s;
	},
	onended: function( fn ) {
		if ( typeof fn === "function" ) {
			this.fnOnended = fn;
		} else {
			clearTimeout( this.playTimeoutId );
			this.startedTime = 0;
			this.isPlaying = false;
			this.isPaused = false;
			this._currentTime = 0;
			this.fnOnended();
		}
		return this;
	}
};

})();