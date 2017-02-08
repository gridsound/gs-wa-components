"use strict";

gswaComposition.prototype.render = function() {
	var currCtx,
		offCtx,
		loopWhen,
		loopDuration,
		that = this,
		dur = this.duration;

	if ( dur ) {
		this.stop();
		if ( this.isLooping ) {
			loopWhen = this.loopWhen;
			loopDuration = this.loopDuration;
		}
		currCtx = this.wCtx.ctx;
		offCtx = this.wCtx.ctx = new OfflineAudioContext( 2, dur * 44100, 44100 );
		this.samples.forEach( function( smp ) {
			smp.stop();
			smp.connect( offCtx.destination );
		} );
		this.currentTime( 0 );
		if ( loopDuration ) {
			this.loop( false );
		}
		this.play();

		return offCtx.startRendering().then( function( cmpBuf ) {
			var data = new DataView( gswaEncodeWAV( cmpBuf ) ),
				blob = new Blob( [ data ], {
					type: "audio/wav"
				} );

			that.wCtx.ctx = currCtx;
			that.samples.forEach( function( smp ) {
				smp.stop();
				smp.connect( currCtx.destination );
			} );
			if ( loopDuration ) {
				that.loop( loopWhen, loopDuration );
			}
			return blob;
		} ).catch( function( err ) {
			console.error( "gs-webaudio-library: composition.render() just failed: " + err );
		} );
	}
};
