import { useAuth } from '@/components/AuthContext';
import PlaylistModal from '@/components/PlaylistModal';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { jioSaavnService } from '@/services/jiosaavn';
import { Song } from '@/types/music';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import {
    ChevronLeft,
    Download,
    Heart,
    ListMinus,
    ListPlus,
    MoreVertical,
    Pause,
    Play,
    Plus
} from 'lucide-react-native';
import { MotiView } from 'moti';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function SongDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { playTrack, currentTrack, isPlaying, togglePlayback, addToQueue, removeFromQueue, isInQueue } = usePlayerStore();
    const { toggleLike, isLiked } = useLibraryStore();
    const { user } = useAuth();
    const { theme, audioQuality } = useSettingsStore();

    const [song, setSong] = useState<Song | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const [isPlaylistModalVisible, setIsPlaylistModalVisible] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

    useEffect(() => {
        const fetchDetails = async () => {
            if (!id) return;
            try {
                const details = await jioSaavnService.getSongDetails(id);
                setSong(details);
            } catch (error) {
                console.error("Fetch song details error:", error);
                Alert.alert("Error", "Could not fetch song details.");
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [id]);

    const handleDownload = async () => {
        if (!song || !song.downloadUrl) return;

        const { downloadedSongs, syncDownloadedSongs } = useLibraryStore.getState();
        const downloadedTrack = downloadedSongs.find(s => s.id === song.id);

        if (downloadedTrack?.localUri) {
            const fileInfo = await FileSystem.getInfoAsync(downloadedTrack.localUri);
            if (fileInfo.exists) {
                Alert.alert("Already Downloaded", `"${song.name}" is already saved to your device.`);
                return;
            } else {
                // Stale state, sync
                console.log("[SongDetails]: Stale download detected, syncing...");
                await syncDownloadedSongs();
            }
        }

        try {
            setDownloadProgress(0);
            
            // Robust quality selection for downloads
            let target = song.downloadUrl?.find((d: any) => d.quality === String(audioQuality)) ||
                (song.downloadUrl ? song.downloadUrl[song.downloadUrl.length - 1] : null);

            let url = target?.url;

            if (!url) {
                Alert.alert("Error", "No download source available for this track.");
                return;
            }

            const downloadUrl = url;

            const downloadDir = `${FileSystem.documentDirectory}Melodix/Downloads/`;
            const dirInfo = await FileSystem.getInfoAsync(downloadDir);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
            }

            const cleanTitle = song.name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').trim();
            const filename = `${cleanTitle}_${song.id}.m4a`;
            const fileUri = `${downloadDir}${filename}`;

            const notificationId = `download-${song.id}`;
            let lastUpdate = Date.now();

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
                                    title: `Downloading: ${song.name}`,
                                    body: `Progress: ${Math.round(progress * 100)}%`,
                                },
                                trigger: null,
                            });
                        } catch (e) {}
                    }
                }
            );

            const result = await downloadResumable.downloadAsync();
            setDownloadProgress(null);
            try { await Notifications.dismissNotificationAsync(notificationId); } catch(e) {}

            if (result && result.uri) {
                // Save to SQLite & Media Library
                await useLibraryStore.getState().saveDownload(song, result.uri);

                try {
                    await Notifications.scheduleNotificationAsync({
                        identifier: `${notificationId}-complete`,
                        content: {
                            title: "Download Complete",
                            body: `"${song.name}" has been saved for offline playback.`
                        },
                        trigger: null
                    });
                } catch (e) {}

                Alert.alert(
                    "Download Complete",
                    `"${song.name}" has been saved for offline playback.`,
                    [
                        { text: "OK" },
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

    const isCurrentPlaying = currentTrack?.id === id;

    return (
        <View className="flex-1 bg-black">
            <Stack.Screen options={{ headerShown: false, title: song?.name || "Details" }} />
            
            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#1DB954" />
                </View>
            ) : !song ? (
                <View className="flex-1 items-center justify-center">
                    <Text className="text-white">Song not found</Text>
                </View>
            ) : (
                <>
                    {/* Dynamic Background */}
                    <View className="absolute inset-0">
                        <Image
                            source={jioSaavnService.sanitizeImageUrl(song.image) ? { uri: jioSaavnService.sanitizeImageUrl(song.image) } : require('../../assets/images/favicon.png')}
                            className="absolute inset-0 opacity-60"
                            transition={500}
                            contentFit="cover"
                            blurRadius={40}
                        />
                        <LinearGradient
                            colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.6)', '#000']}
                            className="absolute inset-0"
                        />
                    </View>

                    <View className="flex-1 px-6 pt-12">
                        {/* Header Row */}
                        <View className="flex-row justify-between items-center mb-4">
                            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-black/20 rounded-full">
                                <ChevronLeft color="#fff" size={28} />
                            </TouchableOpacity>
                            <Text className="text-zinc-400 font-medium">SONG DETAILS</Text>
                            <TouchableOpacity onPress={() => setIsMenuVisible(true)} className="w-10 h-10 items-center justify-center bg-black/20 rounded-full">
                                <MoreVertical color="#fff" size={24} />
                            </TouchableOpacity>
                        </View>

                        {/* Centered Main Content */}
                        <View className="flex-1 justify-center items-center">
                            <View className="shadow-2xl">
                                <Image
                                    source={jioSaavnService.sanitizeImageUrl(song.image) ? { uri: jioSaavnService.sanitizeImageUrl(song.image) } : require('../../assets/images/favicon.png')}
                                    style={{ width: width * 0.85, height: width * 0.85 }}
                                    className="rounded-3xl"
                                    transition={300}
                                    contentFit="cover"
                                    placeholder={require('../../assets/images/favicon.png')}
                                />
                                {downloadProgress !== null && (
                                    <View className="absolute bottom-0 left-0 right-0 h-2 bg-black/40 rounded-b-3xl overflow-hidden">
                                        <View 
                                            className="h-full bg-emerald-500" 
                                            style={{ width: `${downloadProgress * 100}%` }} 
                                        />
                                    </View>
                                )}
                            </View>

                            <View className="mt-10 items-center px-4 w-full">
                                <Text className="text-white text-3xl font-bold text-center mb-2" numberOfLines={2}>{song.name}</Text>
                                <Text className="text-emerald-500 text-xl font-medium text-center">{song?.artists.primary?.[0]?.name}</Text>
                                <Text className="text-zinc-500 mt-3 uppercase tracking-widest text-xs font-semibold">
                                    {song.album?.name || "Single"} • {song.year || "Unknown"}
                                </Text>
                            </View>

                            {/* Controls Row */}
                            <View className="flex-row items-center justify-between mt-12 w-full px-8">
                                <TouchableOpacity
                                    onPress={() => toggleLike(song, user?.id)}
                                    className={`w-14 h-14 items-center justify-center rounded-full ${isLiked(song.id) ? 'bg-emerald-500/10' : 'bg-zinc-900/50'}`}
                                >
                                    <Heart
                                        size={26}
                                        color={isLiked(song.id) ? "#1DB954" : "#fff"}
                                        fill={isLiked(song.id) ? "#1DB954" : "transparent"}
                                    />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => {
                                        if (isCurrentPlaying) {
                                            if (!isPlaying) togglePlayback();
                                        } else {
                                            playTrack(song, [song]);
                                        }
                                        router.push('/player');
                                    }}
                                    className="w-20 h-20 bg-emerald-500 rounded-full items-center justify-center shadow-xl"
                                >
                                    {isCurrentPlaying && isPlaying ? (
                                        <Pause size={40} color="#000" fill="#000" />
                                    ) : (
                                        <Play size={40} color="#000" fill="#000" className="ml-1" />
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setIsPlaylistModalVisible(true)}
                                    className="w-14 h-14 items-center justify-center bg-zinc-900/50 rounded-full"
                                >
                                    <Plus size={26} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Bottom Spacer */}
                        <View className="h-12" />
                    </View>

                    <PlaylistModal
                        isVisible={isPlaylistModalVisible}
                        onClose={() => setIsPlaylistModalVisible(false)}
                        song={song}
                    />

                    <Modal
                        visible={isMenuVisible}
                        transparent
                        animationType="none"
                        onRequestClose={() => setIsMenuVisible(false)}
                    >
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => setIsMenuVisible(false)}
                            className="flex-1 justify-end bg-black/60"
                        >
                            <MotiView
                                from={{ translateY: height * 0.5, opacity: 0 }}
                                animate={{ translateY: isMenuVisible ? 0 : height * 0.5, opacity: isMenuVisible ? 1 : 0 }}
                                transition={{ type: 'timing', duration: 250 }}
                                className="bg-zinc-900 p-6 rounded-t-3xl border-t border-zinc-800"
                            >
                                <View className="items-center mb-6">
                                    <View className="w-12 h-1.5 bg-zinc-700 rounded-full mb-6" />
                                    <Image
                                        source={jioSaavnService.sanitizeImageUrl(song.image) ? { uri: jioSaavnService.sanitizeImageUrl(song.image) } : require('../../assets/images/favicon.png')}
                                        className="w-24 h-24 rounded-lg mb-4"
                                        transition={200}
                                        contentFit="cover"
                                        placeholder={require('../../assets/images/favicon.png')}
                                        onError={(e) => console.log(`[Menu Image Error]: ${song.id}`, e.error)}
                                    />
                                    <Text className="text-white text-xl font-bold text-center" numberOfLines={1}>{song.name}</Text>
                                    <Text className="text-zinc-500 text-lg text-center" numberOfLines={1}>{song.artists.primary?.[0]?.name}</Text>
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

                                {isInQueue(song.id) ? (
                                    <TouchableOpacity
                                        onPress={() => {
                                            removeFromQueue(song.id);
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
                                            const itemUrl = song.downloadUrl ? (song.downloadUrl[
                                                (audioQuality === '320kbps' ? 4 : audioQuality === '160kbps' ? 3 : 2)
                                            ]?.url || song.downloadUrl[song.downloadUrl.length - 1]?.url) : null;
                                            
                                            const track: any = {
                                                id: song.id,
                                                url: itemUrl,
                                                title: song.name,
                                                artist: song.artists.primary?.[0]?.name,
                                                artwork: jioSaavnService.sanitizeImageUrl(song.image),
                                                duration: song.duration,
                                                originalDownloadUrl: song.downloadUrl
                                            };
                                            if (!track.url) {
                                                Alert.alert("Error", "Cannot add to queue: No audio source found.");
                                                return;
                                            }
                                            addToQueue(track);
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

                                <TouchableOpacity
                                    onPress={() => setIsMenuVisible(false)}
                                    className="mt-4 py-4 rounded-xl bg-zinc-800 items-center"
                                >
                                    <Text className="text-white font-bold text-lg">Close</Text>
                                </TouchableOpacity>
                            </MotiView>
                        </TouchableOpacity>
                    </Modal>
                </>
            )}
        </View>
    );
}
