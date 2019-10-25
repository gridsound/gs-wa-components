"use strict";

class gswaEffects {
	constructor( fns ) {
		this.ctx = null;
		this._getChanInput = fns.getChanInput;
		this._getChanOutput = fns.getChanOutput;
		this._wafxs = new Map();
		this.gsdata = new GSDataEffects( {
			dataCallbacks: {
				addFx: this._addFx.bind( this ),
				removeFx: this._removeFx.bind( this ),
				connectFxTo: this._connectFxTo.bind( this ),
				toggleFx: ( id, b ) => this._wafxs.get( id ).toggle( b ),
				changeFxData: ( id, data ) => this._wafxs.get( id ).change( data ),
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
	_addFx( id, fx ) {
		const wafx = new ( gswaEffects.fxsMap.get( fx.type ) )();

		this._wafxs.set( id, wafx );
		wafx.setContext( this.ctx );
	}
	_removeFx( id, prevId, nextId ) {
		const wafx = this._wafxs.get( id );

		wafx.output.disconnect();
		this._wafxs.delete( id );
	}
	_connectFxTo( chanId, fxId, nextFxId ) {
		const dest = nextFxId
				? this._wafxs.get( nextFxId ).input
				: this._getChanOutput( chanId ),
			node = fxId
				? this._wafxs.get( fxId ).output
				: this._getChanInput( chanId );

		node.disconnect();
		node.connect( dest );
	}
}

gswaEffects.fxsMap = new Map();
Object.freeze( gswaEffects );
