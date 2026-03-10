import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

type AudioQuality = "12kbps" | "48kbps" | "96kbps" | "160kbps" | "320kbps";
type AppTheme = "light" | "dark" | "system";

interface SettingsState {
    audioQuality: AudioQuality;
    theme: AppTheme;
    setAudioQuality: (quality: AudioQuality) => void;
    setTheme: (theme: AppTheme) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            audioQuality: "320kbps",
            theme: "dark", // Default to dark as requested by Spotify style
            setAudioQuality: (quality) => set({ audioQuality: quality }),
            setTheme: (theme) => set({ theme }),
        }),
        {
            name: "melodix-settings",
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
