"use strict";

(function() {


walContext.Composition = function( wCtx ) {
	this.wCtx = wCtx;
	this.wSamples = [];
};

function getActiveSamples( wSamples, fromTime ) {
	var wsArr = [];

	$.each( wSamples, function() {
		if ( !fromTime || this.getEndTime() > fromTime ) {
			wsArr.push( this );
		}
	});
	return wsArr;
}

walContext.Composition.prototype = {
	addSamples: function( wSamplesArr ) {
		var that = this;
		$.each( wSamplesArr, function() {
			if ( that.wSamples.length === 0 || that.wSamples.indexOf( this ) === -1 ) {
				that.wSamples.push( this );
			}
		});
	},
	removeSamples: function( wSamplesArr ) {
		var
			that = this,
			index
		;

		$.each( wSamplesArr, function() {
			if ( that.wSamples.length !== 0 && ( index = that.wSamples.indexOf( this ) ) !== -1 ) {
				that.wSamples.splice( index, 1 );
			}
		});
	},
	loadSamples: function( fromTime ) {
		var wSamplesArr = !fromTime ? this.wSamples : getActiveSamples( this.wSamples, fromTime );

		$.each( wSamplesArr, function() {
			this.load();
		});
		return this;
	},
	playSamples: function( fromTime ) {
		var offset, start;
		var wSamplesArr = !fromTime ? this.wSamples : getActiveSamples( this.wSamples, fromTime );

		$.each( wSamplesArr, function() {
			start = fromTime ? this.when - fromTime : this.when;
			offset = fromTime ? fromTime - this.when : this.offset;
			this.start( start, offset < 0 ? 0 : offset );
		});
		return this;
	},
	stopSamples: function( fromTime ) {
		var wSamplesArr = !fromTime ? this.wSamples : getActiveSamples( this.wSamples, fromTime ); // fusionner avec le each du dessous
		$.each( wSamplesArr, function() {
			this.stop();
		});
		return this;
	},
	getLastSample: function() {
		var s, sEnd, end;

		if ( this.wSamples.length ) {
			s = this.wSamples[ 0 ];
			sEnd = s.getEndTime()
			$.each( this.wSamples, function() {
				end = this.getEndTime();
				if ( end > sEnd ) {
					s = this;
					sEnd = end;
				}
			});
		}
		return s;
	}
};

})();