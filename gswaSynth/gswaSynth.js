"use strict";

window.gswaSynth = function() {
	this._currId = 0;
	this._liveKeyPressed = {};
	this.data = {
		oscillators: {}
	};
};

gswaSynth.nativeTypes = [ "sine", "triangle", "sawtooth", "square" ];

gswaSynth.prototype = {
	setContext( ctx ) {
		this.stop();
		this.disconnect();
		this.ctx = ctx;
		Object.values( this.data.oscillators ).forEach( osc => {
			this._oscCreateMainNodes( osc, osc );
		} );
	},
	connect( nodeDest ) {
		this.connectedTo = nodeDest;
		Object.values( this.data.oscillators )
			.forEach( osc => osc._gain.connect( nodeDest ) );
	},
	disconnect() {
		this.connectedTo = null;
		Object.values( this.data.oscillators )
			.forEach( osc => osc._gain.disconnect() );
	},
	liveMidiKeyStart( midiKey ) {
		if ( !this._liveKeyPressed[ midiKey ] ) {
			var node, arrNodes = [];

			this._liveKeyPressed[ midiKey ] = arrNodes;
			Object.values( this.data.oscillators ).forEach( osc => {
				node = this._oscCreateNode( osc, midiKey );
				arrNodes.push( node );
				node._gainEnvNode.gain.setValueCurveAtTime( new Float32Array( [ 0, 1 ] ), 0, .012 ); // tmp
				node.start( 0 );
			} );
		}
	},
	liveMidiKeyStop( midiKey ) {
		var arrNodes = this._liveKeyPressed[ midiKey ],
			currTime = this.ctx.currentTime;

		if ( arrNodes ) {
			arrNodes.forEach( n => {
				n._gainEnvNode.gain.setValueCurveAtTime( new Float32Array( [ 1, 0 ] ), 0, .015 ); // tmp
				n.stop( currTime + .015 );
			} );
			delete this._liveKeyPressed[ midiKey ];
		}
	},
	liveKeyStopAll() {
		Object.keys( this._liveKeyPressed ).forEach( this.liveMidiKeyStop, this );
	},
	start( key, when, offset, duration ) {
		Object.values( this.data.oscillators ).forEach( osc => {
			var n = this._oscCreateNode( osc, key );

			n._when = when;
			n.start( when || 0 );
			if ( arguments.length > 3 ) {
				n._duration = duration;
				n._gainEnvNode.gain.setValueCurveAtTime( new Float32Array( [ 0, 1 ] ), when, .012 ); // tmp
				n._gainEnvNode.gain.setValueCurveAtTime( new Float32Array( [ 1, 0 ] ), when + duration - .015, .015 ); // tmp
				n.stop( when + duration );
			}
		} );
	},
	stop() {
		Object.values( this.data.oscillators ).forEach( osc => {
			Object.values( osc._nodeStack ).forEach( n => n.stop() );
		} );
	},
	change( obj ) {
		var oscs = this.data.oscillators;

		if ( obj.oscillators ) {
			Object.entries( obj.oscillators ).forEach( ( [ id, obj ] ) => {
				obj ? oscs[ id ]
					? this._oscUpdate( id, obj )
					: this._oscCreate( id, obj )
					: this._oscDelete( id );
			} );
			Object.values( this._liveKeyPressed ).forEach( keypressed => {
				keypressed.forEach( node => {
					if ( "type" in obj ) { this._nodeSetType( node, obj.type ); }
					if ( "detune" in obj ) { node.detune.value = obj.detune; }
				} );
			} );
		}
	},

	// private:
	_nodeSetType( node, type ) {
		if ( gswaSynth.nativeTypes.indexOf( type ) > -1 ) {
			node.type = type;
		} else {
			var wave = gswaPeriodicWaves[ type ];

			node.setPeriodicWave( this.ctx.createPeriodicWave( wave.real, wave.imag ) );
		}
	},
	_oscCreateNode( osc, key ) {
		var node = this.ctx.createOscillator(),
			gainEnvNode = this.ctx.createGain();

		this._nodeSetType( node, osc.type );
		node.detune.value = osc.detune;
		if ( !gswaSynth.midiKeyToHz[ key ] ) {
			lg(key, gswaSynth.midiKeyToHz[ key ])
		}
		node.frequency.value = gswaSynth.midiKeyToHz[ key ];
		node.onended = this._oscDeleteNode.bind( this, osc, this._currId );
		gainEnvNode.gain.value = 0;
		node.connect( gainEnvNode );
		gainEnvNode.connect( osc._pan );
		node._gainEnvNode = gainEnvNode;
		node._key = key;
		osc._nodeStack[ this._currId ] = node;
		++this._currId;
		++osc._nodeStackLength;
		return node;
	},
	_oscDeleteNode( osc, id ) {
		delete osc._nodeStack[ id ];
		--osc._nodeStackLength;
	},
	_oscCreate( id, obj ) {
		var newNode,
			oscs = this.data.oscillators,
			oscFirst = Object.values( oscs )[ 0 ],
			osc = Object.assign( {
				_nodeStack: {},
				_nodeStackLength: 0
			}, obj );

		this._oscCreateMainNodes( osc, obj );
		osc._gain.connect( this.connectedTo );
		oscs[ id ] = osc;
		if ( oscFirst && oscFirst._nodeStackLength > 0 ) {
			Object.values( oscFirst._nodeStack ).forEach( node => {
				newNode = this._oscCreateNode( osc, node._key );
				newNode._when = node._when;
				newNode.start( node._when );
				if ( typeof node._duration === "number" ) {
					newNode._duration = node._duration;
					newNode.stop( node._when + node._duration );
				} else {
					this._liveKeyPressed[ node._key ].push( newNode );
				}
			} );
		}
	},
	_oscUpdate( id, obj ) {
		var osc = this.data.oscillators[ id ];

		Object.assign( osc, obj );
		if ( "gain" in obj ) { osc._gain.gain.value = obj.gain; }
		if ( "pan" in obj ) { osc._pan.pan.value = obj.pan; }
		Object.values( osc._nodeStack ).forEach( node => {
			if ( "type" in obj ) { this._nodeSetType( node, obj.type ); }
			if ( "detune" in obj ) { node.detune.value = obj.detune; }
		} );
	},
	_oscDelete( id ) {
		var oscs = this.data.oscillators;

		Object.values( oscs[ id ]._nodeStack ).forEach( node => {
			node.stop();
		} );
		delete oscs[ id ];
	},
	_oscCreateMainNodes( osc, obj ) {
		osc._gain = this.ctx.createGain();
		osc._pan = this.ctx.createStereoPanner();
		osc._pan.pan.value = obj.pan;
		osc._gain.gain.value = obj.gain;
		osc._pan.connect( osc._gain );
	}
};

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
