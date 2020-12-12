"use strict";

class gswaMixer {
	constructor() {
		this.ctx =
		this.connectedTo = null;
		this._chans = {};
		this._fftSize = 4096;
		this.audioDataL = new Uint8Array( this._fftSize / 2 );
		this.audioDataR = new Uint8Array( this._fftSize / 2 );
		this._ctrlMixer = new DAWCore.controllers.mixer( {
			dataCallbacks: {
				addChannel: this._addChan.bind( this ),
				removeChannel: this._removeChan.bind( this ),
				toggleChannel: this._toggleChan.bind( this ),
				redirectChannel: this._redirectChan.bind( this ),
				changePanChannel: this._updateChanPan.bind( this ),
				changeGainChannel: this._updateChanGain.bind( this ),
			},
		} );
		Object.seal( this );
	}

	setContext( ctx ) {
		this.disconnect();
		this.ctx = ctx;
		if ( "main" in this._ctrlMixer.data.channels ) {
			this._ctrlMixer.recall();
		} else {
			this._ctrlMixer.change( {
				channels: {
					main: {
						toggle: true,
						name: "main",
						gain: 1,
						pan: 0,
					},
				},
			} );
		}
	}
	change( obj ) {
		this._ctrlMixer.change( obj );
	}
	clear() {
		this._ctrlMixer.clear();
		this._ctrlMixer.change( {
			channels: {
				main: {
					toggle: true,
					name: "main",
					gain: 1,
					pan: 0,
				},
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
		return this._chans[ id ]?.input;
	}
	getChanOutput( id ) {
		return this._chans[ id ]?.pan.getInput();
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
		Object.entries( this._ctrlMixer.data.channels ).forEach( kv => {
			if ( kv[ 1 ].dest === id ) {
				this._redirectChan( kv[ 0 ], id );
			}
		} );
	}
	_redirectChan( id, val ) {
		this._chans[ id ].output.disconnect();
		if ( val in this._ctrlMixer.data.channels ) {
			this._chans[ id ].output.connect( this.getChanInput( val ) );
		}
	}
	_toggleChan( id, val ) {
		this._chans[ id ].gain.gain.setValueAtTime( val ? this._ctrlMixer.data.channels[ id ].gain : 0, this.ctx.currentTime );
	}
	_updateChanPan( id, val ) {
		this._chans[ id ].pan.setValueAtTime( val, this.ctx.currentTime );
	}
	_updateChanGain( id, val ) {
		if ( this._ctrlMixer.data.channels[ id ].toggle ) {
			this._chans[ id ].gain.gain.setValueAtTime( val, this.ctx.currentTime );
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
