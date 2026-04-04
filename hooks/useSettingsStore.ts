import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

type AudioQuality = "12kbps" | "48kbps" | "96kbps" | "160kbps" | "320kbps";
type AppTheme = "light" | "dark" | "system";

interface SettingsState {
    audioQuality: AudioQuality;
    theme: AppTheme;
    // Audio Enhancements
    bassBoostStrength: number;
    eqGains: number[]; // 5 bands
    loudnessGain: number;
    isBassBoostEnabled: boolean;
    isEqEnabled: boolean;
    isLoudnessEnabled: boolean;
    crossfadeEnabled: boolean;
    crossfadeDuration: number; // 0-10 seconds

    setAudioQuality: (quality: AudioQuality) => void;
    setTheme: (theme: AppTheme) => void;
    setBassBoostStrength: (strength: number) => void;
    setEqGain: (bandIndex: number, gain: number) => void;
    setLoudnessGain: (gain: number) => void;
    setBassBoostEnabled: (enabled: boolean) => void;
    setEqEnabled: (enabled: boolean) => void;
    setLoudnessEnabled: (enabled: boolean) => void;
    setCrossfadeEnabled: (enabled: boolean) => void;
    setCrossfadeDuration: (duration: number) => void;
    resetAudioEffects: () => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            audioQuality: "320kbps",
            theme: "dark", 
            bassBoostStrength: 0,
            eqGains: [0, 0, 0, 0, 0],
            loudnessGain: 0,
            isBassBoostEnabled: false,
            isEqEnabled: false,
            isLoudnessEnabled: false,
            crossfadeEnabled: true,
            crossfadeDuration: 3,

            setAudioQuality: (quality) => set({ audioQuality: quality }),
            setTheme: (theme) => set({ theme }),
            setBassBoostStrength: (strength) => set({ bassBoostStrength: strength }),
            setEqGain: (bandIndex, gain) => set((state) => {
                const newGains = [...state.eqGains];
                newGains[bandIndex] = gain;
                return { eqGains: newGains };
            }),
            setLoudnessGain: (gain) => set({ loudnessGain: gain }),
            setBassBoostEnabled: (enabled) => set({ isBassBoostEnabled: enabled }),
            setEqEnabled: (enabled) => set({ isEqEnabled: enabled }),
            setLoudnessEnabled: (enabled) => set({ isLoudnessEnabled: enabled }),
            setCrossfadeEnabled: (enabled) => set({ crossfadeEnabled: enabled }),
            setCrossfadeDuration: (duration) => set({ crossfadeDuration: duration }),

            resetAudioEffects: () => set({
                bassBoostStrength: 0,
                eqGains: [0, 0, 0, 0, 0],
                loudnessGain: 0,
                isBassBoostEnabled: false,
                isEqEnabled: false,
                isLoudnessEnabled: false,
                crossfadeEnabled: true,
                crossfadeDuration: 3,
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
                loudnessGain: state.loudnessGain,
                crossfadeEnabled: state.crossfadeEnabled,
                crossfadeDuration: state.crossfadeDuration,
                isBassBoostEnabled: state.isBassBoostEnabled,
                isEqEnabled: state.isEqEnabled,
                isLoudnessEnabled: state.isLoudnessEnabled,
            }),
        }
    )
);
