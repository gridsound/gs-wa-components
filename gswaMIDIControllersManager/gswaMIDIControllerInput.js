"use strict";

class gswaMIDIControllerInput {
	#sysex = false;
	#onNoteOn = null;
	#onNoteOff = null;

	constructor( input, sysex, on ) {
		this.#sysex = sysex;
		this.#onNoteOn = on.$onNoteOn;
		this.#onNoteOff = on.$onNoteOff;
		input.onmidimessage = this.#onmidimessage.bind( this );
	}

	#onmidimessage( e ) {
		if ( !this.#sysex && e.data.length !== 3 ) {
			console.warn( "gswaMIDIInput: Unrecognized midi message", e );
		} else {
			const [ msg, key, vel ] = e.data;

			switch ( msg ) {
				case 0x90: this.#onNoteOn( key ); break;
				case 0x80: this.#onNoteOff( key ); break;
			}
		}
	}
}
