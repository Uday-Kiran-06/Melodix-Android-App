import { MusicImage } from '@/components/MusicImage';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { jioSaavnService } from '@/services/jiosaavn';
import { useRouter } from 'expo-router';
import { Pause, Play } from 'lucide-react-native';
import { MotiView } from 'moti';
import React, { memo } from 'react';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import { useProgress } from 'react-native-track-player';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    const { position, duration } = useProgress(1000);
    const router = useRouter();
    const insets = useSafeAreaInsets();

    if (!currentTrack) return null;

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push('/player')}
            className="absolute left-0 right-0 h-16 shadow-2xl overflow-hidden"
            style={{ backgroundColor: '#000', bottom: 50 + insets.bottom }}
        >
            {/* Dynamic Artwork Background */}
            <MusicImage
                images={currentTrack.artwork || currentTrack.image}
                className="absolute w-full h-full opacity-40"
                blurRadius={100}
                transition={500}
            />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
                <MusicImage
                    images={currentTrack.artwork || currentTrack.image}
                    className="w-11 h-11 rounded-md overflow-hidden bg-zinc-900"
                />
                <View className="flex-1 ml-4 justify-center">
                    <MarqueeText
                        text={currentTrack.title || ""}
                        className="text-white font-bold text-sm"
                    />
                    <Text className="text-gray-400 text-xs" numberOfLines={1}>{currentTrack.artist || "Unknown Artist"}</Text>
                </View>
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={togglePlayback} className="p-2 ml-2">
                        {isPlaying ? (
                            <Pause size={28} color="#fff" fill="#fff" />
                        ) : (
                            <Play size={28} color="#fff" fill="#fff" />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Progressive Progress Bar */}
                <View className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10">
                    <View
                        className="h-full bg-emerald-500"
                        style={{ width: `${(position / (duration || 1)) * 100}%` }}
                    />
                </View>
            </View>
        </TouchableOpacity>
    );
});
