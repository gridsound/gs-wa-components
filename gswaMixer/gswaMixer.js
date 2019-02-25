"use strict";

class gswaMixer {
	constructor() {
		this._chans = {};
		this.data = this._proxInit();
	}

	setContext( ctx ) {
		const dataEnt = Object.entries( this.data );

		this.disconnect();
		this.ctx = ctx;
		if ( dataEnt.length ) {
			dataEnt.forEach( kv => this._deleteChan( kv[ 0 ] ) );
			dataEnt.forEach( kv => this._addChan( kv[ 0 ], kv[ 1 ] ) );
		} else {
			this.data.main = {
				order: 0,
				toggle: true,
				name: "",
				pan: 0,
				gain: 1,
			};
		}
	}
	connect( dest ) {
		this.disconnect();
		this._chans.main.output.connect( dest );
		this.connectedTo = dest;
	}
	disconnect() {
		if ( this._chans.main ) {
			this._chans.main.output.disconnect();
			this.connectedTo = null;
		}
	}
	getChanInput( id ) {
		return this._chans[ id ].input;
	}

	// chan:
	_addChan( id, obj ) {
		const pan = this.ctx.createStereoPanner(),
			input = this.ctx.createGain(),
			output = this.ctx.createGain();

		input.connect( pan );
		pan.connect( output );
		this._chans[ id ] = { pan, input, output };
	}
	_deleteChan( id ) {
		const nodes = this._chans[ id ];

		nodes.pan.disconnect();
		nodes.input.disconnect();
		nodes.output.disconnect();
		delete this._chans[ id ];
	}
	_updateChan( id, prop, val ) {
		const nodes = this._chans[ id ],
			now = this.ctx.currentTime;

		switch ( prop ) {
			case "pan":
				nodes.pan.pan.setValueAtTime( val, now );
				break;
			case "gain":
				nodes.input.gain.setValueAtTime( val, now );
				break;
			case "toggle":
				nodes.input.gain.setValueAtTime( val ? this.data[ id ].gain : 0, now );
				break;
			case "dest":
				nodes.output.disconnect();
				nodes.output.connect( this._chans[ val ].input );
				break;
		}
	}

	// proxy:
	_proxInit() {
		return new Proxy( {}, {
			set: this._proxAddChan.bind( this ),
			deleteProperty: this._proxDeleteChan.bind( this ),
		} );
	}
	_proxAddChan( tar, prop, val ) {
		this._proxDeleteChan( tar, prop );
		return this.__proxAddChan( tar, prop, val );
	}
	_proxDeleteChan( tar, prop ) {
		if ( prop in tar ) {
			this._deleteChan( prop );
			delete tar[ prop ];
		}
		return true;
	}
	__proxAddChan( tar, id, obj ) {
		const tarchan = {
				order: 0,
				toggle: true,
				name: "",
				pan: 0,
				gain: 0,
			},
			_ = id !== "main" ? ( tarchan.dest = "main" ) : null,
			updateChan = this._proxUpdateChan.bind( this, id ),
			chan = new Proxy( Object.seal( tarchan ), { set: updateChan } );

		tar[ id ] = chan;
		this._addChan( id, chan );
		chan.pan = obj.pan;
		chan.gain = obj.gain;
		chan.name = obj.name;
		chan.toggle = obj.toggle;
		chan.order = obj.order;
		if ( obj.dest ) {
			chan.dest = obj.dest;
		}
		return true;
	}
	_proxUpdateChan( id, tar, prop, val ) {
		tar[ prop ] = val;
		this._updateChan( id, prop, val );
		return true;
	}
}
