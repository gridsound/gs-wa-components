"use strict";

class gswaOsc {
	static #path = "gswaOscProc.js";
	static $lfoWaveToIndex = GSUdeepFreeze( {
		sine: 0,
		triangle: 1,
		sawtooth: 2,
		square: 3,
	} );
	#node = null;
	#ready = false;
	$pan = null;
	$gain = null;
	$phase = null;
	$detune = null;
	$envs = {
		$gain: [],
		$detune: [],
		$lowpass: [],
		$wtpos: [],
	};
	$lfos = {
		$pan: [],
		$gain: [],
		$detune: [],
		$lowpass: [],
		$wtpos: [],
	};
	// uni
	$unisonvoices = null;
	$unisondetune = null;
	$unisonblend = null;

	static $oscLoadModule( ctx ) {
		return ctx.audioWorklet.addModule( gswaOsc.#path );
	}

	// .........................................................................
	constructor( ctx ) {
		const node = new AudioWorkletNode( ctx, "gswaOscProc", {
			numberOfInputs: 0,
			numberOfOutputs: 1,
			outputChannelCount: [ 2 ],
			processorOptions: { renderQuantumSize: 2048 },
		} );
		const params = node.parameters;
		const envs = this.$envs;
		const lfos = this.$lfos;

		node.port.onmessage = this.#onmsg.bind( this );
		this.#node = node;
		this.$pan = params.get( "pan" );
		this.$gain = params.get( "gain" );
		this.$phase = params.get( "phase" );
		this.$detune = params.get( "detune" );
		this.$unisonvoices = params.get( "unisonvoices" );
		this.$unisondetune = params.get( "unisondetune" );
		this.$unisonblend = params.get( "unisonblend" );
		gswaOsc.#initEnvParams( envs.$gain, params, "envGn" );
		gswaOsc.#initEnvParams( envs.$detune, params, "envDt" );
		gswaOsc.#initEnvParams( envs.$lowpass, params, "envLp" );
		gswaOsc.#initEnvParams( envs.$wtpos, params, "envWt" );
		envs.$detune.push( params.get( "envDtAmp" ) );
		envs.$lowpass.push( params.get( "envLpQ" ) );
		gswaOsc.#initLfoParams( lfos.$pan, params, "lfoPn" );
		gswaOsc.#initLfoParams( lfos.$gain, params, "lfoGn" );
		gswaOsc.#initLfoParams( lfos.$detune, params, "lfoDt" );
		gswaOsc.#initLfoParams( lfos.$lowpass, params, "lfoLp" );
		gswaOsc.#initLfoParams( lfos.$wtpos, params, "lfoWt" );
		GSUdeepFreeze( envs );
		GSUdeepFreeze( lfos );
	}
	#onmsg( e ) {
		const [ type ] = e.data;

		switch ( type ) {
			case "ready": this.#ready = true; break;
		}
	}
	static #initEnvParams( arr, params, prefix ) {
		arr.push(
			params.get( `${ prefix }Att` ),
			params.get( `${ prefix }Hld` ),
			params.get( `${ prefix }Dec` ),
			params.get( `${ prefix }Sus` ),
			params.get( `${ prefix }Rel` ),
		);
	}
	static #initLfoParams( arr, params, prefix ) {
		arr.push(
			params.get( `${ prefix }Wav` ),
			params.get( `${ prefix }Del` ),
			params.get( `${ prefix }Att` ),
			params.get( `${ prefix }Frq` ),
			params.get( `${ prefix }Amp` ),
		);
	}

	// .........................................................................
	$oscIsReady() {
		return this.#ready;
	}
	$oscConnect( ...args ) {
		return this.#node.connect( ...args );
	}
	$oscDisconnect( ...args ) {
		return this.#node.disconnect( ...args );
	}
	$oscClear() {
		this.#node.port.postMessage( [ "clear" ] );
	}
	$oscKill() {
		this.#node.port.postMessage( [ "kill" ] );
	}
	$oscSource( type, a1, a2 ) {
		this.#ready = false;
		this.#node.port.postMessage( [ "source", type, a1, a2 ] );
	}
	$oscPushNote( id, obj, whn, off, dur ) {
		const kA = obj.keys[ 0 ];
		const kZ = obj.keys.at( -1 );
		const w = whn ?? kA?.when;
		const o = off ?? 0;
		const d = dur ?? ( !kZ ? 0 : Math.max( 0, kZ.when + kZ.duration - kA.when - o ) );

		this.#node.port.postMessage( [ "push", id, obj, w, o, d ] );
	}
	$oscPopNote( id ) {
		this.#node.port.postMessage( [ "pop", id ] );
	}
}
