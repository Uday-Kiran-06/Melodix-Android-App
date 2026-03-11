import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import TrackPlayer, {
    RepeatMode,
    State,
    Track
} from "react-native-track-player";
import { create } from "zustand";
import { createJSONStorage, persist } from 'zustand/middleware';
import { jioSaavnService } from "../services/jiosaavn";

interface PlayerState {
    currentTrack: Track | null;
    isPlaying: boolean;
    shuffle: boolean;
    repeatMode: 'off' | 'track' | 'queue';
    queue: Track[];
    originalQueue: Track[];
    sleepTimer: number | null; // minutes
    remainingTime: number | null; // seconds
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
}

// Map quality selection to JioSaavn API download link keys
const qualityMap = {
    "12kbps": 0,
    "48kbps": 1,
    "96kbps": 2,
    "160kbps": 3,
    "320kbps": 4,
};

// Utility to ensure no null/undefined values reach the OS media session, but empty strings become undefined
const cleanMetadata = (val: any, fallback: string | undefined): string | undefined => {
    if (!val || val === "null" || val === "undefined") return fallback;
    const str = String(val).trim();
    if (str === "") return fallback;
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
            setCurrentTrack: (track) => set({ currentTrack: track }),
            setIsPlaying: (playing) => set({ isPlaying: playing }),
            setShuffle: (shuffle) => set({ shuffle }),
            setRepeatMode: (mode) => {
                set({ repeatMode: mode });
                if (mode === 'track') TrackPlayer.setRepeatMode(RepeatMode.Track);
                else if (mode === 'queue') TrackPlayer.setRepeatMode(RepeatMode.Queue);
                else TrackPlayer.setRepeatMode(RepeatMode.Off);
            },

            playTrack: async (trackData: any, queueData: any[] = [], quality: keyof typeof qualityMap = "320kbps") => {
                const qualityIdx = qualityMap[quality];
                const { shuffle } = get();

                // Haptic feedback for interaction
                try {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch (e) { }

                const trackToPlay: Track = {
                    id: String(trackData.id),
                    url: trackData.downloadUrl ? (trackData.downloadUrl[qualityIdx]?.url || trackData.downloadUrl[trackData.downloadUrl.length - 1].url) : trackData.url,
                    title: cleanMetadata(trackData.name || trackData.title, "Unknown Track"),
                    artist: cleanMetadata(trackData.artists?.primary?.[0]?.name || trackData.artist, "Unknown Artist"),
                    artwork: cleanMetadata(
                        typeof trackData.image === 'string' ? trackData.image : (Array.isArray(trackData.image) ? trackData.image[trackData.image.length - 1]?.url : (trackData.image?.url || trackData.artwork)),
                        undefined
                    ),
                    album: cleanMetadata(trackData.album?.name || trackData.album, "Single"),
                    description: cleanMetadata(trackData.name || trackData.title, "Unknown Track"),
                    genre: cleanMetadata(trackData.language, "Music"),
                    ...(Number(trackData.duration) > 0 ? { duration: Number(trackData.duration) } : {}),
                    isLiveStream: false,
                };

                let queueToPlay: Track[] = queueData.map(item => ({
                    id: String(item.id),
                    url: item.downloadUrl ? (item.downloadUrl[qualityIdx]?.url || item.downloadUrl[item.downloadUrl.length - 1].url) : item.url,
                    title: cleanMetadata(item.name || item.title, "Unknown Track"),
                    artist: cleanMetadata(item.artists?.primary?.[0]?.name || item.artist, "Unknown Artist"),
                    artwork: cleanMetadata(
                        typeof item.image === 'string' ? item.image : (Array.isArray(item.image) ? item.image[item.image.length - 1]?.url : (item.image?.url || item.artwork)),
                        undefined
                    ),
                    album: cleanMetadata(item.album?.name || item.album, "Single"),
                    description: cleanMetadata(item.name || item.title, "Unknown Track"),
                    genre: cleanMetadata(item.language, "Music"),
                    ...(Number(item.duration) > 0 ? { duration: Number(item.duration) } : {}),
                    isLiveStream: false,
                }));

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
                    const recommendations = await jioSaavnService.getRecommendations(trackData.id);

                    if (recommendations && recommendations.length > 0) {
                        const existingIds = new Set(queueToPlay.map(t => t.id));
                        const recommendedTracks: Track[] = recommendations
                            .filter((item: any) => !existingIds.has(item.id))
                            .map((item: any) => ({
                                id: String(item.id),
                                url: item.downloadUrl ? (item.downloadUrl[qualityIdx]?.url || item.downloadUrl[item.downloadUrl.length - 1].url) : item.url,
                                title: cleanMetadata(item.name || item.title, "Unknown Track"),
                                artist: cleanMetadata(item.artists?.primary?.[0]?.name || item.artist, "Unknown Artist"),
                                artwork: cleanMetadata(
                                    typeof item.image === 'string' ? item.image : (Array.isArray(item.image) ? item.image[item.image.length - 1]?.url : (item.image?.url || item.artwork)),
                                    undefined
                                ),
                                album: cleanMetadata(item.album?.name || item.album, "Single"),
                                description: cleanMetadata(item.name || item.title, "Unknown Track"),
                                genre: cleanMetadata(item.language, "Music"),
                                ...(Number(item.duration) > 0 ? { duration: Number(item.duration) } : {}),
                                isLiveStream: false,
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

            toggleShuffle: () => {
                const { shuffle, queue, originalQueue, currentTrack } = get();
                try {
                    Haptics.selectionAsync();
                } catch (e) { }
                const newShuffle = !shuffle;
                set({ shuffle: newShuffle });

                if (newShuffle) {
                    const shuffled = [...queue].sort(() => Math.random() - 0.5);
                    set({ queue: shuffled });
                    TrackPlayer.removeUpcomingTracks(); // Simplified for now
                    TrackPlayer.add(shuffled.filter(t => t.id !== currentTrack?.id));
                } else {
                    set({ queue: [...originalQueue] });
                    // Re-sync TrackPlayer queue if needed
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
                    await TrackPlayer.getState();
                } catch (e) {
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
            },

            loadRecommendations: async (songId: string) => {
                const { queue } = get();
                try {
                    const recommendations = await jioSaavnService.getRecommendations(songId);
                    if (recommendations && recommendations.length > 0) {
                        const existingIds = new Set(queue.map(t => t.id));
                        const recommendedTracks: Track[] = recommendations
                            .filter((item: any) => !existingIds.has(item.id))
                            .map((item: any) => ({
                                id: String(item.id),
                                url: item.downloadUrl ? (item.downloadUrl[4]?.url || item.downloadUrl[item.downloadUrl.length - 1].url) : item.url,
                                title: cleanMetadata(item.name || item.title, "Unknown Track"),
                                artist: cleanMetadata(item.artists?.primary?.[0]?.name || item.artist, "Unknown Artist"),
                                artwork: cleanMetadata(
                                    typeof item.image === 'string' ? item.image : (Array.isArray(item.image) ? item.image[item.image.length - 1]?.url : (item.image?.url || item.artwork)),
                                    undefined
                                ),
                                album: cleanMetadata(item.album?.name || item.album, "Single"),
                                description: cleanMetadata(item.name || item.title, "Unknown Track"),
                                genre: cleanMetadata(item.language, "Music"),
                                ...(Number(item.duration) > 0 ? { duration: Number(item.duration) } : {}),
                                isLiveStream: false,
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
        }
    )
);
