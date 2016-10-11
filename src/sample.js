"use strict";

walContext.Sample = function( wCtx, wBuffer, wNode ) {
	this.wCtx = wCtx;
	this.wBuffer = wBuffer;
	this.connectedTo = wNode ? wNode.nodeIn : wCtx.nodeIn;
	this.bufferDuration = wBuffer.buffer.duration;
	this.edit( 0, 0, this.bufferDuration );
	this.loaded =
	this.started =
	this.playing = false;
	this._onendedFn = function() {};
	this.onplay = this.onplay.bind( this );
	this.onended = this.onended.bind( this );
};

walContext.Sample.prototype = {
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
		if ( !this.loaded ) {
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
		if ( !this.loaded ) {
			console.warn( "WebAudio Library: can not start an unloaded sample." );
		} else if ( this.started ) {
			console.warn( "WebAudio Library: can not start a sample twice." );
		} else {
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
	getEndTime: function() {
		return this.when + this.duration;
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
