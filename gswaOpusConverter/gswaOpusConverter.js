"use strict";

class gswaOpusConverter {
	$onprogress = GSUnoop;
	#worker = null;
	#resolve = null;
	#reject = null;
	#blob = null;
	#blobName = "";

	constructor( path ) {
		this.#worker = new Worker( path );
		this.#worker.onmessage = this.#onmessage.bind( this );
	}

	// .........................................................................
	$isConverting() {
		return !!this.#resolve;
	}
	$destroy() {
		this.#worker.terminate();
		this.#reject?.();
	}
	$convert( obj, name ) {
		return new Promise( ( res, rej ) => {
			if ( !obj || this.#resolve ) {
				rej();
			} else {
				this.#reject = rej;
				this.#resolve = res;
				if ( obj instanceof File ) {
					const rdr = new FileReader();

					rdr.addEventListener( "loadend", () => this.#convert( rdr.result, name ) );
					rdr.readAsArrayBuffer( obj );
				} else {
					this.#convert( obj, name );
				}
			}
		} );
	}

	// .........................................................................
	#newName( name ) {
		const name2 = name || "untitled";
		const lastDot = name2.lastIndexOf( "." );

		return `${ lastDot < 0 ? name2 : name2.substring( 0, lastDot ) }.opus`;
	}
	#convert( buf, name ) {
		this.#blobName = this.#newName( name );
		this.#worker.postMessage( {
			command: "encode",
			args: [ "usercmp", "encoded.opus" ],
			outData: { "encoded.opus": { MIME: "audio/ogg" } },
			fileData: { usercmp: new Uint8Array( buf ) },
		} );
	}
	#onmessage( e ) {
		if ( e.data ) {
			const val = e.data.values;
			const res = this.#resolve;

			switch ( e.data.reply ) {
				case "progress":
					if ( val[ 1 ] ) {
						this.$onprogress( val[ 0 ] / val[ 1 ] );
					}
					break;
				case "done":
					for ( const p in val ) {
						this.#blob = val[ p ].blob;
					}
					this.#resolve =
					this.#reject = null;
					res( [ this.#blob, this.#blobName ] );
					break;
			}
		}
	}
}
