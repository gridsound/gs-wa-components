"use strict";

class gswaOsc {
	static #path = "gswaOscProc.js";
	#node = null;
	#ready = false;
	$pan = null;
	$gain = null;
	$phase = null;
	$detune = null;
	$unisonvoices = null;
	$unisondetune = null;
	$unisonblend = null;
	$envGnAtt = null;
	$envGnHld = null;
	$envGnDec = null;
	$envGnSus = null;
	$envGnRel = null;
	$envDtAtt = null;
	$envDtHld = null;
	$envDtDec = null;
	$envDtSus = null;
	$envDtRel = null;
	$envDtAmp = null;

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

		node.port.onmessage = this.#onmsg.bind( this );
		this.#node = node;
		this.$pan = params.get( "pan" );
		this.$gain = params.get( "gain" );
		this.$phase = params.get( "phase" );
		this.$detune = params.get( "detune" );
		this.$unisonvoices = params.get( "unisonvoices" );
		this.$unisondetune = params.get( "unisondetune" );
		this.$unisonblend = params.get( "unisonblend" );
		this.$envGnAtt = params.get( "envGnAtt" );
		this.$envGnHld = params.get( "envGnHld" );
		this.$envGnDec = params.get( "envGnDec" );
		this.$envGnSus = params.get( "envGnSus" );
		this.$envGnRel = params.get( "envGnRel" );
		this.$envDtAtt = params.get( "envDtAtt" );
		this.$envDtHld = params.get( "envDtHld" );
		this.$envDtDec = params.get( "envDtDec" );
		this.$envDtSus = params.get( "envDtSus" );
		this.$envDtRel = params.get( "envDtRel" );
		this.$envDtAmp = params.get( "envDtAmp" );
	}
	#onmsg( e ) {
		const [ type ] = e.data;

		switch ( type ) {
			case "ready": this.#ready = true; break;
		}
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
