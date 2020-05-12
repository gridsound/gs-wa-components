"use strict";

class gswaEffects {
	constructor( fns ) {
		this.ctx = null;
		this._getChanInput = fns.getChanInput;
		this._getChanOutput = fns.getChanOutput;
		this._wafxs = new Map();
		this.gsdata = new DAWCore.controllers.effects( {
			dataCallbacks: {
				changeBPM: bpm => this._wafxs.forEach( fx => fx.setBPM && fx.setBPM( bpm ) ),
				addEffect: this._addEffect.bind( this ),
				removeEffect: this._removeEffect.bind( this ),
				changeEffect: this._changeEffect.bind( this ),
				connectEffectTo: this._connectEffectTo.bind( this ),
				changeEffectData: ( id, data ) => this._wafxs.get( id ).change( data ),
			},
		} );
		Object.seal( this );
	}

	// .........................................................................
	setContext( ctx ) {
		this.ctx = ctx;
		this.gsdata.reset();
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
	_addEffect( id, fx ) {
		const wafx = new ( gswaEffects.fxsMap.get( fx.type ) )();

		this._wafxs.set( id, wafx );
		wafx.setContext( this.ctx );
	}
	_removeEffect( id ) {
		const wafx = this._wafxs.get( id );

		wafx.output.disconnect();
		this._wafxs.delete( id );
	}
	_changeEffect( id, prop, val ) {
		if ( prop === "toggle" ) {
			this._wafxs.get( id ).toggle( val );
		}
	}
	_connectEffectTo( chanId, fxId, nextFxId ) {
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
