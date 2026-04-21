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
    lastPosition: number; // seconds
    sleepTimerDeadline: number | null;
    setLastPosition: (position: number) => void;
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
    loadRecommendations: (songId: string, isManual?: boolean) => Promise<void>;
    isLoadingRecommendations: boolean;
    loadLyrics: (track: Track) => Promise<void>;
    clearRecommendationHistory: () => void;
    refreshTrackUrl: (trackId: string) => Promise<Track | null>;
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

// Module-level re-entrancy lock — prevents PlaybackActiveTrackChanged and
// PlaybackQueueEnded from triggering simultaneous recommendation loads.
let currentRecommendationPromise: Promise<void> | null = null;
let lastRecommendationTime = 0;
const RECOMMENDATION_DEBOUNCE_MS = 3000;

// Session-level dedup: tracks recommended song IDs so we never re-add the same
// song within a single listening session (cleared on playTrack).
const sessionRecommendedIds = new Set<string>();

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
            lastPosition: 0,
            sleepTimerDeadline: null,
            
            setLastPosition: (position) => set({ lastPosition: position }),

            clearRecommendationHistory: () => {
                sessionRecommendedIds.clear();
                currentRecommendationPromise = null;
                lastRecommendationTime = 0;
            },
            setCurrentTrack: (track) => set({ currentTrack: track }),
            setIsPlaying: (playing) => set({ isPlaying: playing }),
            setShuffle: (shuffle) => set({ shuffle }),
            setRepeatMode: async (mode) => {
                set({ repeatMode: mode });
                try {
                    if (mode === 'track') await TrackPlayer.setRepeatMode(RepeatMode.Track);
                    else if (mode === 'queue') await TrackPlayer.setRepeatMode(RepeatMode.Queue);
                    else await TrackPlayer.setRepeatMode(RepeatMode.Off);
                } catch (e) {
                    console.error("[Player]: Failed to set repeat mode", e);
                }
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
                const isOffline = !(await jioSaavnService.checkConnectivity());

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

                // Re-sync repeat mode after reset, as reset often clears it
                const { repeatMode } = get();
                if (repeatMode === 'track') await TrackPlayer.setRepeatMode(RepeatMode.Track);
                else if (repeatMode === 'queue') await TrackPlayer.setRepeatMode(RepeatMode.Queue);
                else await TrackPlayer.setRepeatMode(RepeatMode.Off);

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

                // Vibe Match: Automatically seed initial recommendations
                // Clear session dedup so a fresh play starts a new rec pool.
                sessionRecommendedIds.clear();
                currentRecommendationPromise = null;

                try {
                    const isConnected = await jioSaavnService.checkConnectivity();
                    if (isConnected) {
                        const recommendations = await jioSaavnService.getRecommendations(trackData.id);

                        if (recommendations && recommendations.length > 0) {
                            const existingIds = new Set(queueToPlay.map(t => t.id));
                            const recommendedTracks: Track[] = recommendations
                                .filter((item: any) => {
                                    const id = String(item.id);
                                    return !existingIds.has(id) && !sessionRecommendedIds.has(id);
                                })
                                .slice(0, 10) // Cap at 10 for the initial seed
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
                                    isRecommended: true,
                                    // @ts-ignore
                                    originalDownloadUrl: item.downloadUrl,
                                    // @ts-ignore
                                    originalUrl: item.url
                                }));

                            if (recommendedTracks.length > 0) {
                                recommendedTracks.forEach(t => sessionRecommendedIds.add(t.id));
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

            nextRepeatMode: async () => {
                const { repeatMode } = get();
                try {
                    await Haptics.selectionAsync();
                } catch (e) { }
                const modes: ('off' | 'track' | 'queue')[] = ['off', 'track', 'queue'];
                const nextIdx = (modes.indexOf(repeatMode) + 1) % modes.length;
                const nextMode = modes[nextIdx];
                await get().setRepeatMode(nextMode);
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
                    set({ sleepTimer: null, remainingTime: null, sleepTimerDeadline: null });
                    return;
                }

                const deadline = Date.now() + (minutes * 60 * 1000);
                const totalSeconds = minutes * 60;
                set({ sleepTimer: minutes, remainingTime: totalSeconds, sleepTimerDeadline: deadline });

                // Use a more robust interval that checks the store state
                timerInterval = setInterval(() => {
                    const state = usePlayerStore.getState();
                    const { remainingTime, isPlaying, sleepTimerDeadline } = state;

                    // Accuracy check: If we're past the deadline, stop now regardless of remainingTime
                    const now = Date.now();
                    if (sleepTimerDeadline && now >= sleepTimerDeadline) {
                        if (timerInterval) {
                            clearInterval(timerInterval);
                            timerInterval = null;
                        }

                        if (isPlaying) {
                            TrackPlayer.pause();
                            set({ isPlaying: false });
                        }
                        set({ sleepTimer: null, remainingTime: null, sleepTimerDeadline: null });

                        try {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch (e) { }
                        return;
                    }

                    if (remainingTime !== null && remainingTime > 0) {
                        set({ remainingTime: remainingTime - 1 });
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

                // Re-sync repeat mode on initialization
                const { repeatMode, lastPosition, setSleepTimer, sleepTimer } = get();
                try {
                    if (repeatMode === 'track') await TrackPlayer.setRepeatMode(RepeatMode.Track);
                    else if (repeatMode === 'queue') await TrackPlayer.setRepeatMode(RepeatMode.Queue);
                    else await TrackPlayer.setRepeatMode(RepeatMode.Off);
                    
                    // Restore position if it was saved
                    if (lastPosition > 0) {
                        console.log(`[Player]: Resuming position at ${lastPosition}s`);
                        await TrackPlayer.seekTo(lastPosition);
                    }
                } catch (e) {
                    console.error("[Player]: Failed to sync state during init", e);
                }

                // Reconstruct Sleep Timer if it hasn't expired
                if (sleepTimer !== null && get().sleepTimerDeadline) {
                    const timeRemainingMs = get().sleepTimerDeadline! - Date.now();
                    if (timeRemainingMs > 0) {
                        const minutesRemaining = Math.ceil(timeRemainingMs / (1000 * 60));
                        console.log(`[Player]: Reconstructing sleep timer for ${minutesRemaining} minutes remaining`);
                        get().setSleepTimer(minutesRemaining);
                    } else {
                        console.log(`[Player]: Cleaned up expired sleep timer`);
                        set({ sleepTimer: null, remainingTime: null, sleepTimerDeadline: null });
                    }
                }

                // Load lyrics for the restored track on restart
                if (currentTrack) {
                    get().loadLyrics(currentTrack);
                }
            },

            loadRecommendations: async (songId: string, isManual: boolean = false) => {
                // Return existing promise if already in progress to allow callers to await it
                if (currentRecommendationPromise) {
                    console.log('[Player]: loadRecommendations attached to existing promise');
                    return currentRecommendationPromise;
                }
                
                // Module-level re-entrancy guard + debounce
                const now = Date.now();
                
                // Only debounce automated requests; allow manual clicks to bypass
                if (!isManual && now - lastRecommendationTime < RECOMMENDATION_DEBOUNCE_MS) {
                    console.log('[Player]: loadRecommendations debounced');
                    return;
                }

                currentRecommendationPromise = (async () => {
                    lastRecommendationTime = now;
                    set({ isLoadingRecommendations: true });

                    try {
                        const selectedQuality = useSettingsStore.getState().audioQuality;
                        const { useHistoryStore } = require('./useHistoryStore');
                    const recentItems: any[] = useHistoryStore.getState().recentlyPlayedItems || [];
                    const historySongs = recentItems.filter(i => (i.type === 'song' || !i.type) && i.id);

                    const runVibeMatch = async (seeds: string[], strictDedup: boolean) => {
                        console.log(`[Player]: Vibe Match with ${seeds.length} seeds (strict: ${strictDedup}):`, seeds);
                        const recommendations = await jioSaavnService.getMultiSeedRecommendations(seeds);
                        if (!recommendations || recommendations.length === 0) return [];

                        const existingIds = new Set(get().queue.map(t => t.id));
                        return recommendations
                            .filter((item: any) => {
                                const id = String(item.id);
                                // ALWAYS strict dedup against the actual queue (no duplicates allowed)
                                if (existingIds.has(id)) return false;
                                // Session-level dedup: skip songs seen in this session UNLESS we're in manual rescue mode
                                if (strictDedup && sessionRecommendedIds.has(id)) return false;
                                return true;
                            })
                            .map((item: any) => ({
                                id: String(item.id),
                                url: getTrackUrl(item, selectedQuality),
                                title: cleanMetadata(item.name || item.title, "Unknown Track"),
                                artist: cleanMetadata(item.artists?.primary?.[0]?.name || item.artist, "Unknown Artist"),
                                artwork: cleanMetadata(sanitizeImageUrl(item.image || item.artwork), undefined),
                                album: cleanMetadata(item.album?.name || item.album, "Single"),
                                description: cleanMetadata(item.name || item.title, "Unknown Track"),
                                genre: cleanMetadata(item.language, "Music"),
                                ...(Number(item.duration) > 0 ? { duration: Number(item.duration) } : {}),
                                isLiveStream: false,
                                // @ts-ignore
                                isRecommended: true,
                                // @ts-ignore
                                originalDownloadUrl: item.downloadUrl,
                                // @ts-ignore
                                originalUrl: item.url
                            }));
                    };

                    // PASS 1: High Accuracy (Current Track + Recent History)
                    const seeds1 = [songId, ...historySongs.slice(0, 2).map(t => String(t.id))].filter(Boolean);
                    let recommendedTracks = await runVibeMatch(seeds1, true);

                    // PASS 2: Seed Rotation (Manual Rescue Mode)
                    // If manual and no new tracks found, rotate seeds deeper into history and relax session dedup
                    if (isManual && recommendedTracks.length < 5 && historySongs.length > 2) {
                        console.log('[Player]: Low results, starting Seed Rotation (Pass 2)...');
                        const seeds2 = [songId, ...historySongs.slice(2, 5).map(t => String(t.id))].filter(Boolean);
                        const extraTracks = await runVibeMatch(seeds2, true);
                        recommendedTracks = [...new Map([...recommendedTracks, ...extraTracks].map(t => [t.id, t])).values()];
                    }

                    // PASS 3: Session Dedup Relaxation (Manual Rescue Mode)
                    // If still low, allow songs seen previously in this session (but NOT in queue)
                    if (isManual && recommendedTracks.length < 3) {
                        console.log('[Player]: Still low, relaxing session dedup (Pass 3)...');
                        const seeds3 = [songId, ...historySongs.slice(0, 3).map(t => String(t.id))].filter(Boolean);
                        const desperateTracks = await runVibeMatch(seeds3, false);
                        recommendedTracks = [...new Map([...recommendedTracks, ...desperateTracks].map(t => [t.id, t])).values()];
                    }

                    if (recommendedTracks.length > 0) {
                        const tracksToAdd = recommendedTracks.slice(0, 12);
                        tracksToAdd.forEach(t => sessionRecommendedIds.add(t.id));
                        await TrackPlayer.add(tracksToAdd);
                        set((state) => ({
                            queue: [...state.queue, ...tracksToAdd],
                            originalQueue: [...state.originalQueue, ...tracksToAdd]
                        }));
                        console.log(`[Player]: Successfully added ${tracksToAdd.length} Vibe Match tracks`);
                    } else if (isManual) {
                        console.log('[Player]: Vibe Match exhausted — no new tracks found even after rotation');
                    }
                } catch (e) {
                    console.error("Vibe Match failed:", e);
                } finally {
                    set({ isLoadingRecommendations: false });
                    currentRecommendationPromise = null;
                }
            })() as Promise<void>;
            
            return currentRecommendationPromise;
        },

        refreshTrackUrl: async (trackId: string): Promise<Track | null> => {
            console.log(`[Player]: Refreshing URL for track ${trackId}`);
            try {
                const songData = await jioSaavnService.getSongDetails(trackId);
                if (!songData) return null;

                const selectedQuality = useSettingsStore.getState().audioQuality;
                const trackUrl = getTrackUrl(songData, selectedQuality);

                const refreshedTrack: Track = {
                    id: String(songData.id),
                    url: trackUrl,
                    title: cleanMetadata(songData.name, "Unknown Track"),
                    artist: cleanMetadata(songData.artists?.primary?.[0]?.name, "Unknown Artist"),
                    artwork: cleanMetadata(sanitizeImageUrl(songData.image), undefined),
                    album: cleanMetadata(songData.album?.name, "Single"),
                    description: cleanMetadata(songData.name, "Unknown Track"),
                    genre: cleanMetadata(songData.language, "Music"),
                    ...(Number(songData.duration) > 0 ? { duration: Number(songData.duration) } : {}),
                    isLiveStream: false,
                    // @ts-ignore
                    originalDownloadUrl: songData.downloadUrl,
                    // @ts-ignore
                    originalUrl: songData.url
                };

                // Update in store queue
                const { queue } = get();
                const index = queue.findIndex(t => t.id === trackId);
                if (index !== -1) {
                    const newQueue = [...queue];
                    newQueue[index] = refreshedTrack;
                    set({ queue: newQueue });
                }

                // Update in originalQueue if present
                const { originalQueue } = get();
                const oIndex = originalQueue.findIndex(t => t.id === trackId);
                if (oIndex !== -1) {
                    const newOQueue = [...originalQueue];
                    newOQueue[oIndex] = refreshedTrack;
                    set({ originalQueue: newOQueue });
                }

                // If it's the current track, update it too
                if (get().currentTrack?.id === trackId) {
                    set({ currentTrack: refreshedTrack });
                }

                return refreshedTrack;
            } catch (e) {
                console.error(`[Player]: Failed to refresh URL for ${trackId}`, e);
                return null;
            }
        },

            loadLyrics: async (track: Track) => {
                if (!track || !track.id) return;
                
                const { syncedLyrics, currentTrack } = get();
                
                // If we already have synced lyrics for this exact track ID, skip
                if (syncedLyrics && syncedLyrics.length > 0 && currentTrack?.id === track.id) {
                    return;
                }
                
                set({ isLoadingLyrics: true });
                try {
                    // Pass additional context to help lyrics provider distinguish regional versions
                    const context = {
                        album: track.album || undefined,
                        language: track.genre || undefined // 'genre' holds the language in Melodix
                    };

                    const { synced, plain } = await lyricsService.getSyncedLyrics(track, context);
                    
                    // Race condition guard: Check if the user has already moved to another track
                    if (get().currentTrack?.id !== track.id) {
                        console.log(`[Player]: Abandoning lyrics load for stale track: ${track.title}`);
                        return;
                    }

                    // Use JioSaavn as fallback for plain text if LrcLib didn't provide any
                    const fallbackPlain = plain || await jioSaavnService.getLyrics(track.id);
                    
                    // Final race condition guard
                    if (get().currentTrack?.id !== track.id) return;

                    set({ syncedLyrics: synced, plainLyrics: fallbackPlain });
                } catch (e) {
                    console.error("[Player]: Failed to load lyrics:", e);
                } finally {
                    // Final check to ensure we only reset loading state for the relevant track's flow
                    if (get().currentTrack?.id === track.id) {
                        set({ isLoadingLyrics: false });
                    }
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
                lastPosition: state.lastPosition,
                sleepTimer: state.sleepTimer,
                sleepTimerDeadline: state.sleepTimerDeadline,
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
