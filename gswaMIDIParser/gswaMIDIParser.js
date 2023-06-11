"use strict";

class gswaMIDIParser {
	static #ptr = 0;
	static #dview = null;

	static $parse( arr ) {
		gswaMIDIParser.#ptr = 0;
		gswaMIDIParser.#dview = new DataView( arr.buffer, arr.byteOffset, arr.byteLength );
		if ( gswaMIDIParser.#rdInt4() !== 0x4D546864 ) {
			console.error( "gswaMIDIParser: Bad header, should start with 'MThd'" );
		} else {
			gswaMIDIParser.#ptr += 4; // skip header size
			return gswaMIDIParser.#parseTracks( gswaMIDIParser.#createMIDIObj() );
		}
	}
	static #createMIDIObj() {
		return Object.seal( {
			formatType: gswaMIDIParser.#rdInt2(),
			nbTracks: gswaMIDIParser.#rdInt2(),
			timeDivision: gswaMIDIParser.#rdTimedivision(),
			tracks: [],
		} );
	}
	static #rdTimedivision() {
		const a = gswaMIDIParser.#rdInt1();
		const b = gswaMIDIParser.#rdInt1();

		if ( a < 128 ) {
			return a * 256 + b; // ticks per beat mode
		} else {
			return [
				a - 128, // frames per second mode
				b, // ticks in each frame
			];
		}
	}

	// .........................................................................
	static #parseTracks( MIDI ) {
		for( let t = 0; t < MIDI.nbTracks; ++t ) {
			const events = [];
			const ret = gswaMIDIParser.#parseTrackEvents( events );

			if ( ret === false ) {
				break;
			} else {
				MIDI.tracks.push( { events } );
			}
		}
		return MIDI;
	}
	static #parseTrackEvents( events ) {
		const headerValidation = gswaMIDIParser.#rdInt4();
		let prevType;

		if ( headerValidation === -1 || headerValidation !== 0x4D54726B ) {
			return false; // EOF
		}
		gswaMIDIParser.#rdInt4(); // skip chunk size
		for ( ;; ) {
			const ev = { deltaTime: gswaMIDIParser.#rdIntN() };
			let type = gswaMIDIParser.#rdInt1(); // Event's type

			events.push( ev );
			if ( type >= 128 ) {
				prevType = type; // New type detected
			} else {
				type = prevType; // Use previous type
				--gswaMIDIParser.#ptr; // Move back the ptr (to undo the last read)
			}

			const ret = type === 0xFF
				? gswaMIDIParser.#parseTrackEventMeta( ev )
				: gswaMIDIParser.#parseTrackEvent( ev, type );

			if ( ret === false ) {
				break;
			}
		}
	}
	static #parseTrackEvent( event, statusByte ) {
		event.type = statusByte >> 4;
		event.channel = statusByte & 0xf;
		switch ( event.type ) {
			case 0xa: // Note aftertouch
			case 0xb: // Controller
			case 0xe: // Pitch bend event
			case 0x8: // Note off
			case 0x9: // Note on
				event.data = [
					gswaMIDIParser.#rdInt1(),
					gswaMIDIParser.#rdInt1(),
				];
				break;
			case 0xd: // Program change
			case 0xd: // Channel aftertouch
				event.data = gswaMIDIParser.#rdInt1();
				break;
			case 0xf: // Exclusive events
				console.error( "Unsupported event type '0xF'" );
				break;
		}
	}
	static #parseTrackEventMeta( ev ) {
		const metaType = gswaMIDIParser.#rdInt1();
		const metaEventLength = gswaMIDIParser.#rdIntN();

		ev.type = 0xff;
		ev.metaType = metaType;
		switch ( ev.metaType ) {
			default:
				console.error( "gswaMIDIParser: unsupported meta event", ev );
				return;
			case 0x2f: // End of track
				return false;
			case 0x01: // Text event
			case 0x02: // Copyright notice
			case 0x03: // Sequence/track name
			case 0x04: // Instrument name
			case 0x05: // Lyrics
			case 0x07: // Cue point
			case 0x06: // Marker
				ev.data = gswaMIDIParser.#rdStr( metaEventLength );
				return;
			case 0x20: // Channel prefix
			case 0x21: // Midi port
				ev.data = gswaMIDIParser.#rdInt1();
				return;
			case 0x51: // Tempo
				ev.data = gswaMIDIParser.#rdInt3();
				return;
			case 0x54: // SMPTE offset
				ev.data = [
					gswaMIDIParser.#rdInt1(),
					gswaMIDIParser.#rdInt1(),
					gswaMIDIParser.#rdInt1(),
					gswaMIDIParser.#rdInt1(),
					gswaMIDIParser.#rdInt1(),
				];
				return;
			case 0x58: // Time signature
				ev.data = [
					gswaMIDIParser.#rdInt1(),
					gswaMIDIParser.#rdInt1(),
					gswaMIDIParser.#rdInt1(),
					gswaMIDIParser.#rdInt1(),
				];
				return;
			case 0x59: // Key signature
				ev.data = gswaMIDIParser.#rdInt2();
				return;
		}
	}

	// .........................................................................
	static #rdStr( n ) {
		let text = "";

		for ( let c = 0; c < n; ++c ) {
			text += String.fromCharCode( gswaMIDIParser.#rdInt1() );
		}
		return text;
	}
	static #rdInt4() {
		const i = gswaMIDIParser.#dview.getUint32( gswaMIDIParser.#ptr );

		gswaMIDIParser.#ptr += 4;
		return i;
	}
	static #rdInt3() {
		return ( gswaMIDIParser.#rdInt2() << 16 ) + gswaMIDIParser.#rdInt1();
	}
	static #rdInt2() {
		const i = gswaMIDIParser.#dview.getUint16( gswaMIDIParser.#ptr );

		gswaMIDIParser.#ptr += 2;
		return i;
	}
	static #rdInt1() {
		const i = gswaMIDIParser.#dview.getUint8( gswaMIDIParser.#ptr );

		++gswaMIDIParser.#ptr;
		return i;
	}
	static #rdIntN() {
		let val = 0;

		for ( let i = 0; i < 4; ++i ) {
			const n = gswaMIDIParser.#rdInt1();

			if ( n >= 128 ) {
				val += n - 128;
				val <<= 7;
			} else {
				val += n;
				break;
			}
		}
		return val;
	}
}
