"use strict";

class gswaMIDIControllerInput {
	constructor( portID, name, input, sysexEnabled ) {
		this.portID = portID;
		this.name   = name;
		this.input  = input;
		this.sysexEnabled = sysexEnabled;
		this.input.onmidimessage = this.#midiEvents.bind( this );
		this.listeners = {
			onNoteOn: [],
			onNoteOff: []
		};
	}
	$getInput() {
		return this.input;
	}
	$onNoteOnAdd( callback ) {
		this.listeners.onNoteOn.push( callback );
	}
	$onNoteOffAdd( callback ) {
		this.listeners.onNoteOff.push( callback );
	}
	#midiEvents( event ) {
		if ( !this.sysexEnabled && event.data.length !== 3 ) {
			console.log( 'GSLog : Invalid midi event');
		} else if ( this.#isNoteOn( event.data[0], event.data[2] )) {
			this.listeners.onNoteOn.forEach( callback => callback( event.data ));
		} else if ( this.#isNoteOff( event.data[0], event.data[2] )) {
			this.listeners.onNoteOff.forEach( callback => callback( event.data ));
		}
	}
	#isNoteOn( channel, velocity ) {
		return ( channel === MIDI_CHANNEL_NOTEON && velocity !== 0 );
	}
	#isNoteOff( channel, velocity ) {
		return ( channel === MIDI_CHANNEL_NOTEOFF || velocity === 0);
	}
}
