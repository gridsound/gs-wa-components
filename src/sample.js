"use strict";

walContext.Sample = function( ctx, wBuffer, dest ) {
	this.ctx = ctx;
	this.wBuffer = wBuffer;
	this.destNode = dest || ctx.destination;

	this.when = 0;
	this.offset = 0;
	this.duration = wBuffer.buffer.duration;
};

walContext.Sample.prototype = {
	connect: function( node ) {
		this.destNode = node;
		return this;
	},
	load: function() {
		this.source = this.ctx.createBufferSource();
		this.source.buffer = this.wBuffer.buffer;
		this.source.connect( this.destNode );
		return this;
	},
	start: function( when, offset, duration ) {
		this.source.start(
			when     !== undefined ? when     : this.when,
			offset   !== undefined ? offset   : this.offset,
			duration !== undefined ? duration : this.duration
		);
		return this;
	},
	stop: function( when ) {
		this.source.stop( when );
		return this;
	}
};
