"use strict";

WalContext.Sample = function( ctx, wBuffer, dest ) {
	this.ctx = ctx;
	this.wBuffer = wBuffer;
	this.destination = dest || ctx.destination;

	this.when = 0;
	this.offset = 0;
	this.duration = wBuffer.buffer.duration;
};

WalContext.Sample.prototype = {
	load: function() {
		this.source = this.ctx.createBufferSource();
		this.source.buffer = this.wBuffer.buffer;
		this.source.connect( this.destination );
		return this;
	},
	play: function() {
		this.source.start( this.when, this.offset, this.duration );
		return this;
	},
	stop: function( when ) {
		this.source.stop();
		return this;
	}
};
