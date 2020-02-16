"use strict";

class gswaDrumrows {
	constructor() {
		const gsdata = new GSDataDrumrows( {
				dataCallbacks: {
					addDrumrow: this._addDrumrow.bind( this ),
					removeDrumrow: this._removeDrumrow.bind( this ),
					changeDrumrow: this._changeDrumrow.bind( this ),
				},
			} );

		this.ctx = null;
		this.gsdata = gsdata;
		this.getAudioBuffer =
		this.getChannelInput = () => {};
		this._startedDrums = new Map();
		this._bps = 1;
		Object.seal( this );
	}

	// .........................................................................
	setContext( ctx ) {
		this.stopAllDrums();
		this.ctx = ctx;
	}
	setBPM( bpm ) {
		this._bps = bpm / 60;
	}
	change( obj ) {
		this.gsdata.change( obj );
	}
	clear() {
		this.gsdata.clear();
	}
	getPatternDurationByRowId( rowId ) {
		const d = this.gsdata.data;

		return d.patterns[ d.drumrows[ rowId ].pattern ].duration;
	}

	// start/stop
	// .........................................................................
	startDrum( drum, when, off, dur ) {
		const id = ++gswaDrumrows._startedMaxId.value,
			data = this.gsdata.data,
			rowId = drum.row,
			row = data.drumrows[ rowId ],
			pat = data.patterns[ row.pattern ],
			buffer = this.getAudioBuffer( pat.buffer ),
			nodes = { rowId };

		if ( buffer ) {
			const absn = this.ctx.createBufferSource(),
				gain = this.ctx.createGain(),
				dest = this.getChannelInput( pat.dest );

			nodes.absn = absn;
			nodes.gain = gain;
			absn.buffer = buffer;
			gain.gain.setValueAtTime( row.toggle ? row.gain : 0, this.ctx.currentTime );
			absn.connect( gain ).connect( dest );
			absn.start( when, off, dur );
		}
		this._startedDrums.set( id, nodes );
		return id;
	}
	stopAllDrums() {
		this._startedDrums.forEach( ( _nodes, id ) => this.stopDrum( id ) );
	}
	stopDrum( id ) {
		const nodes = this._startedDrums.get( id );

		this._startedDrums.delete( id );
		if ( nodes.absn ) {
			nodes.absn.stop();
			nodes.gain.disconnect();
		}
	}

	// add/remove/update
	// .........................................................................
	_addDrumrow( id, obj ) {
	}
	_removeDrumrow( id ) {
		this._startedDrums.forEach( ( nodes, startedId ) => {
			if ( nodes.rowId === id ) {
				this.stopDrum( startedId );
			}
		} );
	}
	_changeDrumrow( id, prop, val ) {
		const row = this.gsdata.data.drumrows[ id ];

		switch ( prop ) {
			case "toggle":
				this._startedDrums.forEach( nodes => {
					if ( nodes.rowId === id && nodes.absn ) {
						nodes.gain.gain.setValueAtTime( val ? row.gain : 0, this.ctx.currentTime );
					}
				} );
				break;
		}
	}
}

gswaDrumrows._startedMaxId = Object.seal( { value: 0 } );

Object.freeze( gswaDrumrows );
