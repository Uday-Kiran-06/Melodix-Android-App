import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { EqPresetName } from "@/modules/native-audio-effects";

type AudioQuality = "12kbps" | "48kbps" | "96kbps" | "160kbps" | "320kbps";
type AppTheme = "light" | "dark" | "system";

// Bumping this version triggers a one-time re-application of Spotify-like defaults
// for users who had effects disabled. Increment when defaults change significantly.
const AUDIO_CONFIG_VERSION = 1;

// ─── Spotify-like default audio profile ──────────────────────────────────────
// EQ: gentle "smile curve" (slight bass warmth + high-end air, dip in mids)
//     identical to what most mastering engineers call "radio ready" or "polished"
// Loudness: 400mB target gain — matches Spotify's ~-14 LUFS normalization target
// Bass Boost: off (too subjective; user can enable in Audio Lab)
// Virtualizer: off (spatial processing is personal preference)
export const SPOTIFY_LIKE_DEFAULTS = {
    isEqEnabled: true,
    eqGains: [200, 100, -100, 100, 200] as number[], // 60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz
    eqPreset: 'balanced' as EqPresetName,
    isLoudnessEnabled: true,
    loudnessGain: 400,
    isBassBoostEnabled: false,
    bassBoostStrength: 0,
    isVirtualizerEnabled: false,
    virtualizerStrength: 600,
    crossfadeEnabled: true,
    crossfadeDuration: 3,
};

interface SettingsState {
    audioQuality: AudioQuality;
    theme: AppTheme;
    // Audio Enhancements
    bassBoostStrength: number;
    eqGains: number[]; // 5 bands
    eqPreset: EqPresetName;
    loudnessGain: number;
    isBassBoostEnabled: boolean;
    isEqEnabled: boolean;
    isLoudnessEnabled: boolean;
    isVirtualizerEnabled: boolean;
    virtualizerStrength: number;
    crossfadeEnabled: boolean;
    crossfadeDuration: number;
    // Migration flag — ensures Spotify-like defaults are applied once per version
    audioConfigVersion: number;

    setAudioQuality: (quality: AudioQuality) => void;
    setTheme: (theme: AppTheme) => void;
    setBassBoostStrength: (strength: number) => void;
    setEqGain: (bandIndex: number, gain: number) => void;
    setEqGains: (gains: number[]) => void;
    setEqPreset: (preset: EqPresetName) => void;
    setLoudnessGain: (gain: number) => void;
    setBassBoostEnabled: (enabled: boolean) => void;
    setEqEnabled: (enabled: boolean) => void;
    setLoudnessEnabled: (enabled: boolean) => void;
    setVirtualizerEnabled: (enabled: boolean) => void;
    setVirtualizerStrength: (strength: number) => void;
    setCrossfadeEnabled: (enabled: boolean) => void;
    setCrossfadeDuration: (duration: number) => void;
    applySpotifyLikeDefaults: () => void;
    resetAudioEffects: () => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            audioQuality: "320kbps",
            theme: "dark",
            // ── Auto-enabled Spotify-like defaults ──────────────────────────
            ...SPOTIFY_LIKE_DEFAULTS,
            audioConfigVersion: AUDIO_CONFIG_VERSION,

            setAudioQuality: (quality) => set({ audioQuality: quality }),
            setTheme: (theme) => set({ theme }),
            setBassBoostStrength: (strength) => set({ bassBoostStrength: strength }),
            setEqGain: (bandIndex, gain) => set((state) => {
                const newGains = [...state.eqGains];
                newGains[bandIndex] = gain;
                // Mark as custom (no longer a named preset)
                return { eqGains: newGains, eqPreset: 'flat' };
            }),
            setEqGains: (gains) => set({ eqGains: gains }),
            setEqPreset: (preset) => set({ eqPreset: preset }),
            setLoudnessGain: (gain) => set({ loudnessGain: gain }),
            setBassBoostEnabled: (enabled) => set({ isBassBoostEnabled: enabled }),
            setEqEnabled: (enabled) => set({ isEqEnabled: enabled }),
            setLoudnessEnabled: (enabled) => set({ isLoudnessEnabled: enabled }),
            setVirtualizerEnabled: (enabled) => set({ isVirtualizerEnabled: enabled }),
            setVirtualizerStrength: (strength) => set({ virtualizerStrength: strength }),
            setCrossfadeEnabled: (enabled) => set({ crossfadeEnabled: enabled }),
            setCrossfadeDuration: (duration) => set({ crossfadeDuration: duration }),

            // Called once on app startup if audioConfigVersion is outdated
            applySpotifyLikeDefaults: () => set({
                ...SPOTIFY_LIKE_DEFAULTS,
                audioConfigVersion: AUDIO_CONFIG_VERSION,
            }),

            resetAudioEffects: () => set({
                ...SPOTIFY_LIKE_DEFAULTS,
                audioConfigVersion: AUDIO_CONFIG_VERSION,
            }),
        }),
        {
            name: "melodix-settings",
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                audioQuality: state.audioQuality,
                theme: state.theme,
                bassBoostStrength: state.bassBoostStrength,
                eqGains: state.eqGains,
                eqPreset: state.eqPreset,
                loudnessGain: state.loudnessGain,
                crossfadeEnabled: state.crossfadeEnabled,
                crossfadeDuration: state.crossfadeDuration,
                isBassBoostEnabled: state.isBassBoostEnabled,
                isEqEnabled: state.isEqEnabled,
                isLoudnessEnabled: state.isLoudnessEnabled,
                isVirtualizerEnabled: state.isVirtualizerEnabled,
                virtualizerStrength: state.virtualizerStrength,
                audioConfigVersion: state.audioConfigVersion,
            }),
        }
    )
);
