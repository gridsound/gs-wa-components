"use strict";

class gswaMIDIControllerInput {
	constructor( portID, name, input, sysexEnabled ) {
		this.portID = portID;
		this.name = name;
		this.input = input;
		this.sysexEnabled = sysexEnabled;
		this.input.onmidimessage = this.#midiEvents.bind( this );
		this.listeners = {
			onNoteOn: [],
			onNoteOff: [],
		};
	}

	$getInput() {
		return this.input;
	}
	$onNoteOnAdd( cb ) {
		this.listeners.onNoteOn.push( cb );
	}
	$onNoteOffAdd( cb ) {
		this.listeners.onNoteOff.push( cb );
	}
	#midiEvents( e ) {
		if ( !this.sysexEnabled && e.data.length !== 3 ) {
			console.log( "GSLog : Invalid midi event" );
		} else if ( this.#isNoteOn( e.data[ 0 ], e.data[ 2 ] ) ) {
			this.listeners.onNoteOn.forEach( cb => cb( e.data ) );
		} else if ( this.#isNoteOff( e.data[ 0 ], e.data[ 2 ] ) ) {
			this.listeners.onNoteOff.forEach( cb => cb( e.data ) );
		}
	}
	#isNoteOn( channel, velocity ) {
		return ( channel === MIDI_CHANNEL_NOTEON && velocity !== 0 );
	}
	#isNoteOff( channel, velocity ) {
		return ( channel === MIDI_CHANNEL_NOTEOFF || velocity === 0 );
	}
}
