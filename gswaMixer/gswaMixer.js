"use strict";

class gswaMixer {
	constructor() {
		this._chans = {};
		this._fftSize = 128;
		this.audioDataL = new Uint8Array( 64 );
		this.audioDataR = new Uint8Array( 64 );
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
	fillAudioData( chanId ) {
		const nodes = this._chans[ chanId ];

		nodes.analyserL.getByteFrequencyData( this.audioDataL );
		nodes.analyserR.getByteFrequencyData( this.audioDataR );
	}
	liveUpdateChan( chanId, prop, val ) {
		this._updateChan( chanId, prop, val );
	}

	// chan:
	_addChan( id, obj ) {
		const ctx = this.ctx,
			pan = new gswaStereoPanner( ctx ),
			gain = ctx.createGain(),
			input = ctx.createGain(),
			output = ctx.createGain(),
			splitter = ctx.createChannelSplitter( 2 ),
			analyserL = ctx.createAnalyser(),
			analyserR = ctx.createAnalyser();

		analyserL.fftSize =
		analyserR.fftSize = this._fftSize;
		analyserL.smoothingTimeConstant =
		analyserR.smoothingTimeConstant = 0;
		input.connect( pan.getInput() );
		pan.connect( gain );
		gain.connect( output );
		gain.connect( splitter );
		splitter.connect( analyserL, 0 );
		splitter.connect( analyserR, 1 );
		this._chans[ id ] = {
			input, pan, gain, output, splitter, analyserL, analyserR,
			analyserData: new Uint8Array( analyser.frequencyBinCount )
		};
	}
	_deleteChan( id ) {
		const nodes = this._chans[ id ];

		nodes.pan.disconnect();
		nodes.gain.disconnect();
		nodes.input.disconnect();
		nodes.output.disconnect();
		nodes.splitter.disconnect();
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
				nodes.gain.gain.setValueAtTime( val, now );
				break;
			case "toggle":
				nodes.gain.gain.setValueAtTime( val ? this.data[ id ].gain : 0, now );
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
