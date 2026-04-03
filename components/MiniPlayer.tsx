import { MusicImage } from '@/components/MusicImage';
import * as Haptics from 'expo-haptics';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { jioSaavnService } from '@/services/jiosaavn';
import { useRouter, useSegments, usePathname } from 'expo-router';
import { Pause, Play } from 'lucide-react-native';
import { MotiView } from 'moti';
import React, { memo } from 'react';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import { useProgress } from 'react-native-track-player';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DesignSystem } from '@/constants/DesignSystem';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { StyleSheet } from 'react-native';

const { width } = Dimensions.get('window');

const MarqueeText = ({ text, style, className }: { text: string; style?: any; className?: string }) => {
    const textWidth = (text?.length || 0) * 8; // Smaller multiplier for mini player
    const containerWidth = width - 160;

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

const getImageUrl = (track: any) => {
    if (!track) return null;
    const images = track.artwork || track.image || track.images;
    return jioSaavnService.sanitizeImageUrl(images);
};

export default memo(function MiniPlayer() {
    const { currentTrack, isPlaying, togglePlayback } = usePlayerStore();
    const { theme } = useSettingsStore();
    const { position, duration } = useProgress(1000);
    const router = useRouter();
    const segments = useSegments();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();
    const isDark = theme === 'dark';

    // Check if we are in the tabs layout
    const isInTabs = segments[0] === '(tabs)';
    // Hide mini player on the main player screen
    const isPlayerScreen = pathname === '/player';

    if (!currentTrack || isPlayerScreen) return null;

    return (
        <MotiView
            from={{ scale: 1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className={`absolute left-0 right-0 h-[60px] shadow-2xl border-t ${isDark ? 'border-white/10' : 'border-zinc-200'} overflow-hidden`}
            style={{ 
                backgroundColor: isDark ? DesignSystem.colors.surface : '#fff', 
                bottom: (isInTabs ? 50 : 0) + insets.bottom,
                zIndex: 100
            }}
        >
            <TouchableOpacity
                activeOpacity={1}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/player');
                }}
                className="flex-1"
            >
                {/* Opaque Blurred Artwork Background (Premium Look) */}
                <MusicImage
                    images={currentTrack.artwork || currentTrack.image}
                    className="absolute w-full h-full"
                    blurRadius={100}
                    transition={500}
                />
                {/* Subtle Overlay to ensure text legibility */}
                <View 
                    className={`absolute w-full h-full ${isDark ? 'bg-black/40' : 'bg-white/40'}`} 
                />
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
                    <MusicImage
                        images={currentTrack.artwork || currentTrack.image}
                        className="w-11 h-11 rounded-md overflow-hidden bg-zinc-900"
                    />
                    <View className="flex-1 ml-4 justify-center">
                        <MarqueeText
                            text={currentTrack.title || ""}
                            className={`${isDark ? 'text-white' : 'text-slate-900'} font-bold text-sm`}
                        />
                        <Text className="text-zinc-500 text-xs" numberOfLines={1}>{currentTrack.artist || "Unknown Artist"}</Text>
                    </View>
                    <View className="flex-row items-center">
                        <TouchableOpacity 
                            onPress={async () => {
                                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                                togglePlayback();
                            }} 
                            className="p-2 ml-2"
                        >
                            {isPlaying ? (
                                <Pause size={28} color={isDark ? "#fff" : "#000"} fill={isDark ? "#fff" : "#000"} />
                            ) : (
                                <Play size={28} color={isDark ? "#fff" : "#000"} fill={isDark ? "#fff" : "#000"} />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Progressive Progress Bar */}
                <View className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10">
                    <View
                        className="h-full bg-emerald-500"
                        style={{ width: `${(position / (duration || 1)) * 100}%` }}
                    />
                </View>
            </TouchableOpacity>
        </MotiView>
    );
});
