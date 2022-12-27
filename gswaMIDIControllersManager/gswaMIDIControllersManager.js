"use strict";

const MIDI_CHANNEL_NOTEON = 0x90;
const MIDI_CHANNEL_NOTEOFF = 0x80;

class gswaMIDIControllersManager {
	#dawcore = null;
	#uiKeys  = null;

	constructor( midiAccess ) {
		this.sysexEnabled = midiAccess.sysexEnabled;
		this.MIDIControllers = new Map();

		this.$detectDevices( midiAccess );
	}
	$setDAWCore( core ) {
		this.#dawcore = core;
	}
	$setPianorollKeys( uiKeys ) {
		this.#uiKeys = uiKeys;
	}
	$detectDevices( midiAccess ) {
		let deviceInput = null;
		let deviceOutput = null;
		let availableMIDIControllers = new Map();

		for ( let entry of midiAccess.inputs ) {
			deviceInput = entry[ 1 ];

			if ( deviceInput != null ) {
				availableMIDIControllers.set( deviceInput.name, { input:deviceInput, output:null } );
			}
		}
		for ( let entry of midiAccess.outputs ) {
			deviceOutput = entry[ 1 ];

			if ( deviceOutput != null ) {
				let device = availableMIDIControllers.get( deviceOutput.name );
				if ( device != null ) {
					device.output = deviceOutput;
				}
			}
		}
		availableMIDIControllers.forEach(( value, key ) => {
			if ( value.input && value.output ) {
				let ctrl = new gswaMIDIController( key, value.input, value.output, this.sysexEnabled );
				this.MIDIControllers.set( key, ctrl );
				this.$linkToPianoroll( ctrl );
			}
		});
	}
	#onControllerStateChange( event ) {
		if ( event.port.state == "connected" && !this.MIDIControllers.has( event.port.id )) {
			this.#addDevice( event.port, event.srcElement, event.currentTarget.sysexEnabled )
		} else if ( event.port.state == "disconnected" ) {
			this.#removeDevice( event.port );
		}
	}
	#addDevice( port, srcElement, sysexEnabled ) {
		console.log("addDevice");
		for ( let entry of srcElement.inputs ) {
			console.log("entry[ 1 ]");
			console.log(entry[ 1 ]);
		}
		let ctrler = new gswaMIDIController( port.name, srcElement.inputs[1], srcElement.outputs[1], sysexEnabled );

		this.MIDIControllers.set( port.id, ctrler );
		this.linkToPianoroll( ctrl );
	}
	#removeDevice( port ) {
		console.log("removeDevice");
		this.MIDIControllers.delete( port.id );
	}
	// ----------------- // Linkable functions
	// These functions are used to associate controllers buttons, keys, etc to actions or instruments
	$linkToPianoroll( MIDIController ) {
		MIDIController.$onNoteOnAdd( this.#pianorollLiveKeyPressed.bind( this ));
		MIDIController.$onNoteOffAdd( this.#pianoRollLiveKeyReleased.bind( this ));
	}
	$unlinkFromPianoroll( MIDIController ) {
		MIDIController.$onNoteOnRemove( this.#pianorollLiveKeyPressed.bind( this ));
		MIDIController.$onNoteOffRemove( this.#pianoRollLiveKeyReleased.bind( this ));
	}

	// ---------------- // Action functions
	#pianoRollLiveKeyReleased( MIDIControllerData ) {
		this.#uiKeys.midiKeyUp( MIDIControllerData[1] );
	}
	#pianorollLiveKeyPressed( MIDIControllerData ) {
		this.#uiKeys.midiKeyDown( MIDIControllerData[1] );
	}
}
