"use strict";

walContext.Filters = function( wCtx ) {
	this.wCtx = wCtx;
	this.nodes = [];

	this.nodeIn = wCtx.ctx.createGain();
	this.nodeOut = wCtx.ctx.createGain();

	this.nodeIn.connect( this.nodeOut );
	this.connect( wCtx.ctx.destination );
};

walContext.Filters.prototype = {
	pushBack: function( node ) {
		if ( this.nodes.length ) {
			var lastnode = this.nodes[ this.nodes.length - 1 ];
			lastnode.disconnect();
			lastnode.connect( node );
		} else {
			this.nodeIn.disconnect();
			this.nodeIn.connect( node );
		}
		node.connect( this.nodeOut );
		this.nodes.push( node );
	},
	pushFront: function( node ) {
		if ( this.nodes.length ) {
			this.nodeIn.disconnect();
			this.nodeIn.connect( node );
			node.connect( this.nodes[ 0 ] );
			this.nodes.unshift( node );
		} else {
			this.pushBack( node );
		}
	},
	popBack: function() {
		var poped = this.nodes.pop();
		if ( poped ) {
			poped.disconnect();
			if ( this.nodes.length ) {
				var lastnode = this.nodes[ this.nodes.length - 1 ];
				lastnode.disconnect();
				lastnode.connect( this.nodeOut );
			} else {
				this.nodeIn.disconnect();
				this.nodeIn.connect( this.nodeOut );
			}
		}
		return poped;
	},
	popFront: function() {
		var poped = this.nodes.shift();
		if ( poped ) {
			poped.disconnect();
			this.nodeIn.disconnect();
			this.nodeIn.connect( this.nodes[ 0 ] || this.nodeOut );
		}
		return poped;
	},
	empty: function() {
		if ( this.nodes.length ) {
			this.nodes[ this.nodes.length - 1 ].disconnect();
			this.nodeIn.disconnect();
			this.nodeIn.connect( this.nodeOut );
			this.nodes = [];
		}
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
			return this.nodeOut.gain.value;
		}
		this.nodeOut.gain.value = vol;
	}
};
