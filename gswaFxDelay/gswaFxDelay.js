"use strict";

class gswaFxDelay {
	constructor() {
		this.ctx =
		this.input =
		this.output = null;
		this._bps = 1;
		this._nodes = new Map();
		this.gsdata = new GSDataFxDelay( {
			dataCallbacks: {
				changeEchoes: this._changeEchoes.bind( this ),
			},
		} );
		Object.seal( this );
	}

	// .........................................................................
	setContext( ctx ) {
		if ( this.ctx ) {
			this.input.disconnect();
			this.output.disconnect();
			this._nodes.forEach( nodes => {
				nodes.pan.disconnect();
				nodes.gain.disconnect();
				nodes.delay.disconnect();
			} );
			this._nodes.clear();
		}
		this.ctx = ctx;
		this.input = ctx.createGain();
		this.output = ctx.createGain();
		this.input.connect( this.output );
		Object.entries( this.gsdata.data.echoes )
			.forEach( kv => this._addEcho( ...kv ) );
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

	// .........................................................................
	_changeEchoes( echoes ) {
		Object.entries( echoes ).forEach( ( [ id, echo ] ) => {
			if ( !echo ) {
				this._removeEcho( id );
			} else if ( this._nodes.has( id ) ) {
				this._updateEcho( id, echo );
			} else {
				this._addEcho( id, echo );
			}
		} );
	}
	_addEcho( id, echo ) {
		const delay = this.ctx.createDelay( 50 );
		const gain = this.ctx.createGain();
		const pan = this.ctx.createStereoPanner();

		lg("_addEcho", id, GSData.deepCopy( echo ))
		delay.connect( gain );
		gain.connect( pan );
		pan.connect( this.output );
		this._nodes.set( id, { delay, gain, pan } );
		this._updateEcho( id, echo );
		this.input.connect( delay );
	}
	_removeEcho( id ) {
		lg("_removeEcho", id)
		this.input.disconnect( this._nodes.get( id ).delay );
		this._nodes.delete( id );
	}
	_updateEcho( id, echo ) {
		const nodes = this._nodes.get( id );

		lg("_updateEcho", id, GSData.deepCopy( echo ))
		this._updateEchoParam( nodes.pan.pan, echo.pan );
		this._updateEchoParam( nodes.gain.gain, echo.gain );
		this._updateEchoParam( nodes.delay.delayTime, echo.delay );
	}
	_updateEchoParam( audioParam, val ) {
		if ( val !== undefined ) {
			audioParam.setValueAtTime( val, this.ctx.currentTime );
		}
	}
}

Object.freeze( gswaFxDelay );

if ( typeof gswaEffects !== "undefined" ) {
	gswaEffects.fxsMap.set( "delay", gswaFxDelay );
}
