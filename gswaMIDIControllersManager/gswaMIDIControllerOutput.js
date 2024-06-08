"use strict";

class gswaMIDIControllerOutput {
	constructor( portID, name, output, sysexEnabled ) {
		this.portID = portID;
		this.name = name;
		this.output = output;
		this.sysexEnabled = sysexEnabled;
	}

	$getOutput() {
		return this.output;
	}
	#send( bytes ) {
		this.output.send( bytes );
	}
	#sendToTarget( bytes, targetOutput ) {
		targetOutput.send( bytes );
	}
}
