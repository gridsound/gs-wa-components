"use strict";

walContext.Sample = function( wCtx ) {
	this.wCtx = wCtx;
	this.connectedTo = wCtx.nodeIn;
	this.started = 0;
	this.bufferSources = [];
	this.onended( function() {} );
	this.edit( 0, 0 );
};

walContext.Sample.prototype = {
	setBuffer: function( wBuffer ) {
		this.wBuffer = wBuffer;
		return this.setBufferDuration( wBuffer.buffer.duration );
	},
	setBufferDuration: function( dur ) {
		this.bufferDuration = dur;
		if ( this.duration == null || this.duration > dur ) {
			this.duration = dur;
		}
		return this;
	},
	edit: function( when, offset, duration ) {
		if ( when     != null ) { this.when     = when;     }
		if ( offset   != null ) { this.offset   = offset;   }
		if ( duration != null ) { this.duration = duration; }
		return this;
	},
	connect: function( node ) {
		node = node.nodeIn || node;
		if ( node instanceof AudioNode ) {
			this.connectedTo = node;
			this.bufferSources.forEach( function( bsrc ) {
				bsrc.connect( node );
			} );
		}
		return this;
	},
	disconnect: function() {
		this.connectedTo = null;
		this.bufferSources.forEach( function( bsrc ) {
			bsrc.disconnect();
		} );
		return this;
	},
	start: function( when, offset, duration ) {
		if ( this.wBuffer ) {
			var bsrc = this.wCtx.ctx.createBufferSource();

			when     = when     != null ? when     : this.when;
			offset   = offset   != null ? offset   : this.offset;
			duration = duration != null ? duration : this.duration;
			bsrc.buffer = this.wBuffer.buffer;
			bsrc.onended = this._bsrcOnended.bind( this, bsrc, true );
			bsrc.connect( this.connectedTo );
			this.bufferSources.push( bsrc );
			bsrc.start( this.wCtx.ctx.currentTime + when, offset, duration );
			++this.started;
			if ( when > 0 ) {
				bsrc.gs__onplayTimeoutId = setTimeout( this._bsrcOnplay.bind( this, bsrc ), when * 1000 );
			} else {
				this._bsrcOnplay( bsrc );
			}
		}
		return this;
	},
	stop: function() {
		if ( this.started ) {
			this.bufferSources.forEach( function( bsrc ) {
				bsrc.onended = null;
				bsrc.stop( 0 );
				this._bsrcOnended( bsrc, false );
			}, this );
			this.bufferSources.length = 0;
		}
		return this;
	},
	onended: function( fn ) {
		this._userOnended = fn;
		return this;
	},

	// private:
	_bsrcOnplay: function( bsrc ) {
		bsrc.gs__isPlaying = true;
		++this.wCtx.nbPlaying;
	},
	_bsrcOnended: function( bsrc, realEvent ) {
		clearTimeout( bsrc.gs__onplayTimeoutId );
		if ( bsrc.gs__isPlaying ) {
			bsrc.gs__isPlaying = false;
			--this.wCtx.nbPlaying;
		}
		if ( realEvent ) {
			this.bufferSources.splice( this.bufferSources.indexOf( bsrc ), 1 );
		}
		--this.started;
		this._userOnended();
	}
};
