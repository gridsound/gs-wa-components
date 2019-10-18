"use strict";

class gswaEffects {
	constructor( fns ) {
		this.ctx = null;
		this._getChanInput = fns.getChanInput;
		this._getChanOutput = fns.getChanOutput;
		this._wafxs = new Map();
		this.gsdata = new GSDataEffects( {
			dataCallbacks: {
				toggleFx: this._toggleFx.bind( this ),
				removeFx: this._removeFx.bind( this ),
				changeFxData: this._changeFxData.bind( this ),
			},
		} );
		Object.seal( this );
	}

	// .........................................................................
	setContext( ctx ) {
		this.ctx = ctx;
		this._wafxs.forEach( fx => fx.setContext( ctx ) );
	}
	setBPM( bpm ) {
		this._wafxs.forEach( fx => fx.setBPM && fx.setBPM( bpm ) );
	}
	change( obj ) {
		this.gsdata.change( obj );
	}
	clear() {
		this.gsdata.clear();
	}
	liveChangeFxProp( id, prop, val ) {
		this._wafxs.get( id ).liveChange( prop, val );
	}

	// .........................................................................
	_toggleFx( id, b ) {
		if ( !b ) {
			this._removeFx( id );
		} else if ( !this._wafxs.has( id ) ) {
			this._addFx( id, this.gsdata.data[ id ] );
		}
	}
	_addFx( id, fx ) {
		const wafx = new ( gswaEffects.fxsMap.get( fx.type ) )(),
			chanIn = this._getChanInput( fx.dest ),
			chanOut = this._getChanOutput( fx.dest );

		this._wafxs.set( id, wafx );
		wafx.setContext( this.ctx );
		chanIn.disconnect(); // still work to do here
		chanIn.connect( wafx.input );
		wafx.output.connect( chanOut );
	}
	_changeFxData( id, fxData ) {
		this._wafxs.get( id ).change( fxData );
	}
	_removeFx( id ) {
		const wafx = this._wafxs.get( id );

		wafx.output.disconnect();
		this._wafxs.delete( id );
	}
}

gswaEffects.fxsMap = new Map();
Object.freeze( gswaEffects );
