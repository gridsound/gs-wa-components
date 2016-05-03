"use strict";

(function() {


walContext.Composition = function( wCtx ) {
	this.wCtx = wCtx;
	this.wSamples = [];
};

walContext.Composition.prototype = {
	addSamples: function( wSamplesArr ) {
		var that = this;
		wSamplesArr.map( function( ws ) {
			if ( that.wSamples.length === 0 || that.wSamples.indexOf( ws ) === -1 ) {
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
			}
		});
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
	}
};

})();