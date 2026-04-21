import TrackPlayer, { Event, State } from 'react-native-track-player';

// Track IDs and their current retry count (reset when a track starts successfully)
const recoveryRetries = new Map<string, number>();
const MAX_RETRY_ATTEMPTS = 3;

// Track IDs that have already been retried once in the current session
const retriedTrackIds = new Set<string>();

export const PlaybackService = async function () {
    const safeSkipForward = async () => {
        const { usePlayerStore } = require('../hooks/usePlayerStore');
        const store = usePlayerStore.getState();
        
        try {
            const queue = await TrackPlayer.getQueue();
            const index = await TrackPlayer.getActiveTrackIndex();
            
            if (index !== undefined && index === queue.length - 1 && store.repeatMode === 'off') {
                const currentTrack = await TrackPlayer.getActiveTrack();
                if (currentTrack?.id) {
                    console.log('[PlayerService]: RemoteNext at end of queue, loading rescue seeds...');
                    await store.loadRecommendations(currentTrack.id, true);
                }
            }
            await TrackPlayer.skipToNext();
            await TrackPlayer.play();
        } catch (e) {
            console.error('[PlayerService]: safeSkipForward failed:', e);
        }
    };

    TrackPlayer.addEventListener(Event.RemotePlay, () => { console.log('RemotePlay'); TrackPlayer.play(); });
    TrackPlayer.addEventListener(Event.RemotePause, () => { console.log('RemotePause'); TrackPlayer.pause(); });
    TrackPlayer.addEventListener(Event.RemoteNext, () => { console.log('RemoteNext'); safeSkipForward(); });
    TrackPlayer.addEventListener(Event.RemotePrevious, () => { console.log('RemotePrevious'); TrackPlayer.skipToPrevious(); });
    TrackPlayer.addEventListener(Event.RemoteStop, async () => { 
        console.log('RemoteStop'); 
        const { usePlayerStore } = require('../hooks/usePlayerStore');
        const store = usePlayerStore.getState();
        
        // Capture final position before reset
        try {
            const pos = await TrackPlayer.getPosition();
            if (pos > 0) store.setLastPosition(pos);
        } catch (e) {}

        await TrackPlayer.stop();
        await TrackPlayer.reset(); 
    });
    TrackPlayer.addEventListener(Event.RemoteSeek, async (event) => {
        console.log('RemoteSeek to:', event.position);
        await TrackPlayer.seekTo(event.position);
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
    TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
        const { usePlayerStore } = require('../hooks/usePlayerStore');
        const store = usePlayerStore.getState();
        
        if (event.track !== undefined && event.track !== null) {
            console.log(`[PlayerService]: Active track changed to: ${event.track.title} (${event.track.id})`);
            
            // Prevent duplicate triggers for the same track ID
            const isNewTrack = lastTrackId !== event.track.id;
            lastTrackId = event.track.id;

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

            // Proactively top up queue when 5 tracks or fewer remain
            // (raised from 3 to give more time for multi-seed network calls)
            if (isNewTrack) {
                // Reset retry count for this track since it successfully started
                recoveryRetries.delete(event.track.id);

                const index = event.index;
                const queue = await TrackPlayer.getQueue();
                const remaining = queue.length - ((index ?? 0) + 1);
                if (remaining <= 5 && event.track.id && store.repeatMode === 'off') {
                    console.log(`[PlayerService]: Only ${remaining} tracks left, topping up queue...`);
                    store.loadRecommendations(event.track.id);
                }

                // PROACTIVE JIT REFRESH: If there is a next track, refresh it now to prevent future errors
                const nextIndex = (index ?? 0) + 1;
                if (nextIndex < queue.length) {
                    const nextTrack = queue[nextIndex];
                    if (nextTrack?.id) {
                        console.log(`[PlayerService]: Proactively refreshing next track: ${nextTrack.title}`);
                        store.refreshTrackUrl(nextTrack.id).then(async (refreshed: any) => {
                            if (refreshed) {
                                try {
                                    // Native Gapless Swap: silently update the native queue item holding the URL
                                    // This fetches the URL ahead of time without interrupting the currently playing track!
                                    const latestQueue = await TrackPlayer.getQueue();
                                    const latestIndex = await TrackPlayer.getActiveTrackIndex();
                                    
                                    // Ensure playback hasn't already reached or passed our target track index
                                    if (latestIndex !== undefined && latestIndex < nextIndex && latestQueue.length > nextIndex) {
                                        if (latestQueue[nextIndex].id === refreshed.id) {
                                            console.log(`[PlayerService]: Natively swapping refreshed URL ahead of time for: ${refreshed.title}`);
                                            await TrackPlayer.remove(nextIndex);
                                            await TrackPlayer.add(refreshed, nextIndex);
                                        }
                                    }
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

    // Handle end of queue: load recommendations and resume playback
    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
        const { usePlayerStore } = require('../hooks/usePlayerStore');
        const store = usePlayerStore.getState();

        // REPEAT GUARD: If repeat is active, let native TrackPlayer looping handle it.
        if (store.repeatMode !== 'off') {
            console.log(`[PlayerService]: Queue ended with repeat: ${store.repeatMode}, ignoring manual recommendation load.`);
            return;
        }

        console.log('[PlayerService]: Queue ended, loading/waiting for recommendations...');
        const lastTrack = store.currentTrack;

        if (!lastTrack?.id) return;

        try {
            // This will now WAIT for any ongoing proactive load due to the new Promise guard in store
            await store.loadRecommendations(lastTrack.id);

            // After recommendations are added (or waited for), resume playback from the next available track
            const queue = await TrackPlayer.getQueue();
            const currentIndex = await TrackPlayer.getActiveTrackIndex();
            const nextIndex = (currentIndex ?? -1) + 1;

            if (queue.length > nextIndex) {
                console.log(`[PlayerService]: Resuming from track index ${nextIndex}`);
                await TrackPlayer.skip(nextIndex);
                await TrackPlayer.play();
                store.setIsPlaying(true);
            } else {
                console.log('[PlayerService]: No tracks found even after recommendation load.');
            }
        } catch (e) {
            console.error('[PlayerService]: Failed to continue after queue ended:', e);
        }
    });

    // Handle playback errors: attempt to refresh URL and retry before skipping
    TrackPlayer.addEventListener(Event.PlaybackError, async (event) => {
        const { usePlayerStore } = require('../hooks/usePlayerStore');
        const store = usePlayerStore.getState();
        
        console.error('[PlayerService]: Playback error:', event);
        
        try {
            const activeTrack = await TrackPlayer.getActiveTrack();
            if (activeTrack && activeTrack.id) {
                const attempt = (recoveryRetries.get(activeTrack.id) || 0) + 1;
                
                if (attempt <= MAX_RETRY_ATTEMPTS) {
                    console.log(`[PlayerService]: Hyper-Persistent Recovery (Attempt ${attempt}/${MAX_RETRY_ATTEMPTS}) for: ${activeTrack.title}`);
                    recoveryRetries.set(activeTrack.id, attempt);
                    
                    // Small delay before retry to allow network to settle
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    const refreshed = await store.refreshTrackUrl(activeTrack.id);
                    if (refreshed) {
                        const currentIndex = await TrackPlayer.getActiveTrackIndex();
                        if (currentIndex !== undefined) {
                            await TrackPlayer.remove(currentIndex);
                            await TrackPlayer.add(refreshed, currentIndex);
                            await TrackPlayer.skip(currentIndex);
                            await TrackPlayer.play();
                            return;
                        }
                    }
                } else {
                    console.warn(`[PlayerService]: MAX_ATTEMPTS reached for ${activeTrack.id}, giving up.`);
                    recoveryRetries.delete(activeTrack.id);
                }
            }
            
            // Fallback: Stop trying instead of skipping uncontrollably
            console.log('[PlayerService]: Recovery unviable, stopping playback.');
            // Removed safeSkipForward() based on user request avoiding skipping algorithm
        } catch (e) {
            console.error('[PlayerService]: Could not recover or skip after error:', e);
        }
    });

    TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
        const { usePlayerStore } = require('../hooks/usePlayerStore');
        const isPlaying = event.state === State.Playing;
        usePlayerStore.getState().setIsPlaying(isPlaying);
    });

    let lastSavedSecond = 0;
    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (event) => {
        const { usePlayerStore } = require('../hooks/usePlayerStore');
        const currentSecond = Math.floor(event.position);
        
        // Save position every 10 seconds or on track boundary
        if (currentSecond !== lastSavedSecond && currentSecond % 10 === 0) {
            lastSavedSecond = currentSecond;
            usePlayerStore.getState().setLastPosition(event.position);
        }
    });
};
