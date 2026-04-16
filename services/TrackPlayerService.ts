import TrackPlayer, { Event, State } from 'react-native-track-player';

export const PlaybackService = async function () {
    TrackPlayer.addEventListener(Event.RemotePlay, () => { console.log('RemotePlay'); TrackPlayer.play(); });
    TrackPlayer.addEventListener(Event.RemotePause, () => { console.log('RemotePause'); TrackPlayer.pause(); });
    TrackPlayer.addEventListener(Event.RemoteNext, () => { console.log('RemoteNext'); TrackPlayer.skipToNext(); });
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
                const index = event.index;
                const queue = await TrackPlayer.getQueue();
                const remaining = queue.length - ((index ?? 0) + 1);
                if (remaining <= 5 && event.track.id && store.repeatMode === 'off') {
                    console.log(`[PlayerService]: Only ${remaining} tracks left, topping up queue...`);
                    store.loadRecommendations(event.track.id);
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
        // We only want to manually load recommendations and skip forward if repeat is OFF.
        if (store.repeatMode !== 'off') {
            console.log(`[PlayerService]: Queue ended with repeat: ${store.repeatMode}, ignoring manual recommendation load.`);
            return;
        }

        console.log('[PlayerService]: Queue ended, loading recommendations...');
        const lastTrack = store.currentTrack;

        if (!lastTrack?.id) return;

        try {
            // Load recommendations for the last played track
            await store.loadRecommendations(lastTrack.id);

            // After recommendations are added, resume playback from the next available track
            const queue = await TrackPlayer.getQueue();
            const currentIndex = await TrackPlayer.getActiveTrackIndex();
            const nextIndex = (currentIndex ?? -1) + 1;

            if (queue.length > nextIndex) {
                console.log(`[PlayerService]: Resuming from track index ${nextIndex}`);
                await TrackPlayer.skip(nextIndex);
                await TrackPlayer.play();
                store.setIsPlaying(true);
            }
        } catch (e) {
            console.error('[PlayerService]: Failed to continue after queue ended:', e);
        }
    });

    // Handle playback errors: skip the broken track instead of stopping
    TrackPlayer.addEventListener(Event.PlaybackError, async (event) => {
        console.error('[PlayerService]: Playback error, skipping track:', event);
        try {
            await TrackPlayer.skipToNext();
            await TrackPlayer.play();
        } catch (e) {
            console.error('[PlayerService]: Could not skip after playback error:', e);
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
