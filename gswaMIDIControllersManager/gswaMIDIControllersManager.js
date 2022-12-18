"use strict";

class gswaMIDIControllersManager {
	constructor( midiAccess ) {
		this.sysexEnabled = midiAccess.sysexEnabled;
		this.MIDIDevices = new Map();

		this.detectDevices( midiAccess );
		this.printDetectedDevices(); // debug purpose
	}
	detectDevices( midiAccess ) {
		let deviceInput = null;
		let deviceOutput = null;
		let availableMIDIDevices = new Map();

		for ( let entry of midiAccess.inputs ) {
			deviceInput = entry[ 1 ];

			if ( deviceInput != null ) {
				availableMIDIDevices.set( deviceInput.name, { input:deviceInput, output:null } );
			}
		}
		for ( let entry of midiAccess.outputs ) {
			deviceOutput = entry[ 1 ];

			if ( deviceOutput != null ) {
				let device = availableMIDIDevices.get( deviceOutput.name );
				if ( device != null ) {
					device.output = deviceOutput;
				}
			}
		}
		availableMIDIDevices.forEach(( value, key ) => {
			if ( value.input && value.output ) {
				this.MIDIDevices.set( key, value ); // create and insert gswaMIDIController here
				console.log( "GSLogs: MIDI device '" + key + "' created" );
			}
		});
	}

	// Debug purpose
	printDetectedDevices() {
		var nbDevices = this.MIDIDevices.size;

		if ( nbDevices == 0 ) {
			console.log( "GSLogs: No devices detected." );
			return;
		}
		console.log( "GSLogs: %d device%s detected:", nbDevices, ( nbDevices > 1 ? "s" : "" ))
		this.MIDIDevices.forEach(( value, key ) => {
			console.log( "GSLogs: - Device name: '%s'", key );
		});
	}
}
