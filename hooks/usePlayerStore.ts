import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import TrackPlayer, {
    RepeatMode,
    State,
    Track,
    TrackType,
    PitchAlgorithm,
} from "react-native-track-player";
import { create } from "zustand";
import { createJSONStorage, persist } from 'zustand/middleware';
import { jioSaavnService } from "../services/jiosaavn";
import { LrcLine, lyricsService } from "../services/lyrics";
import { sanitizeImageUrl } from "../utils/stringUtils";
import { useSettingsStore } from "./useSettingsStore";

interface PlayerState {
    currentTrack: Track | null;
    isPlaying: boolean;
    shuffle: boolean;
    repeatMode: 'off' | 'track' | 'queue';
    queue: Track[];
    originalQueue: Track[];
    sleepTimer: number | null; // minutes
    remainingTime: number | null; // seconds
    syncedLyrics: LrcLine[] | null;
    plainLyrics: string | null;
    isLoadingLyrics: boolean;
    isRehydrated: boolean;
    setCurrentTrack: (track: Track | null) => void;
    setIsPlaying: (playing: boolean) => void;
    setShuffle: (shuffle: boolean) => void;
    setRepeatMode: (mode: 'off' | 'track' | 'queue') => void;
    playTrack: (trackData: any, queueData?: any[], quality?: keyof typeof qualityMap) => Promise<void>;
    togglePlayback: () => Promise<void>;
    toggleShuffle: () => void;
    nextRepeatMode: () => void;
    addToQueue: (track: Track) => Promise<void>;
    removeFromQueue: (trackId: string) => Promise<void>;
    isInQueue: (trackId: string) => boolean;
    setSleepTimer: (minutes: number | null) => void;
    initPlayer: () => Promise<void>;
    loadRecommendations: (songId: string) => Promise<void>;
    isLoadingRecommendations: boolean;
    loadLyrics: (track: Track) => Promise<void>;
}

// Map quality selection to JioSaavn API download link keys
const qualityMap = {
    "12kbps": 0,
    "48kbps": 1,
    "96kbps": 2,
    "160kbps": 3,
    "320kbps": 4,
};

const getTrackUrl = (trackData: any, quality: keyof typeof qualityMap): string => {
    if (!trackData.downloadUrl || !Array.isArray(trackData.downloadUrl) || trackData.downloadUrl.length === 0) {
        return trackData.url;
    }

    // Find the specific quality or fallback to the closest one
    const qualityString = String(quality);
    const target = trackData.downloadUrl.find((d: any) => d.quality === qualityString) ||
        trackData.downloadUrl[trackData.downloadUrl.length - 1];

    if (!target || !target.url) return trackData.url;

    return target.url;
};

// Utility to ensure no null/undefined values reach the OS media session
const cleanMetadata = (val: any, fallback: string | undefined): string | undefined => {
    if (val === null || val === undefined || val === "null" || val === "undefined") return fallback;
    const str = String(val).trim();
    if (str === "" || str === "[object Object]") return fallback;
    return str;
};

let timerInterval: NodeJS.Timeout | null = null;

export const usePlayerStore = create<PlayerState>()(
    persist(
        (set, get) => ({
            currentTrack: null,
            isPlaying: false,
            shuffle: false,
            repeatMode: 'off',
            queue: [],
            originalQueue: [],
            sleepTimer: null,
            remainingTime: null,
            isLoadingRecommendations: false,
            syncedLyrics: null,
            plainLyrics: null,
            isLoadingLyrics: false,
            isRehydrated: false,
            setCurrentTrack: (track) => set({ currentTrack: track }),
            setIsPlaying: (playing) => set({ isPlaying: playing }),
            setShuffle: (shuffle) => set({ shuffle }),
            setRepeatMode: (mode) => {
                set({ repeatMode: mode });
                if (mode === 'track') TrackPlayer.setRepeatMode(RepeatMode.Track);
                else if (mode === 'queue') TrackPlayer.setRepeatMode(RepeatMode.Queue);
                else TrackPlayer.setRepeatMode(RepeatMode.Off);
            },

            playTrack: async (trackData: any, queueData: any[] = [], quality?: keyof typeof qualityMap) => {
                const selectedQuality = quality || useSettingsStore.getState().audioQuality;
                const { shuffle } = get();
                const { downloadedSongs } = require('./useLibraryStore').useLibraryStore.getState();

                // Haptic feedback for interaction
                try {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch (e) { }

                // Check for local version of the track
                const downloadedTrack = downloadedSongs.find((s: any) => s.id === String(trackData.id));
                const isOffline = !(await jioSaavnService.checkConnection());

                let trackUrl = getTrackUrl(trackData, selectedQuality);
                console.log(`[Player]: Loading track with quality: ${selectedQuality}`);

                // If we have a local copy, prioritize it
                if (downloadedTrack?.localUri) {
                    if (isOffline) {
                        // Always use local URI if offline and present
                        trackUrl = downloadedTrack.localUri;
                    } else {
                        try {
                            const fileInfo = await FileSystem.getInfoAsync(downloadedTrack.localUri);
                            if (fileInfo.exists) {
                                trackUrl = downloadedTrack.localUri;
                            } else {
                                console.warn(`[Player]: Local file missing, falling back to network`);
                                require('./useLibraryStore').useLibraryStore.getState().syncDownloadedSongs();
                            }
                        } catch (e) {
                            console.error("[Player]: Error verifying local file", e);
                            trackUrl = downloadedTrack.localUri; // Fallback to trying it anyway
                        }
                    }
                } else if (isOffline && !trackUrl?.startsWith('file://')) {
                    console.warn(`[Player]: Offline and no local file found for ${trackData.name}`);
                }

                set({ syncedLyrics: null, plainLyrics: null, isLoadingLyrics: false });

                const trackToPlay: Track = {
                    id: String(trackData.id),
                    url: trackUrl,
                    title: cleanMetadata(trackData.name || trackData.title, "Unknown Track"),
                    artist: cleanMetadata(trackData.artists?.primary?.[0]?.name || trackData.artist, "Unknown Artist"),
                    artwork: cleanMetadata(
                        sanitizeImageUrl(trackData.image || trackData.artwork),
                        undefined
                    ),
                    album: cleanMetadata(trackData.album?.name || trackData.album, "Single"),
                    description: cleanMetadata(trackData.name || trackData.title, "Unknown Track"),
                    genre: cleanMetadata(trackData.language, "Music"),
                    ...(Number(trackData.duration) > 0 ? { duration: Number(trackData.duration) } : {}),
                    isLiveStream: false,
                    // @ts-ignore
                    originalDownloadUrl: trackData.downloadUrl,
                    // @ts-ignore
                    originalUrl: trackData.url
                };

                let queueToPlay: Track[] = queueData.map(item => {
                    const localItem = downloadedSongs.find((s: any) => s.id === String(item.id));
                    return {
                        id: String(item.id),
                        url: localItem?.localUri || getTrackUrl(item, selectedQuality),
                        title: cleanMetadata(item.name || item.title, "Unknown Track"),
                        artist: cleanMetadata(item.artists?.primary?.[0]?.name || item.artist, "Unknown Artist"),
                        artwork: cleanMetadata(
                            sanitizeImageUrl(item.image || item.artwork),
                            undefined
                        ),
                        album: cleanMetadata(item.album?.name || item.album, "Single"),
                        description: cleanMetadata(item.name || item.title, "Unknown Track"),
                        genre: cleanMetadata(item.language, "Music"),
                        ...(Number(item.duration) > 0 ? { duration: Number(item.duration) } : {}),
                        isLiveStream: false,
                        // @ts-ignore - Custom property to store remote metadata
                        originalDownloadUrl: item.downloadUrl,
                        // @ts-ignore - Custom property to store remote metadata
                        originalUrl: item.url
                    };
                });

                set({ originalQueue: [...queueToPlay], queue: [...queueToPlay] });

                if (shuffle) {
                    queueToPlay = [...queueToPlay].sort(() => Math.random() - 0.5);
                }

                await TrackPlayer.reset();
                if (queueToPlay.length > 0) {
                    await TrackPlayer.add(queueToPlay);
                    const index = queueToPlay.findIndex(t => t.id === trackToPlay.id);
                    if (index !== -1) {
                        await TrackPlayer.skip(index);
                    }
                } else {
                    await TrackPlayer.add([trackToPlay]);
                }
                await TrackPlayer.play();
                set({ currentTrack: trackToPlay, isPlaying: true });

                // Vibe Match: Automatically add recommendations to queue
                try {
                    const isConnected = await jioSaavnService.checkConnection();
                    if (isConnected) {
                        const recommendations = await jioSaavnService.getRecommendations(trackData.id);

                        if (recommendations && recommendations.length > 0) {
                            const existingIds = new Set(queueToPlay.map(t => t.id));
                            const recommendedTracks: Track[] = recommendations
                                .filter((item: any) => !existingIds.has(item.id))
                                .map((item: any) => ({
                                    id: String(item.id),
                                    url: getTrackUrl(item, selectedQuality),
                                    title: cleanMetadata(item.name || item.title, "Unknown Track"),
                                    artist: cleanMetadata(item.artists?.primary?.[0]?.name || item.artist, "Unknown Artist"),
                                    artwork: cleanMetadata(
                                        sanitizeImageUrl(item.image || item.artwork),
                                        undefined
                                    ),
                                    album: cleanMetadata(item.album?.name || item.album, "Single"),
                                    description: cleanMetadata(item.name || item.title, "Unknown Track"),
                                    genre: cleanMetadata(item.language, "Music"),
                                    ...(Number(item.duration) > 0 ? { duration: Number(item.duration) } : {}),
                                    isLiveStream: false,
                                    // @ts-ignore
                                    originalDownloadUrl: item.downloadUrl,
                                    // @ts-ignore
                                    originalUrl: item.url
                                }));

                            if (recommendedTracks.length > 0) {
                                await TrackPlayer.add(recommendedTracks);
                                set((state) => ({
                                    queue: [...state.queue, ...recommendedTracks],
                                    originalQueue: [...state.originalQueue, ...recommendedTracks]
                                }));
                            }
                        }
                    }
                } catch (e) {
                    console.error("Vibe Match failed:", e);
                }

                // Track history for smart recommendations
                try {
                    const { useHistoryStore } = require("./useHistoryStore");
                    useHistoryStore.getState().addTrackToHistory(trackData);
                } catch (e) {
                    console.error("History tracking failed:", e);
                }
            },

            toggleShuffle: async () => {
                const { shuffle, queue, originalQueue, currentTrack } = get();
                try {
                    await Haptics.selectionAsync();
                } catch (e) { }
                const newShuffle = !shuffle;
                set({ shuffle: newShuffle });

                if (newShuffle) {
                    // Reorder remaining queue
                    const currentIndex = await TrackPlayer.getActiveTrackIndex();
                    const currentQueue = await TrackPlayer.getQueue();

                    const before = currentQueue.slice(0, (currentIndex || 0) + 1);
                    const after = currentQueue.slice((currentIndex || 0) + 1);

                    // Shuffle only the upcoming tracks
                    const shuffledAfter = [...after].sort(() => Math.random() - 0.5);

                    await TrackPlayer.removeUpcomingTracks();
                    if (shuffledAfter.length > 0) {
                        await TrackPlayer.add(shuffledAfter);
                    }

                    set({ queue: [...before, ...shuffledAfter] });
                } else {
                    // Revert to original order for upcoming tracks
                    const currentIndex = await TrackPlayer.getActiveTrackIndex() || 0;
                    const playingId = currentTrack?.id;

                    const originalIdx = originalQueue.findIndex(t => t.id === playingId);
                    if (originalIdx !== -1) {
                        const nextInOriginal = originalQueue.slice(originalIdx + 1);
                        await TrackPlayer.removeUpcomingTracks();
                        if (nextInOriginal.length > 0) {
                            await TrackPlayer.add(nextInOriginal);
                        }

                        const currentShown = queue.slice(0, currentIndex + 1);
                        set({ queue: [...currentShown, ...nextInOriginal] });
                    }
                }
            },

            nextRepeatMode: () => {
                const { repeatMode } = get();
                try {
                    Haptics.selectionAsync();
                } catch (e) { }
                const modes: ('off' | 'track' | 'queue')[] = ['off', 'track', 'queue'];
                const nextIdx = (modes.indexOf(repeatMode) + 1) % modes.length;
                const nextMode = modes[nextIdx];
                get().setRepeatMode(nextMode);
            },

            togglePlayback: async () => {
                const state = await TrackPlayer.getState();
                try {
                    await Haptics.selectionAsync();
                } catch (e) { }
                if (state === State.Playing) {
                    await TrackPlayer.pause();
                    set({ isPlaying: false });
                } else {
                    await TrackPlayer.play();
                    set({ isPlaying: true });
                }
            },

            addToQueue: async (track: Track) => {
                const { queue } = get();
                const currentIndex = await TrackPlayer.getActiveTrackIndex();
                const insertIndex = currentIndex !== undefined ? currentIndex + 1 : queue.length;

                await TrackPlayer.add(track, insertIndex);

                const newQueue = [...queue];
                newQueue.splice(insertIndex, 0, track);
                set({ queue: newQueue, originalQueue: [...get().originalQueue, track] });
            },

            removeFromQueue: async (trackId: string) => {
                const { queue, currentTrack } = get();
                const index = queue.findIndex(t => t.id === trackId);
                if (index !== -1) {
                    if (currentTrack?.id === trackId) {
                        await TrackPlayer.skipToNext();
                    }
                    await TrackPlayer.remove(index);
                    const newQueue = queue.filter(t => t.id !== trackId);
                    set({ queue: newQueue, originalQueue: get().originalQueue.filter(t => t.id !== trackId) });
                }
            },

            isInQueue: (trackId: string) => {
                return get().queue.some(t => t.id === trackId);
            },

            setSleepTimer: (minutes: number | null) => {
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }

                if (minutes === null) {
                    set({ sleepTimer: null, remainingTime: null });
                    return;
                }

                const totalSeconds = minutes * 60;
                set({ sleepTimer: minutes, remainingTime: totalSeconds });

                // Use a more robust interval that checks the store state
                timerInterval = setInterval(() => {
                    const state = usePlayerStore.getState();
                    const { remainingTime, isPlaying } = state;

                    if (remainingTime !== null && remainingTime > 0) {
                        set({ remainingTime: remainingTime - 1 });
                    } else {
                        if (timerInterval) {
                            clearInterval(timerInterval);
                            timerInterval = null;
                        }

                        if (isPlaying) {
                            TrackPlayer.pause();
                            set({ isPlaying: false });
                        }
                        set({ sleepTimer: null, remainingTime: null });

                        try {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch (e) { }
                    }
                }, 1000);
            },

            initPlayer: async () => {
                const { currentTrack, queue } = get();
                if (!currentTrack) return;

                try {
                    const state = await TrackPlayer.getState();
                } catch (e) {
                    console.log("[Player]: TrackPlayer setup not ready during init");
                    return;
                }

                // If not rehydrated yet, wait or return
                if (!get().isRehydrated) {
                    console.log("[Player]: Waiting for store rehydration...");
                    return;
                }

                const playerQueue = await TrackPlayer.getQueue();
                if (playerQueue.length === 0 && queue.length > 0) {
                    await TrackPlayer.add(queue);
                    const index = queue.findIndex(t => t.id === currentTrack.id);
                    if (index !== -1) {
                        await TrackPlayer.skip(index);
                    }
                    // Explicitly pause and ensure isPlaying is false
                    await TrackPlayer.pause();
                    set({ isPlaying: false });
                }

                // Load lyrics for the restored track on restart
                if (currentTrack) {
                    get().loadLyrics(currentTrack);
                }
            },

            loadRecommendations: async (songId: string) => {
                const { queue, isLoadingRecommendations } = get();
                if (isLoadingRecommendations) return;

                set({ isLoadingRecommendations: true });
                try {
                    const recommendations = await jioSaavnService.getRecommendations(songId);
                    if (recommendations && recommendations.length > 0) {
                        const existingIds = new Set(get().queue.map(t => t.id));
                        const recommendedTracks: Track[] = recommendations
                            .filter((item: any) => !existingIds.has(String(item.id)))
                            .map((item: any) => ({
                                id: String(item.id),
                                url: getTrackUrl(item, useSettingsStore.getState().audioQuality),
                                title: cleanMetadata(item.name || item.title, "Unknown Track"),
                                artist: cleanMetadata(item.artists?.primary?.[0]?.name || item.artist, "Unknown Artist"),
                                artwork: cleanMetadata(
                                    sanitizeImageUrl(item.image || item.artwork),
                                    undefined
                                ),
                                album: cleanMetadata(item.album?.name || item.album, "Single"),
                                description: cleanMetadata(item.name || item.title, "Unknown Track"),
                                genre: cleanMetadata(item.language, "Music"),
                                ...(Number(item.duration) > 0 ? { duration: Number(item.duration) } : {}),
                                isLiveStream: false,
                                // @ts-ignore
                                originalDownloadUrl: item.downloadUrl,
                                // @ts-ignore
                                originalUrl: item.url
                            }));

                        if (recommendedTracks.length > 0) {
                            await TrackPlayer.add(recommendedTracks);
                            set((state) => ({
                                queue: [...state.queue, ...recommendedTracks],
                                originalQueue: [...state.originalQueue, ...recommendedTracks]
                            }));
                        }
                    }
                } catch (e) {
                    console.error("Failed to load recommendations:", e);
                } finally {
                    set({ isLoadingRecommendations: false });
                }
            },

            loadLyrics: async (track: Track) => {
                if (!track) return;
                
                const { isLoadingLyrics, syncedLyrics, currentTrack } = get();
                
                // If we already have synced lyrics for this exact track ID, skip
                if (syncedLyrics && syncedLyrics.length > 0 && currentTrack?.id === track.id) {
                    return;
                }
                
                set({ isLoadingLyrics: true });
                try {
                    const { synced, plain } = await lyricsService.getSyncedLyrics(track);
                    // Use JioSaavn as fallback for plain text if LrcLib didn't provide any
                    const fallbackPlain = plain || await jioSaavnService.getLyrics(track.id);
                    set({ syncedLyrics: synced, plainLyrics: fallbackPlain });
                } catch (e) {
                    console.error("[Player]: Failed to load lyrics:", e);
                } finally {
                    set({ isLoadingLyrics: false });
                }
            },
        }),
        {
            name: 'player-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                currentTrack: state.currentTrack,
                queue: state.queue,
                originalQueue: state.originalQueue,
                shuffle: state.shuffle,
                repeatMode: state.repeatMode,
            }),
            onRehydrateStorage: (state) => {
                return (rehydratedState, error) => {
                    if (!error && rehydratedState) {
                        usePlayerStore.setState({ isRehydrated: true });
                        // Re-trigger initPlayer to restore session once data is ready
                        rehydratedState.initPlayer();
                    }
                };
            },
        }
    )
);
