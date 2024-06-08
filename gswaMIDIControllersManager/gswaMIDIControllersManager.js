"use strict";

const MIDI_CHANNEL_NOTEON = 0x90;
const MIDI_CHANNEL_NOTEOFF = 0x80;

class gswaMIDIControllersManager {
	#uiKeys = null;
	#midiCtrlInputs = new Map();
	#midiCtrlOutputs = new Map();

	$initMidiAccess( midiAccess ) {
		this.sysexEnabled = midiAccess.sysexEnabled;
		midiAccess.onstatechange = this.#onControllerStateChange.bind( this );
		this.#openAlreadyConnectedControllers( midiAccess );
	}
	$setPianorollKeys( uiKeys ) {
		this.#uiKeys = uiKeys;
	}
	$linkToPianoroll( midiCtrl ) {
		midiCtrl.$onNoteOnAdd( this.#pianorollLiveKeyPressed.bind( this ) );
		midiCtrl.$onNoteOffAdd( this.#pianoRollLiveKeyReleased.bind( this ) );
	}
	$unlinkFromPianoroll( midiCtrl ) {
		midiCtrl.$onNoteOnRemove( this.#pianorollLiveKeyPressed.bind( this ) );
		midiCtrl.$onNoteOffRemove( this.#pianoRollLiveKeyReleased.bind( this ) );
	}

	// .........................................................................
	#openAlreadyConnectedControllers( midiAccess ) {
		for ( const entry of midiAccess.inputs ) {
			entry[ 1 ].open();
		}
		for ( const entry of midiAccess.outputs ) {
			entry[ 1 ].open();
		}
	}
	#onControllerStateChange( e ) {
		if ( e.port.state === "connected" && e.port.connection === "open" ) {
			this.#addController( e.port, e.currentTarget.sysexEnabled )
		} else if ( e.port.state === "disconnected" ) {
			this.#removeDevice( e.port );
		}
	}
	#addController( port, sysexEnabled ) {
		if ( port.type === "input" && !this.#midiCtrlInputs.has( port.id ) ) {
			const ctrler = new gswaMIDIControllerInput( port.id, port.name, port, sysexEnabled );

			this.#midiCtrlInputs.set( port.id, ctrler );
			this.$linkToPianoroll( ctrler );
		} else if ( port.type === "output" && !this.#midiCtrlOutputs.has( port.id ) ) {
			const ctrler = new gswaMIDIControllerOutput( port.id, port.name, port, sysexEnabled );

			this.#midiCtrlOutputs.set( port.id, ctrler );
		}
	}
	#removeDevice( port ) {
		( port.type === "input"
			? this.#midiCtrlInputs
			: this.#midiCtrlOutputs ).delete( port.id );
	}
	#pianoRollLiveKeyReleased( midiCtrlData ) {
		this.#uiKeys?.$midiKeyUp( midiCtrlData[ 1 ] );
	}
	#pianorollLiveKeyPressed( midiCtrlData ) {
		this.#uiKeys?.$midiKeyDown( midiCtrlData[ 1 ] );
	}
	#printControllers() {
		for ( const [ id, ctrl ] of this.#midiCtrlInputs ) {
			console.log( `input: id[${ id }] name[${ ctrl.name }]` );
		}
		for ( const [ id, ctrl ] of this.#midiCtrlOutputs ) {
			console.log( `output: id[${ id }] name[${ ctrl.name }]` );
		}
	}
}
