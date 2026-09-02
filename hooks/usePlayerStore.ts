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
import { Song } from "../types/music";
import { jioSaavnService } from "../services/jiosaavn";
import { LrcLine, lyricsService } from "../services/lyrics";
import { queueController } from "../services/QueueController";
import { recommendationEngine } from "../services/RecommendationEngine";
import { sanitizeImageUrl } from "../utils/stringUtils";
import { useSettingsStore } from "./useSettingsStore";

interface PlayerState {
    currentTrack: Track | null;
    isPlaying: boolean;
    shuffle: boolean;
    repeatMode: 'off' | 'track' | 'queue';
    queue: Track[];
    originalQueue: Track[];
    recommendations: Track[];
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
    setRepeatMode: (mode: 'off' | 'track' | 'queue') => Promise<void>;
    playTrack: (trackData: any, queueData?: any[], quality?: keyof typeof qualityMap) => Promise<void>;
    togglePlayback: () => Promise<void>;
    toggleShuffle: () => void;
    nextRepeatMode: () => void;
    addToQueue: (track: Track) => Promise<void>;
    removeFromQueue: (trackId: string) => Promise<void>;
    isInQueue: (trackId: string) => boolean;
    setSleepTimer: (minutes: number | null) => void;
    initPlayer: () => Promise<void>;
    loadRecommendations: (songId: string, isManual?: boolean, expectedGeneration?: number) => Promise<void>;
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

export const getTrackUrl = (trackData: any, quality: keyof typeof qualityMap): string => {
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
export const cleanMetadata = (val: any, fallback: string | undefined): string | undefined => {
    if (val === null || val === undefined || val === "null" || val === "undefined") return fallback;
    const str = String(val).trim();
    if (str === "" || str === "[object Object]") return fallback;
    return str;
};

let timerInterval: NodeJS.Timeout | null = null;

// Playback Operation Generation counter
let playbackGeneration = 0;
export const getPlaybackGeneration = (): number => playbackGeneration;
export const getNextPlaybackGeneration = (): number => ++playbackGeneration;
export const isCurrentPlaybackGeneration = (gen: number): boolean => gen === playbackGeneration;

// Explicit Playback Transition Reason tracking
export type PlaybackTransitionReason =
    | 'USER_NEXT'
    | 'USER_PREVIOUS'
    | 'USER_SELECTED_TRACK'
    | 'NATURAL_ADVANCEMENT'
    | 'QUEUE_END'
    | 'REMOTE_NEXT'
    | 'REMOTE_PREVIOUS'
    | 'REMOTE_SELECTED_TRACK'
    | 'ERROR_RECOVERY'
    | 'PLAYBACK_START'
    | 'UNKNOWN';

let currentTransitionReason: PlaybackTransitionReason = 'PLAYBACK_START';

export const setPlaybackTransitionReason = (reason: PlaybackTransitionReason) => {
    currentTransitionReason = reason;
};

export const getAndResetPlaybackTransitionReason = (): PlaybackTransitionReason => {
    const reason = currentTransitionReason;
    currentTransitionReason = 'NATURAL_ADVANCEMENT';
    return reason;
};

// Module-level re-entrancy lock and state tracking for recommendations
let currentRecommendationPromise: Promise<void> | null = null;
let activeRecommendationSeed: string | null = null;
let activeRecommendationGeneration: number = 0;
let lastRecommendationTime = 0;
const RECOMMENDATION_DEBOUNCE_MS = 3000;

// Session-level dedup: tracks recommended song IDs so we never re-add the same
// song within a single listening session (cleared on playTrack).
export const sessionRecommendedIds = new Set<string>();

export const usePlayerStore = create<PlayerState>()(
    persist(
        (set, get) => ({
            currentTrack: null,
            isPlaying: false,
            shuffle: false,
            repeatMode: 'off',
            queue: [],
            originalQueue: [],
            recommendations: [],
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
                activeRecommendationSeed = null;
                activeRecommendationGeneration = 0;
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
                const generation = ++playbackGeneration;
                const selectedQuality = quality || useSettingsStore.getState().audioQuality;
                const { shuffle } = get();
                const { downloadedSongs } = require('./useLibraryStore').useLibraryStore.getState();

                // Haptic feedback for interaction
                try {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch (e) { }

                if (generation !== playbackGeneration) {
                    console.log(`[Player]: playTrack aborted at step 1 (haptics) for stale generation ${generation}`);
                    return;
                }

                // Check for local offline version of the track
                const downloadedTrack = downloadedSongs.find((s: any) => s.id === String(trackData.id));
                let trackUrl = getTrackUrl(trackData, selectedQuality);
                console.log(`[Player]: Loading track with quality: ${selectedQuality}`);

                // If we have a local copy, prioritize it if it exists on disk
                if (downloadedTrack?.localUri) {
                    try {
                        const fileInfo = await FileSystem.getInfoAsync(downloadedTrack.localUri);
                        if (generation !== playbackGeneration) {
                            console.log(`[Player]: playTrack aborted at step 2 (file info) for stale generation ${generation}`);
                            return;
                        }
                        if (fileInfo.exists) {
                            trackUrl = downloadedTrack.localUri;
                        } else {
                            console.warn(`[Player]: Local file missing, falling back to streaming URL`);
                            require('./useLibraryStore').useLibraryStore.getState().syncDownloadedSongs();
                        }
                    } catch (e) {
                        console.error("[Player]: Error verifying local file", e);
                        trackUrl = downloadedTrack.localUri;
                    }
                }

                if (generation !== playbackGeneration) {
                    console.log(`[Player]: playTrack aborted at step 3 (url resolution) for stale generation ${generation}`);
                    return;
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

                if (generation !== playbackGeneration) {
                    console.log(`[Player]: playTrack aborted at step 5 (queue mapping) for stale generation ${generation}`);
                    return;
                }

                // Execute native queue replacement inside serialized queue controller
                await queueController.run(async () => {
                    if (generation !== playbackGeneration) return;

                    set({ originalQueue: [...queueToPlay], queue: [...queueToPlay] });

                    if (shuffle) {
                        queueToPlay = [...queueToPlay].sort(() => Math.random() - 0.5);
                    }

                    if (generation !== playbackGeneration) return;

                    await TrackPlayer.reset();

                    if (generation !== playbackGeneration) return;

                    // Re-sync repeat mode after reset, as reset often clears it
                    const { repeatMode } = get();
                    if (repeatMode === 'track') await TrackPlayer.setRepeatMode(RepeatMode.Track);
                    else if (repeatMode === 'queue') await TrackPlayer.setRepeatMode(RepeatMode.Queue);
                    else await TrackPlayer.setRepeatMode(RepeatMode.Off);

                    if (generation !== playbackGeneration) return;

                    if (queueToPlay.length > 0) {
                        await TrackPlayer.add(queueToPlay);
                        if (generation !== playbackGeneration) return;
                        const index = queueToPlay.findIndex(t => t.id === trackToPlay.id);
                        if (index !== -1) {
                            await TrackPlayer.skip(index);
                        }
                    } else {
                        await TrackPlayer.add([trackToPlay]);
                    }

                    if (generation !== playbackGeneration) return;

                    set({ currentTrack: trackToPlay, isPlaying: true });

                    // Auto-seed recommendations when playing a standalone track (no playlist)
                    // Clear session dedup so a fresh play starts a new rec pool.
                    sessionRecommendedIds.clear();
                    currentRecommendationPromise = null;
                    activeRecommendationSeed = null;
                    activeRecommendationGeneration = 0;
                });

                if (generation !== playbackGeneration) {
                    console.log(`[Player]: playTrack aborted before play for stale generation ${generation}`);
                    return;
                }

                setPlaybackTransitionReason(queueData && queueData.length > 1 ? 'USER_SELECTED_TRACK' : 'PLAYBACK_START');
                await TrackPlayer.play();

                if (generation !== playbackGeneration) {
                    console.log(`[Player]: playTrack aborted after play for stale generation ${generation}`);
                    return;
                }

                const seedTrackId = String(trackData.id);
                // Trigger Up Next discovery recommendation fetch for the newly played track
                setTimeout(async () => {
                    if (playbackGeneration !== generation) return;
                    if (get().currentTrack?.id !== seedTrackId) return;
                    get().loadRecommendations(seedTrackId, false, generation);
                }, 300);

                // Track history for smart recommendations
                try {
                    const { useHistoryStore } = require("./useHistoryStore");
                    useHistoryStore.getState().addTrackToHistory(trackData);
                } catch (e) {
                    console.error("History tracking failed:", e);
                }
            },

            toggleShuffle: async () => {
                try {
                    await Haptics.selectionAsync();
                } catch (e) { }

                return queueController.run(async () => {
                    const { shuffle, originalQueue, currentTrack } = get();
                    const newShuffle = !shuffle;
                    set({ shuffle: newShuffle });

                    if (newShuffle) {
                        // Reorder remaining queue
                        const currentIndex = await TrackPlayer.getActiveTrackIndex();
                        const currentQueue = await TrackPlayer.getQueue();

                        const validCurrentIndex = currentIndex ?? 0;
                        const before = currentQueue.slice(0, validCurrentIndex + 1);
                        const after = currentQueue.slice(validCurrentIndex + 1);

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

                            const currentShown = get().queue.slice(0, currentIndex + 1);
                            set({ queue: [...currentShown, ...nextInOriginal] });
                        }
                    }
                });
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
                return queueController.run(async () => {
                    const currentIndex = await TrackPlayer.getActiveTrackIndex();
                    const playerQueue = await TrackPlayer.getQueue();
                    const insertIndex = currentIndex !== undefined && currentIndex >= 0
                        ? Math.min(currentIndex + 1, playerQueue.length)
                        : playerQueue.length;

                    await TrackPlayer.add(track, insertIndex);

                    set((state) => {
                        const newQueue = [...state.queue];
                        const storeCurrentIndex = state.currentTrack 
                            ? state.queue.findIndex(t => t.id === state.currentTrack?.id)
                            : -1;
                        const storeInsertIndex = storeCurrentIndex !== -1 
                            ? Math.min(storeCurrentIndex + 1, newQueue.length)
                            : newQueue.length;
                        newQueue.splice(storeInsertIndex, 0, track);
                        return {
                            queue: newQueue,
                            originalQueue: [...state.originalQueue, track]
                        };
                    });
                });
            },

            removeFromQueue: async (trackId: string) => {
                return queueController.run(async () => {
                    const playerQueue = await TrackPlayer.getQueue();
                    const targetIndex = playerQueue.findIndex(t => t.id === trackId);
                    
                    if (targetIndex !== -1) {
                        const activeIndex = await TrackPlayer.getActiveTrackIndex();
                        const isCurrentTrack = activeIndex !== undefined && activeIndex === targetIndex;
                        
                        if (isCurrentTrack) {
                            if (playerQueue.length === 1) {
                                // Only track in queue
                                await TrackPlayer.stop();
                                await TrackPlayer.reset();
                                set({ currentTrack: null, isPlaying: false });
                            } else if (targetIndex < playerQueue.length - 1) {
                                // Current track has a next track
                                await TrackPlayer.skipToNext();
                                const freshQueue = await TrackPlayer.getQueue();
                                const freshIndex = freshQueue.findIndex(t => t.id === trackId);
                                if (freshIndex !== -1) {
                                    await TrackPlayer.remove(freshIndex);
                                }
                            } else {
                                // Current track is the last track in a multi-track queue
                                const prevIndex = Math.max(0, targetIndex - 1);
                                await TrackPlayer.skip(prevIndex);
                                const freshQueue = await TrackPlayer.getQueue();
                                const freshIndex = freshQueue.findIndex(t => t.id === trackId);
                                if (freshIndex !== -1) {
                                    await TrackPlayer.remove(freshIndex);
                                }
                            }
                        } else {
                            // Non-current track: remove directly
                            await TrackPlayer.remove(targetIndex);
                        }
                    }

                    set((state) => {
                        const newQueue = state.queue.filter(t => t.id !== trackId);
                        const newOriginalQueue = state.originalQueue.filter(t => t.id !== trackId);
                        const shouldClearCurrent = state.currentTrack?.id === trackId && newQueue.length === 0;
                        return {
                            queue: newQueue,
                            originalQueue: newOriginalQueue,
                            ...(shouldClearCurrent ? { currentTrack: null, isPlaying: false } : {})
                        };
                    });
                });
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
                    await TrackPlayer.getState();
                } catch (e) {
                    console.log("[Player]: TrackPlayer setup not ready during init");
                    return;
                }

                // If not rehydrated yet, wait or return
                if (!get().isRehydrated) {
                    console.log("[Player]: Waiting for store rehydration...");
                    return;
                }

                await queueController.run(async () => {
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
                });

                // Re-sync repeat mode on initialization
                const { repeatMode, lastPosition, sleepTimer } = get();
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

            loadRecommendations: async (songId: string, isManual: boolean = false, expectedGeneration?: number) => {
                const targetGen = expectedGeneration !== undefined ? expectedGeneration : playbackGeneration;
                
                if (get().isLoadingRecommendations && !isManual) {
                    return;
                }

                set({ isLoadingRecommendations: true });
                console.log(`[Player]: Loading Up Next recommendations for seed: ${songId} (isManual: ${isManual}, Gen: ${targetGen})`);

                try {
                    const currentTrack = get().currentTrack;
                    const liveQueueIds = new Set(get().queue.map(t => t.id));

                    const candidates: Song[] = await recommendationEngine.getRecommendations(
                        songId,
                        currentTrack,
                        liveQueueIds,
                        sessionRecommendedIds,
                        isManual
                    );

                    if (playbackGeneration !== targetGen) {
                        console.log(`[Player]: Aborting Up Next recommendations load: playback generation changed (${targetGen} vs ${playbackGeneration})`);
                        return;
                    }

                    const selectedQuality = useSettingsStore.getState().audioQuality;
                    const cleanTracks: Track[] = candidates.map((s) => ({
                        id: String(s.id),
                        url: getTrackUrl(s, selectedQuality),
                        title: cleanMetadata(s.name, "Unknown Track"),
                        artist: cleanMetadata(s.artists?.primary?.[0]?.name, "Unknown Artist"),
                        artwork: cleanMetadata(sanitizeImageUrl(s.image), undefined),
                        album: cleanMetadata(s.album?.name, "Single"),
                        description: cleanMetadata(s.name, "Unknown Track"),
                        genre: cleanMetadata(s.language, "Music"),
                        ...(Number(s.duration) > 0 ? { duration: Number(s.duration) } : {}),
                        isLiveStream: false,
                        // @ts-ignore
                        originalDownloadUrl: s.downloadUrl,
                        // @ts-ignore
                        originalUrl: s.url
                    }));

                    // Record newly received recommendation IDs into session deduplication
                    cleanTracks.forEach(t => sessionRecommendedIds.add(t.id));

                    if (isManual) {
                        // Append uniquely to existing recommendations list
                        set((state) => {
                            const existingIds = new Set(state.recommendations.map(t => t.id));
                            const uniqueTracks = cleanTracks.filter(t => !existingIds.has(t.id));
                            return {
                                recommendations: [...state.recommendations, ...uniqueTracks],
                                isLoadingRecommendations: false
                            };
                        });
                    } else {
                        // Replace recommendations list for new seed track
                        set({
                            recommendations: cleanTracks,
                            isLoadingRecommendations: false
                        });
                    }
                } catch (error) {
                    console.error("[Player]: Failed to load Up Next recommendations:", error);
                } finally {
                    if (playbackGeneration === targetGen) {
                        set({ isLoadingRecommendations: false });
                    }
                }
            },

            refreshTrackUrl: async (trackId: string): Promise<Track | null> => {
                console.log(`[Player]: Refreshing URL for track ${trackId}`);
                try {
                    // Check if track is an offline local download first
                    let localUri: string | null = null;
                    try {
                        const { useLibraryStore } = require('./useLibraryStore');
                        const downloadedTrack = useLibraryStore.getState().downloadedSongs?.find((s: any) => s.id === trackId);
                        if (downloadedTrack?.localUri) {
                            const fileInfo = await FileSystem.getInfoAsync(downloadedTrack.localUri);
                            if (fileInfo.exists) {
                                localUri = downloadedTrack.localUri;
                            }
                        }
                    } catch (e) { }

                    const songData = await jioSaavnService.getSongDetails(trackId);
                    if (!songData) return null;

                    const selectedQuality = useSettingsStore.getState().audioQuality;
                    const trackUrl = localUri || getTrackUrl(songData, selectedQuality);

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

                    // Atomically update store queue and currentTrack without using stale index snapshots
                    set((state) => {
                        const queueIndex = state.queue.findIndex(t => t.id === trackId);
                        const originalIndex = state.originalQueue.findIndex(t => t.id === trackId);
                        
                        const updatedQueue = queueIndex !== -1 
                            ? state.queue.map((t, idx) => idx === queueIndex ? refreshedTrack : t)
                            : state.queue;
                        const updatedOriginalQueue = originalIndex !== -1 
                            ? state.originalQueue.map((t, idx) => idx === originalIndex ? refreshedTrack : t)
                            : state.originalQueue;

                        const isStillCurrentTrack = state.currentTrack?.id === trackId;

                        return {
                            queue: updatedQueue,
                            originalQueue: updatedOriginalQueue,
                            ...(isStillCurrentTrack ? { currentTrack: refreshedTrack } : {})
                        };
                    });

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

                const loadGen = playbackGeneration;
                const trackId = track.id;
                
                set({ isLoadingLyrics: true });
                try {
                    // Pass additional context to help lyrics provider distinguish regional versions
                    const context = {
                        album: track.album || undefined,
                        language: track.genre || undefined // 'genre' holds the language in Melodix
                    };

                    const { synced, plain } = await lyricsService.getSyncedLyrics(track, context);
                    
                    // Race condition guard: Check if the user has already moved to another track or generation
                    if (playbackGeneration !== loadGen || get().currentTrack?.id !== trackId) {
                        console.log(`[Player]: Abandoning lyrics load for stale track: ${track.title}`);
                        return;
                    }

                    // Use JioSaavn as fallback for plain text if LrcLib didn't provide any
                    const fallbackPlain = plain || await jioSaavnService.getLyrics(trackId);
                    
                    // Final race condition guard
                    if (playbackGeneration !== loadGen || get().currentTrack?.id !== trackId) return;

                    set({ syncedLyrics: synced, plainLyrics: fallbackPlain });
                } catch (e) {
                    console.error("[Player]: Failed to load lyrics:", e);
                } finally {
                    // Final check to ensure we only reset loading state for the relevant track's flow
                    if (playbackGeneration === loadGen && get().currentTrack?.id === trackId) {
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
