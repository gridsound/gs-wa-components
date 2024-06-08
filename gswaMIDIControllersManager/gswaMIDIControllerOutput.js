"use strict";

class gswaMIDIControllerOutput {
	#port = null;
	#sysex = false;

	constructor( output, sysex ) {
		this.#port = output;
		this.#sysex = sysex;
	}

	#send( bytes ) {
		this.#port.send( bytes );
	}
	#sendToTarget( bytes, targetOutput ) {
		targetOutput.send( bytes );
	}
}
