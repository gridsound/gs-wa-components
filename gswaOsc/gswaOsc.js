"use strict";

class gswaOsc {
	static #path = "gswaOscProc.js";
	#node = null;
	#ready = false;
	pan = null;
	gain = null;
	phase = null;
	detune = null;
	unisonvoices = null;
	unisondetune = null;
	unisonblend = null;

	static $oscLoadModule( ctx ) {
		return ctx.audioWorklet.addModule( gswaOsc.#path );
	}

	// .........................................................................
	constructor( ctx ) {
		this.#node = new AudioWorkletNode( ctx, "gswaOscProc", {
			numberOfInputs: 0,
			numberOfOutputs: 1,
			outputChannelCount: [ 2 ],
			processorOptions: { renderQuantumSize: 2048 },
		} );
		this.pan = this.#node.parameters.get( "pan" );
		this.gain = this.#node.parameters.get( "gain" );
		this.phase = this.#node.parameters.get( "phase" );
		this.detune = this.#node.parameters.get( "detune" );
		this.unisonvoices = this.#node.parameters.get( "unisonvoices" );
		this.unisondetune = this.#node.parameters.get( "unisondetune" );
		this.unisonblend = this.#node.parameters.get( "unisonblend" );
		this.#node.port.onmessage = this.#onmsg.bind( this );
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
	$oscWavetable( wt ) {
		this.#ready = false;
		this.#node.port.postMessage( [ "wavetable", wt ] );
	}
	$oscPushNote( id, obj ) {
		this.#node.port.postMessage( [ "push", id, obj ] );
	}
}
