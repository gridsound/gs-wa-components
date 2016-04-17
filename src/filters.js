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
			this.nodes[ this.nodes.length - 1 ].disconnect( this.nodeOut );
			this.nodes[ this.nodes.length - 1 ].connect( node );
		} else {
			this.nodeIn.disconnect( this.nodeOut );	
			this.nodeIn.connect( node );
		}
		node.connect( this.nodeOut );
		this.nodes.push( node );
	},
	popBack: function() {
		var poped = this.nodes.pop();
		if ( poped ) {
			poped.disconnect( this.nodeOut );
			if ( this.nodes.length === 0 ) {
				this.nodeIn.disconnect( poped );
				this.nodeIn.connect( this.nodeOut );
			} else {
				this.nodes[ this.nodes.length - 1 ].disconnect( poped );
				this.nodes[ this.nodes.length - 1 ].connect( this.nodeOut );
			}
		}
		return poped;
	},
	popAll: function() {
		if ( this.nodes.length > 0 ) {
			var poped = this.nodes;
			this.nodeIn.disconnect( this.nodes[ 0 ] );
			poped[ poped.length - 1 ].disconnect( this.nodeOut );
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
		this.nodeOut.disconnect( this.connectedTo );
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
