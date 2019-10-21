"use strict";

class gswaFxFilter {
	constructor() {
		this.ctx =
		this.input =
		this.output =
		this._filter =
		this.responseHzIn =
		this.responseMagOut =
		this.responsePhaseOut = null;
		this._respSize = -1;
		this._enable = false;
		this.gsdata = new GSDataFxFilter( {
			dataCallbacks: {
				changeType: this._changeType.bind( this ),
				changeQ: this._changeProp.bind( this, "Q" ),
				changeGain: this._changeProp.bind( this, "gain" ),
				changeDetune: this._changeProp.bind( this, "detune" ),
				changeFrequency: this._changeProp.bind( this, "frequency" ),
			},
		} );
		Object.seal( this );
	}

	// .........................................................................
	setContext( ctx ) {
		if ( this.ctx ) {
			this.input.disconnect();
			this.output.disconnect();
			this._filter.disconnect();
		}
		this.ctx = ctx;
		this.input = ctx.createGain();
		this.output = ctx.createGain();
		this._filter = ctx.createBiquadFilter();
		this.gsdata.recall();
		this.toggle( this._enable );
	}
	toggle( b ) {
		this._enable = b;
		if ( this.ctx ) {
			if ( b ) {
				this.input.disconnect();
				this.input.connect( this._filter );
				this._filter.connect( this.output );
			} else {
				this._filter.disconnect();
				this.input.connect( this.output );
			}
		}
	}
	change( obj ) {
		this.gsdata.change( obj );
	}
	liveChange( prop, val ) {
		this._changeProp( prop, val );
	}
	clear() {
		this.gsdata.clear();
		this._respSize = -1;
		this.responseHzIn =
		this.responseMagOut =
		this.responsePhaseOut = null;
	}
	updateResponse( size ) {
		this._createResponseArrays( size );
		this._filter.getFrequencyResponse(
			this.responseHzIn,
			this.responseMagOut,
			this.responsePhaseOut );
		return this.responseMagOut;
	}

	// .........................................................................
	_changeType( type ) {
		this._filter.type = type;
	}
	_changeProp( prop, val ) {
		this._filter[ prop ].setValueAtTime( val, this.ctx.currentTime );
	}
	_createResponseArrays( w ) {
		if ( w !== this._respSize ) {
			const nyquist = this.ctx.sampleRate / 2,
				Hz = new Float32Array( w );

			this._respSize = w;
			this.responseHzIn = Hz;
			this.responseMagOut = new Float32Array( w );
			this.responsePhaseOut = new Float32Array( w );
			for ( let i = 0; i < w; ++i ) {
				Hz[ i ] = nyquist * Math.pow( 2, 11 * ( i / w - 1 ) );
			}
		}
	}
}

Object.freeze( gswaFxFilter );

if ( typeof gswaEffects !== "undefined" ) {
	gswaEffects.fxsMap.set( "filter", gswaFxFilter );
}
