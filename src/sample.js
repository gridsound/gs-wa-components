"use strict";

walContext.Sample = function( wCtx, wBuffer, wNode ) {
	this.wCtx = wCtx;
	this.wBuffer = wBuffer;
	this.connectedTo = wNode ? wNode.nodeIn : wCtx.nodeIn;

	this.fnOnended = function() {};
	this.when = 0;
	this.offset = 0;
	this.duration = wBuffer.buffer.duration;
	this.bufferDuration = wBuffer.buffer.duration;
	this.composition = null;

	this.started =
	this.playing = false;
};

walContext.Sample.prototype = {
	connect: function( node ) {
		this.connectedTo = node.nodeIn || node;
		if ( this.source ) {
			this.source.connect( this.connectedTo );
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
	setComposition: function( compo ) {
		this.composition = compo;
	},
	load: function() {
		this.source = this.wCtx.ctx.createBufferSource();
		this.source.buffer = this.wBuffer.buffer;
		this.source.onended = this.onended.bind( this );
		if ( this.connectedTo ) {
			this.source.connect( this.connectedTo );
		}
		return this;
	},
	start: function( when, offset, duration ) {
		if ( !this.started ) {
			var that = this;

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
			this.source.stop( this.wCtx.ctx.currentTime + ( when || 0 ) );
			this.onended();
		}
		return this;
	},
	setWhen: function( when ) {
		this.when = when;
	},
	setOffset: function( offset ) {
		this.offset = offset > 0 ? offset : 0;
	},
	setDuration: function( duration ) {
		this.duration = duration;
	},
	getWhen: function() {
		return this.when;
	},
	getOffset: function() {
		return this.offset;
	},
	getDuration: function() {
		return this.duration;
	},
	getEndTime: function() {
		var d = this.duration + this.offset > this.bufferDuration
			  ? this.bufferDuration - this.offset
			  : this.duration;

		return this.when + d;
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
			this.source = null;
		}
		return this;
	}
};
