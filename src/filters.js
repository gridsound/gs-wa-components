"use strict";

walContext.Filters = function( wCtx ) {
	this.wCtx = wCtx;
	this.nodes = [];

	this.nodeIn = wCtx.ctx.createGain();
	this.nodeOut = wCtx.ctx.createGain();
	this.nodeIn.connect( this.nodeOut );
};

walContext.Filters.prototype = {
	pushBack: function( node ) {
		if ( this.nodes.length > 0 ) {
			this.nodes[ this.nodes.length - 1 ].disconnect();
			this.nodes[ this.nodes.length - 1 ].connect( node );
		} else {
			this.nodeIn.disconnect();
			this.nodeIn.connect( node );
		}
		node.connect( this.nodeOut );
		this.nodes.push( node );
	},
	pushFront: function( node ) {
		if ( this.nodes.length === 0 ) {
			this.pushBack( node );
		} else {
			this.nodeIn.disconnect();
			this.nodeIn.connect( node );
			this.nodes.unshift( node );
			node.connect( this.nodes[ 1 ] );
		}
	},
	popBack: function() {
		var poped = this.nodes.length ? this.nodes.pop() : null;
		if ( poped ) {
			poped.disconnect();
			if ( this.nodes.length === 0 ) {
				this.nodeIn.disconnect();
				this.nodeIn.connect( this.nodeOut );
			} else {
				this.nodes[ this.nodes.length - 1 ].disconnect();
				this.nodes[ this.nodes.length - 1 ].connect( this.nodeOut );
			}
		}
		return poped;
	},
	popFront: function() {
		var poped;

		if ( !this.nodes.length ) {
			poped = null;
		} else if ( this.nodes.length === 1 ) {
			poped = this.popBack();
		} else {
			this.nodeIn.disconnect();
			this.nodes[ 0 ].disconnect();
			poped = this.nodes.shift();
			this.nodeIn.connect( this.nodes[ 0 ] );
		}
		return poped;
	},
	popAll: function() {
		if ( this.nodes.length > 0 ) {
			var poped = this.nodes;
			this.nodeIn.disconnect();
			poped[ poped.length - 1 ].disconnect();
			this.nodeIn.connect( this.nodeOut );
			this.nodes = [];
			return poped;
		}
		return null;
	},
	connect: function( node ) {
		node = node.nodeIn || node;
		this.nodeOut.connect( node );
		this.connectedTo = node;
	},
	disconnect: function() {
		this.nodeOut.disconnect();
		this.connectedTo = null;
	},
	gain: function( vol ) {
		if ( !arguments.length ) {
			return this.gainNode.gain.value;
		}
		this.gainNode.gain.value = vol;
		return this;
	}
};
