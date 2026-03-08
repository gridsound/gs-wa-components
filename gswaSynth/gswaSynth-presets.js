"use strict";

const gswaSynth_presets = ( function() {
	const def = GSUgetModel( "synth" );

	return GSUdeepFreeze( [
		{
			preset: "electric-1",
			octave: 4,
			envs: {
				gain: { toggle: true, attack: .02, hold: 0, decay: .08, sustain: 1, release: .19 },
				detune: { toggle: true, amp: 24, attack: 0, hold: 0, decay: .15, sustain: 0, release: .1 },
				lowpass: def.envs.lowpass,
			},
			lfos: def.lfos,
			noise: def.noise,
			oscillators: {
				0: { order: 0, wave: "square", wavetable: null, source: null, phaze: 0, pan: 0, gain: 1, detune: 0, detunefine: 0, unisonvoices: 3, unisondetune: .02, unisonblend: 1 },
				1: { order: 1, wave: "sine", wavetable: null, source: null, phaze: 0, pan: 0, gain: 1, detune: -24, detunefine: 0, unisonvoices: 3, unisondetune: .01, unisonblend: 1 },
			},
		}, {
			preset: "bass-1",
			octave: 2,
			envs: {
				gain: { toggle: true, attack: .04, hold: 0, decay: .08, sustain: .75, release: .06 },
				detune: def.envs.detune,
				lowpass: def.envs.lowpass,
			},
			lfos: def.lfos,
			noise: def.noise,
			oscillators: {
				0: { order: 0, wave: "sawtooth", wavetable: null, source: null, phaze: 0, pan: 0, gain: .55, detune: 0, detunefine: 0, unisonvoices: 1, unisondetune: .2, unisonblend: .33 },
				1: { order: 1, wave: "sine", wavetable: null, source: null, phaze: 0, pan: 0, gain: 1, detune: 0, detunefine: 0, unisonvoices: 1, unisondetune: .2, unisonblend: .33 },
			},
		}, {
			preset: "sawtooth-lfo",
			octave: 4,
			envs: {
				gain: { toggle: true, attack: .02, hold: 0, decay: .08, sustain: .75, release: .25 },
				detune: def.envs.detune,
				lowpass: def.envs.lowpass,
			},
			lfos: {
				gain: { toggle: true, type: "sawtooth", delay: .125, attack: 0, speed: 4, amp: -.75 },
				detune: def.lfos.detune,
			},
			noise: { toggle: true, color: "white", gain: .02, pan: 0 },
			oscillators: {
				0: { order: 0, wave: "sawtooth", wavetable: null, source: null, phaze: 0, pan: 0, gain: .75, detune: 0, detunefine: 0, unisonvoices: 2, unisondetune: .2, unisonblend: .33 },
				1: { order: 1, wave: "sine", wavetable: null, source: null, phaze: 0, pan: 0, gain: .35, detune: -24, detunefine: 0, unisonvoices: 1, unisondetune: .2, unisonblend: .33 },
			},
		}, {
			preset: "kick-1",
			octave: 2,
			envs: {
				gain: { toggle: true, attack: 0, hold: 0, decay: .25, sustain: 0, release: .46 },
				detune: { toggle: true, amp: 24, attack: 0, hold: 0, decay: .09, sustain: 0, release: .1 },
				lowpass: def.envs.lowpass,
			},
			lfos: def.lfos,
			noise: def.noise,
			oscillators: {
				0: { order: 0, wave: "sine", wavetable: null, source: null, phaze: 0, pan: 0, gain: 1, detune: 0, detunefine: 0, unisonvoices: 1, unisondetune: .05, unisonblend: .33 },
			},
		}, {
			preset: "hit-1",
			octave: 4,
			envs: {
				gain: { toggle: true, attack: 0, hold: 0, decay: .07, sustain: 0, release: 0 },
				detune: def.envs.detune,
				lowpass: def.envs.lowpass,
			},
			lfos: def.lfos,
			noise: { toggle: true, color: "white", gain: .25, pan: 0 },
			oscillators: {},
		},
	] );
} )();
