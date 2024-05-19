"use strict";

class gswaDrumrows {
	static #startedMaxId = 0;
	$onstartdrum = null;
	$onstartdrumcut = null;
	$getAudioBuffer = GSUnoop;
	$getChannelInput = GSUnoop;
	#ctx = null;
	#startedDrums = new Map();
	#ctrl = new DAWCoreControllerDrumrows( {
		$addDrumrow: GSUnoop,
		$removeDrumrow: this.#removeDrumrow.bind( this ),
		$changeDrumrow: this.#changeDrumrow.bind( this ),
	} );

	constructor() {
		Object.seal( this );
	}

	// .........................................................................
	$setContext( ctx ) {
		this.$stopAllDrums();
		this.#ctx = ctx;
	}
	$change( obj ) {
		this.#ctrl.$change( obj );
	}
	$clear() {
		this.#ctrl.$clear();
	}
	$getPatternDurationByRowId( rowId ) {
		const d = this.#ctrl.$data;

		return d.patterns[ d.drumrows[ rowId ].pattern ].duration;
	}

	// .........................................................................
	$liveDrumStart( rowId ) {
		const drum = {
			row: rowId,
			detune: 0,
			gain: 1,
			pan: 0,
		};

		return this.#startDrum( drum, this.#ctx.currentTime, 0, null, true );
	}
	$liveDrumStop( rowId ) {
		this.#startedDrums.forEach( ( nodes, id ) => {
			// if ( nodes.live && nodes.rowId === rowId ) {
			if ( nodes.rowId === rowId ) {
				this.$stopDrum( id, "-f" );
			}
		} );
	}

	// .........................................................................
	$startDrumcut( drumcut, when ) {
		const cutDur = .001;
		const whenCutStart = when - cutDur;

		this.#startedDrums.forEach( nodes => {
			if ( nodes.absn && nodes.rowId === drumcut.row && nodes.when < whenCutStart && when < nodes.endAt ) {
				nodes.endAt = when;
				nodes.gainCut.gain.setValueCurveAtTime( new Float32Array( [ 1, 0 ] ), whenCutStart, cutDur );
				nodes.absn.stop( when + cutDur );
				if ( this.$onstartdrumcut ) {
					const fn = this.$onstartdrumcut.bind( null, nodes.rowId );
					const time = whenCutStart - this.#ctx.currentTime;

					nodes.startDrumcutTimeoutId = setTimeout( fn, time * 1000 );
				}
			}
		} );
	}
	$startDrum( drum, when, off, dur ) {
		return this.#startDrum( drum, when, off, dur, false );
	}
	#startDrum( drum, when, off, durUser, live ) {
		const data = this.#ctrl.$data;
		const rowId = drum.row;
		const row = data.drumrows[ rowId ];
		const pat = data.patterns[ row.pattern ];
		const buffer = this.$getAudioBuffer( pat.buffer );
		const dur = durUser !== null ? durUser : buffer ? buffer.duration : 0;
		const id = ++gswaDrumrows.#startedMaxId;
		const nodes = {
			rowId, live, when, dur,
			endAt: when + dur,
			pan: drum.pan,
			gain: drum.gain,
			detune: drum.detune,
		};

		if ( buffer ) {
			const absn = this.#ctx.createBufferSource();
			const gainRow = this.#ctx.createGain();
			const gainCut = this.#ctx.createGain();
			const panRow = this.#ctx.createStereoPanner();
			const dest = this.$getChannelInput( pat.dest );

			nodes.absn = absn;
			nodes.gainCut = gainCut;
			nodes.gainRow = gainRow;
			nodes.panRow = panRow;
			absn.buffer = buffer;
			absn.detune.setValueAtTime( ( row.detune + drum.detune ) * 100, this.#ctx.currentTime );
			gainRow.gain.setValueAtTime( row.toggle ? row.gain * drum.gain : 0, this.#ctx.currentTime );
			panRow.pan.setValueAtTime( GSUpanningMerge( row.pan, drum.pan ), this.#ctx.currentTime );
			absn.connect( gainCut ).connect( gainRow ).connect( panRow ).connect( dest );
			absn.start( when, off, dur );
			if ( this.$onstartdrum ) {
				const timeoutMs = ( when - this.#ctx.currentTime ) * 1000;

				nodes.startDrumTimeoutId = setTimeout( () => this.$onstartdrum( rowId ), timeoutMs );
			}
		}
		this.#startedDrums.set( id, nodes );
		this.#startedDrums.forEach( ( nodes, id ) => {
			if ( nodes.when + nodes.dur <= this.#ctx.currentTime ) {
				this.#stopDrum( id, nodes );
			}
		} );
		return id;
	}
	$stopAllDrums() {
		this.#startedDrums.forEach( ( nodes, id ) => this.$stopDrum( id, "-f" ) );
	}
	$stopDrum( id, force ) {
		const nodes = this.#startedDrums.get( id );

		if ( nodes && ( force === "-f" ||
			nodes.when + nodes.dur <= this.#ctx.currentTime ||
			nodes.when >= this.#ctx.currentTime
		) ) {
			this.#stopDrum( id, nodes );
		}
	}
	#stopDrum( id, nodes ) {
		this.#startedDrums.delete( id );
		clearTimeout( nodes.startDrumTimeoutId );
		clearTimeout( nodes.startDrumcutTimeoutId );
		if ( nodes.absn ) {
			nodes.absn.stop();
			nodes.gainCut.disconnect();
			nodes.gainRow.disconnect();
			nodes.panRow.disconnect();
			if ( this.onstopdrum ) {
				this.onstopdrum( nodes.rowId, id );
			}
		}
	}
	$changeDrumProp( id, prop, val ) {
		const nodes = this.#startedDrums.get( +id );

		if ( nodes ) {
			const row = this.#ctrl.$data.drumrows[ nodes.rowId ];

			switch ( prop ) {
				case "detune":
					nodes.detune = val;
					nodes.absn.detune.setValueAtTime( ( val + row.detune ) * 100, this.#ctx.currentTime );
					break;
				case "gain":
					nodes.gain = val;
					nodes.gainRow.gain.setValueAtTime( row.toggle ? val * row.gain : 0, this.#ctx.currentTime );
					break;
				case "pan":
					nodes.pan = val;
					nodes.panRow.pan.setValueAtTime( GSUpanningMerge( val, row.pan ), this.#ctx.currentTime );
					break;
			}
		}
	}

	// .........................................................................
	#removeDrumrow( id ) {
		this.#startedDrums.forEach( ( nodes, startedId ) => {
			if ( nodes.rowId === id ) {
				this.$stopDrum( startedId, "-f" );
			}
		} );
	}
	#changeDrumrow( id, prop, val ) {
		const row = this.#ctrl.$data.drumrows[ id ];

		switch ( prop ) {
			case "toggle":
				this.#changeDrumrowProp( id, nodes => {
					nodes.gainRow.gain.setValueAtTime( val ? row.gain : 0, this.#ctx.currentTime );
				} );
				break;
			case "dest":
				this.#changeDrumrowProp( id, nodes => {
					nodes.gainRow.disconnect();
					nodes.gainRow.connect( this.$getChannelInput( val ) );
				} );
				break;
			case "detune":
				this.#changeDrumrowProp( id, nodes => {
					nodes.absn.detune.setValueAtTime( ( val + nodes.detune ) * 100, this.#ctx.currentTime );
				} );
				break;
			case "gain":
				this.#changeDrumrowProp( id, nodes => {
					nodes.gainRow.gain.setValueAtTime( val * nodes.gain, this.#ctx.currentTime );
				} );
				break;
			case "pan":
				this.#changeDrumrowProp( id, nodes => {
					nodes.panRow.pan.setValueAtTime( GSUpanningMerge( val, nodes.pan ), this.#ctx.currentTime );
				} );
				break;
		}
	}
	#changeDrumrowProp( rowId, fn ) {
		this.#startedDrums.forEach( nodes => {
			if ( nodes.rowId === rowId && nodes.absn ) {
				fn( nodes );
			}
		} );
	}
}

Object.freeze( gswaDrumrows );
