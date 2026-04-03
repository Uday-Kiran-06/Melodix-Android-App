import { useAuth } from '@/components/AuthContext';
import { MusicImage } from '@/components/MusicImage';
import PlaylistModal from '@/components/PlaylistModal';
import SongMenu from '@/components/SongMenu';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { DesignSystem } from '@/constants/DesignSystem';
import { jioSaavnService } from '@/services/jiosaavn';
import Slider from '@react-native-community/slider';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
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
import React, { useCallback, useState } from 'react';
import { Alert, Dimensions, FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';
import TrackPlayer, { useProgress } from 'react-native-track-player';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
});

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

        const { downloadedSongs, syncDownloadedSongs } = useLibraryStore.getState();
        const downloadedTrack = downloadedSongs.find(s => s.id === currentTrack.id);

        if (downloadedTrack?.localUri) {
            const fileInfo = await FileSystem.getInfoAsync(downloadedTrack.localUri);
            if (fileInfo.exists) {
                Alert.alert("Already Downloaded", `"${currentTrack.title}" is already saved to your device.`);
                return;
            } else {
                // Stale state found, sync and continue
                console.log("[Player]: Stale download detected, syncing...");
                await syncDownloadedSongs();
            }
        }

        if (currentTrack.url?.startsWith('file://')) {
            const fileInfo = await FileSystem.getInfoAsync(currentTrack.url);
            if (fileInfo.exists) {
                Alert.alert("Local File", "This is a local file and cannot be downloaded again.");
                return;
            }
        }

        try {
            setDownloadProgress(0);

            const downloadDir = `${FileSystem.documentDirectory}Melodix/Downloads/`;
            const dirInfo = await FileSystem.getInfoAsync(downloadDir);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
            }

            const cleanTitle = (currentTrack.title || 'song')
                .replace(/[\\/:*?"<>|]/g, '_')
                .replace(/\s+/g, '_')
                .trim();
            const filename = `${cleanTitle}_${currentTrack.id}.mp3`;
            const fileUri = `${downloadDir}${filename}`;

            const notificationId = `download-${currentTrack.id}`;
            let lastUpdate = Date.now();

            let downloadUrl = currentTrack.url;
            
            // ALWAYS favor a remote URL for downloading
            // @ts-ignore - custom property from usePlayerStore
            const remoteUrls = currentTrack.originalDownloadUrl || (currentTrack as any).downloadUrl;
            if (remoteUrls && Array.isArray(remoteUrls) && remoteUrls.length > 0) {
                // Use high quality for download if possible
                const qualityIdx = remoteUrls.length > 4 ? 4 : remoteUrls.length - 1;
                const bestRemote = remoteUrls[qualityIdx]?.url || remoteUrls[0]?.url;
                if (bestRemote && bestRemote.startsWith('http')) {
                    downloadUrl = bestRemote;
                }
            } else if (downloadUrl?.startsWith('file://')) {
                // If we still have a file:// URL, check if there's an originalUrl
                // @ts-ignore
                if (currentTrack.originalUrl?.startsWith('http')) {
                    // @ts-ignore
                    downloadUrl = currentTrack.originalUrl;
                }
            }

            if (!downloadUrl || downloadUrl.startsWith('file://')) {
                // If it's a downloaded song, we might find its remote URL in the library store
                if (downloadedTrack?.downloadUrl && Array.isArray(downloadedTrack.downloadUrl) && downloadedTrack.downloadUrl.length > 0) {
                    const remoteUrl = downloadedTrack.downloadUrl[downloadedTrack.downloadUrl.length - 1]?.url;
                    if (remoteUrl && remoteUrl.startsWith('http')) {
                        downloadUrl = remoteUrl;
                    }
                }
            }

            if (!downloadUrl || downloadUrl.startsWith('file://')) {
                Alert.alert("Error", "No remote source found for this track. It cannot be downloaded.");
                return;
            }

            const downloadResumable = FileSystem.createDownloadResumable(
                downloadUrl,
                fileUri,
                {},
                async (progressData: any) => {
                    const progress = progressData.totalBytesWritten / progressData.totalBytesExpectedToWrite;
                    setDownloadProgress(progress);

                    const now = Date.now();
                    if (now - lastUpdate > 1000 || progress === 1) {
                        lastUpdate = now;
                        try {
                            await Notifications.scheduleNotificationAsync({
                                identifier: notificationId,
                                content: {
                                    title: `Downloading: ${cleanTitle}`,
                                    body: `Progress: ${Math.round(progress * 100)}%`,
                                },
                                trigger: null,
                            });
                        } catch (e) { }
                    }
                }
            );

            const result = await downloadResumable.downloadAsync();
            setDownloadProgress(null);
            try { await Notifications.dismissNotificationAsync(notificationId); } catch (e) { }

            if (result && result.uri) {
                // Save to SQLite & Media Library
                await useLibraryStore.getState().saveDownload(currentTrack as any, result.uri);

                try {
                    await Notifications.scheduleNotificationAsync({
                        identifier: `${notificationId}-complete`,
                        content: {
                            title: "Download Complete",
                            body: `"${currentTrack.title}" has been saved for offline playback.`
                        },
                        trigger: null
                    });
                } catch (e) { }

                try {
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch (e) { }

                Alert.alert(
                    "Download Complete",
                    `"${currentTrack.title}" has been saved for offline playback.`,
                    [
                        { text: "OK" },
                        { text: "Share", onPress: () => Sharing.shareAsync(result.uri) }
                    ]
                );
            }
        } catch (e: any) {
            console.error("[Download Error]:", e);
            setDownloadProgress(null);
            Alert.alert("Error", "Failed to download song.");
        }
    };

    const [isSkipping, setIsSkipping] = useState(false);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };


    const handleSkipToTrack = useCallback(async (index: number) => {
        try {
            await TrackPlayer.skip(index);
            setIsQueueVisible(false);
        } catch (e) {
            console.error("Skip to track failed:", e);
        }
    }, []);

    const handleSkipNext = useCallback(async () => {
        if (isSkipping) return;
        setIsSkipping(true);
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await TrackPlayer.skipToNext();
        } catch (e) {
            console.error("Skip next failed:", e);
        } finally {
            setTimeout(() => setIsSkipping(false), 500);
        }
    }, [isSkipping]);

    const handleSkipPrev = useCallback(async () => {
        if (isSkipping) return;
        setIsSkipping(true);
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await TrackPlayer.skipToPrevious();
        } catch (e) {
            console.error("Skip previous failed:", e);
        } finally {
            setTimeout(() => setIsSkipping(false), 500);
        }
    }, [isSkipping]);

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

            <View className="flex-1 px-8 justify-center pb-8">
                <View className="flex-row justify-between items-center mb-12">
                    <TouchableOpacity onPress={() => router.back()}>
                        <ChevronDown size={32} color="#fff" />
                    </TouchableOpacity>
                    <View className="items-center">
                        <Text className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">Playing from</Text>
                        <Text className="text-white font-bold text-xs">MELODIX PLAYER</Text>
                    </View>
                    <TouchableOpacity onPress={() => setIsMenuVisible(true)}>
                        <MoreVertical size={28} color="#fff" />
                    </TouchableOpacity>
                </View>

                <View className="items-center justify-center my-4 relative">
                    {/* Aesthetic Pulsing Visualizer */}
                    {isPlaying && (
                        <>
                            <MotiView
                                from={{ scale: 0.8, opacity: 0.2 }}
                                animate={{ scale: 1.2, opacity: 0.5 }}
                                transition={{
                                    type: 'timing',
                                    duration: 2000,
                                    loop: true,
                                    repeatReverse: true,
                                }}
                                className="absolute w-full h-full rounded-full bg-emerald-500/20 shadow-2xl"
                                style={{ width: width - 40, height: width - 40 }}
                            />
                            <MotiView
                                from={{ scale: 0.9, opacity: 0.1 }}
                                animate={{ scale: 1.4, opacity: 0.3 }}
                                transition={{
                                    type: 'timing',
                                    duration: 3000,
                                    loop: true,
                                    repeatReverse: true,
                                }}
                                className="absolute w-full h-full rounded-full bg-emerald-400/10 shadow-2xl"
                                style={{ width: width - 20, height: width - 20 }}
                            />
                        </>
                    )}

                    <View
                        style={{ width: width - 64, height: width - 64 }}
                        className="rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl shadow-black/50 z-10"
                    >
                        <MusicImage
                            images={getImageUrl(currentTrack)}
                            className="w-full h-full"
                            transition={300}
                            contentFit="cover"
                        />
                        {downloadProgress !== null && (
                            <View className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40 overflow-hidden">
                                <View
                                    className="h-full bg-emerald-500"
                                    style={{ width: `${downloadProgress * 100}%` }}
                                />
                            </View>
                        )}
                    </View>
                </View>

                <View className="mt-12">
                    <View className="flex-row justify-between items-center">
                        <View className="flex-1 mr-4">
                            <MarqueeText
                                text={currentTrack.title || ""}
                                className="text-white text-2xl font-bold"
                            />
                            <Text className="text-gray-400 text-lg" numberOfLines={1}>{currentTrack.artist}</Text>
                        </View>
                        <View className="flex-row items-center">
                            <TouchableOpacity onPress={async () => {
                                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
                        minimumTrackTintColor="#fff"
                        maximumTrackTintColor="rgba(255, 255, 255, 0.2)"
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
                    <TouchableOpacity onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        toggleShuffle();
                    }}>
                        <Shuffle size={24} color={shuffle ? DesignSystem.colors.primary : "#fff"} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSkipPrev} disabled={isSkipping}>
                        <SkipBack size={36} color={isSkipping ? "rgba(255,255,255,0.5)" : "#fff"} fill={isSkipping ? "rgba(255,255,255,0.5)" : "#fff"} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={async () => {
                            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                            togglePlayback();
                        }}
                        className="w-20 h-20 bg-white rounded-full items-center justify-center scale-110"
                    >
                        {isPlaying ? (
                            <Pause size={40} color={DesignSystem.colors.background} fill={DesignSystem.colors.background} />
                        ) : (
                            <Play size={40} color={DesignSystem.colors.background} fill={DesignSystem.colors.background} />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSkipNext} disabled={isSkipping}>
                        <SkipForward size={36} color={isSkipping ? "rgba(255,255,255,0.5)" : "#fff"} fill={isSkipping ? "rgba(255,255,255,0.5)" : "#fff"} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        nextRepeatMode();
                    }}>
                        {repeatMode === 'track' ? (
                            <Repeat1 size={24} color={DesignSystem.colors.primary} />
                        ) : (
                            <Repeat size={24} color={repeatMode === 'queue' ? DesignSystem.colors.primary : "#fff"} />
                        )}
                    </TouchableOpacity>
                </View>

                <View className="flex-row justify-between items-center mt-12 px-2">
                    <TouchableOpacity onPress={() => setIsQueueVisible(true)}>
                        <ListMusic size={24} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsPlaylistModalVisible(true)}>
                        <Plus size={24} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleDownload}>
                        <Download size={24} color={downloadProgress !== null ? DesignSystem.colors.primary : "#fff"} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setIsSleepTimerModalVisible(true)}
                        className="items-center"
                    >
                        <Clock size={24} color={sleepTimer ? DesignSystem.colors.primary : "#fff"} />
                        {sleepTimer && (
                            <Text className="text-[9px] text-emerald-500 font-bold absolute -bottom-4">
                                {formatTime(remainingTime || 0)}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <PlaylistModal
                isVisible={isPlaylistModalVisible}
                onClose={() => setIsPlaylistModalVisible(false)}
                song={currentTrack as any}
            />

            <SongMenu
                isVisible={isMenuVisible}
                onClose={() => setIsMenuVisible(false)}
                song={currentTrack as any}
                userId={user?.id}
                extraActions={
                    <>
                        <SongMenu.Item
                            icon={Download}
                            label={downloadProgress !== null ? `Downloading... ${Math.round(downloadProgress * 100)}%` : "Download song"}
                            onPress={handleDownload}
                            showProgress={downloadProgress !== null}
                            progress={downloadProgress || 0}
                        />
                        <SongMenu.Item
                            icon={Clock}
                            label={sleepTimer ? `Sleep Timer: ${formatTime(remainingTime || 0)}` : "Sleep Timer"}
                            onPress={() => {
                                setIsMenuVisible(false);
                                setIsSleepTimerModalVisible(true);
                            }}
                            color={sleepTimer ? "#1DB954" : "#fff"}
                        />
                        <SongMenu.Item
                            icon={isInQueue(currentTrack.id) ? ListMinus : ListPlus}
                            label={isInQueue(currentTrack.id) ? "Remove from Queue" : "Add to Queue"}
                            onPress={() => {
                                if (isInQueue(currentTrack.id)) {
                                    removeFromQueue(currentTrack.id);
                                } else {
                                    addToQueue(currentTrack);
                                }
                                setIsMenuVisible(false);
                            }}
                            color={isInQueue(currentTrack.id) ? "#ef4444" : "#fff"}
                        />
                    </>
                }
            />

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
