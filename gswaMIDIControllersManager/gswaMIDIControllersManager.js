"use strict";

const MIDI_CHANNEL_NOTEON = 0x90;
const MIDI_CHANNEL_NOTEOFF = 0x80;

class gswaMIDIControllersManager {
	#uiKeys = null;
	#midiAccess = null;
	#midiCtrlInputs = new Map();
	#midiCtrlOutputs = new Map();

	$init() {
		return navigator.requestMIDIAccess( { sysex: true } ).then( this.#oninit.bind( this ) );
	}

	// .........................................................................
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
	#pianoRollLiveKeyReleased( midiCtrlData ) {
		this.#uiKeys?.$midiKeyUp( midiCtrlData[ 1 ] );
	}
	#pianorollLiveKeyPressed( midiCtrlData ) {
		this.#uiKeys?.$midiKeyDown( midiCtrlData[ 1 ] );
	}

	// .........................................................................
	#oninit( midiAcc ) {
		this.#midiAccess = midiAcc;
		midiAcc.onstatechange = this.#onstatechange.bind( this );
		midiAcc.inputs.forEach( i => i.open() );
		midiAcc.outputs.forEach( o => o.open() );
	}
	#onstatechange( e ) {
		switch ( e.port.state ) {
			case "connected":
				if ( e.port.connection === "open" ) {
					this.#addDevice( e.port, e.currentTarget.sysexEnabled );
				}
				break;
			case "disconnected":
				( e.port.type === "input"
					? this.#midiCtrlInputs
					: this.#midiCtrlOutputs ).delete( e.port.id );
				break;
		}
	}
	#addDevice( port, sysexEnabled ) {
		switch ( port.type ) {
			case "input":
				if ( !this.#midiCtrlInputs.has( port.id ) ) {
					const ctrl = new gswaMIDIControllerInput( port.id, port.name, port, sysexEnabled );

					this.#midiCtrlInputs.set( port.id, ctrl );
					this.$linkToPianoroll( ctrl );
				}
				break;
			case "output":
				if ( !this.#midiCtrlOutputs.has( port.id ) ) {
					this.#midiCtrlOutputs.set( port.id, new gswaMIDIControllerOutput( port.id, port.name, port, sysexEnabled ) );
				}
				break;
		}
	}
}
