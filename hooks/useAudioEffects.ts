import { useEffect, useRef } from 'react';
import { useSettingsStore } from './useSettingsStore';
import * as AudioEffects from '../modules/native-audio-effects';
import TrackPlayer, { useProgress, State, usePlaybackState } from 'react-native-track-player';
import { usePlayerStore } from './usePlayerStore';

export const useAudioEffects = () => {
    const {
        bassBoostStrength,
        eqGains,
        loudnessGain,
        isBassBoostEnabled,
        isEqEnabled,
        isLoudnessEnabled,
        crossfadeEnabled,
        crossfadeDuration
    } = useSettingsStore();

    const { position, duration } = useProgress(200); // Check every 200ms
    const playbackState = usePlaybackState();
    const isPlaying = playbackState.state === State.Playing;
    const isTransitioning = useRef(false);

    // Scan for audio session ID when playback starts, but ONLY if any effect is enabled
    const anyEffectEnabled = isBassBoostEnabled || isEqEnabled || isLoudnessEnabled;
    
    useEffect(() => {
        if (isPlaying && anyEffectEnabled) {
            // Small delay to ensure the player has started and registered with the system
            const timer = setTimeout(() => {
                AudioEffects.scanForSession();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isPlaying, anyEffectEnabled]);

    // Audio Effect Sync (Existing)
    useEffect(() => {
        try {
            AudioEffects.setEnabled('bass', isBassBoostEnabled);
            if (isBassBoostEnabled) {
                AudioEffects.setBassBoost(bassBoostStrength);
            }
        } catch (e) {
            console.error('Failed to apply Bass Boost:', e);
        }
    }, [isBassBoostEnabled, bassBoostStrength]);

    useEffect(() => {
        try {
            AudioEffects.setEnabled('eq', isEqEnabled);
            if (isEqEnabled) {
                eqGains.forEach((gain, index) => {
                    AudioEffects.setEqualizerBandGain(index, gain);
                });
            }
        } catch (e) {
            console.error('Failed to apply Equalizer:', e);
        }
    }, [isEqEnabled, eqGains]);

    useEffect(() => {
        try {
            AudioEffects.setEnabled('loudness', isLoudnessEnabled);
            if (isLoudnessEnabled) {
                AudioEffects.setLoudnessGain(loudnessGain);
            }
        } catch (e) {
            console.error('Failed to apply Loudness Enhancer:', e);
        }
    }, [isLoudnessEnabled, loudnessGain]);

    const lastSkipTrackId = useRef<string | null>(null);

    const { repeatMode } = usePlayerStore();

    // Crossfade Logic
    useEffect(() => {
        // Disable crossfade if Repeat Track is enabled, as native TrackPlayer looping 
        // doesn't support crossfading into the same track via manual skipToNext().
        if (!crossfadeEnabled || repeatMode === 'track' || !isPlaying || duration <= 0 || isTransitioning.current) return;

        const timeLeft = duration - position;
        const fadeThreshold = crossfadeDuration;

        if (timeLeft > 0 && timeLeft <= fadeThreshold) {
            const performCrossfade = async () => {
                const activeTrack = await TrackPlayer.getActiveTrack();
                if (!activeTrack || lastSkipTrackId.current === activeTrack.id) return;
                
                isTransitioning.current = true;
                lastSkipTrackId.current = activeTrack.id;

                const steps = 20;
                const stepDelay = (fadeThreshold * 1000) / steps;
                const targetGain = isLoudnessEnabled ? loudnessGain : 1000;
                
                try {
                    // 1. Check if there is a next track before fading
                    const queue = await TrackPlayer.getQueue();
                    const index = await TrackPlayer.getActiveTrackIndex();
                    
                    // Respect repeatMode: 'queue' loops around, but 'off' ends at queue.length - 1
                    const hasNextTrack = index !== undefined && (index < queue.length - 1 || repeatMode === 'queue');

                    // Only fade out if there's a next track to fade into
                    if (hasNextTrack) {
                        // 2. Fade Out
                        const startGain = targetGain;
                        const gainStepOut = startGain / steps;
                        
                        for (let i = 1; i <= steps; i++) {
                            const nextGain = Math.max(0, startGain - (gainStepOut * i));
                            AudioEffects.setLoudnessGain(Math.round(nextGain));
                            await new Promise(resolve => setTimeout(resolve, stepDelay));
                        }
                        AudioEffects.setLoudnessGain(0);

                        // 3. Skip to next track (verify we're still on the same track)
                        const currentTrack = await TrackPlayer.getActiveTrack();
                        if (currentTrack?.id === lastSkipTrackId.current) {
                            if (index === queue.length - 1 && repeatMode === 'queue') {
                                await TrackPlayer.skip(0);
                            } else {
                                await TrackPlayer.skipToNext();
                            }
                            
                            // 4. Fade In
                            const gainStepIn = targetGain / steps;
                            
                            AudioEffects.setEnabled('loudness', true);
                            AudioEffects.setLoudnessGain(0);
                            
                            for (let i = 1; i <= steps; i++) {
                                const nextGain = Math.min(targetGain, gainStepIn * i);
                                AudioEffects.setLoudnessGain(Math.round(nextGain));
                                await new Promise(resolve => setTimeout(resolve, stepDelay));
                            }
                            AudioEffects.setLoudnessGain(targetGain);
                            
                            // 5. Restore original loudness enabled state if it was off
                            if (!isLoudnessEnabled) {
                                AudioEffects.setEnabled('loudness', false);
                            }
                        } else {
                            // Track changed under us — restore volume
                            AudioEffects.setLoudnessGain(targetGain);
                            if (!isLoudnessEnabled) AudioEffects.setEnabled('loudness', false);
                        }
                    }
                    // If no next track, do nothing — let TrackPlayer's natural end event handle it
                } catch (e) {
                    console.error('Crossfade failed:', e);
                    // Safety: always restore volume on error
                    try { AudioEffects.setLoudnessGain(targetGain); } catch (_) {}
                } finally {
                    // Stay in transitioning state for a bit to allow the next track to settle
                    setTimeout(() => {
                        isTransitioning.current = false;
                    }, 2000);
                }
            };

            performCrossfade();
        }

        // Reset flag/lock if we are at the beginning of a track
        if (position < 1 && isTransitioning.current) {
            isTransitioning.current = false;
        }

    }, [position, duration, isPlaying, crossfadeEnabled, crossfadeDuration, isLoudnessEnabled, loudnessGain, repeatMode]);
};
