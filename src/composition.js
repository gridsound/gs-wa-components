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
};

walContext.Composition.prototype = {
	addSamples: function( wSamplesArr ) {
		var that = this;
		wSamplesArr.forEach( function( ws ) {
			if ( that.wSamples.indexOf( ws ) === -1 ) {
				if ( that.lastSample === null || ws.getEndTime() > that.lastSample.getEndTime() ) {
					that.lastSample = ws;
				}
				that.wSamples.push( ws );
				ws.setComposition( ws );
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
				if ( ws === that.lastSample ) {
					that.lastSample = that.getLastSample();
				}
			}
		});
	},
	updateSamples: function( ws ) {
		if ( this.wSamples.indexOf( ws ) !== -1 ) {
			if ( ws !== this.lastSample && ws.getEndTime() > this.lastSample.getEndTime() ) {
				this.lastSample = ws;
			} else if ( ws === this.lastSample && this.wSamples.length > 1 ) {
				this.lastSample = this.getLastSample();
			}
		}
	},
	loadSamples: function( compoOffset ) {
		if ( !this.isPlaying ) {
			this.wSamples.forEach( function( ws ) {
				if ( !compoOffset || ws.getEndTime() > compoOffset ) {
					ws.load();
				}
			});
		}
		return this;
	},
	playSamples: function( compoOffset ) {
		var offset, start;
		if ( this.wSamples.length && !this.isPlaying ) {
			this.startedTime = wa.wctx.ctx.currentTime;
			if ( compoOffset ) {
				this.pausedOffset = compoOffset;
			}
			this.isPlaying = true;
			this.wSamples.forEach( function( ws ) {
				if ( !compoOffset || ws.getEndTime() > compoOffset ) {
					start = compoOffset ? ws.when - compoOffset : ws.when;
					offset = compoOffset ? compoOffset - ws.when : ws.offset;
					ws.start( start, offset < 0 ? 0 : offset );
				}
			});
			this.playTimeoutId = setTimeout( this.onended.bind( this ),
				( this.lastSample.getEndTime() - this.pausedOffset ) * 1000 );
		}
		return this;
	},
	stopSamples: function( compoOffset ) {
		var save;
		this.wSamples.forEach( function( ws ) {
			ws.stop();
		});
		this.onended();
		return this;
	},
	pauseSamples: function() {
		if ( this.isPlaying ) {
			this.pausedOffset += wa.wctx.ctx.currentTime - this.startedTime;
			this.wSamples.forEach( function( ws ) {
				ws.stop();
			});
			clearTimeout( this.playTimeoutId );
			this.startedTime = 0;
			this.isPlaying = false;
			this.fnOnpaused();
		}
	},
	getLastSample: function() {
		var s = null, sEnd, end;
		if ( this.wSamples.length ) {
			s = this.wSamples[ 0 ];
			sEnd = s.getEndTime()
			this.wSamples.forEach( function( ws ) {
				end = ws.getEndTime();
				if ( end > sEnd ) {
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
			this.pausedOffset = 0;
			this.fnOnended();
		}
		return this;
	}
};

})();