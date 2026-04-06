import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import TrackPlayer, { useProgress } from 'react-native-track-player';
import { MotiView, MotiText } from 'moti';
import * as Haptics from 'expo-haptics';
import { MusicImage } from './MusicImage';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Music2, Mic2, ChevronDown } from 'lucide-react-native';
import { DesignSystem } from '@/constants/DesignSystem';
import { lyricsService } from '@/services/lyrics';
import { useRouter } from 'expo-router';

import GlassCard from './GlassCard';

const { height, width } = Dimensions.get('window');

interface LyricsViewProps {
    scrollViewRef: React.RefObject<ScrollView | null>;
}

export const LyricsView: React.FC<LyricsViewProps> = ({ scrollViewRef }) => {
    const { currentTrack, syncedLyrics, plainLyrics, isLoadingLyrics, loadLyrics } = usePlayerStore();
    const { position } = useProgress(50); // Faster polling for premium sync
    const syncOffset = -0.15; // 150ms earlier provides the most "on-beat" feel
    const [activeIndex, setActiveIndex] = useState(-1);
    const lyricsContainerRef = useRef<View>(null);
    const internalScrollViewRef = useRef<ScrollView>(null);
    const lineHeights = useRef<{ [key: number]: number }>({});
    const [scrollViewHeight, setScrollViewHeight] = useState(0);
    const [containerY, setContainerY] = useState(0);
    const router = useRouter();
    const lastLoadedTrackId = useRef<string | null>(null);

    const boxSize = width - 48;
    // Reserve space for the header (icon + title + margin)
    const headerHeight = 52;
    // Reserve space for footer attribution
    const footerHeight = 30;
    // Available height for lyrics content inside the box
    const lyricsContentHeight = boxSize - headerHeight - footerHeight - 32; // 32 = GlassCard padding

    useEffect(() => {
        if (currentTrack && currentTrack.id !== lastLoadedTrackId.current) {
            lastLoadedTrackId.current = currentTrack.id;
            // Reset active index and measurements for new track
            setActiveIndex(-1);
            lineHeights.current = {};
            
            // Proactively load lyrics if missing (helps with app restart restoration)
            if (!syncedLyrics && !plainLyrics && !isLoadingLyrics) {
                loadLyrics(currentTrack);
            }
        }
    }, [currentTrack?.id, syncedLyrics, plainLyrics, isLoadingLyrics]);

    useEffect(() => {
        if (!syncedLyrics || syncedLyrics.length === 0) return;

        // Find the current line based on position + offset
        const adjustedPosition = position - syncOffset;
        const index = syncedLyrics.findIndex((line, i) => {
            const nextLine = syncedLyrics[i + 1];
            return adjustedPosition >= line.time && (!nextLine || adjustedPosition < nextLine.time);
        });

        if (index !== -1 && index !== activeIndex) {
            const start = Date.now();
            setActiveIndex(index);
            console.log(`[Lyrics]: Highlighted line ${index} (Sync latency: ${Date.now() - start}ms)`);
            
            // Calculate INTERNAL scroll position to center the current line
            let offset = 0;
            for (let i = 0; i < index; i++) {
                offset += lineHeights.current[i] || 55;
            }

            const currentLineHeight = lineHeights.current[index] || 55;
            // Scroll to the cumulative offset + half of the current line's height
            // to place the line's vertical center exactly in the middle of the box.
            const targetInternalY = offset + (currentLineHeight / 2);
            
            internalScrollViewRef.current?.scrollTo({
                y: targetInternalY,
                animated: true,
            });
        }
    }, [position, syncedLyrics, lyricsContentHeight]);

    const handleSeek = async (time: number) => {
        await TrackPlayer.seekTo(time);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    return (
        <View 
            className="mt-6 px-6 pb-20 items-center"
            onLayout={(e) => setContainerY(e.nativeEvent.layout.y)}
            ref={lyricsContainerRef}
        >
            <GlassCard 
                className="overflow-hidden"
                style={{ width: boxSize, height: boxSize }}
            >
                <View className="flex-row items-center mb-6">
                    <Mic2 size={22} color={DesignSystem.colors.primary} />
                    <Text className="text-white font-bold text-2xl ml-3">Lyrics</Text>
                </View>

                {/* Content */}
                <View style={{ height: lyricsContentHeight }}>
                    {isLoadingLyrics ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator size="large" color="white" />
                            <Text className="text-zinc-400 mt-4 font-medium">Finding lyrics...</Text>
                        </View>
                    ) : syncedLyrics && syncedLyrics.length > 0 ? (
                        <View style={{ flex: 1 }}>
                            <ScrollView 
                                ref={internalScrollViewRef}
                                showsVerticalScrollIndicator={false}
                                scrollEnabled={false}
                                onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
                                contentContainerStyle={{ 
                                    paddingTop: lyricsContentHeight / 2,
                                    paddingBottom: lyricsContentHeight / 2,
                                }}
                            >
                                {syncedLyrics.map((item, index) => {
                                    const isActive = index === activeIndex;
                                    const isNext = index === activeIndex + 1;
                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            onPress={() => handleSeek(item.time)}
                                            activeOpacity={0.7}
                                            onLayout={(e) => {
                                                lineHeights.current[index] = e.nativeEvent.layout.height + 12;
                                            }}
                                            style={{ minHeight: 40, justifyContent: 'center', marginVertical: 6, width: '100%' }}
                                        >
                                            <MotiView
                                                animate={{
                                                    opacity: isActive ? 1 : (isNext ? 0.6 : 0.15),
                                                    scale: isActive ? 1.05 : 0.95,
                                                }}
                                                transition={{ type: 'timing', duration: 80 }}
                                                style={{ width: '100%' }}
                                            >
                                                <Text
                                                    className={`${isActive ? 'text-xl' : 'text-lg'} font-bold leading-7 text-center px-4`}
                                                    numberOfLines={2}
                                                    adjustsFontSizeToFit
                                                    style={{
                                                        color: isActive ? '#fff' : '#ccc',
                                                        textShadowColor: isActive ? 'rgba(0,0,0,0.5)' : 'transparent',
                                                        textShadowOffset: { width: 0, height: 2 },
                                                        textShadowRadius: 4,
                                                        width: '100%',
                                                    }}
                                                >
                                                    {item.text}
                                                </Text>
                                            </MotiView>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    ) : plainLyrics ? (
                        <View style={{ flex: 1 }}>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <Text className="text-xl text-zinc-200 font-bold leading-relaxed px-4 text-center">
                                    {lyricsService.cleanPlainLyrics(plainLyrics)}
                                </Text>
                            </ScrollView>
                        </View>
                    ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
                            <Music2 size={48} color="#52525b" />
                            <Text className="text-zinc-400 text-center mt-6 text-lg font-medium leading-6">
                                We couldn't find lyrics for this one.
                            </Text>
                        </View>
                    )}
                </View>

                {/* Footer Attribution */}
                {(syncedLyrics || plainLyrics) && (
                    <View className="pt-2 items-center border-t border-white/5 mt-2">
                        <Text className="text-zinc-500 text-[8px] tracking-widest uppercase opacity-40">
                            Lyrics provided by Melodix
                        </Text>
                    </View>
                )}
            </GlassCard>

            {/* Premium Lyrics Preview Button (Outside Box) */}
            {(syncedLyrics || plainLyrics) && (
                <MotiView
                    from={{ scale: 0.95, opacity: 0.9 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                        type: 'timing',
                        duration: 1000,
                        loop: true,
                        repeatReverse: true,
                    }}
                    className="mt-6"
                >
                    <TouchableOpacity 
                        onPress={() => router.push('/lyrics')}
                        activeOpacity={0.8}
                        style={{ borderRadius: 100, overflow: 'hidden' }}
                    >
                        <LinearGradient
                            colors={['#10b981', '#059669']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ 
                                paddingHorizontal: 16, 
                                paddingVertical: 8, 
                                borderRadius: 100,
                                flexDirection: 'row',
                                alignItems: 'center',
                            }}
                            className="shadow-xl shadow-emerald-500/40"
                        >
                            <Mic2 size={12} color="#fff" className="mr-2" />
                            <Text className="text-white font-black text-[9px] uppercase tracking-[2px] ml-1">
                                Lyrics Preview
                            </Text>
                            <View className="ml-2 bg-white/20 rounded-full p-1">
                                <ChevronDown size={8} color="#fff" style={{ transform: [{ rotate: '-90deg' }] }} />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </MotiView>
            )}
        </View>
    );
};
