import TrackPlayer, { Event, State } from 'react-native-track-player';
import { queueController } from './QueueController';

// Track IDs and their current retry count (reset when a track starts successfully)
const recoveryRetries = new Map<string, number>();
const MAX_RETRY_ATTEMPTS = 3;

// Track IDs that have already been retried once in the current session
const retriedTrackIds = new Set<string>();

// Singleton listener guard: prevents duplicate event subscription on reload
let isPlaybackServiceRegistered = false;
let lastRemoteNextTime = 0;
let lastRemotePrevTime = 0;
const REMOTE_DEBOUNCE_MS = 350;

export const PlaybackService = async function () {
    if (isPlaybackServiceRegistered) {
        console.log('[PlayerService]: PlaybackService already initialized, skipping duplicate registration');
        return;
    }
    isPlaybackServiceRegistered = true;

    const safeSkipForward = async () => {
        try {
            await TrackPlayer.skipToNext();
            await TrackPlayer.play();
        } catch (e) {
            console.error('[PlayerService]: safeSkipForward failed:', e);
        }
    };

    TrackPlayer.addEventListener(Event.RemotePlay, () => { console.log('RemotePlay'); TrackPlayer.play(); });
    TrackPlayer.addEventListener(Event.RemotePause, () => { console.log('RemotePause'); TrackPlayer.pause(); });
    TrackPlayer.addEventListener(Event.RemoteNext, () => {
        const now = Date.now();
        if (now - lastRemoteNextTime < REMOTE_DEBOUNCE_MS) {
            console.log('[PlayerService]: Debounced rapid RemoteNext');
            return;
        }
        lastRemoteNextTime = now;
        const { setPlaybackTransitionReason } = require('../hooks/usePlayerStore');
        if (typeof setPlaybackTransitionReason === 'function') {
            setPlaybackTransitionReason('REMOTE_NEXT');
        }
        console.log('RemoteNext');
        safeSkipForward();
    });
    TrackPlayer.addEventListener(Event.RemotePrevious, () => {
        const now = Date.now();
        if (now - lastRemotePrevTime < REMOTE_DEBOUNCE_MS) {
            console.log('[PlayerService]: Debounced rapid RemotePrevious');
            return;
        }
        lastRemotePrevTime = now;
        const { setPlaybackTransitionReason } = require('../hooks/usePlayerStore');
        if (typeof setPlaybackTransitionReason === 'function') {
            setPlaybackTransitionReason('REMOTE_PREVIOUS');
        }
        console.log('RemotePrevious');
        TrackPlayer.skipToPrevious();
    });
    TrackPlayer.addEventListener(Event.RemoteStop, async () => { 
        console.log('RemoteStop'); 
        const { usePlayerStore, getNextPlaybackGeneration } = require('../hooks/usePlayerStore');
        if (typeof getNextPlaybackGeneration === 'function') {
            getNextPlaybackGeneration();
        }
        const store = usePlayerStore.getState();
        
        // Capture final position before reset
        try {
            const pos = await TrackPlayer.getPosition();
            if (pos > 0) store.setLastPosition(pos);
        } catch (e) {}

        await queueController.run(async () => {
            await TrackPlayer.stop();
            await TrackPlayer.reset(); 
        });
    });
    TrackPlayer.addEventListener(Event.RemoteSeek, async (event) => {
        console.log('RemoteSeek to:', event.position);
        await TrackPlayer.seekTo(event.position);
        const { usePlayerStore } = require('../hooks/usePlayerStore');
        usePlayerStore.getState().setLastPosition(event.position);
    });
    TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event) => {
        const current = await TrackPlayer.getPosition();
        await TrackPlayer.seekTo(current + (event.interval || 10));
    });
    TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
        const current = await TrackPlayer.getPosition();
        await TrackPlayer.seekTo(current - (event.interval || 10));
    });
    TrackPlayer.addEventListener(Event.RemotePlayId, async (event) => {
        const { setPlaybackTransitionReason } = require('../hooks/usePlayerStore');
        if (typeof setPlaybackTransitionReason === 'function') {
            setPlaybackTransitionReason('REMOTE_SELECTED_TRACK');
        }
        const queue = await TrackPlayer.getQueue();
        const index = queue.findIndex(t => t.id === event.id);
        if (index !== -1) {
            await TrackPlayer.skip(index);
            await TrackPlayer.play();
        }
    });
    let wasPlayingBeforeDuck = false;
    TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
        console.log('[PlayerService]: RemoteDuck event:', event);
        if (event.permanent) {
            await TrackPlayer.pause();
            wasPlayingBeforeDuck = false;
        } else {
            if (event.paused) {
                // Focus lost or ducking started
                const state = await TrackPlayer.getState();
                wasPlayingBeforeDuck = state === State.Playing;
                await TrackPlayer.pause();
            } else {
                // Focus returned
                if (wasPlayingBeforeDuck) {
                    const state = await TrackPlayer.getState();
                    if (state !== State.Playing) {
                        await TrackPlayer.play();
                    }
                }
                wasPlayingBeforeDuck = false;
            }
        }
    });

    let lastTrackId: string | undefined = undefined;
    let lastProcessedGeneration: number = -1;
    TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
        const { usePlayerStore, getPlaybackGeneration, getAndResetPlaybackTransitionReason } = require('../hooks/usePlayerStore');
        const store = usePlayerStore.getState();
        const currentGen = typeof getPlaybackGeneration === 'function' ? getPlaybackGeneration() : 0;
        const transitionReason = typeof getAndResetPlaybackTransitionReason === 'function'
            ? getAndResetPlaybackTransitionReason()
            : 'NATURAL_ADVANCEMENT';
        
        if (event.track !== undefined && event.track !== null) {
            console.log(`[PlaybackTransition] from=${lastTrackId ?? 'none'} to=${event.track.id} reason=${transitionReason} generation=${currentGen}`);
            
            // Track is considered a new playback instance if the track ID changed OR the playback generation changed
            const isNewTrack = lastTrackId !== event.track.id || lastProcessedGeneration !== currentGen;
            lastTrackId = event.track.id;
            lastProcessedGeneration = currentGen;

            // Sync the store with the track provided by TrackPlayer
            store.setCurrentTrack(event.track);
            
            // Reset and load lyrics state for the new track
            if (isNewTrack || !store.syncedLyrics || !store.plainLyrics) {
                usePlayerStore.setState({ 
                    syncedLyrics: null, 
                    plainLyrics: null, 
                    isLoadingLyrics: true // Set to true immediately to show spinner
                });
                store.loadLyrics(event.track);
            }

            if (isNewTrack) {
                // Reset retry count for this track since it successfully started
                recoveryRetries.delete(event.track.id);

                // Proactively refresh UI recommendations for the new active track (Up Next discovery)
                if (event.track.id) {
                    store.loadRecommendations(event.track.id, false, currentGen);
                }

                // PROACTIVE JIT REFRESH: If there is a next track, refresh it now to prevent future errors.
                // Skip this during repeat:track — the same track will loop natively and there is no
                // meaningful "next" track to prefetch, which would waste a network call every loop.
                const index = event.index;
                const queue = await TrackPlayer.getQueue();
                const nextIndex = (index ?? 0) + 1;
                if (store.repeatMode !== 'track' && nextIndex < queue.length) {
                    const nextTrack = queue[nextIndex];
                    if (nextTrack?.id) {
                        const targetNextId = nextTrack.id;
                        const jitGen = typeof getPlaybackGeneration === 'function' ? getPlaybackGeneration() : 0;
                        console.log(`[PlayerService]: Proactively refreshing next track: ${nextTrack.title}`);
                        store.refreshTrackUrl(targetNextId).then(async (refreshed: any) => {
                            if (refreshed && refreshed.id === targetNextId) {
                                try {
                                    await queueController.run(async () => {
                                        if (typeof getPlaybackGeneration === 'function' && getPlaybackGeneration() !== jitGen) {
                                            console.log('[PlayerService]: JIT refresh aborted: playback generation changed');
                                            return;
                                        }
                                        // Native Gapless Swap: silently update the native queue item holding the URL
                                        // This fetches the URL ahead of time without interrupting the currently playing track!
                                        const latestQueue = await TrackPlayer.getQueue();
                                        const latestIndex = await TrackPlayer.getActiveTrackIndex();
                                        
                                        // Revalidate: find actual index of targetNextId in latestQueue
                                        const actualIndex = latestQueue.findIndex(t => t.id === targetNextId);

                                        // Ensure target track is strictly after active track
                                        if (latestIndex !== undefined && actualIndex !== -1 && latestIndex < actualIndex) {
                                            const existingTrack = latestQueue[actualIndex];
                                            // Only swap if URL actually changed to prevent disturbing native player unnecessarily
                                            if (existingTrack?.id === targetNextId && existingTrack.url !== refreshed.url) {
                                                console.log(`[PlayerService]: Natively swapping refreshed URL ahead of time for: ${refreshed.title} at index ${actualIndex}`);
                                                await TrackPlayer.remove(actualIndex);
                                                await TrackPlayer.add(refreshed, actualIndex);
                                            }
                                        }
                                    });
                                } catch (e) {
                                    console.error('[PlayerService]: Failed silent native queue swap:', e);
                                }
                            }
                        });
                    }
                }
            }
        } else {
            console.log('[PlayerService]: Active track cleared');
            store.setCurrentTrack(null);
            // Clear lyrics state when track is cleared
            usePlayerStore.setState({ syncedLyrics: null, plainLyrics: null, isLoadingLyrics: false });
        }
    });

    // Handle end of queue: wrap around if repeat:queue is enabled, otherwise stop
    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
        const { usePlayerStore, setPlaybackTransitionReason } = require('../hooks/usePlayerStore');
        const store = usePlayerStore.getState();

        console.log('[PlayerService]: PlaybackQueueEnded');

        if (!store.isRehydrated) {
            return;
        }

        // If repeat:queue is active, wrap around to track 0
        if (store.repeatMode === 'queue') {
            try {
                if (typeof setPlaybackTransitionReason === 'function') {
                    setPlaybackTransitionReason('QUEUE_END');
                }
                await TrackPlayer.skip(0);
                await TrackPlayer.play();
            } catch (e) {
                console.error('[PlayerService]: Failed to wrap queue on PlaybackQueueEnded:', e);
            }
        }
    });

    // Handle playback errors: attempt to refresh URL and retry before skipping
    TrackPlayer.addEventListener(Event.PlaybackError, async (event) => {
        const { usePlayerStore, getPlaybackGeneration, setPlaybackTransitionReason } = require('../hooks/usePlayerStore');
        const store = usePlayerStore.getState();
        
        try {
            const activeTrack = await TrackPlayer.getActiveTrack();
            const targetTrackId = activeTrack?.id;
            const recoveryGen = typeof getPlaybackGeneration === 'function' ? getPlaybackGeneration() : 0;
            
            console.warn(`[PlaybackError] track=${targetTrackId ?? 'none'} code=${(event as any)?.code ?? 'unknown'} message=${(event as any)?.message ?? 'error'} generation=${recoveryGen}`);
            
            if (activeTrack && targetTrackId) {
                const attempt = (recoveryRetries.get(targetTrackId) || 0) + 1;
                
                if (attempt <= MAX_RETRY_ATTEMPTS) {
                    console.log(`[PlaybackRecovery] track=${targetTrackId} attempt=${attempt} result=started`);
                    recoveryRetries.set(targetTrackId, attempt);
                    
                    // Small delay before retry to allow network to settle
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Post-delay validation: verify generation & active track haven't changed
                    if (typeof getPlaybackGeneration === 'function' && getPlaybackGeneration() !== recoveryGen) {
                        console.log(`[PlaybackRecovery] track=${targetTrackId} attempt=${attempt} result=aborted (generation changed)`);
                        return;
                    }
                    const currentActive = await TrackPlayer.getActiveTrack();
                    if (!currentActive || currentActive.id !== targetTrackId) {
                        console.log(`[PlaybackRecovery] track=${targetTrackId} attempt=${attempt} result=aborted (active track changed)`);
                        return;
                    }

                    const refreshed = await store.refreshTrackUrl(targetTrackId);
                    
                    if (refreshed && refreshed.id === targetTrackId) {
                        await queueController.run(async () => {
                            if (typeof getPlaybackGeneration === 'function' && getPlaybackGeneration() !== recoveryGen) {
                                console.log(`[PlaybackRecovery] track=${targetTrackId} attempt=${attempt} result=aborted (generation changed post-refresh)`);
                                return;
                            }
                            const postRefreshActive = await TrackPlayer.getActiveTrack();
                            if (!postRefreshActive || postRefreshActive.id !== targetTrackId) {
                                console.log(`[PlaybackRecovery] track=${targetTrackId} attempt=${attempt} result=aborted (active track changed post-refresh)`);
                                return;
                            }

                            const currentQueue = await TrackPlayer.getQueue();
                            const currentIndex = await TrackPlayer.getActiveTrackIndex();
                            const targetIndex = currentQueue.findIndex(t => t.id === targetTrackId);

                            // Ensure target track is found and is indeed the currently active track
                            if (targetIndex !== -1 && currentIndex !== undefined && targetIndex === currentIndex) {
                                console.log(`[PlaybackRecovery] track=${targetTrackId} attempt=${attempt} result=success`);
                                if (typeof setPlaybackTransitionReason === 'function') {
                                    setPlaybackTransitionReason('ERROR_RECOVERY');
                                }
                                await TrackPlayer.remove(targetIndex);
                                await TrackPlayer.add(refreshed, targetIndex);
                                await TrackPlayer.skip(targetIndex);
                                await TrackPlayer.play();
                            } else {
                                console.log(`[PlaybackRecovery] track=${targetTrackId} attempt=${attempt} result=aborted (index mismatch)`);
                            }
                        });
                        return;
                    }
                } else {
                    console.warn(`[PlaybackRecovery] track=${targetTrackId} attempt=${attempt} result=failed (MAX_RETRY_ATTEMPTS reached)`);
                    recoveryRetries.delete(targetTrackId);
                }
            }
            
            // Fallback: Stop trying instead of skipping uncontrollably
            console.log('[PlayerService]: Recovery unviable, stopping playback.');
        } catch (e) {
            console.error('[PlayerService]: Could not recover or skip after error:', e);
        }
    });

    TrackPlayer.addEventListener(Event.PlaybackState, async (event) => {
        const { usePlayerStore } = require('../hooks/usePlayerStore');
        const isPlaying = event.state === State.Playing;
        usePlayerStore.getState().setIsPlaying(isPlaying);
        
        if (event.state === State.Paused || event.state === State.Stopped) {
            try {
                const pos = await TrackPlayer.getPosition();
                if (pos > 0) usePlayerStore.getState().setLastPosition(pos);
            } catch (e) { }
        }
    });

    let lastSavedSecond = 0;
    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (event) => {
        const { usePlayerStore } = require('../hooks/usePlayerStore');
        const currentSecond = Math.floor(event.position);
        
        // Save position every 5 seconds or on track boundary
        if (currentSecond !== lastSavedSecond && currentSecond % 5 === 0) {
            lastSavedSecond = currentSecond;
            usePlayerStore.getState().setLastPosition(event.position);
        }
    });
};
