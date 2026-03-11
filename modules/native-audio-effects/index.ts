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

export function setEnabled(effect: 'bass' | 'eq' | 'loudness', enabled: boolean) {
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

// No-op for removed native functions
