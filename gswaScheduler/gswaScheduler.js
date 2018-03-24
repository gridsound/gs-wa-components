"use strict";

class gswaScheduler {
	constructor() {
		this.ondatastart =
		this.ondatastop =
		this.onended =
		this.currentTime = () => {};
		this.bpm = 60;
		this.bps = 1;
		this.duration =
		this.dataLen = 0;
		this.data = this._proxyCreate();
		this._dataScheduled = {};
		this._dataScheduledPerBlock = {};
		this._streamloop = this._streamloop.bind( this );
		this.setBPM( 60 );
	}

	// BPM
	// ........................................................................
	setBPM( bpm ) {
		if ( this.bpm !== bpm ) {
			const ratio = this.bpm / bpm,
				started = this.started,
				currTime = started && this.getCurrentOffset()

			this.bpm = bpm;
			this.bps = bpm / 60;
			this.duration *= ratio;
			if ( started ) {
				this.setCurrentOffset( currTime * ratio );
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
		let off;

		if ( this.started ) {
			off = this.getCurrentOffset();
		}
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
	startBeat( when, off = 0, dur = this.duration * this.bps ) {
		return this.start( when,
			off / this.bps,
			dur / this.bps );
	}
	start( when, off = 0, dur = this.duration ) {
		const currTime = this.currentTime();

		if ( this.started ) {
			this.stop();
		}
		this.started = true;
		this._startWhen = Math.max( currTime, when );
		this._startWhenDiff = this._startWhen - currTime;
		this._startOff = off;
		this._startDur = dur;
		this._setTimeoutEnded();
		if ( this.duration > 0 ) {
			this._streamloopOn();
		}
	}
	stop() {
		if ( this.started ) {
			delete this.started;
			clearTimeout( this._timeoutIdEnded );
			this._streamloopOff();
			Object.keys( this.data ).forEach( this._blockStop, this );
		}
	}
	_setTimeoutEnded() {
		if ( this.started ) {
			clearTimeout( this._timeoutIdEnded );
			if ( !this.looping ) {
				this._timeoutIdEnded = setTimeout( () => {
					this.onended();
				}, ( ( this.duration || 0 ) + 1 ) * 1000 );
			}
		}
	}
	_getOffsetEnd() {
		return this.looping ? this.loopB : this._startOff + this._startDur;
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

		Object.entries( allSchedule ).forEach( ( [ id, obj ] ) => {
			if ( obj.whenEnd < currTime ) {
				this.ondatastop( id, obj.block );
				delete this._dataScheduledPerBlock[ obj.blockId ].started[ id ];
				delete allSchedule[ id ];
			}
		} );
		Object.keys( this.data ).forEach( this._blockSchedule, this );
	}

	// Block functions
	// ........................................................................
	_bWhn( o ) { return o.when / this.bps; }
	_bOff( o ) { return o.offset / this.bps; }
	_bDur( o ) { return o.duration / this.bps; }
	_blockStop( id ) {
		const allSchedule = this._dataScheduled,
			blcSchedule = this._dataScheduledPerBlock[ id ];

		Object.entries( blcSchedule.started ).forEach( ( [ id, obj ] ) => {
			delete allSchedule[ id ];
			delete blcSchedule.started[ id ];
			this.ondatastop( id, obj.block );
		} );
		blcSchedule.scheduledUntil = 0;
	}
	_blockSchedule( id ) {
		if ( this.started ) {
			const currTime = this.currentTime(),
				currTimeEnd = currTime + 1;
			let blcSchedule = this._dataScheduledPerBlock[ id ],
				until = Math.max( currTime, blcSchedule.scheduledUntil || 0 );

			if ( until < currTimeEnd ) {
				const offEnd = this._getOffsetEnd(),
					block = this.data[ id ],
					bWhn = this._bWhn( block ),
					bOff = this._bOff( block ),
					bDur = this._bDur( block );

				do {
					const from = this.getFutureOffsetAt( until );
					let to = Math.min( from + 1, offEnd );

					until += this._blockStart( until, from, to, offEnd, id, block, bWhn, bOff, bDur );
				} while ( this.looping && until < currTimeEnd );
				blcSchedule.scheduledUntil = until;
			}
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
			const block = this.data[ id ],
				whenEnd = this._bWhn( block ) + this._bDur( block );

			if ( whenEnd > this.duration ) {
				this._lastBlockId = id;
				this.duration = whenEnd;
				this._setTimeoutEnded();
			}
		}
	}
	_findLastBlock() {
		this.duration = Object.entries( this.data ).reduce( ( maxEnd, [ id, block ] ) => {
			const whenEnd = this._bWhn( block ) + this._bDur( block );

			if ( whenEnd > maxEnd ) {
				this._lastBlockId = id;
				return whenEnd;
			}
			return maxEnd;
		}, 0 );
		this._setTimeoutEnded();
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
		delete target[ id ];
		if ( this.started ) {
			this._blockStop( id );
		}
		if ( this._lastBlockId === id ) {
			this._findLastBlock();
		}
		delete this._dataScheduledPerBlock[ id ];
		return true;
	}
	_proxySetBlock( target, id, block ) {
		if ( id in target ) {
			if ( this.started ) {
				this._blockStop( id );
			}
		} else {
			this._dataScheduledPerBlock[ id ] = {
				started: {},
				scheduledUntil: 0
			};
		}
		target[ id ] = new Proxy(
			Object.assign( { when: 0, offset: 0, duration: 0 }, block ), {
				set: this._proxySetBlockProp.bind( this, id ),
				deleteProperty: this._proxyDelBlockProp.bind( this, id )
			} );
		this._isLastBlock( id );
		this._blockSchedule( id );
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
