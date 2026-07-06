"use strict";

class gswaOsc {
	static #path = "gswaOscProc.js";
	#node = null;
	#ready = false;
	pan = null;
	gain = null;
	phase = null;
	detune = null;

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
		this.#node.port.onmessage = this.#onmsg.bind( this );
	}
	#onmsg( e ) {
		switch ( e.data.type ) {
			case "ready": this.#ready = true; break;
		}
	}

	// .........................................................................
	$oscConnect( ...args ) {
		return this.#node.connect( ...args );
	}
	$oscDisconnect( ...args ) {
		return this.#node.disconnect( ...args );
	}
	$oscKill( when ) {
		this.#node.port.postMessage( { type: "kill" } );
	}
	$oscWavetable( wt ) {
		this.#ready = false;
		this.#node.port.postMessage( { type: "wavetable", buffer: wt } );
	}
	$oscPushNote( id, obj ) {
		this.#node.port.postMessage( { type: "push", id, ...obj } );
	}
}
