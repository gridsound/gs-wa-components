"use strict";

function WalContext() {
	this.ctx = new AudioContext();
	this.buffers = [];
	// this.samples = [];
};

WalContext.prototype = {
	createBuffer: function( file, fn ) {
		var buf = new WalContext.Buffer( this.ctx, file, fn );
		this.buffers.push( buf );
		return buf;
	}
	// loadSet: function() {
	// 	$.each( samples, function() {
	// 		this.load();
	// 	});
	// },
	// playSet: function() {
	// 	$.each( samples, function() {
	// 		this.play();
	// 	});
	// }
};
