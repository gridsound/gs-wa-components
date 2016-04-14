"use strict";

walContext.Sample = function( wCtx, wBuffer, dest ) {
	this.wCtx = wCtx;
	this.wBuffer = wBuffer;
	this.destNode = dest || wCtx.destination;

	this.fnOnended = function() {};
	this.when = 0;
	this.offset = 0;
	this.duration = wBuffer.buffer.duration;

	this.started =
	this.playing = false;
};

walContext.Sample.prototype = {
	connect: function( node ) {
		this.destNode = node;
		return this;
	},
	load: function() {
		this.source = this.wCtx.ctx.createBufferSource();
		this.source.buffer = this.wBuffer.buffer;
		this.source.connect( this.destNode );
		this.source.onended = this.onended.bind( this );
		return this;
	},
	start: function( when, offset, duration ) {
		var that = this;

		if ( !this.started ) {
			this.started = true;
			when = when !== undefined ? when : this.when;
			this.source.start(
				this.wCtx.ctx.currentTime + when,
				offset   !== undefined ? offset   : this.offset,
				duration !== undefined ? duration : this.duration
			);
			function onplay() {
				++that.wCtx.nbPlaying;
				that.playing = true;
			}
			if ( when > this.wCtx.ctx.currentTime ) {
				this.playTimeoutId = setTimeout( onplay, when );
			} else {
				onplay();
			}
		}
		return this;
	},
	stop: function( when ) {
		if ( this.started ) {
			this.source.stop( this.wCtx.ctx.currentTime + when );
			this.onended();
		}
		return this;
	},
	onended: function( fn ) {
		if ( typeof fn === "function" ) {
			this.fnOnended = fn;
		} else if ( this.started ) {
			this.started = false;
			if ( this.playing ) {
				this.playing = false;
				--this.wCtx.nbPlaying;
			} else {
				clearTimeout( this.playTimeoutId );
			}
			this.fnOnended();
		}
		return this;
	}
};
