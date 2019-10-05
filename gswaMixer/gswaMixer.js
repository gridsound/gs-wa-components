"use strict";

class gswaMixer {
	constructor() {
		this.ctx =
		this.connectedTo = null;
		this._chans = {};
		this._fftSize = 128;
		this.audioDataL = new Uint8Array( 64 );
		this.audioDataR = new Uint8Array( 64 );
		this.gsdata = new GSDataMixer( {
			dataCallbacks: {
				addChan: this._addChan.bind( this ),
				removeChan: this._removeChan.bind( this ),
				toggleChan: this._updateChanToggle.bind( this ),
				redirectChan: this._updateChanDest.bind( this ),
				changePanChan: this._updateChanPan.bind( this ),
				changeGainChan: this._updateChanGain.bind( this ),
			},
		} );
		Object.seal( this );
	}

	setContext( ctx ) {
		this.disconnect();
		this.ctx = ctx;
		if ( this.gsdata.values.nbChannels > 0 ) {
			this.gsdata.reset();
		} else {
			this.gsdata.change( {
				main: {
					toggle: true,
					name: "main",
					gain: 1,
					pan: 0,
				},
			} );
		}
	}
	change( obj ) {
		this.gsdata.change( obj );
	}
	clear() {
		this.gsdata.clear();
		this.gsdata.change( {
			main: {
				toggle: true,
				name: "main",
				gain: 1,
				pan: 0,
			},
		} );
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

	// chan:
	_addChan( id ) {
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
			analyserData: new Uint8Array( analyserL.frequencyBinCount )
		};
		Object.entries( this.gsdata.data ).forEach( kv => {
			if ( kv[ 1 ].dest === id ) {
				this.gsdata.liveChange( kv[ 0 ], "dest", id );
			}
		} );
	}
	_updateChanPan( id, val ) {
		this._chans[ id ].pan.setValueAtTime( val, this.ctx.currentTime );
	}
	_updateChanGain( id, val ) {
		this._chans[ id ].gain.gain.setValueAtTime( val, this.ctx.currentTime );
	}
	_updateChanToggle( id, val ) {
		this._chans[ id ].gain.gain.setValueAtTime( val ? this.gsdata.data[ id ].gain : 0, this.ctx.currentTime );
	}
	_updateChanDest( id, val ) {
		this._chans[ id ].output.disconnect();
		if ( val in this.gsdata.data ) {
			this._chans[ id ].output.connect( this._chans[ val ].input );
		}
	}
	_removeChan( id ) {
		const nodes = this._chans[ id ];

		nodes.pan.disconnect();
		nodes.gain.disconnect();
		nodes.input.disconnect();
		nodes.output.disconnect();
		nodes.splitter.disconnect();
		delete this._chans[ id ];
	}
}
