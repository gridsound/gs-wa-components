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

		this.ctx =
		this.onstartdrum = null;
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
	startLiveDrum( rowId ) {
		return this._startDrum( rowId, this.ctx.currentTime, 0, null, true );
	}
	stopLiveDrum( rowId ) {
		this._startedDrums.forEach( ( nodes, id ) => {
			// if ( nodes.live && nodes.rowId === rowId ) {
			if ( nodes.rowId === rowId ) {
				this.stopDrum( id, "-f" );
			}
		} );
	}
	startDrum( drum, when, off, dur ) {
		return this._startDrum( drum.row, when, off, dur, false );
	}
	_startDrum( rowId, when, off, durUser, live ) {
		const data = this.gsdata.data,
			row = data.drumrows[ rowId ],
			pat = data.patterns[ row.pattern ],
			buffer = this.getAudioBuffer( pat.buffer ),
			dur = durUser !== null ? durUser : buffer ? buffer.duration : 0,
			id = ++gswaDrumrows._startedMaxId.value,
			nodes = { rowId, live, when, dur };

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
			if ( this.onstartdrum ) {
				const timeoutMs = ( when - this.ctx.currentTime ) * 1000;

				nodes.startDrumTimeoutId = setTimeout( () => this.onstartdrum( rowId ), timeoutMs );
			}
		}
		this._startedDrums.set( id, nodes );
		this._startedDrums.forEach( ( nodes, id ) => {
			if ( nodes && nodes.when + nodes.dur <= this.ctx.currentTime ) {
				this._stopDrum( id, nodes );
			}
		} );
		return id;
	}
	stopAllDrums() {
		this._startedDrums.forEach( ( _nodes, id ) => this.stopDrum( id, "-f" ) );
	}
	stopDrum( id, force ) {
		const nodes = this._startedDrums.get( id );

		if ( nodes && ( force === "-f" ||
			nodes.when + nodes.dur <= this.ctx.currentTime ||
			nodes.when >= this.ctx.currentTime
		) ) {
			this._stopDrum( id, nodes );
		}
	}
	_stopDrum( id, nodes ) {
		this._startedDrums.delete( id );
		clearTimeout( nodes.startDrumTimeoutId );
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
				this.stopDrum( startedId, "-f" );
			}
		} );
	}
	_changeDrumrow( id, prop, val ) {
		const row = this.gsdata.data.drumrows[ id ];

		switch ( prop ) {
			case "toggle":
				this.__changeDrumrow( id, nodes => {
					nodes.gain.gain.setValueAtTime( val ? row.gain : 0, this.ctx.currentTime );
				} );
				break;
			case "dest":
				this.__changeDrumrow( id, nodes => {
					nodes.gain.disconnect();
					nodes.gain.connect( this.getChannelInput( val ) );
				} );
				break;
		}
	}
	__changeDrumrow( rowId, fn ) {
		this._startedDrums.forEach( nodes => {
			if ( nodes.rowId === rowId && nodes.absn ) {
				fn( nodes );
			}
		} );
	}
}

gswaDrumrows._startedMaxId = Object.seal( { value: 0 } );

Object.freeze( gswaDrumrows );
