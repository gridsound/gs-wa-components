"use strict";

const MIDI_CHANNEL_NOTEON = 0x90;
const MIDI_CHANNEL_NOTEOFF = 0x80;

class gswaMIDIControllersManager {
	#dawcore = null;
	#uiKeys  = null;
	#MIDIControllersInput  = new Map();
	#MIDIControllersOutput = new Map();

	$initMidiAccess( midiAccess ) {
		this.sysexEnabled = midiAccess.sysexEnabled;
		midiAccess.onstatechange = this.#onControllerStateChange.bind( this );

		this.#openAlreadyConnectedControllers( midiAccess );
	}
	$setDAWCore( core ) {
		this.#dawcore = core;
	}
	$setPianorollKeys( uiKeys ) {
		this.#uiKeys = uiKeys;
	}
	#openAlreadyConnectedControllers( midiAccess ) {
		let deviceInput;
		let deviceOutput;

		for ( let entry of midiAccess.inputs ) {
			deviceInput = entry[ 1 ];
			deviceInput.open();
		}
		for ( let entry of midiAccess.outputs ) {
			deviceOutput = entry[ 1 ];
			deviceOutput.open();
		}
	}
	#onControllerStateChange( event ) {
		if ( event.port.state === "connected" && event.port.connection === "open" ) {
			this.#addController( event.port, event.currentTarget.sysexEnabled )
		} else if ( event.port.state === "disconnected" ) {
			this.#removeDevice( event.port );
		}
	}
	#addController( port, sysexEnabled ) {
		if ( port.type === "input" && !this.#MIDIControllersInput.has( port.id )) {
			let ctrler = new gswaMIDIControllerInput( port.id, port.name, port, sysexEnabled );

			this.#MIDIControllersInput.set( port.id, ctrler );
			this.$linkToPianoroll( ctrler );
		} else if ( port.type === "output" && !this.#MIDIControllersOutput.has( port.id )) {
			let ctrler = new gswaMIDIControllerOutput( port.id, port.name, port, sysexEnabled );

			this.#MIDIControllersOutput.set( port.id, ctrler );
		}
	}
	#removeDevice( port ) {
		let MIDIControllers = port.type === "input"	? this.#MIDIControllersInput
													: this.#MIDIControllersOutput;

		MIDIControllers.delete( port.id );
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
	// ---------------- // print
	#printControllers() {
		console.log( "Inputs" );
		for ( const [ ctrlerID, ctrler ] of this.#MIDIControllersInput ) {
			console.log( "ID : ", ctrlerID );
			console.log( "Name : ", ctrler.name );
		}
		console.log( "Outputs" );
		for ( const [ ctrlerID, ctrler ] of this.#MIDIControllersOutput ) {
			console.log( "ID : ", ctrlerID );
			console.log( "Name : ", ctrler.name );
		}
	}
}
