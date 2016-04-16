"use strict";

walContext.Filters = function( wCtx ) {
	this.nodes = [];

	// Node `input` sur laquelle seront connectés tous les nodes entrants
	// On peut ainsi changer l'ordre des noeuds dans le tableau sans risques
	this.nodeIn = wCtx.ctx.createGain();
	
	// Node `output` sur laquelle sera connecté le dernier node du tableau
	// C'est elle qui devra être connecté à d'autres nodes
	// Gain permettant de controler le volume d'un groupe de samples/nodes
	this.nodeOut = wCtx.ctx.createGain();

	// Ce n'est pas un nodeOut car cd n'est pas un node 
	// appartenant au sample, c'est le node nodeIn d'un wNode
	// auquel le sample sera connecté
	// Besoin de le connaitre pour la deconnection
	// this.connectedTo;

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
	connect: function( wNode ) {
		this.nodeOut.connect( wNode.nodeIn );
		this.connectedTo = wNode.nodeIn;
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