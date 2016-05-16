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

	this.loaded =
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
		if ( !this.loaded ) {
			this.loaded = true;
			this.source = this.wCtx.ctx.createBufferSource();
			this.source.buffer = this.wBuffer.buffer;
			this.source.onended = this.onended.bind( this );
			if ( this.connectedTo ) {
				this.source.connect( this.connectedTo );
			}
		}
		return this;
	},
	start: function( when, offset, duration ) {
		var that = this;
		if ( !this.loaded ) {
			console.warn( "WebAudio Library: can not start an unloaded sample." );
		} else if ( this.started ) {
			console.warn( "WebAudio Library: can not start a sample twice." );
		} else {
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
			if ( when ) {
				this.playTimeoutId = setTimeout( onplay, when * 1000 );
			} else {
				onplay();
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
		return this.when + ( this.duration + this.offset > this.bufferDuration
			? this.bufferDuration - this.offset
			: this.duration );
	},
	onended: function( fn ) {
		if ( typeof fn === "function" ) {
			this.fnOnended = fn;
		} else if ( this.loaded ) {
			if ( this.playing ) {
				this.playing = false;
				--this.wCtx.nbPlaying;
			}
			if ( this.started ) {
				this.started = false;
				clearTimeout( this.playTimeoutId );
			}
			this.loaded = false;
			this.source = null;
			this.fnOnended();
		}
		return this;
	}
};
