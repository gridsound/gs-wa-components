"use strict";

walContext.Sample = function( wCtx ) {
	this.wCtx = wCtx;
	this.connectedTo = wCtx.nodeIn;
	this.loaded =
	this.started =
	this.playing = false;
	this._onendedFn = function() {};
	this.onplay = this.onplay.bind( this );
	this.onended = this.onended.bind( this );
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
			if ( this.source ) {
				this.source.connect( node );
			}
		}
		return this;
	},
	disconnect: function() {
		if ( this.source ) {
			this.source.disconnect();
			this.connectedTo = null;
		}
		return this;
	},
	load: function() {
		if ( this.wBuffer && !this.loaded ) {
			this.loaded = true;
			this.source = this.wCtx.ctx.createBufferSource();
			this.source.buffer = this.wBuffer.buffer;
			this.source.onended = this.onended;
			if ( this.connectedTo ) {
				this.source.connect( this.connectedTo );
			}
		}
		return this;
	},
	start: function( when, offset, duration ) {
		if ( this.loaded && !this.started ) {
			when     = when     != null ? when     : this.when;
			offset   = offset   != null ? offset   : this.offset;
			duration = duration != null ? duration : this.duration;
			this.source.start( this.wCtx.ctx.currentTime + when, offset, duration );
			this.started = true;
			if ( when ) {
				this.playTimeoutId = setTimeout( this.onplay, when * 1000 );
			} else {
				this.onplay();
			}
		}
		return this;
	},
	stop: function() {
		if ( this.started ) {
			this.source.onended = null;
			this.source.stop( 0 );
			this.onended();
		}
		return this;
	},
	onplay: function() {
		this.playing = true;
		++this.wCtx.nbPlaying;
	},
	onended: function( fn ) {
		if ( typeof fn === "function" ) {
			this._onendedFn = fn;
		} else if ( this.loaded ) {
			if ( this.started ) {
				this.started = false;
				clearTimeout( this.playTimeoutId );
			}
			if ( this.playing ) {
				this.playing = false;
				--this.wCtx.nbPlaying;
			}
			this.loaded = false;
			this.source = null;
			this._onendedFn();
		}
		return this;
	}
};
