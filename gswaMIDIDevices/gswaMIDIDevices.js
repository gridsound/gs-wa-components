"use strict";

class gswaMIDIDevices {
	#uiKeys = null;
	#midiCtrlInputs = new Map();
	#midiCtrlOutputs = new Map();

	$init() {
		navigator.requestMIDIAccess?.( { sysex: true } ).then( this.#oninit.bind( this ) );
	}

	// .........................................................................
	$setPianorollKeys( uiKeys ) {
		this.#uiKeys = uiKeys;
	}

	// .........................................................................
	#oninit( midiAcc ) {
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
					this.#midiCtrlInputs.set( port.id, new gswaMIDIInput( port, sysexEnabled, {
						$onNoteOn: ( key, vel ) => this.#uiKeys?.$midiKeyDown( key, vel ),
						$onNoteOff: key => this.#uiKeys?.$midiKeyUp( key ),
					} ) );
				}
				break;
			case "output":
				if ( !this.#midiCtrlOutputs.has( port.id ) ) {
					this.#midiCtrlOutputs.set( port.id, new gswaMIDIOutput( port, sysexEnabled ) );
				}
				break;
		}
	}
}
