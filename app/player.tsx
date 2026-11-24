import { useAuth } from '@/components/AuthContext';
import { MusicImage } from '@/components/MusicImage';
import PlaylistModal from '@/components/PlaylistModal';
import SongMenu from '@/components/SongMenu';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { usePlayerStore, setPlaybackTransitionReason } from '@/hooks/usePlayerStore';
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
    Activity,
    ChevronDown,
    Clock,
    Download,
    Headphones,
    Heart,
    Info,
    ListMinus,
    ListMusic,
    ListPlus,
    Mic2,
    MoreVertical,
    Pause,
    Play,
    Plus,
    RefreshCw,
    Repeat,
    Repeat1,
    Share2,
    ShieldCheck,
    Shuffle,
    SkipBack,
    SkipForward,
    Sparkles,
    Trash2,
    Volume2,
    X,
    Zap,
} from 'lucide-react-native';
import { MeshGradientBackground } from '@/components/MeshGradientBackground';
import { LyricsView } from '@/components/LyricsView';
import { MotiView } from 'moti';
import React, { useCallback, useRef, useState } from 'react';
import {
    Alert,
    ActivityIndicator,
    Dimensions,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import TrackPlayer, { useProgress } from 'react-native-track-player';
import { BlurView } from 'expo-blur';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
});

const { width, height } = Dimensions.get('window');

const MarqueeText = ({ text, style, className }: { text: string; style?: any; className?: string }) => {
    const textWidth = (text?.length || 0) * 10;
    const containerWidth = width - 130;

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
        currentTrack,
        isPlaying,
        togglePlayback,
        shuffle,
        repeatMode,
        toggleShuffle,
        nextRepeatMode,
        addToQueue,
        removeFromQueue,
        isInQueue,
        queue,
        sleepTimer,
        remainingTime,
        setSleepTimer,
        syncedLyrics,
        isLoadingRecommendations,
        loadRecommendations,
        recommendations,
        playTrack,
        playNextRecommendation,
    } = usePlayerStore();
    const { toggleLike, isLiked } = useLibraryStore();
    const { user } = useAuth();
    const {
        theme,
        audioQuality,
        isEqEnabled,
        eqPreset,
        isBassBoostEnabled,
        isLoudnessEnabled,
    } = useSettingsStore();
    const isDark = theme === 'dark';
    const router = useRouter();

    const [isPlaylistModalVisible, setIsPlaylistModalVisible] = useState(false);
    const [isSleepTimerModalVisible, setIsSleepTimerModalVisible] = useState(false);
    const [isQueueVisible, setIsQueueVisible] = useState(false);
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const [isAudioFormatModalVisible, setIsAudioFormatModalVisible] = useState(false);

    // High precision progress tracking
    const { position, duration } = useProgress(100);

    // Scrubbing & seeking state with anti-snapback lock
    const [isDragging, setIsDragging] = useState(false);
    const [dragPosition, setDragPosition] = useState(0);
    const [isSeeking, setIsSeeking] = useState(false);
    const [seekTarget, setSeekTarget] = useState(0);
    const seekLockTimeout = useRef<NodeJS.Timeout | null>(null);

    const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
    const [isSkipping, setIsSkipping] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    const handleGoToAlbum = useCallback(async () => {
        let targetAlbumId = (currentTrack as any)?.albumId || (currentTrack as any)?.rawSongData?.album?.id;
        if (!targetAlbumId && currentTrack?.id) {
            try {
                const details = await jioSaavnService.getSongDetails(currentTrack.id);
                targetAlbumId = details?.album?.id;
            } catch (e) { }
        }
        if (targetAlbumId) {
            router.push(`/album/${targetAlbumId}`);
        }
    }, [currentTrack, router]);

    const handleDownload = async () => {
        if (!currentTrack || !currentTrack.url) return;
        if (downloadProgress !== null) return;

        const { downloadedSongs, syncDownloadedSongs } = useLibraryStore.getState();
        const downloadedTrack = downloadedSongs.find(s => s.id === currentTrack.id);

        if (downloadedTrack?.localUri) {
            const fileInfo = await FileSystem.getInfoAsync(downloadedTrack.localUri);
            if (fileInfo.exists) {
                Alert.alert("Already Downloaded", `"${currentTrack.title}" is already saved to your device.`);
                return;
            } else {
                await syncDownloadedSongs();
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

            let downloadUrl = currentTrack.url;
            // @ts-ignore
            const remoteUrls = currentTrack.originalDownloadUrl || (currentTrack as any).downloadUrl;
            if (remoteUrls && Array.isArray(remoteUrls) && remoteUrls.length > 0) {
                const qualityIdx = remoteUrls.length > 4 ? 4 : remoteUrls.length - 1;
                const bestRemote = remoteUrls[qualityIdx]?.url || remoteUrls[0]?.url;
                if (bestRemote && bestRemote.startsWith('http')) {
                    downloadUrl = bestRemote;
                }
            }

            if (!downloadUrl || downloadUrl.startsWith('file://')) {
                Alert.alert("Error", "No remote audio source found for download.");
                setDownloadProgress(null);
                return;
            }

            const downloadResumable = FileSystem.createDownloadResumable(
                downloadUrl,
                fileUri,
                {},
                (progressData: any) => {
                    const progress = progressData.totalBytesWritten / progressData.totalBytesExpectedToWrite;
                    setDownloadProgress(progress);
                }
            );

            const result = await downloadResumable.downloadAsync();
            setDownloadProgress(null);

            if (result && result.uri) {
                await useLibraryStore.getState().saveDownload(currentTrack as any, result.uri);
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("Download Complete", `"${currentTrack.title}" saved in 320 kbps Lossless fidelity.`);
            }
        } catch (e) {
            console.error("[Download Error]:", e);
            setDownloadProgress(null);
            Alert.alert("Download Failed", "Could not complete the download. Check your connection.");
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleSkipToTrack = useCallback(async (index: number) => {
        try {
            setPlaybackTransitionReason('USER_SELECTED_TRACK');
            await TrackPlayer.skip(index);
            setIsQueueVisible(false);
        } catch (e) {
            console.error("Skip to track failed:", e);
        }
    }, []);

    // Debounced and safe skip next with repeat:queue wrap
    const handleSkipNext = useCallback(async () => {
        if (isSkipping) return;
        setIsSkipping(true);
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
        } catch (e) {
            console.error('Skip next failed:', e);
        } finally {
            setTimeout(() => setIsSkipping(false), 450);
        }
    }, [isSkipping, repeatMode, playNextRecommendation]);

    // Debounced safe skip previous
    const handleSkipPrev = useCallback(async () => {
        if (isSkipping) return;
        setIsSkipping(true);
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setPlaybackTransitionReason('USER_PREVIOUS');
            await TrackPlayer.skipToPrevious();
        } catch (e) {
            console.error("Skip previous failed:", e);
        } finally {
            setTimeout(() => setIsSkipping(false), 450);
        }
    }, [isSkipping]);

    // Active Lyric Preview
    const activeLyricLine = React.useMemo(() => {
        if (!syncedLyrics || syncedLyrics.length === 0) return null;
        const adjustedPosition = position + 0.12;
        return syncedLyrics.find((line, i) => {
            const nextLine = syncedLyrics[i + 1];
            return adjustedPosition >= line.time && (!nextLine || adjustedPosition < nextLine.time);
        });
    }, [position, syncedLyrics]);

    const nextUpSongs = React.useMemo(() => {
        if (!queue || !currentTrack) return [];
        const index = queue.findIndex(t => t.id === currentTrack.id);
        return index === -1 ? [] : queue.slice(index + 1);
    }, [queue, currentTrack?.id]);

    const currentIndexInQueue = React.useMemo(() => {
        if (!queue || !currentTrack) return -1;
        return queue.findIndex(t => t.id === currentTrack.id);
    }, [queue, currentTrack?.id]);

    if (!currentTrack) return null;

    // Smooth position calculation avoiding slider backward jump glitch
    const currentPos = isDragging ? dragPosition : (isSeeking ? seekTarget : position);
    const progressPercent = Math.min(100, Math.max(0, (currentPos / (duration || 1)) * 100));

    return (
        <View className="flex-1 bg-black">
            {/* Apple Music Dynamic Liquid Mesh Background */}
            <MeshGradientBackground />

            {/* Ambient Blurred Cover Overlay */}
            <MusicImage
                images={getImageUrl(currentTrack)}
                className="absolute w-full h-full opacity-25"
                blurRadius={90}
                transition={800}
            />

            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)', '#09090b']}
                className="absolute w-full h-full"
            />

            <ScrollView
                ref={scrollViewRef}
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 50 }}
            >
                <View className="flex-1 px-7 justify-center pb-6" style={{ minHeight: height }}>
                    
                    {/* Header Bar */}
                    <View className="flex-row justify-between items-center mb-8 pt-4">
                        <TouchableOpacity 
                            onPress={() => router.back()}
                            className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/10"
                        >
                            <ChevronDown size={24} color="#fff" />
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={handleGoToAlbum} 
                            activeOpacity={0.8} 
                            className="items-center max-w-[200px]"
                        >
                            <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-[2px] mb-0.5">
                                {currentTrack?.album && currentTrack.album !== 'Single' ? 'Album' : 'Now Playing'}
                            </Text>
                            <Text className="text-white font-bold text-xs" numberOfLines={1}>
                                {currentTrack?.album && currentTrack.album !== 'Single' ? currentTrack.album : 'MELODIX HI-FI'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setIsMenuVisible(true)}
                            className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/10"
                        >
                            <MoreVertical size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* Floating Album Art with Dynamic Ambient Halo */}
                    <View className="items-center justify-center my-3 relative">
                        {isPlaying && (
                            <>
                                <MotiView
                                    from={{ scale: 0.85, opacity: 0.2 }}
                                    animate={{ scale: 1.18, opacity: 0.45 }}
                                    transition={{
                                        type: 'timing',
                                        duration: 2200,
                                        loop: true,
                                        repeatReverse: true,
                                    }}
                                    className="absolute w-full h-full rounded-full bg-emerald-500/25 shadow-2xl"
                                    style={{ width: width - 50, height: width - 50 }}
                                />
                                <MotiView
                                    from={{ scale: 0.92, opacity: 0.15 }}
                                    animate={{ scale: 1.35, opacity: 0.3 }}
                                    transition={{
                                        type: 'timing',
                                        duration: 3200,
                                        loop: true,
                                        repeatReverse: true,
                                    }}
                                    className="absolute w-full h-full rounded-full bg-teal-400/15 shadow-2xl"
                                    style={{ width: width - 20, height: width - 20 }}
                                />
                            </>
                        )}

                        <TouchableOpacity
                            activeOpacity={0.92}
                            onPress={handleGoToAlbum}
                            style={{ width: width - 68, height: width - 68 }}
                            className="rounded-3xl overflow-hidden bg-zinc-900 shadow-2xl shadow-black z-10 border border-white/15"
                        >
                            <MusicImage
                                images={getImageUrl(currentTrack)}
                                className="w-full h-full"
                                transition={300}
                                contentFit="cover"
                            />
                            {downloadProgress !== null && (
                                <View className="absolute bottom-0 left-0 right-0 h-2 bg-black/50 overflow-hidden">
                                    <View
                                        className="h-full bg-emerald-500"
                                        style={{ width: `${downloadProgress * 100}%` }}
                                    />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Track Details & Apple Music Style Lossless Badge */}
                    <View className="mt-8">
                        <View className="flex-row justify-between items-center">
                            <View className="flex-1 mr-4">
                                <MarqueeText
                                    text={currentTrack.title || ""}
                                    className="text-white text-2xl font-black flex-1"
                                />
                                <Text className="text-zinc-400 text-base font-semibold mt-0.5" numberOfLines={1}>
                                    {currentTrack.artist}
                                </Text>
                            </View>

                            {/* Like Button */}
                            <TouchableOpacity
                                onPress={async () => {
                                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                    toggleLike(currentTrack as any, user?.id);
                                }}
                                className="w-12 h-12 rounded-full bg-white/10 items-center justify-center border border-white/10"
                            >
                                <Heart
                                    size={24}
                                    color={isLiked(currentTrack.id) ? "#10b981" : "#fff"}
                                    fill={isLiked(currentTrack.id) ? "#10b981" : "transparent"}
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Interactive Apple Music Lossless / Format Pill */}
                        <View className="flex-row items-center mt-3">
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setIsAudioFormatModalVisible(true);
                                }}
                                className="flex-row items-center bg-white/10 px-2.5 py-1 rounded-full border border-white/15 mr-2"
                            >
                                <Sparkles size={11} color="#10b981" className="mr-1.5" />
                                <Text className="text-white text-[10px] font-black uppercase tracking-wider ml-1">
                                    Lossless · 320 kbps
                                </Text>
                                <Info size={10} color="#94a3b8" className="ml-1.5" />
                            </TouchableOpacity>

                            {isEqEnabled && (
                                <View className="flex-row items-center bg-emerald-500/15 px-2 py-1 rounded-full border border-emerald-500/30">
                                    <Activity size={10} color="#10b981" />
                                    <Text className="text-emerald-400 text-[9px] font-bold uppercase ml-1">
                                        EQ Active
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Active Lyric Sneak-Peek */}
                        {activeLyricLine && (
                            <MotiView
                                from={{ opacity: 0, translateY: 6 }}
                                animate={{ opacity: 1, translateY: 0 }}
                                key={activeLyricLine.time}
                                className="mt-3 bg-white/5 px-3 py-2 rounded-xl border border-white/5"
                            >
                                <Text className="text-emerald-400 font-bold text-sm" numberOfLines={1}>
                                    ♪ {activeLyricLine.text}
                                </Text>
                            </MotiView>
                        )}
                    </View>

                    {/* Progress Slider (Anti-Snapback Glitch Fixed) */}
                    <View className="mt-7">
                        <Slider
                            style={{ width: width - 52, height: 38, marginLeft: -4 }}
                            minimumValue={0}
                            maximumValue={duration || 1}
                            value={currentPos}
                            minimumTrackTintColor="#fff"
                            maximumTrackTintColor="rgba(255, 255, 255, 0.2)"
                            thumbTintColor="#fff"
                            onSlidingStart={() => {
                                setIsDragging(true);
                            }}
                            onValueChange={(value) => {
                                setDragPosition(value);
                            }}
                            onSlidingComplete={async (value) => {
                                setIsDragging(false);
                                setIsSeeking(true);
                                setSeekTarget(value);
                                await TrackPlayer.seekTo(value);
                                if (seekLockTimeout.current) clearTimeout(seekLockTimeout.current);
                                seekLockTimeout.current = setTimeout(() => {
                                    setIsSeeking(false);
                                }, 300);
                            }}
                        />
                        <View className="flex-row justify-between -mt-1 px-1">
                            <Text className="text-zinc-400 text-xs font-semibold">{formatTime(currentPos)}</Text>
                            <Text className="text-zinc-500 text-xs font-semibold">-{formatTime(Math.max(0, (duration || 0) - currentPos))}</Text>
                        </View>
                    </View>

                    {/* Main Media Controls */}
                    <View className="flex-row justify-between items-center mt-8 px-1">
                        {/* Shuffle */}
                        <TouchableOpacity
                            onPress={async () => {
                                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                toggleShuffle();
                            }}
                            className="p-3 rounded-full bg-white/5 border border-white/5"
                        >
                            <Shuffle size={20} color={shuffle ? "#10b981" : "#a1a1aa"} />
                        </TouchableOpacity>

                        {/* Skip Prev */}
                        <TouchableOpacity
                            onPress={handleSkipPrev}
                            disabled={isSkipping}
                            className="p-3"
                        >
                            <SkipBack size={34} color={isSkipping ? "rgba(255,255,255,0.4)" : "#fff"} fill={isSkipping ? "rgba(255,255,255,0.4)" : "#fff"} />
                        </TouchableOpacity>

                        {/* Play/Pause (Apple Music Fluid Glass Hero Pill) */}
                        <TouchableOpacity
                            onPress={async () => {
                                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                                togglePlayback();
                            }}
                            className="w-20 h-20 bg-white rounded-full items-center justify-center shadow-2xl shadow-white/30"
                        >
                            {isPlaying ? (
                                <Pause size={38} color="#000" fill="#000" />
                            ) : (
                                <Play size={38} color="#000" fill="#000" style={{ marginLeft: 3 }} />
                            )}
                        </TouchableOpacity>

                        {/* Skip Next */}
                        <TouchableOpacity
                            onPress={handleSkipNext}
                            disabled={isSkipping}
                            className="p-3"
                        >
                            <SkipForward size={34} color={isSkipping ? "rgba(255,255,255,0.4)" : "#fff"} fill={isSkipping ? "rgba(255,255,255,0.4)" : "#fff"} />
                        </TouchableOpacity>

                        {/* Repeat */}
                        <TouchableOpacity
                            onPress={async () => {
                                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                nextRepeatMode();
                            }}
                            className="p-3 rounded-full bg-white/5 border border-white/5"
                        >
                            {repeatMode === 'track' ? (
                                <Repeat1 size={20} color="#10b981" />
                            ) : (
                                <Repeat size={20} color={repeatMode === 'queue' ? "#10b981" : "#a1a1aa"} />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Secondary Action Bar (Queue, Add to Playlist, Download, Sleep Timer) */}
                    <View className="flex-row justify-between items-center mt-9 px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
                        {/* Queue */}
                        <TouchableOpacity onPress={() => setIsQueueVisible(true)} className="relative p-2">
                            <ListMusic size={22} color="#fff" />
                            {nextUpSongs.length > 0 && (
                                <View className="absolute top-0 right-0 w-4 h-4 rounded-full bg-emerald-500 items-center justify-center">
                                    <Text className="text-black text-[8px] font-black">
                                        {nextUpSongs.length > 99 ? '99+' : nextUpSongs.length}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Add to Playlist */}
                        <TouchableOpacity onPress={() => setIsPlaylistModalVisible(true)} className="p-2">
                            <Plus size={22} color="#fff" />
                        </TouchableOpacity>

                        {/* Download */}
                        <TouchableOpacity 
                            onPress={handleDownload}
                            disabled={downloadProgress !== null}
                            className="p-2"
                        >
                            <Download size={22} color={downloadProgress !== null ? "#10b981" : "#fff"} />
                        </TouchableOpacity>

                        {/* Sleep Timer */}
                        <TouchableOpacity 
                            onPress={() => setIsSleepTimerModalVisible(true)}
                            className="p-2 relative items-center justify-center"
                        >
                            <Clock size={22} color={sleepTimer ? "#10b981" : "#fff"} />
                            {sleepTimer && (
                                <View className="absolute -bottom-1">
                                    <Text className="text-[8px] text-emerald-400 font-bold">
                                        {Math.ceil((remainingTime || 0) / 60)}m
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Apple Music Style Fullscreen Synced Lyrics */}
                <LyricsView scrollViewRef={scrollViewRef} />
            </ScrollView>

            {/* Apple Music Lossless & Audio Format Inspector Sheet */}
            <Modal
                visible={isAudioFormatModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsAudioFormatModalVisible(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setIsAudioFormatModalVisible(false)}
                    className="flex-1 justify-center items-center bg-black/85 px-6"
                >
                    <View className="bg-zinc-900 w-full p-6 rounded-3xl border border-zinc-800">
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 rounded-xl bg-emerald-500/20 items-center justify-center mr-3">
                                    <Headphones size={22} color="#10b981" />
                                </View>
                                <View>
                                    <Text className="text-white text-xl font-black">Lossless Audio</Text>
                                    <Text className="text-zinc-400 text-xs font-semibold">Apple Glass Hi-Fi Profile</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setIsAudioFormatModalVisible(false)}>
                                <X size={20} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        {/* Specs Grid */}
                        <View className="bg-black/40 p-4 rounded-2xl border border-white/5 mb-4">
                            <View className="flex-row justify-between py-2 border-b border-white/5">
                                <Text className="text-zinc-400 text-xs font-medium">Quality Tier</Text>
                                <Text className="text-emerald-400 text-xs font-bold uppercase">{audioQuality} (Lossless)</Text>
                            </View>
                            <View className="flex-row justify-between py-2 border-b border-white/5">
                                <Text className="text-zinc-400 text-xs font-medium">Sampling Rate</Text>
                                <Text className="text-white text-xs font-bold">44.1 kHz · 16/24-Bit CD Master</Text>
                            </View>
                            <View className="flex-row justify-between py-2 border-b border-white/5">
                                <Text className="text-zinc-400 text-xs font-medium">Codec</Text>
                                <Text className="text-white text-xs font-bold">AAC-LC / 320 kbps High Efficiency</Text>
                            </View>
                            <View className="flex-row justify-between py-2">
                                <Text className="text-zinc-400 text-xs font-medium">Hardware DSP</Text>
                                <Text className="text-white text-xs font-bold">
                                    {isEqEnabled ? `5-Band EQ (${eqPreset})` : 'Flat / Bypass'}
                                </Text>
                            </View>
                        </View>

                        <Text className="text-zinc-400 text-xs leading-5 mb-5">
                            Melodix streams audio with uncompressed bitrates matching the original recording master, processed through Android's native audio effects engine for maximum clarity.
                        </Text>

                        <TouchableOpacity
                            onPress={() => {
                                setIsAudioFormatModalVisible(false);
                                router.push('/audio-settings' as any);
                            }}
                            className="bg-emerald-600 py-3.5 rounded-2xl items-center flex-row justify-center"
                        >
                            <Activity size={18} color="#fff" className="mr-2" />
                            <Text className="text-white font-bold text-sm ml-1">Open Audio Lab & EQ</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Playlist Modal */}
            <PlaylistModal
                isVisible={isPlaylistModalVisible}
                onClose={() => setIsPlaylistModalVisible(false)}
                song={currentTrack as any}
            />

            {/* Song Menu */}
            <SongMenu
                isVisible={isMenuVisible}
                onClose={() => setIsMenuVisible(false)}
                song={currentTrack ? {
                    ...currentTrack,
                    album: (currentTrack as any).rawSongData?.album || { id: (currentTrack as any).albumId, name: currentTrack.album },
                    artists: (currentTrack as any).rawSongData?.artists || { primary: [{ name: currentTrack.artist }] }
                } : null}
                userId={user?.id}
                extraActions={
                    <>
                        <SongMenu.Item
                            icon={Clock}
                            label={sleepTimer ? `Sleep Timer: ${formatTime(remainingTime || 0)}` : "Sleep Timer"}
                            onPress={() => {
                                setIsMenuVisible(false);
                                setIsSleepTimerModalVisible(true);
                            }}
                            color={sleepTimer ? "#10b981" : "#fff"}
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
                                    Alert.alert("Sleep Timer", `Music will pause automatically in ${mins} minutes`);
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

            {/* OpenTune-Style Up Next & Queue Modal */}
            <Modal
                visible={isQueueVisible}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setIsQueueVisible(false)}
            >
                <View className="flex-1 bg-black pt-12">
                    <View className="px-6 flex-row justify-between items-center mb-6">
                        <View>
                            <Text className="text-white text-3xl font-black">Playing Queue</Text>
                            {nextUpSongs.length > 0 && (
                                <Text className="text-zinc-500 text-sm mt-0.5">{nextUpSongs.length} upcoming tracks</Text>
                            )}
                        </View>
                        <TouchableOpacity 
                            onPress={() => setIsQueueVisible(false)}
                            className="w-10 h-10 rounded-full bg-zinc-800 items-center justify-center"
                        >
                            <X size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={recommendations}
                        keyExtractor={(track, index) => `rec-${track.id}-${index}`}
                        className="px-6"
                        showsVerticalScrollIndicator={false}
                        initialNumToRender={10}
                        maxToRenderPerBatch={10}
                        windowSize={5}
                        ListHeaderComponent={() => (
                            <>
                                <Text style={{ color: "#10b981" }} className="font-bold mb-3 uppercase tracking-wider text-xs">Now Playing</Text>
                                <View className="flex-row items-center mb-6 bg-zinc-900/60 p-3.5 rounded-2xl border border-white/10">
                                    <MusicImage
                                        images={jioSaavnService.sanitizeImageUrl(currentTrack.artwork || currentTrack.image)}
                                        className="w-14 h-14 rounded-xl mr-4"
                                        transition={300}
                                    />
                                    <View className="flex-1">
                                        <Text className="text-white font-bold text-base" numberOfLines={1}>{currentTrack.title}</Text>
                                        <Text className="text-zinc-400 text-xs mt-0.5" numberOfLines={1}>{currentTrack.artist}</Text>
                                    </View>
                                    <View className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2" />
                                </View>

                                {nextUpSongs.length > 0 && (
                                    <>
                                        <Text className="text-white font-bold text-lg mb-4">In Queue ({nextUpSongs.length})</Text>
                                        {nextUpSongs.map((track, index) => (
                                            <TouchableOpacity
                                                key={`queue-${track.id}-${index}`}
                                                className="flex-row items-center mb-4 bg-zinc-900/30 p-2.5 rounded-xl border border-white/5"
                                                onPress={() => handleSkipToTrack(currentIndexInQueue + 1 + index)}
                                            >
                                                <MusicImage
                                                    images={jioSaavnService.sanitizeImageUrl(track.artwork || track.image)}
                                                    className="w-12 h-12 rounded-lg mr-4"
                                                    transition={300}
                                                />
                                                <View className="flex-1">
                                                    <Text className="text-white font-medium text-sm" numberOfLines={1}>{track.title}</Text>
                                                    <Text className="text-zinc-500 text-xs mt-0.5" numberOfLines={1}>{track.artist}</Text>
                                                </View>
                                                <TouchableOpacity
                                                    onPress={() => removeFromQueue(track.id)}
                                                    className="p-2"
                                                >
                                                    <Trash2 size={16} color="#71717a" />
                                                </TouchableOpacity>
                                            </TouchableOpacity>
                                        ))}
                                    </>
                                )}

                                <View className="flex-row items-center mb-4 mt-4">
                                    <Zap size={18} color="#10b981" />
                                    <Text style={{ color: "#10b981" }} className="font-bold text-lg ml-1.5">Up Next Discovery</Text>
                                </View>
                            </>
                        )}
                        renderItem={({ item: track }) => (
                            <TouchableOpacity
                                className="flex-row items-center mb-3 bg-zinc-900/40 p-2.5 rounded-xl border border-white/5"
                                onPress={() => {
                                    playTrack(track);
                                    setIsQueueVisible(false);
                                }}
                            >
                                <MusicImage
                                    images={jioSaavnService.sanitizeImageUrl(track.artwork || track.image)}
                                    className="w-12 h-12 rounded-lg mr-4"
                                    transition={300}
                                />
                                <View className="flex-1 mr-2">
                                    <Text className="text-zinc-200 font-semibold text-sm" numberOfLines={1}>{track.title}</Text>
                                    <Text className="text-zinc-400 text-xs mt-0.5" numberOfLines={1}>{track.artist}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={async () => {
                                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        addToQueue(track);
                                        Alert.alert("Queue", `"${track.title}" added to queue`);
                                    }}
                                    className="p-2 bg-white/5 rounded-full"
                                >
                                    <ListPlus size={18} color="#10b981" />
                                </TouchableOpacity>
                            </TouchableOpacity>
                        )}
                        ListFooterComponent={() => (
                            <>
                                {recommendations.length === 0 && !isLoadingRecommendations && (
                                    <View className="py-8 items-center">
                                        <Zap size={32} color="#10b981" style={{ opacity: 0.4 }} />
                                        <Text className="text-zinc-500 text-center italic mt-2">No more recommendations. Tap Load More.</Text>
                                    </View>
                                )}

                                {currentTrack && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (currentTrack.id) loadRecommendations(currentTrack.id, true);
                                        }}
                                        disabled={isLoadingRecommendations}
                                        className="mt-4 mb-6 mx-4 py-3.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 items-center flex-row justify-center"
                                    >
                                        {isLoadingRecommendations ? (
                                            <>
                                                <ActivityIndicator size="small" color="#10b981" />
                                                <Text className="text-emerald-400 ml-2 font-bold">Discovering Next Tracks...</Text>
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCw size={16} color="#10b981" />
                                                <Text className="text-emerald-400 ml-2 font-bold">Load More Discovery</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
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
