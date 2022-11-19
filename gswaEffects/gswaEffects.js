"use strict";

class gswaEffects {
	ctx = null;
	#wafxs = new Map();
	#getChanInput = null;
	#getChanOutput = null;
	#ctrl = new DAWCoreControllers.effects( {
		dataCallbacks: {
			changeBPM: bpm => this.#wafxs.forEach( fx => fx.setBPM && fx.setBPM( bpm ) ),
			addEffect: this.#addEffect.bind( this ),
			removeEffect: this.#removeEffect.bind( this ),
			changeEffect: this.#changeEffect.bind( this ),
			connectEffectTo: this.#connectEffectTo.bind( this ),
			changeEffectData: ( id, data ) => this.$getFx( id ).$change( data ),
		},
	} );

	constructor( fns ) {
		Object.seal( this );
		this.#getChanInput = fns.getChanInput;
		this.#getChanOutput = fns.getChanOutput;
	}

	// .........................................................................
	$getFx( id ) {
		return this.#wafxs.get( id );
	}
	$setContext( ctx ) {
		this.ctx = ctx;
		this.#ctrl.reset();
	}
	$change( obj ) {
		this.#ctrl.change( obj );
	}
	$clear() {
		this.#ctrl.clear();
	}
	$liveChangeFxProp( id, prop, val ) {
		this.$getFx( id ).$liveChange( prop, val );
	}

	// .........................................................................
	#addEffect( id, fx ) {
		const wafx = gswaEffects.#addEffectCreate( fx.type );

		this.#wafxs.set( id, wafx );
		wafx.$setContext( this.ctx );
		wafx.$change( DAWCoreJSON.effects[ fx.type ]() );
	}
	static #addEffectCreate( fx ) {
		switch ( fx ) {
			// case "delay": return new gswaFxDelay();
			case "filter": return new gswaFxFilter();
		}
	}
	#removeEffect( id ) {
		this.$getFx( id ).$getOutput().disconnect();
		this.#wafxs.delete( id );
	}
	#changeEffect( id, prop, val ) {
		if ( prop === "toggle" ) {
			this.$getFx( id ).$toggle( val );
		}
	}
	#connectEffectTo( chanId, fxId, nextFxId ) {
		const dest = nextFxId
			? this.$getFx( nextFxId ).$getInput()
			: this.#getChanOutput( chanId );
		const node = fxId
			? this.$getFx( fxId ).$getOutput()
			: this.#getChanInput( chanId );

		if ( node ) {
			node.disconnect();
			node.connect( dest );
		}
	}
}

Object.freeze( gswaEffects );
