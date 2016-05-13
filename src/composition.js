"use strict";

(function() {

walContext.Composition = function( wCtx ) {
	this.wCtx = wCtx;
	this.wSamples = [];
	this.lastSample = null;
	this.fnOnended = function() {};
	this.fnOnpaused = function() {};
	this.startedTime = 0;
	this.pausedOffset = 0;
	this.isPlaying = false;
	this.isPaused = false;
};

function startSampleFrom( ws, compoOffset ) {
	var start = ws.when - compoOffset;
	var offset = start >= 0 ? ws.offset : ws.offset - start;
	ws.start( start, Math.max( offset, 0 ) );
}

function updateTimeout( compo ) {
	if ( compo.playTimeoutId )
		clearTimeout( compo.playTimeoutId );
	compo.playTimeoutId = setTimeout( compo.onended.bind( compo ),
		( compo.lastSample.getEndTime() - compo.getOffset() ) * 1000 );
}

function updateInLive( compo, ws, action, oldLast ) {
	if ( ws.getEndTime() > compo.getOffset() && action != "rm" ) {
		ws.load();
		startSampleFrom( ws, compo.getOffset() );
	}
	if ( compo.lastSample != oldLast || action == "mv" ) {
		if ( !compo.lastSample || compo.lastSample.getEndTime() <= compo.getOffset() ) {
			compo.onended();
		} else {
			updateTimeout( compo );
		}
	}
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
	// TODO : optimization
	update: function( ws, action ) {
		var
			that = this,
			oldLast = this.lastSample,
			save
		;
		this.lastSample = this.getLastSample();
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
	load: function( compoOffset ) {
		if ( !this.isPlaying ) {
			this.wSamples.forEach( function( ws ) {
				if ( !compoOffset || ws.getEndTime() > compoOffset ) {
					ws.load();
				}
			});
		}
		return this;
	},
	play: function() {
		this.playFrom( 0 );
	},
	playFrom: function( compoOffset ) {
		compoOffset = compoOffset || this.getOffset();
		this.load( compoOffset );
		this.start( compoOffset );
	},
	start: function( compoOffset ) {
		compoOffset = Math.max( compoOffset, 0 );
		if ( this.wSamples.length && !this.isPlaying ) {
			this.startedTime = wa.wctx.ctx.currentTime;
			this.pausedOffset = compoOffset;
			this.isPlaying = true;
			this.isPaused = false;
			this.wSamples.forEach( function( ws ) {
				if ( ws.getEndTime() > compoOffset ) {
					startSampleFrom( ws, compoOffset );
				}
			});
			updateTimeout( this );
		}
		return this;
	},
	stop: function() {
		if ( this.isPlaying || this.isPaused ) {
			this.wSamples.forEach( function( ws ) {
				ws.stop();
			});
			this.onended();
		}
		return this;
	},
	pause: function() {
		if ( this.isPlaying ) {
			this.pausedOffset += wa.wctx.ctx.currentTime - this.startedTime;
			this.wSamples.forEach( function( ws ) {
				ws.stop();
			});
			clearTimeout( this.playTimeoutId );
			this.startedTime = 0;
			this.isPlaying = false;
			this.isPaused = true;
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
	getOffset: function() {
		return	this.isPlaying
				? this.pausedOffset + wa.wctx.ctx.currentTime - this.startedTime
				: this.pausedOffset;
	},
	onended: function( fn ) {
		if ( typeof fn === "function" ) {
			this.fnOnended = fn;
		} else {
			if ( this.playTimeoutId ) {
				clearTimeout( this.playTimeoutId );
			}
			this.startedTime = 0;
			this.isPlaying = false;
			this.isPaused = false;
			this.pausedOffset = 0;
			this.fnOnended();
		}
		return this;
	}
};

})();