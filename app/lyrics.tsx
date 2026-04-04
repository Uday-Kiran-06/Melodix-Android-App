import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import TrackPlayer, { useProgress } from 'react-native-track-player';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { MusicImage } from '@/components/MusicImage';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, Mic2, Music2 } from 'lucide-react-native';
import { DesignSystem } from '@/constants/DesignSystem';
import { useRouter } from 'expo-router';
import { jioSaavnService } from '@/services/jiosaavn';
import { lyricsService } from '@/services/lyrics';

const { height, width } = Dimensions.get('window');

export default function FullLyricsScreen() {
    const { currentTrack, syncedLyrics, plainLyrics, isLoadingLyrics } = usePlayerStore();
    const { position } = useProgress(100);
    const [activeIndex, setActiveIndex] = useState(-1);
    const flatListRef = useRef<FlatList>(null);
    const router = useRouter();

    useEffect(() => {
        if (!syncedLyrics || syncedLyrics.length === 0) return;

        const index = syncedLyrics.findIndex((line, i) => {
            const nextLine = syncedLyrics[i + 1];
            return position >= line.time && (!nextLine || position < nextLine.time);
        });

        if (index !== -1 && index !== activeIndex) {
            setActiveIndex(index);
            flatListRef.current?.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0.5,
            });
        }
    }, [position, syncedLyrics]);

    const handleSeek = async (time: number) => {
        await TrackPlayer.seekTo(time);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const getImageUrl = (track: any) => {
        if (!track) return null;
        const images = track.artwork || track.image || track.images;
        return jioSaavnService.sanitizeImageUrl(images);
    };

    if (!currentTrack) return null;

    return (
        <View className="flex-1 bg-black">
            <StatusBar barStyle="light-content" />
            
            {/* Background Artwork */}
            <MusicImage
                images={getImageUrl(currentTrack)}
                className="absolute w-full h-full opacity-40"
                blurRadius={60}
            />
            <LinearGradient
                colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.5)', 'black']}
                className="absolute w-full h-full"
            />

            {/* Header */}
            <View className="pt-14 px-6 flex-row justify-between items-center z-10">
                <TouchableOpacity onPress={() => router.back()} className="p-2 bg-white/10 rounded-full">
                    <ChevronDown size={28} color="#fff" />
                </TouchableOpacity>
                <View className="items-center flex-1 px-4">
                    <Text className="text-white font-bold text-lg" numberOfLines={1}>{currentTrack.title}</Text>
                    <Text className="text-zinc-400 text-xs" numberOfLines={1}>{currentTrack.artist}</Text>
                </View>
                <View className="w-10" />
            </View>

            {/* Lyrics Content */}
            <View className="flex-1 mt-6">
                {isLoadingLyrics ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="large" color={DesignSystem.colors.primary} />
                        <Text className="text-zinc-400 mt-4 font-medium">Loading synced lyrics...</Text>
                    </View>
                ) : syncedLyrics && syncedLyrics.length > 0 ? (
                    <FlatList
                        ref={flatListRef}
                        data={syncedLyrics}
                        keyExtractor={(_, i) => i.toString()}
                        ListHeaderComponent={() => <View style={{ height: height * 0.5 }} />}
                        ListFooterComponent={() => <View style={{ height: height * 0.5 }} />}
                        contentContainerStyle={{ paddingHorizontal: 32 }}
                        showsVerticalScrollIndicator={false}
                        initialNumToRender={20}
                        getItemLayout={(_, index) => ({
                            length: 100,
                            offset: 100 * index + (height * 0.5),
                            index,
                        })}
                        renderItem={({ item, index }) => {
                            const isActive = index === activeIndex;
                            return (
                                <TouchableOpacity
                                    onPress={() => handleSeek(item.time)}
                                    activeOpacity={0.7}
                                    style={{ minHeight: 80, justifyContent: 'center', marginVertical: 10 }}
                                >
                                    <MotiView
                                        animate={{
                                            opacity: isActive ? 1 : 0.3,
                                            scale: isActive ? 1.05 : 0.95,
                                        }}
                                        transition={{ type: 'timing', duration: 300 }}
                                    >
                                        <Text
                                            className="text-3xl font-bold leading-relaxed"
                                            style={{
                                                color: isActive ? '#fff' : '#ccc',
                                                textShadowColor: isActive ? 'rgba(0,0,0,0.6)' : 'transparent',
                                                textShadowOffset: { width: 0, height: 2 },
                                                textShadowRadius: 6,
                                            }}
                                        >
                                            {item.text}
                                        </Text>
                                    </MotiView>
                                </TouchableOpacity>
                            );
                        }}
                    />
                ) : plainLyrics ? (
                    <View className="flex-1 px-8 pt-10">
                        <FlatList
                            data={[plainLyrics]}
                            keyExtractor={() => 'plain'}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <Text className="text-3xl text-zinc-200 font-bold leading-relaxed">
                                    {lyricsService.cleanPlainLyrics(item)}
                                </Text>
                            )}
                        />
                    </View>
                ) : (
                    <View className="flex-1 items-center justify-center px-10">
                        <Music2 size={64} color="#3f3f46" />
                        <Text className="text-zinc-500 text-center mt-8 text-xl font-medium leading-8">
                            No synced lyrics available for this track.
                        </Text>
                    </View>
                )}
            </View>

            {/* Footer Attribution */}
            {(syncedLyrics || plainLyrics) && (
                <View className="pb-10 pt-4 items-center">
                    <Text className="text-zinc-500 text-[10px] tracking-widest uppercase opacity-40">
                        Lyrics provided by Melodix
                    </Text>
                </View>
            )}
        </View>
    );
}
