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
                // If it's a ducking event, lower the volume
                if ((event as any).ducking) {
                    await TrackPlayer.setVolume(0.3);
                } else {
                    // Otherwise, restore the volume
                    await TrackPlayer.setVolume(1);
                    // And ensure playback continues if it was transiently paused
                    const state = await TrackPlayer.getState();
                    if (state !== State.Playing) {
                        await TrackPlayer.play();
                    }
                }
            }
        }
    });

    TrackPlayer.addEventListener(Event.PlaybackTrackChanged, async (event) => {
        const { usePlayerStore } = require('../hooks/usePlayerStore');
        if (event.nextTrack !== undefined) {
            const track = await TrackPlayer.getTrack(event.nextTrack);
            usePlayerStore.getState().setCurrentTrack(track);
        }
    });

    TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
        const { usePlayerStore } = require('../hooks/usePlayerStore');
        const isPlaying = event.state === State.Playing;
        usePlayerStore.getState().setIsPlaying(isPlaying);
    });
};
