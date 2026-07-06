"use strict";

class gswaOscillator {
	static #path = "gswaOscillatorProc.js";
	#node = null;
	// #ready = false;
	frequency = null;
	detune = null;
	phase = null;
	wtpos = null;

	static $loadModule( ctx ) {
		return ctx.audioWorklet.addModule( gswaOscillator.#path );
	}

	// .........................................................................
	$init( ctx ) {
		this.#node = new AudioWorkletNode( ctx, "gswaOscillatorProc", {
			numberOfInputs: 0,
			numberOfOutputs: 1,
			outputChannelCount: [ 1 ],
			processorOptions: { renderQuantumSize: 2048 },
		} );
		this.frequency = this.#node.parameters.get( "frequency" );
		this.detune = this.#node.parameters.get( "detune" );
		this.phase = this.#node.parameters.get( "phase" );
		this.wtpos = this.#node.parameters.get( "wtpos" );
		this.#node.port.onmessage = this.#onmsg.bind( this );
		return this;
	}
	#onmsg( e ) {
		switch ( e.data.type ) {
			// case "ready": this.#ready = true; break;
			// case "ended": this.#ready = false; break;
			case "debug": console.log( ...e.data.data ); break;
		}
	}

	// .........................................................................
	$connect( ...args ) {
		return this.#node.connect( ...args );
	}
	$disconnect( ...args ) {
		return this.#node.disconnect( ...args );
	}
	$start( when ) {
		this.#node.port.postMessage( { type: "start", when: when ?? this.#node.context.currentTime } );
	}
	$stop( when ) {
		this.#node.port.postMessage( { type: "stop", when: when ?? this.#node.context.currentTime } );
	}
	$reset() {
		this.#node.port.postMessage( { type: "reset" } );
	}
	$setWavetable( wt ) {
		// this.#ready = false;
		this.#node.port.postMessage( { type: "wavetable", buffer: wt } );
	}
}
