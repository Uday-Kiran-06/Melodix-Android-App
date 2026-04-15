import TrackPlayer, { Event, State } from 'react-native-track-player';

export const PlaybackService = async function () {
    TrackPlayer.addEventListener(Event.RemotePlay, () => { console.log('RemotePlay'); TrackPlayer.play(); });
    TrackPlayer.addEventListener(Event.RemotePause, () => { console.log('RemotePause'); TrackPlayer.pause(); });
    TrackPlayer.addEventListener(Event.RemoteNext, () => { console.log('RemoteNext'); TrackPlayer.skipToNext(); });
    TrackPlayer.addEventListener(Event.RemotePrevious, () => { console.log('RemotePrevious'); TrackPlayer.skipToPrevious(); });
    TrackPlayer.addEventListener(Event.RemoteStop, async () => { 
        console.log('RemoteStop'); 
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
    TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
        if (event.permanent) {
            await TrackPlayer.pause();
        } else {
            if (event.paused) {
                await TrackPlayer.pause();
            } else {
                // Rely on native ducking for transient interruptions
                const state = await TrackPlayer.getState();
                if (state !== State.Playing) {
                    await TrackPlayer.play();
                }
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

            // Load more recommendations if we're nearing the end of the queue
            const index = event.index;
            const queue = await TrackPlayer.getQueue();
            if (index !== undefined && index >= queue.length - 3) {
                if (event.track.id) {
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
        console.log('[PlayerService]: Queue ended, loading recommendations...');
        const { usePlayerStore } = require('../hooks/usePlayerStore');
        const store = usePlayerStore.getState();
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
};
