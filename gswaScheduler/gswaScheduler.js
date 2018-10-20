"use strict";

class gswaScheduler {
	constructor() {
		this.ondatastart =
		this.ondatastop =
		this.onended =
		this.currentTime = () => {};
		this.bpm = 60;
		this.bps = 1;
		this._startOff =
		this.duration =
		this.dataLen = 0;
		this.data = this._proxyCreate();
		this._dataScheduled = {};
		this._dataScheduledPerBlock = {};
		this._streamloop = this._streamloop.bind( this );
		this.enableStreaming();
	}

	// BPM
	// ........................................................................
	setBPM( bpm ) {
		if ( this.bpm !== bpm ) {
			const ratio = this.bpm / bpm,
				currTime = this.getCurrentOffset() * ratio;

			this.bpm = bpm;
			this.bps = bpm / 60;
			this.duration *= ratio;
			if ( this.looping ) {
				this.loopA *= ratio;
				this.loopB *= ratio;
				this.loopDuration = this.loopB - this.loopA;
				this.setCurrentOffset( this.loopB > currTime ? currTime : this.loopA );
			} else {
				this.setCurrentOffset( currTime );
			}
		}
	}

	// Empty
	// ........................................................................
	empty() {
		Object.keys( this.data ).forEach( id => delete this.data[ id ] );
	}

	// Loop
	// ........................................................................
	setLoopBeat( a, b ) {
		return this.setLoop( a / this.bps, b / this.bps );
	}
	setLoop( a, b ) {
		const off = this.started && this.getCurrentOffset();

		this.looping = true;
		this.loopA = Math.min( a, b );
		this.loopB = Math.max( a, b );
		this.loopDuration = this.loopB - this.loopA;
		if ( this.started ) {
			this.setCurrentOffset( this.loopB > off ? off : this.loopA );
		}
	}
	clearLoop() {
		if ( this.looping ) {
			const off = this.getCurrentOffset();

			delete this.looping;
			this.setCurrentOffset( off );
		}
	}

	// set/getCurrentOffset
	// ........................................................................
	setCurrentOffsetBeat( off ) {
		this.setCurrentOffset( off / this.bps );
	}
	setCurrentOffset( off ) {
		this._startOff = off;
		this.started && this.start( 0, off );
	}
	getCurrentOffsetBeat() {
		return this.getCurrentOffset() * this.bps;
	}
	getCurrentOffset() {
		return this.started
			? this.getFutureOffsetAt( this.currentTime() )
			: this._startOff;
	}
	getFutureOffsetAt( futureTime ) {
		let t = this._startOff + futureTime - this._startWhen;

		if ( this.looping && t > this.loopB - .001 ) {
			t = this.loopA + ( t - this.loopA ) % this.loopDuration;
			if ( t > this.loopB - .001 ) {
				t = this.loopA;
			}
		}
		return t;
	}

	// Start / stop
	// ........................................................................
	enableStreaming( b = true ) {
		this.isStreaming = b;
	}
	startBeat( when, off = 0, dur ) {
		if ( Number.isFinite( dur ) ) {
			dur /= this.bps;
		}
		return this.start( when, off / this.bps, dur );
	}
	start( when, off = 0, dur ) {
		const currTime = this.currentTime();

		if ( this.started ) {
			this.stop();
		}
		this._startFixedDur = Number.isFinite( dur );
		if ( !this._startFixedDur ) {
			dur = this.duration - off;
		}
		this.started = true;
		this._startWhen = Math.max( currTime, when );
		this._startOff = off;
		this._startDur = dur;
		if ( this.isStreaming && !this.looping ) {
			this._timeoutIdEnded = setTimeout( this.onended.bind( this ), dur * 1000 );
		}
		if ( this.duration > 0 ) {
			this.isStreaming
				? this._streamloopOn()
				: this._fullStart();
		}
	}
	stop() {
		if ( this.started ) {
			this._startOff = this.getCurrentOffset();
			delete this.started;
			clearTimeout( this._timeoutIdEnded );
			this._streamloopOff();
			Object.keys( this._dataScheduledPerBlock ).forEach( this._blockStop, this );
		}
	}
	_getOffsetEnd() {
		return this.looping ? this.loopB : this._startOff + this._startDur;
	}
	_updateDuration( dur ) {
		if ( dur !== this.duration ) {
			this.duration = dur;
			if ( this.started && !this._startFixedDur ) {
				this._startDur = dur;
			}
			if ( this.looping || !this._startFixedDur ) {
				clearTimeout( this._timeoutIdEnded );
			}
			if ( this.started && this.isStreaming && !this.looping ) {
				this._timeoutIdEnded = setTimeout( this.onended.bind( this ),
					( dur - this._startOff - this.currentTime() + this._startWhen ) * 1000 );
			}
		}
	}

	// Full start
	// ........................................................................
	_fullStart() {
		const when = this._startWhen,
			from = this._startOff,
			to = from + this._startDur,
			bps = this.bps;

		Object.entries( this.data ).forEach( ( [ blockId, block ] ) => {
			this._blockStart( when, from, to, to, +blockId, block,
				block.when / bps,
				block.offset / bps,
				block.duration / bps );
		} );
	}

	// Stream loop
	// ........................................................................
	_streamloopOn() {
		if ( !this._streamloopId ) {
			this._streamloopId = setInterval( this._streamloop, 100 );
			this._streamloop();
		}
	}
	_streamloopOff() {
		if ( this._streamloopId ) {
			clearInterval( this._streamloopId );
			delete this._streamloopId;
		}
	}
	_streamloop() {
		const allSchedule = this._dataScheduled,
			currTime = this.currentTime();
		let stillSomethingToPlay;

		Object.entries( allSchedule ).forEach( ( [ id, obj ] ) => {
			if ( obj.whenEnd < currTime ) {
				id = +id;
				this.ondatastop( id, obj.block );
				delete this._dataScheduledPerBlock[ obj.blockId ].started[ id ];
				delete allSchedule[ id ];
			}
		} );
		Object.keys( this.data ).forEach( id => {
			if ( this._blockSchedule( id ) ) {
				stillSomethingToPlay = true;
			}
		} );
		if ( !stillSomethingToPlay ) {
			this._streamloopOff();
		}
	}

	// Block functions
	// ........................................................................
	_blockStop( id ) {
		const allSchedule = this._dataScheduled,
			blcSchedule = this._dataScheduledPerBlock[ id ];

		Object.entries( blcSchedule.started ).forEach( ( [ id, obj ] ) => {
			id = +id;
			delete allSchedule[ id ];
			delete blcSchedule.started[ id ];
			this.ondatastop( id, obj.block );
		} );
		blcSchedule.scheduledUntil = 0;
	}
	_blockSchedule( id ) {
		if ( this.started ) {
			const currTime = this.currentTime(),
				currTimeEnd = currTime + 1,
				blcSchedule = this._dataScheduledPerBlock[ id ];
			let until = Math.max( currTime, blcSchedule.scheduledUntil || 0 );

			if ( until < currTimeEnd ) {
				const offEnd = this._getOffsetEnd(),
					blc = this.data[ id ],
					bWhn = blc.when / this.bps,
					bOff = blc.offset / this.bps,
					bDur = blc.duration / this.bps;

				do {
					const from = this.getFutureOffsetAt( until ),
						to = Math.min( from + 1, offEnd );

					until += this._blockStart( until, from, to, offEnd, id, blc, bWhn, bOff, bDur );
				} while ( this.looping && until < currTimeEnd );
				blcSchedule.scheduledUntil = until;
			}
			return this.looping || blcSchedule.scheduledUntil <= this._startWhen + this._startDur;
		}
	}
	_blockStart( when, from, to, offEnd, blockId, block, bWhn, bOff, bDur ) {
		if ( from < bWhn + bDur && bWhn < to ) {
			const startWhen = this._startWhen;

			to = offEnd;
			if ( bWhn + bDur > to ) {
				bDur -= bWhn + bDur - to;
			}
			if ( bWhn < from ) {
				bOff += from - bWhn;
				bDur -= from - bWhn;
				bWhn = from;
			}
			bWhn = when + bWhn - from;
			if ( bWhn < startWhen ) {
				bOff += startWhen - bWhn;
				bDur -= startWhen - bWhn;
				bWhn = startWhen;
			}
			if ( bDur > .000001 ) {
				const id = ++gswaScheduler._startedMaxId;

				this._dataScheduledPerBlock[ blockId ].started[ id ] =
				this._dataScheduled[ id ] = {
					block,
					blockId,
					whenEnd: bWhn + bDur
				};
				this.ondatastart( id, block, bWhn, bOff, bDur );
			}
		}
		return to - from;
	}
	_isLastBlock( id ) {
		if ( this._lastBlockId === id ) {
			this._findLastBlock();
		} else {
			const blc = this.data[ id ],
				whenEnd = ( blc.when + blc.duration ) / this.bps;

			if ( whenEnd > this.duration ) {
				this._lastBlockId = id;
				this._updateDuration( whenEnd );
			}
		}
	}
	_findLastBlock() {
		this._updateDuration( Object.entries( this.data )
			.reduce( ( max, [ id, blc ] ) => {
				const whenEnd = ( blc.when + blc.duration ) / this.bps;

				if ( whenEnd > max ) {
					this._lastBlockId = +id;
					return whenEnd;
				}
				return max;
			}, 0 ) );
	}

	// Data proxy
	// ........................................................................
	_proxyCreate() {
		return new Proxy( {}, {
			set: this._proxySetBlock.bind( this ),
			deleteProperty: this._proxyDelBlock.bind( this )
		} );
	}
	_proxyDelBlock( target, id ) {
		if ( !( id in target ) ) {
			console.warn( "gswaScheduler: data delete unknown id", id );
		} else {
			delete target[ id ];
			if ( this.started ) {
				this._blockStop( id );
			}
			if ( this._lastBlockId === id ) {
				this._findLastBlock();
			}
			delete this._dataScheduledPerBlock[ id ];
		}
		return true;
	}
	_proxySetBlock( target, id, block ) {
		if ( id in target || !block ) {
			this._proxyDelBlock( target, id );
		}
		if ( block ) {
			this._dataScheduledPerBlock[ id ] = {
				started: {},
				scheduledUntil: 0,
			};
			target[ id ] = new Proxy(
				Object.assign( { when: 0, offset: 0, duration: 0 }, block ), {
					set: this._proxySetBlockProp.bind( this, id ),
					deleteProperty: this._proxyDelBlockProp.bind( this, id )
				} );
			this._isLastBlock( id );
			this._blockSchedule( id );
		}
		return true;
	}
	_proxyDelBlockProp( id, target, prop ) {
		return this._proxySetBlockProp( id, target, prop );
	}
	_proxySetBlockProp( id, target, prop, val ) {
		if ( val === undefined ) {
			delete target[ prop ];
		} else {
			target[ prop ] = val;
		}
		if ( gswaScheduler._blockAttributes.indexOf( prop ) > -1 ) {
			this._isLastBlock( id );
		}
		if ( this.started ) {
			this._blockStop( id );
		}
		this._blockSchedule( id );
		return true;
	}
}

gswaScheduler._startedMaxId = 0;
gswaScheduler._blockAttributes = [ "when", "offset", "duration" ];
