import TrackPlayer, { Event, State } from 'react-native-track-player';

export const PlaybackService = async function () {
    TrackPlayer.addEventListener(Event.RemotePlay, () => { console.log('RemotePlay'); TrackPlayer.play(); });
    TrackPlayer.addEventListener(Event.RemotePause, () => { console.log('RemotePause'); TrackPlayer.pause(); });
    TrackPlayer.addEventListener(Event.RemoteNext, () => { console.log('RemoteNext'); TrackPlayer.skipToNext(); });
    TrackPlayer.addEventListener(Event.RemotePrevious, () => { console.log('RemotePrevious'); TrackPlayer.skipToPrevious(); });
    TrackPlayer.addEventListener(Event.RemoteStop, () => { console.log('RemoteStop'); TrackPlayer.reset(); });
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

    let lastLoadedTrackIndex = -1;
    TrackPlayer.addEventListener(Event.PlaybackTrackChanged, async (event) => {
        const { usePlayerStore } = require('../hooks/usePlayerStore');
        const store = usePlayerStore.getState();
        
        if (event.nextTrack !== undefined && event.nextTrack !== null) {
            // Prevent duplicate triggers for the same track index
            if (lastLoadedTrackIndex === event.nextTrack) return;
            lastLoadedTrackIndex = event.nextTrack;

            const track = await TrackPlayer.getTrack(event.nextTrack);
            if (track) {
                store.setCurrentTrack(track);

                // Load more recommendations if we're nearing the end of the queue
                const queue = await TrackPlayer.getQueue();
                if (event.nextTrack >= queue.length - 3) {
                    if (track.id) {
                        store.loadRecommendations(track.id);
                    }
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
