import { useAuth } from '@/components/AuthContext';
import { MusicImage } from '@/components/MusicImage';
import PlaylistModal from '@/components/PlaylistModal';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { jioSaavnService } from '@/services/jiosaavn';
import Slider from '@react-native-community/slider';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
    ChevronDown,
    Clock,
    Download,
    Heart,
    ListMinus,
    ListMusic,
    ListPlus,
    MinusCircle,
    MoreVertical,
    Pause,
    Play,
    Plus,
    Repeat,
    Repeat1,
    Shuffle,
    SkipBack,
    SkipForward,
    X
} from 'lucide-react-native';
import { MotiView } from 'moti';
import React, { useCallback } from 'react';
import { Alert, Dimensions, FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';
import TrackPlayer, { useProgress } from 'react-native-track-player';

const { width } = Dimensions.get('window');

const MarqueeText = ({ text, style, className }: { text: string; style?: any; className?: string }) => {
    const textWidth = (text?.length || 0) * 10; // Rough estimate
    const containerWidth = width - 120;

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
                <Text className={className} style={[style, { paddingRight: 50 }]}>{text}</Text>
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

export default function PlayerScreen() {
    const {
        currentTrack, isPlaying, togglePlayback,
        shuffle, repeatMode, toggleShuffle, nextRepeatMode,
        addToQueue, removeFromQueue, isInQueue, queue,
        sleepTimer, remainingTime, setSleepTimer
    } = usePlayerStore();
    const { toggleLike, isLiked } = useLibraryStore();
    const { user } = useAuth();
    const { theme } = useSettingsStore();
    const isDark = theme === 'dark';
    const router = useRouter();
    const [isPlaylistModalVisible, setIsPlaylistModalVisible] = React.useState(false);
    const [isSleepTimerModalVisible, setIsSleepTimerModalVisible] = React.useState(false);
    const [isQueueVisible, setIsQueueVisible] = React.useState(false);
    const [isMenuVisible, setIsMenuVisible] = React.useState(false);
    const { position, duration } = useProgress(1000);
    const [isDragging, setIsDragging] = React.useState(false);
    const [dragPosition, setDragPosition] = React.useState(0);
    const [downloadProgress, setDownloadProgress] = React.useState<number | null>(null);

    const handleDownload = async () => {
        if (!currentTrack || !currentTrack.url) return;

        try {
            setDownloadProgress(0);
            const filename = `${(currentTrack.title || 'song').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
            const fileUri = `${FileSystem.documentDirectory}${filename}`;

            const downloadResumable = FileSystem.createDownloadResumable(
                currentTrack.url,
                fileUri,
                {},
                (downloadProgress: any) => {
                    const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                    setDownloadProgress(progress);
                }
            );

            const result = await downloadResumable.downloadAsync();
            setDownloadProgress(null);

            if (result) {
                // Save metadata for library sync
                try {
                    const metadataFile = `${FileSystem.documentDirectory}Melodix/downloads_metadata.json`;
                    const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}Melodix`);
                    if (!dirInfo.exists) {
                        await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}Melodix`, { intermediates: true });
                    }

                    let downloads = [];
                    const metadataInfo = await FileSystem.getInfoAsync(metadataFile);
                    if (metadataInfo.exists) {
                        const content = await FileSystem.readAsStringAsync(metadataFile);
                        if (content) downloads = JSON.parse(content);
                    }

                    if (!downloads.some((s: any) => s.id === currentTrack.id)) {
                        downloads.push(currentTrack);
                        await FileSystem.writeAsStringAsync(metadataFile, JSON.stringify(downloads));
                        // Sync the store immediately
                        useLibraryStore.getState().setDownloadedSongs(downloads);
                    }
                } catch (metaErr) {
                    console.error("Failed to save download metadata:", metaErr);
                }

                try {
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch (hErr) { }

                Alert.alert(
                    "Download Complete",
                    `Song has been saved to: ${filename}. It's now available offline in your Library.`,
                    [
                        { text: "Later", style: "cancel" },
                        { text: "Share", onPress: () => Sharing.shareAsync(result.uri) }
                    ]
                );
            }
        } catch (e) {
            console.error(e);
            setDownloadProgress(null);
            Alert.alert("Error", "Failed to download song.");
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };


    const handleSkipToTrack = useCallback(async (index: number) => {
        await TrackPlayer.skip(index);
        setIsQueueVisible(false);
    }, []);

    if (!currentTrack) return null;

    const currentPos = isDragging ? dragPosition : position;
    const progress = (currentPos / (duration || 1)) * 100;

    return (
        <View className="flex-1 bg-black">
            <MusicImage
                images={getImageUrl(currentTrack)}
                className="absolute w-full h-full opacity-50"
                blurRadius={50}
                transition={500}
            />

            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)', 'black']}
                className="absolute w-full h-full"
            />

            <View className="flex-1 px-8 pt-12 pb-16">
                <View className="flex-row justify-between items-center mb-10">
                    <TouchableOpacity onPress={() => router.back()}>
                        <ChevronDown size={28} color="#fff" />
                    </TouchableOpacity>
                    <Text className="text-gray-300 font-medium">{currentTrack.title?.toUpperCase()}</Text>
                    <View className="flex-row items-center">
                        <TouchableOpacity onPress={() => setIsQueueVisible(true)} className="mr-4">
                            <ListMusic size={28} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setIsMenuVisible(true)}>
                            <MoreVertical size={28} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View className="items-center shadow-2xl">
                    <View
                        style={{ width: width - 64, height: width - 64 }}
                        className="rounded-2xl overflow-hidden bg-zinc-900"
                    >
                        <MusicImage
                            images={getImageUrl(currentTrack)}
                            className="w-full h-full"
                            transition={300}
                            contentFit="cover"
                        />
                    </View>
                </View>

                <View className="mt-10">
                    <View className="flex-row justify-between items-center">
                        <View className="flex-1 mr-4">
                            <MarqueeText
                                text={currentTrack.title || ""}
                                className="text-white text-2xl font-bold"
                            />
                            <Text className="text-gray-400 text-lg" numberOfLines={1}>{currentTrack.artist}</Text>
                        </View>
                        <View className="flex-row items-center">
                            <TouchableOpacity
                                onPress={() => setIsPlaylistModalVisible(true)}
                                className="mr-6"
                            >
                                <Plus size={28} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => {
                                toggleLike(currentTrack as any, user?.id);
                            }}>
                                <Heart size={28} color={isLiked(currentTrack.id) ? "#1DB954" : "#fff"} fill={isLiked(currentTrack.id) ? "#1DB954" : "transparent"} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Real-time Progress Bar */}
                <View className="mt-8">
                    <Slider
                        style={{ width: width - 56, height: 40, marginLeft: -4 }}
                        minimumValue={0}
                        maximumValue={duration}
                        value={isDragging ? dragPosition : position}
                        minimumTrackTintColor="#1DB954"
                        maximumTrackTintColor="rgba(255, 255, 255, 0.1)"
                        thumbTintColor="#fff"
                        onSlidingStart={() => setIsDragging(true)}
                        onValueChange={(value) => setDragPosition(value)}
                        onSlidingComplete={async (value) => {
                            setIsDragging(false);
                            await TrackPlayer.seekTo(value);
                        }}
                    />
                    <View className="flex-row justify-between -mt-1">
                        <Text className="text-zinc-400 text-xs font-medium">{formatTime(currentPos)}</Text>
                        <Text className="text-zinc-500 text-xs font-medium">{formatTime(duration)}</Text>
                    </View>
                </View>

                <View className="flex-row justify-between items-center mt-10">
                    <TouchableOpacity onPress={toggleShuffle}>
                        <Shuffle size={24} color={shuffle ? "#1DB954" : "#fff"} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => TrackPlayer.skipToPrevious()}>
                        <SkipBack size={32} color="#fff" fill="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={togglePlayback}
                        className="w-20 h-20 bg-white rounded-full items-center justify-center"
                    >
                        {isPlaying ? (
                            <Pause size={40} color="#000" fill="#000" />
                        ) : (
                            <Play size={40} color="#000" fill="#000" />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => TrackPlayer.skipToNext()}>
                        <SkipForward size={32} color="#fff" fill="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={nextRepeatMode}>
                        {repeatMode === 'track' ? (
                            <Repeat1 size={24} color="#1DB954" />
                        ) : (
                            <Repeat size={24} color={repeatMode === 'queue' ? "#1DB954" : "#fff"} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <PlaylistModal
                isVisible={isPlaylistModalVisible}
                onClose={() => setIsPlaylistModalVisible(false)}
                song={currentTrack as any}
            />


            {/* Song Options Menu */}
            <Modal
                visible={isMenuVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsMenuVisible(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setIsMenuVisible(false)}
                    className="flex-1 justify-end bg-black/60"
                >
                    <View className="bg-zinc-900 p-6 rounded-t-3xl border-t border-zinc-800">
                        <View className="items-center mb-6">
                            <View className="w-12 h-1.5 bg-zinc-700 rounded-full mb-6" />
                            <MusicImage
                                images={jioSaavnService.sanitizeImageUrl(currentTrack.artwork || currentTrack.image)}
                                className="w-24 h-24 rounded-lg mb-4"
                                transition={300}
                                contentFit="cover"
                            />
                            <Text className="text-white text-xl font-bold text-center" numberOfLines={1}>{currentTrack.title}</Text>
                            <Text className="text-zinc-500 text-lg text-center" numberOfLines={1}>{currentTrack.artist}</Text>
                        </View>


                        <TouchableOpacity
                            onPress={() => {
                                setIsMenuVisible(false);
                                handleDownload();
                            }}
                            className="flex-row items-center py-4 border-b border-zinc-800"
                            disabled={downloadProgress !== null}
                        >
                            {downloadProgress !== null ? (
                                <View className="flex-row items-center flex-1">
                                    <View className="w-12 h-1 bg-zinc-800 rounded-full mr-4 overflow-hidden">
                                        <View className="h-full bg-emerald-500" style={{ width: `${downloadProgress * 100}%` }} />
                                    </View>
                                    <Text className="text-emerald-500 text-lg">Downloading... {Math.round(downloadProgress * 100)}%</Text>
                                </View>
                            ) : (
                                <>
                                    <Download size={24} color="#fff" className="mr-4" />
                                    <Text className="text-white text-lg">Download song</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => {
                                setIsMenuVisible(false);
                                setIsSleepTimerModalVisible(true);
                            }}
                            className="flex-row items-center py-4 border-b border-zinc-800"
                        >
                            <Clock size={24} color={sleepTimer ? "#1DB954" : "#fff"} className="mr-4" />
                            <Text className={sleepTimer ? "text-emerald-500 text-lg" : "text-white text-lg"}>
                                {sleepTimer ? `Sleep Timer: ${formatTime(remainingTime || 0)}` : "Sleep Timer"}
                            </Text>
                        </TouchableOpacity>

                        {isInQueue(currentTrack.id) ? (
                            <TouchableOpacity
                                onPress={() => {
                                    removeFromQueue(currentTrack.id);
                                    setIsMenuVisible(false);
                                    Alert.alert("Queue", "Song removed from queue");
                                }}
                                className="flex-row items-center py-4 border-b border-zinc-800"
                            >
                                <ListMinus size={24} color="#ef4444" className="mr-4" />
                                <Text className="text-red-500 text-lg">Remove from Queue</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={() => {
                                    addToQueue(currentTrack);
                                    setIsMenuVisible(false);
                                    Alert.alert("Queue", "Song added to queue");
                                }}
                                className="flex-row items-center py-4 border-b border-zinc-800"
                            >
                                <ListPlus size={24} color="#fff" className="mr-4" />
                                <Text className="text-white text-lg">Add to Queue</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            onPress={() => {
                                setIsMenuVisible(false);
                                setIsPlaylistModalVisible(true);
                            }}
                            className="flex-row items-center py-4 border-b border-zinc-800"
                        >
                            <Plus size={24} color="#fff" className="mr-4" />
                            <Text className="text-white text-lg">Add or Remove from playlist</Text>
                        </TouchableOpacity>

                        {isLiked(currentTrack.id) && (
                            <TouchableOpacity
                                onPress={() => {
                                    toggleLike(currentTrack as any, user?.id);
                                    setIsMenuVisible(false);
                                }}
                                className="flex-row items-center py-4"
                            >
                                <MinusCircle size={24} color="#ef4444" className="mr-4" />
                                <Text className="text-red-500 text-lg">Remove From liked songs</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            onPress={() => setIsMenuVisible(false)}
                            className="mt-4 py-4 rounded-xl bg-zinc-800 items-center"
                        >
                            <Text className="text-white font-bold text-lg">Close</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Sleep Timer Modal */}
            <Modal
                visible={isSleepTimerModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsSleepTimerModalVisible(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setIsSleepTimerModalVisible(false)}
                    className="flex-1 justify-center items-center bg-black/80 px-6"
                >
                    <View className="bg-zinc-900 w-full p-6 rounded-3xl border border-zinc-800">
                        <Text className="text-white text-2xl font-bold mb-6 text-center">Sleep Timer</Text>
                        {[5, 10, 15, 30, 45, 60].map((mins) => (
                            <TouchableOpacity
                                key={mins}
                                onPress={() => {
                                    setSleepTimer(mins);
                                    setIsSleepTimerModalVisible(false);
                                    Alert.alert("Sleep Timer", `Music will stop in ${mins} minutes`);
                                }}
                                className="py-4 border-b border-zinc-800 items-center"
                            >
                                <Text className="text-white text-lg">{mins} minutes</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            onPress={() => {
                                setSleepTimer(null);
                                setIsSleepTimerModalVisible(false);
                                Alert.alert("Sleep Timer", "Timer cancelled");
                            }}
                            className="py-4 items-center"
                        >
                            <Text className="text-red-500 text-lg font-bold">Turn off timer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setIsSleepTimerModalVisible(false)}
                            className="mt-4 py-4 rounded-xl bg-zinc-800 items-center"
                        >
                            <Text className="text-white font-bold text-lg">Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Queue Modal */}
            <Modal
                visible={isQueueVisible}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setIsQueueVisible(false)}
            >
                <View className="flex-1 bg-black pt-12">
                    <View className="px-6 flex-row justify-between items-center mb-6">
                        <Text className="text-white text-3xl font-bold">Queue</Text>
                        <TouchableOpacity onPress={() => setIsQueueVisible(false)}>
                            <X size={28} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={queue}
                        keyExtractor={(track, index) => `${track.id}-${index}`}
                        className="px-6"
                        showsVerticalScrollIndicator={false}
                        removeClippedSubviews={true}
                        ListHeaderComponent={() => (
                            <>
                                <Text className="text-emerald-500 font-bold mb-4">Now Playing</Text>
                                <View className="flex-row items-center mb-8 bg-zinc-900/50 p-3 rounded-xl">
                                    <MusicImage
                                        images={jioSaavnService.sanitizeImageUrl(currentTrack.artwork || currentTrack.image)}
                                        className="w-14 h-14 rounded-lg mr-4"
                                        transition={300}
                                    />
                                    <View className="flex-1">
                                        <Text className="text-white font-bold text-lg" numberOfLines={1}>{currentTrack.title}</Text>
                                        <Text className="text-zinc-400" numberOfLines={1}>{currentTrack.artist}</Text>
                                    </View>
                                    <View className="w-2 h-2 bg-emerald-500 rounded-full" />
                                </View>
                                <Text className="text-white font-bold text-xl mb-4">Next Up</Text>
                            </>
                        )}
                        renderItem={({ item: track, index }) => {
                            const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
                            if (index <= currentIndex) return null;

                            return (
                                <TouchableOpacity
                                    className="flex-row items-center mb-4"
                                    onPress={() => handleSkipToTrack(index)}
                                >
                                    <MusicImage
                                        images={jioSaavnService.sanitizeImageUrl(track.artwork || track.image)}
                                        className="w-12 h-12 rounded-md mr-4"
                                        transition={300}
                                    />
                                    <View className="flex-1">
                                        <Text className="text-white font-medium" numberOfLines={1}>{track.title}</Text>
                                        <Text className="text-zinc-500 text-sm" numberOfLines={1}>{track.artist}</Text>
                                    </View>
                                    <MoreVertical size={20} color="#71717a" />
                                </TouchableOpacity>
                            );
                        }}
                        ListFooterComponent={() => (
                            <>
                                {queue.findIndex(t => t.id === currentTrack.id) === queue.length - 1 && (
                                    <View className="py-10 items-center">
                                        <Text className="text-zinc-500 text-center italic">End of queue. Playing recommendations...</Text>
                                    </View>
                                )}
                                <View className="h-20" />
                            </>
                        )}
                    />
                </View>
            </Modal>
        </View>
    );
}
