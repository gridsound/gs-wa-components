"use strict";

(function() {


walContext.Composition = function( wCtx ) {
	this.wCtx = wCtx;
	this.wSamples = [];
	this.lastSample = null;
	this.onended = function() {};
};

walContext.Composition.prototype = {
	addSamples: function( wSamplesArr ) {
		var that = this;
		wSamplesArr.map( function( ws ) {
			if ( that.wSamples.length === 0 || that.wSamples.indexOf( ws ) === -1 ) {
				if ( that.wSamples.length === 0 || ws.getEndTime() > that.lastSample.getEndTime() ) {
					if ( that.lastSample ) {
						that.lastSample.onended( function() {} );
					}
					that.lastSample = ws;
					that.lastSample.onended( that.onended );
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

		wSamplesArr.map( function( ws ) {
			if ( that.wSamples.length !== 0 && ( index = that.wSamples.indexOf( ws ) ) !== -1 ) {
				that.wSamples.splice( index, 1 );
				ws.setComposition( null );
				if ( that.wSamples.length !== 0 || ws === that.lastSample ) {
					ws.onended( function() {} );
					that.lastSample = that.getLastSample();
					that.lastSample.onended( that.onended );
				} else if ( that.wSamples.length === 0 ) {
					ws.onended( function() {} );
					that.lastSample = null;
					that.onended( null );
				}
			}
		});
	},
	updateSamples: function( ws ) {
		var newLast;

		if ( this.wSamples.length !== 0 && ws !== this.lastSample && ws.getEndTime() > this.lastSample.getEndTime() ) {
			if ( this.lastSample ) {
				this.lastSample.onended( function() {} );
			}
			this.lastSample = ws;
			this.lastSample.onended( this.onended );
		} else if ( this.wSamples.length !== 0 && ws === this.lastSample && ( ( newLast = this.getLastSample() ) !==  ws ) ) {
			if ( this.lastSample ) {
				this.lastSample.onended( function() {} );
			}
			this.lastSample = newLast;
			this.lastSample.onended( this.onended );
		}
	},
	loadSamples: function( compoOffset ) {
		this.wSamples.map( function( ws ) {
			if ( !compoOffset || ws.getEndTime() > compoOffset ) {
				ws.load();
			}
		});
		return this;
	},
	playSamples: function( compoOffset ) {
		var offset, start;
		this.wSamples.map( function( ws ) {
			if ( !compoOffset || ws.getEndTime() > compoOffset ) {
				start = compoOffset ? ws.when - compoOffset : ws.when;
				offset = compoOffset ? compoOffset - ws.when : ws.offset;
				ws.start( start, offset < 0 ? 0 : offset );
			}
		});
		return this;
	},
	stopSamples: function( compoOffset ) {
		this.wSamples.map( function( ws ) {
			ws.stop();
		});
		return this;
	},
	getLastSample: function() {
		var s, sEnd, end;
		if ( this.wSamples.length ) {
			s = this.wSamples[ 0 ];
			sEnd = s.getEndTime()
			this.wSamples.map( function( ws ) {
				end = ws.getEndTime();
				if ( end > sEnd ) {
					s = ws;
					sEnd = end;
				}
			});
		}
		return s;
	},
	setOnEnded: function( fn ) {
		this.onended = fn;
		this.lastSample.onended( fn );
	}
};

})();