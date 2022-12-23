"use strict";

class gswaScheduler {
	static #startedMaxId = 0;
	data = {};
	bpm = 60;
	bps = 1;
	loopA = null;
	loopB = null;
	looping = false;
	loopDuration = 0;
	isStreaming = true;
	started = false;
	duration = 0;
	delayStopCallback = 0;
	currentTime = DAWCoreUtils.$noop;
	ondatastart = DAWCoreUtils.$noop;
	ondatastop = DAWCoreUtils.$noop;
	ondatapropchange = DAWCoreUtils.$noop;
	onended = DAWCoreUtils.$noop;
	#startDur = 0;
	#startOff = 0;
	#startWhen = 0;
	#startFixedDur = 0;
	#timeoutIdEnded = null;
	#sortedData = [];
	#dataScheduled = {};
	#dataScheduledPerBlock = {};
	#streamloopId = null;
	#streamloopBind = this.#streamloop.bind( this );
	#ctrl = DAWCoreUtils.$createUpdateDelete.bind( null, this.data,
		this.#dataAddBlock.bind( this ),
		this.#dataUpdateBlock.bind( this ),
		this.#dataDeleteBlock.bind( this )
	);

	constructor() {
		Object.seal( this );
	}

	// .........................................................................
	$setBPM( bpm ) {
		if ( this.bpm !== bpm ) {
			const ratio = this.bpm / bpm;
			const currTime = this.#getCurrentOffset() * ratio;

			this.bpm = bpm;
			this.bps = bpm / 60;
			this.duration *= ratio;
			if ( this.looping ) {
				this.loopA *= ratio;
				this.loopB *= ratio;
				this.loopDuration = this.loopB - this.loopA;
				this.#setCurrentOffset( this.loopB > currTime ? currTime : this.loopA );
			} else {
				this.#setCurrentOffset( currTime );
			}
		}
	}

	// .........................................................................
	$empty() {
		this.#sortedData.forEach( kv => this.#dataDeleteBlock( kv[ 0 ] ) );
		this.$clearLoop();
	}

	// .........................................................................
	$setLoopBeat( a, b ) {
		return this.#setLoop( a / this.bps, b / this.bps );
	}
	#setLoop( a, b ) {
		const off = this.started && this.#getCurrentOffset();

		this.looping = true;
		this.loopA = Math.min( a, b );
		this.loopB = Math.max( a, b );
		this.loopDuration = this.loopB - this.loopA;
		if ( this.started ) {
			this.#setCurrentOffset( this.loopB > off ? off : this.loopA );
		}
	}
	$clearLoop() {
		if ( this.looping ) {
			const off = this.#getCurrentOffset();

			this.looping = false;
			this.#setCurrentOffset( off );
		}
	}

	// .........................................................................
	$setCurrentOffsetBeat( off ) {
		this.#setCurrentOffset( off / this.bps );
	}
	#setCurrentOffset( off ) {
		this.#startOff = off;
		this.started && this.$start( 0, off );
	}
	$getCurrentOffsetBeat() {
		return this.#getCurrentOffset() * this.bps;
	}
	#getCurrentOffset() {
		return this.started
			? this.#getFutureOffsetAt( this.currentTime() )
			: this.#startOff;
	}
	#getFutureOffsetAt( futureTime ) {
		let t = this.#startOff + futureTime - this.#startWhen;

		if ( this.looping && t > this.loopB - .001 ) {
			t = this.loopA + ( t - this.loopA ) % this.loopDuration;
			if ( t > this.loopB - .001 ) {
				t = this.loopA;
			}
		}
		return t;
	}

	// .........................................................................
	$enableStreaming( b = true ) {
		this.isStreaming = b;
	}
	$startBeat( when, off = 0, dur ) {
		return this.$start( when, off / this.bps,
			Number.isFinite( dur )
				? dur / this.bps
				: dur );
	}
	$start( when, off = 0, dur ) {
		const currTime = this.currentTime();

		if ( this.started ) {
			this.$stop();
		}
		this.started = true;
		this.#startFixedDur = Number.isFinite( dur );
		this.#startWhen = Math.max( currTime, when );
		this.#startOff = off;
		this.#startDur = this.#startFixedDur
			? dur
			: this.duration - off;
		if ( this.isStreaming && !this.looping ) {
			this.#timeoutIdEnded = setTimeout(
				this.onended.bind( this ),
				this.#startDur * 1000 );
		}
		this.isStreaming
			? this.#streamloopOn()
			: this.#fullStart();
	}
	$stop() {
		if ( this.started ) {
			this.#startOff = this.#getCurrentOffset();
			this.started = false;
			clearTimeout( this.#timeoutIdEnded );
			this.#streamloopOff();
			Object.keys( this.#dataScheduledPerBlock ).forEach( this.#blockStop, this );
		}
	}
	#getOffsetEnd() {
		return this.looping ? this.loopB : this.#startOff + this.#startDur;
	}
	#updateDuration() {
		const dur = Object.values( this.data ).reduce( gswaScheduler.#updateDurationReduce, 0 ) / this.bps;

		if ( dur !== this.duration ) {
			this.duration = dur;
			if ( this.started && !this.#startFixedDur ) {
				this.#startDur = dur;
			}
			if ( this.looping || !this.#startFixedDur ) {
				clearTimeout( this.#timeoutIdEnded );
			}
			if ( this.started && this.isStreaming && !this.looping ) {
				this.#timeoutIdEnded = setTimeout( this.onended.bind( this ),
					( dur - this.#startOff - this.currentTime() + this.#startWhen ) * 1000 );
			}
		}
	}
	static #updateDurationReduce( max, blc ) {
		return Math.max( max, blc.when + blc.duration );
	}

	// .........................................................................
	#fullStart() {
		const when = this.#startWhen;
		const from = this.#startOff;
		const to = from + this.#startDur;

		this.#sortedData.forEach( kv => this.#blockStart( when, from, to, to, ...kv ) );
	}

	// .........................................................................
	#streamloopOn() {
		if ( !this.#streamloopId ) {
			this.#streamloopId = setInterval( this.#streamloopBind, 100 );
			this.#streamloop();
		}
	}
	#streamloopOff() {
		if ( this.#streamloopId ) {
			clearInterval( this.#streamloopId );
			this.#streamloopId = null;
		}
	}
	#streamloop() {
		const currTime = this.currentTime();
		const delay = this.delayStopCallback / this.bps;
		let stillSomethingToPlay;

		Object.entries( this.#dataScheduled ).forEach( ( [ id, obj ] ) => {
			if ( obj.whenEnd + delay < currTime ) {
				delete this.#dataScheduled[ id ];
				delete this.#dataScheduledPerBlock[ obj.blockId ].started[ id ];
				this.ondatastop( id );
			}
		} );
		this.#sortedData.forEach( kv => {
			if ( this.#blockSchedule( kv[ 0 ] ) ) {
				stillSomethingToPlay = true;
			}
		} );
		if ( !this.looping && !stillSomethingToPlay ) {
			this.#streamloopOff();
		}
	}

	// .........................................................................
	#blockStop( id ) {
		const blcSchedule = this.#dataScheduledPerBlock[ id ];

		Object.keys( blcSchedule.started ).forEach( id => {
			this.ondatastop( id );
			delete this.#dataScheduled[ id ];
			delete blcSchedule.started[ id ];
		} );
		blcSchedule.scheduledUntil = 0;
	}
	#blockSchedule( id ) {
		if ( this.started ) {
			const currTime = this.currentTime();
			const currTimeEnd = currTime + 1;
			const blcSchedule = this.#dataScheduledPerBlock[ id ];
			let until = Math.max( currTime, blcSchedule.scheduledUntil || 0 );

			if ( until < currTimeEnd ) {
				const offEnd = this.#getOffsetEnd();
				const blc = this.data[ id ];

				do {
					const from = this.#getFutureOffsetAt( until );
					const to = Math.min( from + 1, offEnd );

					until += this.#blockStart( until, from, to, offEnd, id, blc );
				} while ( this.looping && until < currTimeEnd );
				blcSchedule.scheduledUntil = until;
			}
			return blcSchedule.scheduledUntil <= this.#startWhen + this.#startDur;
		}
	}
	#blockStart( when, from, to, offEnd, blockId, block ) {
		if ( block.prev == null ) {
			const bps = this.bps;
			const blcs = [];
			let bWhn = block.when / bps;
			let bOff = block.offset / bps;
			let bDur = 0;

			for ( let id = blockId, blc = block; blc; ) {
				blcs.push( [ id, blc ] );
				bDur = blc.when / bps - bWhn + blc.duration / bps;
				id = blc.next;
				blc = id != null ? this.data[ id ] : null;
			}
			if ( from <= bWhn + bDur && bWhn < to ) {
				const startWhen = this.#startWhen;

				if ( bWhn + bDur > offEnd ) {
					bDur -= bWhn + bDur - offEnd;
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
					const id = `${ ++gswaScheduler.#startedMaxId }`;

					this.#dataScheduledPerBlock[ blockId ].started[ id ] =
					this.#dataScheduled[ id ] = {
						block,
						blockId,
						when: bWhn,
						whenEnd: bWhn + bDur,
					};
					this.ondatastart( id, blcs, bWhn, bOff, bDur );
				}
				return offEnd - from;
			}
		}
		return to - from;
	}

	// .........................................................................
	$change( obj ) {
		this.#ctrl( obj );
		this.#sortedData = Object.entries( this.data ).sort( ( a, b ) => a[ 1 ].when - b[ 1 ].when );
	}
	#dataDeleteBlock( id ) {
		if ( !( id in this.data ) ) {
			console.warn( "gswaScheduler: data delete unknown id", id );
		} else {
			delete this.data[ id ];
			if ( this.started ) {
				this.#blockStop( id );
			}
			delete this.#dataScheduledPerBlock[ id ];
			this.#updateDuration();
		}
	}
	#dataAddBlock( id, obj ) {
		this.#dataScheduledPerBlock[ id ] = {
			started: {},
			scheduledUntil: 0,
		};
		this.data[ id ] = {
			when: 0,
			offset: 0,
			duration: 0,
			...obj,
		};
		this.#updateDuration();
		this.#blockSchedule( id );
	}
	#dataUpdateBlock( id, obj ) {
		let blc = this.data[ id ];
		let idToPlay = id;

		Object.assign( blc, obj );
		this.#updateDuration();
		while ( blc.prev ) {
			idToPlay = blc.prev;
			blc = this.data[ idToPlay ];
		}
		this.#blockStop( idToPlay );
		this.#blockSchedule( idToPlay );
	}
}

Object.freeze( gswaScheduler );
