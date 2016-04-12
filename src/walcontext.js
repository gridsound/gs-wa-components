"use strict";

function walContext() {
	this.ctx = new AudioContext();
	this.buffers = [];
};

walContext.prototype = {
	createBuffer: function( file, fn ) {
		var buf = new walContext.Buffer( this.ctx, file, fn );
		this.buffers.push( buf );
		return buf;
	}
};
