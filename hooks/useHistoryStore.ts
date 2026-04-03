import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface HistoryState {
    recentKeywords: string[];
    recentlyPlayedTracks: any[];
    recentlyPlayedItems: any[];
    searchHistory: string[];
    languagePreferences: Record<string, number>;
    getPreferredLanguages: () => string;
    addTrackToHistory: (track: any) => void;
    addItemToHistory: (item: any) => void;
    addSearchQuery: (query: string) => void;
    removeSearchQuery: (query: string) => void;
    clearSearchHistory: () => void;
    removeTrackFromHistory: (trackId: string) => void;
    removeItemFromHistory: (itemId: string) => void;
    clearRecentlyPlayed: () => void;
}

export const useHistoryStore = create<HistoryState>()(
    persist(
        (set, get) => ({
            recentKeywords: [],
            recentlyPlayedTracks: [], // Keeping for backward compatibility
            recentlyPlayedItems: [],
            searchHistory: [],
            languagePreferences: {},
            getPreferredLanguages: () => {
                const { languagePreferences } = get();
                // Filter out falsy/undefined keys and empty strings
                const validLangs = Object.entries(languagePreferences).filter(([k]) => k && k.trim() !== '' && k !== 'undefined');
                const sortedLangs = validLangs
                    .sort(([, countA], [, countB]) => countB - countA)
                    .map(([lang]) => lang);
                const defaults = ['telugu', 'hindi', 'english'];
                return Array.from(new Set([...sortedLangs, ...defaults])).join(',');
            },
            addTrackToHistory: (track) => {
                get().addItemToHistory(track);
            },
            addItemToHistory: (item) => {
                if (!item || !item.id) return;
                const { recentKeywords, recentlyPlayedItems } = get();
                const keyword = item.artist || item.artists?.primary?.[0]?.name;

                const itemWithTimestamp = { ...item, playedAt: Date.now() };

                // Combined History (Tracks + Playlists/Albums)
                const newItems = [itemWithTimestamp, ...recentlyPlayedItems.filter(i => i.id !== item.id)].slice(0, 20);

                // Keyword History
                let newKeywords = recentKeywords;
                if (keyword) {
                    newKeywords = [keyword, ...recentKeywords.filter(k => k !== keyword)].slice(0, 5);
                }

                // Language Preferences
                const newLanguagePreferences = { ...(get().languagePreferences || {}) };
                if (item.language) {
                    const lang = item.language.toLowerCase().trim();
                    if (lang) {
                        newLanguagePreferences[lang] = (newLanguagePreferences[lang] || 0) + 1;
                    }
                }

                set({
                    recentlyPlayedItems: newItems,
                    recentKeywords: newKeywords,
                    languagePreferences: newLanguagePreferences,
                    // Also sync back to recentlyPlayedTracks for existing UI that still uses it
                    recentlyPlayedTracks: newItems.filter(i => i.type === 'song' || !i.type).slice(0, 10)
                });
            },
            addSearchQuery: (query) => {
                if (!query || query.trim().length === 0) return;
                const { searchHistory } = get();
                const trimmedQuery = query.trim();
                const newHistory = [trimmedQuery, ...searchHistory.filter(q => q !== trimmedQuery)].slice(0, 15);
                set({ searchHistory: newHistory });
            },
            removeSearchQuery: (query) => {
                const { searchHistory } = get();
                set({ searchHistory: searchHistory.filter(q => q !== query) });
            },
            clearSearchHistory: () => {
                set({ searchHistory: [] });
            },
            removeTrackFromHistory: (trackId) => {
                get().removeItemFromHistory(trackId);
            },
            removeItemFromHistory: (itemId) => {
                const { recentlyPlayedItems } = get();
                const newItems = recentlyPlayedItems.filter(i => i.id !== itemId);
                set({
                    recentlyPlayedItems: newItems,
                    recentlyPlayedTracks: newItems.filter(i => i.type === 'song' || !i.type).slice(0, 10)
                });
            },
            clearRecentlyPlayed: () => {
                set({ recentlyPlayedItems: [], recentlyPlayedTracks: [] });
            },
        }),
        {
            name: "melodix-history",
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
