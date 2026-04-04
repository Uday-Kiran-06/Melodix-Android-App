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
            // Prevent duplicate triggers for the same track ID
            const isNewTrack = lastTrackId !== event.track.id;
            lastTrackId = event.track.id;

            store.setCurrentTrack(event.track);
            // Reset and load lyrics state for the new track ONLY if needed
            if (isNewTrack || !store.syncedLyrics || !store.plainLyrics) {
                usePlayerStore.setState({ syncedLyrics: null, plainLyrics: null, isLoadingLyrics: false });
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
        }
    });

    TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
        const { usePlayerStore } = require('../hooks/usePlayerStore');
        const isPlaying = event.state === State.Playing;
        usePlayerStore.getState().setIsPlaying(isPlaying);
    });
};
