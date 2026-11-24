import { MusicImage } from '@/components/MusicImage';
import * as Haptics from 'expo-haptics';
import { usePlayerStore, setPlaybackTransitionReason } from '@/hooks/usePlayerStore';
import { jioSaavnService } from '@/services/jiosaavn';
import { useRouter, useSegments, usePathname } from 'expo-router';
import { Clock, Pause, Play, SkipForward } from 'lucide-react-native';
import { MotiView } from 'moti';
import React, { memo, useCallback } from 'react';
import { Dimensions, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import TrackPlayer, { useProgress } from 'react-native-track-player';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useSettingsStore } from '@/hooks/useSettingsStore';

const { width } = Dimensions.get('window');

const MarqueeText = ({ text, style, className }: { text: string; style?: any; className?: string }) => {
    const textWidth = (text?.length || 0) * 8;
    const containerWidth = width - 190;

    if (textWidth < containerWidth) {
        return <Text className={className} style={style} numberOfLines={1}>{text || ""}</Text>;
    }

    return (
        <View style={{ overflow: 'hidden', width: containerWidth }}>
            <MotiView
                from={{ translateX: 0 }}
                animate={{ translateX: -textWidth }}
                transition={{
                    loop: true,
                    type: 'timing',
                    duration: (text?.length || 1) * 200,
                    repeatReverse: false,
                }}
                style={{ flexDirection: 'row' }}
            >
                <Text className={className} style={[style, { paddingRight: 30 }]}>{text}</Text>
                <Text className={className} style={style}>{text}</Text>
            </MotiView>
        </View>
    );
};

export default memo(function MiniPlayer() {
    const { currentTrack, isPlaying, togglePlayback, sleepTimer, remainingTime, repeatMode, playNextRecommendation } = usePlayerStore();
    const { theme, audioQuality } = useSettingsStore();
    const { position, duration } = useProgress(200);
    const router = useRouter();
    const segments = useSegments();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();
    const isDark = theme === 'dark';

    const isInTabs = segments[0] === '(tabs)';
    const isPlayerScreen = pathname === '/player';

    const handleSkipNext = useCallback(async (e: any) => {
        e?.stopPropagation?.();
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const currentIndex = await TrackPlayer.getActiveTrackIndex();
            const playerQueue = await TrackPlayer.getQueue();
            const isLastTrack = currentIndex !== undefined && currentIndex === playerQueue.length - 1;

            if (isLastTrack && repeatMode === 'queue') {
                setPlaybackTransitionReason('USER_NEXT');
                await TrackPlayer.skip(0);
                await TrackPlayer.play();
            } else if (!isLastTrack) {
                setPlaybackTransitionReason('USER_NEXT');
                await TrackPlayer.skipToNext();
            } else {
                setPlaybackTransitionReason('USER_NEXT');
                await playNextRecommendation();
            }
        } catch (err) {
            console.error('[MiniPlayer]: Skip next failed', err);
        }
    }, [repeatMode, playNextRecommendation]);

    if (!currentTrack || isPlayerScreen) return null;

    const progressPercent = Math.min(100, Math.max(0, (position / (duration || 1)) * 100));

    return (
        <MotiView
            from={{ translateY: 20, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            exit={{ translateY: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 18 }}
            style={[
                styles.floatingContainer,
                {
                    bottom: (isInTabs ? 52 : 8) + insets.bottom,
                }
            ]}
        >
            <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/player');
                }}
                style={styles.touchableCard}
            >
                {/* Real-time Frosted Glass & Artwork Blur Backdrop */}
                <MusicImage
                    images={currentTrack.artwork || currentTrack.image}
                    style={StyleSheet.absoluteFillObject}
                    blurRadius={65}
                    transition={400}
                />
                
                <BlurView
                    intensity={60}
                    tint={isDark ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFillObject}
                />

                {/* Translucent Frosted Glass Tint */}
                <View 
                    style={[
                        StyleSheet.absoluteFillObject,
                        { backgroundColor: isDark ? 'rgba(15, 15, 20, 0.65)' : 'rgba(255, 255, 255, 0.65)' }
                    ]}
                />

                {/* Content */}
                <View style={styles.contentRow}>
                    {/* Rounded Album Art Thumbnail with Glass Shadow */}
                    <View style={styles.thumbnailWrapper}>
                        <MusicImage
                            images={currentTrack.artwork || currentTrack.image}
                            style={styles.thumbnail}
                        />
                    </View>

                    {/* Track Info & Lossless Pill */}
                    <View style={styles.infoCol}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MarqueeText
                                text={currentTrack.title || 'Unknown Track'}
                                style={{
                                    color: isDark ? '#ffffff' : '#0f172a',
                                    fontWeight: '700',
                                    fontSize: 14,
                                }}
                            />
                            {audioQuality === '320kbps' && (
                                <View style={styles.losslessBadge}>
                                    <Text style={styles.losslessText}>LOSSLESS</Text>
                                </View>
                            )}
                            {sleepTimer && (
                                <View style={styles.sleepTimerBadge}>
                                    <Clock size={8} color="#10b981" />
                                    <Text style={styles.sleepTimerText}>
                                        {Math.ceil((remainingTime || 0) / 60)}m
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text 
                            style={{
                                color: isDark ? '#94a3b8' : '#64748b',
                                fontSize: 12,
                                marginTop: 1,
                            }}
                            numberOfLines={1}
                        >
                            {currentTrack.artist || 'Unknown Artist'}
                        </Text>
                    </View>

                    {/* Media Controls: Play/Pause + Skip Next */}
                    <View style={styles.controlsRow}>
                        <TouchableOpacity
                            hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                            onPress={async (e) => {
                                e.stopPropagation();
                                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                togglePlayback();
                            }}
                            style={styles.playButton}
                        >
                            {isPlaying ? (
                                <Pause size={22} color={isDark ? '#fff' : '#0f172a'} fill={isDark ? '#fff' : '#0f172a'} />
                            ) : (
                                <Play size={22} color={isDark ? '#fff' : '#0f172a'} fill={isDark ? '#fff' : '#0f172a'} />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                            onPress={handleSkipNext}
                            style={styles.skipButton}
                        >
                            <SkipForward size={20} color={isDark ? '#94a3b8' : '#64748b'} fill={isDark ? '#94a3b8' : '#64748b'} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Ultra-thin Apple Glass Micro-Progress Bar */}
                <View style={styles.progressBarBackground}>
                    <View
                        style={[
                            styles.progressBarFill,
                            { width: `${progressPercent}%` }
                        ]}
                    />
                </View>
            </TouchableOpacity>
        </MotiView>
    );
});

const styles = StyleSheet.create({
    floatingContainer: {
        position: 'absolute',
        left: 12,
        right: 12,
        height: 64,
        zIndex: 100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 12,
    },
    touchableCard: {
        flex: 1,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    contentRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    thumbnailWrapper: {
        width: 44,
        height: 44,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#18181b',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    infoCol: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    losslessBadge: {
        marginLeft: 6,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderWidth: 0.5,
        borderColor: '#10b981',
    },
    losslessText: {
        color: '#10b981',
        fontSize: 7,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    sleepTimerBadge: {
        marginLeft: 6,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    sleepTimerText: {
        color: '#10b981',
        fontSize: 8,
        fontWeight: '700',
        marginLeft: 2,
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
    },
    playButton: {
        padding: 6,
    },
    skipButton: {
        padding: 6,
        marginLeft: 4,
    },
    progressBarBackground: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2.5,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#10b981',
        borderRadius: 2,
    },
});
