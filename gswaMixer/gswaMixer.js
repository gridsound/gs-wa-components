"use strict";

class gswaMixer {
	static fftSizeVu = 1024;
	static fftSize = 1024;
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
		$changeChannelProp: this.#changeChanProp.bind( this ),
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
		this.#vuAnalyserChan = null;
		if ( "main" in this.#ctrlMixer.$getData().channels ) {
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
	}
	$change( obj ) {
		this.#ctrlMixer.$change( obj );
	}
	$clear() {
		this.#vuAnalyserChan = null;
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
		return this.#chans[ id ]?.toggle;
	}
	$fillAudioDataVu( chanId ) {
		if ( chanId !== this.#vuAnalyserChan ) {
			const nodes = this.#chans[ chanId ];
			const nodesOld = this.#chans[ this.#vuAnalyserChan ];

			if ( nodesOld ) {
				nodesOld.splitter.disconnect( this.#vuAnalyserL, 0 );
				nodesOld.splitter.disconnect( this.#vuAnalyserR, 1 );
			}
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
			input: ctx.createGain(),
			toggle: ctx.createGain(),
			gain: ctx.createGain(),
			pan: new gswaStereoPanner( ctx ),
			output: ctx.createGain(),
			splitter: ctx.createChannelSplitter( 2 ),
			analyserL: ctx.createAnalyser(),
			analyserR: ctx.createAnalyser(),
		};

		chan.analyserL.fftSize =
		chan.analyserR.fftSize = gswaMixer.fftSize;
		chan.analyserL.smoothingTimeConstant =
		chan.analyserR.smoothingTimeConstant = 0;
		chan.input.connect( chan.toggle )
		chan.toggle.connect( chan.gain );
		chan.gain.connect( chan.pan.$getInput() );
		chan.pan.$connect( chan.output );
		chan.pan.$connect( chan.splitter );
		chan.splitter.connect( chan.analyserL, 0 );
		chan.splitter.connect( chan.analyserR, 1 );
		this.#chans[ id ] = chan;
		GSUforEach( this.#ctrlMixer.$getData().channels, ( chan, chanId ) => {
			if ( chan.dest === id ) {
				this.#changeChanProp( chanId, "dest", id );
			}
		} );
	}
	#removeChan( id ) {
		const nodes = this.#chans[ id ];

		nodes.pan.$disconnect();
		nodes.gain.disconnect();
		nodes.input.disconnect();
		nodes.output.disconnect();
		nodes.splitter.disconnect();
		delete this.#chans[ id ];
	}
	#changeChanProp( id, prop, val, prev ) {
		const chan = this.#chans[ id ];
		const now = this.ctx.currentTime;

		switch ( prop ) {
			case "toggle": chan.toggle.gain.setValueAtTime( val ? 1 : 0, now ); break;
			case "pan": chan.pan.$setValueAtTime( val, now ); break;
			case "gain": chan.gain.gain.setValueAtTime( val, now ); break;
			case "dest":
				chan.output.disconnect();
				if ( val in this.#ctrlMixer.$getData().channels ) {
					chan.output.connect( this.$getChanInput( val ) );
				}
				break;
		}
	}
}
