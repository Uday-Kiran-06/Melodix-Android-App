import { requireNativeModule } from 'expo-modules-core';

const NativeAudioEffectsModule = requireNativeModule('NativeAudioEffects');

export function setBassBoost(strength: number) {
  return NativeAudioEffectsModule.setBassBoost(strength);
}

export function setEqualizerBandGain(bandIndex: number, gain: number) {
  return NativeAudioEffectsModule.setEqualizerBandGain(bandIndex, gain);
}

export function setLoudnessGain(gain: number) {
  return NativeAudioEffectsModule.setLoudnessGain(gain);
}

export function setVirtualizerStrength(strength: number) {
  return NativeAudioEffectsModule.setVirtualizerStrength(strength);
}

export function setEnabled(effect: 'bass' | 'eq' | 'loudness' | 'virtualizer', enabled: boolean) {
  return NativeAudioEffectsModule.setEnabled(effect, enabled);
}

export function setAudioSessionId(sessionId: number) {
  return NativeAudioEffectsModule.setAudioSessionId(sessionId);
}

export function scanForSession() {
  return NativeAudioEffectsModule.scanForSession();
}

export function getEqualizerBands() {
  return NativeAudioEffectsModule.getEqualizerBands();
}

export function isVirtualizerSupported(): boolean {
  return NativeAudioEffectsModule.isVirtualizerSupported();
}

// ─── EQ Presets ─────────────────────────────────────────────────────────────
// Each preset is 5 values in millibels (mB) for bands: 60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz
// Range: -1500 to +1500 mB

export type EqPresetName =
  | 'balanced'
  | 'flat'
  | 'pop'
  | 'rock'
  | 'hiphop'
  | 'jazz'
  | 'classical'
  | 'bass_booster'
  | 'treble_booster'
  | 'vocal_booster'
  | 'acoustic'
  | 'electronic'
  | 'podcast';

export const EQ_PRESETS: Record<EqPresetName, { label: string; gains: number[] }> = {
  // Balanced: gentle smile curve — auto-applied by default (Spotify-like)
  balanced:       { label: 'Balanced ✦',    gains: [200,  100,  -100, 100,  200 ] },
  flat:           { label: 'Flat',           gains: [0,    0,    0,    0,    0   ] },
  pop:            { label: 'Pop',            gains: [-100, 200,  400,  200,  -100] },
  rock:           { label: 'Rock',           gains: [400,  100,  -100, 200,  400 ] },
  hiphop:         { label: 'Hip-Hop',        gains: [500,  300,  0,    -100, -200] },
  jazz:           { label: 'Jazz',           gains: [200,  -100, 200,  100,  300 ] },
  classical:      { label: 'Classical',      gains: [300,  100,  -100, 200,  300 ] },
  bass_booster:   { label: 'Bass Booster',   gains: [600,  400,  0,    0,    0   ] },
  treble_booster: { label: 'Treble Booster', gains: [0,    0,    0,    400,  600 ] },
  vocal_booster:  { label: 'Vocal Booster',  gains: [-200, 0,    400,  300,  -100] },
  acoustic:       { label: 'Acoustic',       gains: [400,  200,  0,    200,  300 ] },
  electronic:     { label: 'Electronic',     gains: [400,  200,  -100, 300,  400 ] },
  podcast:        { label: 'Podcast',        gains: [-300, -100, 400,  200,  -200] },
};
