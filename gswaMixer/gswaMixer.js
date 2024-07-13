"use strict";

class gswaMixer {
	static fftSizeVu = 1024;
	static fftSize = 4096;
	ctx = null;
	connectedTo = null;
	#vuAnalyserL = null;
	#vuAnalyserR = null;
	#vuAnalyserChan = null;
	#analyserType = "hz";
	$vuDataL = new Float32Array( gswaMixer.fftSizeVu / 2 );
	$vuDataR = new Float32Array( gswaMixer.fftSizeVu / 2 );
	$audioDataL = new Float32Array( gswaMixer.fftSize / 2 );
	$audioDataR = new Float32Array( gswaMixer.fftSize / 2 );
	#chans = {};
	#ctrlMixer = new DAWCoreControllerMixer( {
		$addChannel: this.#addChan.bind( this ),
		$removeChannel: this.#removeChan.bind( this ),
		$toggleChannel: this.#toggleChan.bind( this ),
		$redirectChannel: this.#redirectChan.bind( this ),
		$changePanChannel: this.#updateChanPan.bind( this ),
		$changeGainChannel: this.#updateChanGain.bind( this ),
	} );

	constructor() {
		Object.seal( this );
	}

	// .........................................................................
	$setContext( ctx ) {
		this.$disconnect();
		this.ctx = ctx;
		this.#vuAnalyserL = ctx.createAnalyser();
		this.#vuAnalyserR = ctx.createAnalyser();
		this.#vuAnalyserL.fftSize =
		this.#vuAnalyserR.fftSize = gswaMixer.fftSize;
		if ( "main" in this.#ctrlMixer.$data.channels ) {
			this.#ctrlMixer.$recall();
		} else {
			this.#ctrlMixer.$change( {
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
		this.#vuAnalyserChan = "main";
		this.#chans.main.splitter.connect( this.#vuAnalyserL, 0 );
		this.#chans.main.splitter.connect( this.#vuAnalyserR, 1 );
	}
	$change( obj ) {
		this.#ctrlMixer.$change( obj );
	}
	$clear() {
		this.#ctrlMixer.$clear();
		this.#ctrlMixer.$change( {
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
	$connect( dest ) {
		this.$disconnect();
		this.#chans.main.output.connect( dest );
		this.connectedTo = dest;
	}
	$disconnect() {
		if ( this.#chans.main ) {
			this.#chans.main.output.disconnect();
			this.connectedTo = null;
		}
	}
	$getChanInput( id ) {
		return this.#chans[ id ]?.input;
	}
	$getChanOutput( id ) {
		return this.#chans[ id ]?.pan.getInput();
	}
	$fillAudioDataVu( chanId ) {
		if ( chanId !== this.#vuAnalyserChan ) {
			const nodesOld = this.#chans[ this.#vuAnalyserChan ];
			const nodes = this.#chans[ chanId ];

			nodesOld.splitter.disconnect( this.#vuAnalyserL, 0 );
			nodesOld.splitter.disconnect( this.#vuAnalyserR, 1 );
			nodes.splitter.connect( this.#vuAnalyserL, 0 );
			nodes.splitter.connect( this.#vuAnalyserR, 1 );
			this.#vuAnalyserChan = chanId;
		}
		this.#vuAnalyserL.getFloatTimeDomainData( this.$vuDataL );
		this.#vuAnalyserR.getFloatTimeDomainData( this.$vuDataR );
	}
	$changeAnalyser( type ) {
		this.#analyserType = type;
	}
	$fillAudioData( chanId ) {
		const nodes = this.#chans[ chanId ];

		switch ( this.#analyserType ) {
			case "hz":
				nodes.analyserL.getFloatFrequencyData( this.$audioDataL );
				nodes.analyserR.getFloatFrequencyData( this.$audioDataR );
				break;
			case "td":
				nodes.analyserL.getFloatTimeDomainData( this.$audioDataL );
				nodes.analyserR.getFloatTimeDomainData( this.$audioDataR );
				break;
		}
	}

	// .........................................................................
	#addChan( id ) {
		const ctx = this.ctx;
		const chan = {
			pan: new gswaStereoPanner( ctx ),
			gain: ctx.createGain(),
			input: ctx.createGain(),
			output: ctx.createGain(),
			splitter: ctx.createChannelSplitter( 2 ),
			analyserL: ctx.createAnalyser(),
			analyserR: ctx.createAnalyser(),
		};

		chan.analyserL.fftSize =
		chan.analyserR.fftSize = gswaMixer.fftSize;
		chan.analyserL.smoothingTimeConstant =
		chan.analyserR.smoothingTimeConstant = 0;
		chan.input.connect( chan.pan.getInput() );
		chan.pan.connect( chan.gain );
		chan.gain.connect( chan.output );
		chan.gain.connect( chan.splitter );
		chan.splitter.connect( chan.analyserL, 0 );
		chan.splitter.connect( chan.analyserR, 1 );
		this.#chans[ id ] = chan;
		Object.entries( this.#ctrlMixer.$data.channels ).forEach( kv => {
			if ( kv[ 1 ].dest === id ) {
				this.#redirectChan( kv[ 0 ], id );
			}
		} );
	}
	#redirectChan( id, val ) {
		this.#chans[ id ].output.disconnect();
		if ( val in this.#ctrlMixer.$data.channels ) {
			this.#chans[ id ].output.connect( this.$getChanInput( val ) );
		}
	}
	#toggleChan( id, val ) {
		this.#chans[ id ].gain.gain.setValueAtTime( val ? this.#ctrlMixer.$data.channels[ id ].gain : 0, this.ctx.currentTime );
	}
	#updateChanPan( id, val ) {
		this.#chans[ id ].pan.setValueAtTime( val, this.ctx.currentTime );
	}
	#updateChanGain( id, val ) {
		if ( this.#ctrlMixer.$data.channels[ id ].toggle ) {
			this.#chans[ id ].gain.gain.setValueAtTime( val, this.ctx.currentTime );
		}
	}
	#removeChan( id ) {
		const nodes = this.#chans[ id ];

		nodes.pan.disconnect();
		nodes.gain.disconnect();
		nodes.input.disconnect();
		nodes.output.disconnect();
		nodes.splitter.disconnect();
		delete this.#chans[ id ];
	}
}
