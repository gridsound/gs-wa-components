"use strict";

class gswaMIDIToKeys {
	static $convert( obj ) {
		if ( obj ) {
			const tracks = obj.tracks.filter( tr => tr.events.some( ev => ev.type !== 255 ) );
			const track0 = tracks[ 0 ];

			if ( track0 ) {
				const [ keys, dur, name ] = gswaMIDIToKeys.#convert( track0.events, obj.timeDivision );

				return {
					patterns: {
						0: { name, keys: 0, duration: dur },
					},
					keys: {
						0: keys,
					},
				};
			}
		}
	}
	static #convert( ev, timeDiv ) {
		const keys = {};
		let keyId = 0;
		let dTime = 0;
		let name = "";

		ev.forEach( e => {
			dTime += e.deltaTime;
			switch ( e.type ) {
				case 255:
					if ( e.metaType === 3 ) {
						name = e.data.trim();
					}
					break;
				case 9:
					keys[ keyId ] = {
						key: e.data[ 0 ] - 12,
						gain: GSUmathFix( e.data[ 1 ] / 127, 2 ),
						when: dTime,
					};
					++keyId;
					break;
				case 8: {
					const kkey = e.data[ 0 ] - 12;
					const key = Object.values( keys ).find( k => k.key === kkey && k.duration === undefined );

					key.duration = GSUmathFix( ( dTime - key.when ) / timeDiv, 2 );
					key.when = GSUmathFix( key.when / timeDiv, 2 );
				} break;
			}
		} );
		return [ keys, GSUmathFix( dTime / timeDiv, 2 ), name ];
	}
}
