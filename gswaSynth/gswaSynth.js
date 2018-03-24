"use strict";

class gswaSynth {
	constructor() {
		this.data = this._proxyCreate();
		this._nodes = {};
		this._startedKeys = {};
	}

	// Context, dis/connect
	// ........................................................................
	setContext( ctx ) {
		const oscs = this.data.oscillators;

		this.stopAllKeys();
		this.disconnect();
		this.ctx = ctx;
		Object.keys( oscs ).forEach( this._oscsDel );
		Object.entries( oscs ).forEach( ( [ id, osc ] ) => this._oscsAdd( id, osc ) );
	}
	connect( dest ) {
		Object.values( this._nodes ).forEach( obj => obj.gain.connect( dest ) );
		this.connectedTo = dest;
	}
	disconnect() {
		Object.values( this._nodes ).forEach( obj => obj.gain.disconnect() );
		this.connectedTo = null;
	}

	// Start/stop keys
	// ........................................................................
	stopAllKeys() {
		Object.keys( this._startedKeys ).forEach( this.stopKey, this );
	}
	stopKey( id ) {
		const key = this._startedKeys[ id ];

		if ( key ) {
			Object.values( key.oscs ).forEach( node => node.stop() );
			delete this._startedKeys[ id ];
		}
	}
	startKey( midi, when, off, dur ) {
		const id = ++gswaSynth._startedMaxId,
			oscs = {},
			key = { midi, oscs, when, off, dur };

		Object.keys( this.data.oscillators ).forEach( oscId => {
			oscs[ oscId ] = this._createOscNode( key, oscId );
		} );
		this._startedKeys[ id ] = key;
		return id;
	}

	// createOscNode
	_createOscNode( key, oscId ) {
		const node = this.ctx.createOscillator(),
			osc = this.data.oscillators[ oscId ];

		this._nodeOscSetType( node, osc.type );
		node.detune.value = osc.detune;
		node.frequency.value = gswaSynth.midiKeyToHz[ key.midi ];
		node.connect( this._nodes[ oscId ].pan );
		node.start( key.when );
		if ( Number.isFinite( key.dur ) ) {
			node.stop( key.when + key.dur );
		}
		return node;
	}
	_nodeOscSetType( node, type ) {
		if ( gswaSynth.nativeTypes.indexOf( type ) > -1 ) {
			node.type = type;
		} else {
			const wave = gswaPeriodicWaves[ type ];

			node.setPeriodicWave( this.ctx.createPeriodicWave( wave.real, wave.imag ) );
		}
	}
	_oscsAdd( id, osc ) {
		const gain = this.ctx.createGain(),
			pan = this.ctx.createStereoPanner();

		this._nodes[ id ] = { gain, pan };
		pan.pan.value = osc.pan;
		gain.gain.value = osc.gain;
		pan.connect( gain );
		if ( this.connectedTo ) {
			gain.connect( this.connectedTo );
		}
		Object.values( this._startedKeys ).forEach(
			key => key.oscs[ id ] = this._createOscNode( key, id ) );
	}
	_oscsDel( id ) {
		const obj = this._nodes[ id ];

		obj.pan.disconnect();
		obj.gain.disconnect();
		Object.values( this._startedKeys ).forEach( key => {
			key.oscs[ id ].stop();
			delete key.oscs[ id ];
		} );
		delete this._nodes[ id ];
	}
	_oscsChangeProp( id, prop, val ) {
		switch ( prop ) {
			case "pan": this._nodes[ id ].pan.pan.value = val; break;
			case "gain": this._nodes[ id ].gain.gain.value = val; break;
			case "type":
			case "detune":
				Object.values( this._startedKeys )
					.forEach( prop === "detune"
						? key => key.oscs[ id ].detune.value = val
						: key => this._nodeOscSetType( key.oscs[ id ], val ) );
		}
	}

	// Data proxy
	// ........................................................................
	_proxyCreate() {
		return Object.freeze( {
			oscillators: new Proxy( {}, {
				set: this._proxyAddOsc.bind( this ),
				deleteProperty: this._proxyDelOsc.bind( this )
			} )
		} );
	}
	_proxyDelOsc( target, oscId ) {
		delete target[ oscId ];
		if ( this.ctx ) {
			this._oscsDel( oscId );
		}
		return true;
	}
	_proxyAddOsc( target, oscId, osc ) {
		if ( oscId in target && this.ctx ) {
			this._oscsDel( oscId );
		}
		osc = Object.assign( Object.seal( {
			order: 0,
			type: "sine",
			detune: 0,
			pan: 0,
			gain: 1
		} ), osc );
		target[ oscId ] = new Proxy( osc, {
			set: this._proxySetOscProp.bind( this, oscId )
		} );
		if ( this.ctx ) {
			this._oscsAdd( oscId, osc );
		}
		return true;
	}
	_proxySetOscProp( oscId, target, prop, val ) {
		target[ prop ] = val;
		if ( this.ctx ) {
			this._oscsChangeProp( oscId, prop, val );
		}
		return true;
	}
}

gswaSynth._startedMaxId = 0;

gswaSynth.nativeTypes = [ "sine", "triangle", "sawtooth", "square" ];

gswaSynth.midiKeyToHz = ( new Array( 12 ) ).concat( [
	//
	  // 27.5,
	  // 29.1353,
	  // 30.8677,

	//
	  32.7032, // C1 24
	  34.6479,
	  36.7081,
	  38.8909,
	  41.2035,
	  43.6536,
	  46.2493,
	  48.9995,
	  51.9130,
	  55,
	  58.2705,
	  61.7354,

	//
	  65.4064,
	  69.2957,
	  73.4162,
	  77.7817,
	  82.4069,
	  87.3071,
	  92.4986,
	  97.9989,
	 103.826,
	 110,
	 116.541,
	 123.471,

	//
	 130.813,
	 138.591,
	 146.832,
	 155.563,
	 164.814,
	 174.614,
	 184.997,
	 195.998,
	 207.652,
	 220,
	 233.082,
	 246.942,

	//
	 261.626,
	 277.183,
	 293.665,
	 311.127,
	 329.628,
	 349.228,
	 369.994,
	 391.995,
	 415.305,
	 440,
	 466.164,
	 493.883,

	//
	 523.251,
	 554.365,
	 587.33,
	 622.254,
	 659.255,
	 698.456,
	 739.989,
	 783.991,
	 830.609,
	 880,
	 932.328,
	 987.767,

	//
	1046.5,
	1108.73,
	1174.66,
	1244.51,
	1318.51,
	1396.91,
	1479.98,
	1567.98,
	1661.22,
	1760,
	1864.66,
	1975.53,

	//
	2093,
	2217.46,
	2349.32,
	2489.02,
	2637.02,
	2793.83,
	2959.96,
	3135.96,
	3322.44,
	3520,
	3729.31,
	3951.07,

	//
	4186.01,
] );
