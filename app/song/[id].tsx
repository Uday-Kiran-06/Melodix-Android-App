import { useAuth } from '@/components/AuthContext';
import PlaylistModal from '@/components/PlaylistModal';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { jioSaavnService } from '@/services/jiosaavn';
import { Song } from '@/types/music';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
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

        try {
            setDownloadProgress(0);
            const qualityIdx = (audioQuality === '320kbps' || audioQuality === '160kbps') ? (song.downloadUrl.length > 4 ? 4 : song.downloadUrl.length - 1) : 0;
            const url = song.downloadUrl[qualityIdx].url;

            const downloadDir = `${(FileSystem as any).documentDirectory}Melodix/Downloads/`;
            const dirInfo = await FileSystem.getInfoAsync(downloadDir);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
            }

            const filename = `${song.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
            const fileUri = `${(FileSystem as any).documentDirectory}Melodix/Downloads/${filename}`;

            const downloadResumable = FileSystem.createDownloadResumable(
                url,
                fileUri,
                {},
                (progressData: any) => {
                    const progress = progressData.totalBytesWritten / progressData.totalBytesExpectedToWrite;
                    setDownloadProgress(progress);
                }
            );

            const result = await downloadResumable.downloadAsync();
            setDownloadProgress(null);

            if (result) {
                // Update Metadata
                const metadataFile = `${(FileSystem as any).documentDirectory}Melodix/downloads_metadata.json`;
                let metadata: Song[] = [];
                const metadataInfo = await FileSystem.getInfoAsync(metadataFile);
                if (metadataInfo.exists) {
                    const content = await FileSystem.readAsStringAsync(metadataFile);
                    metadata = JSON.parse(content);
                }

                // Add if not already present
                if (!metadata.some(s => s.id === song.id)) {
                    metadata.push(song);
                    await FileSystem.writeAsStringAsync(metadataFile, JSON.stringify(metadata));
                }

                // Sync store
                useLibraryStore.getState().syncDownloadedSongs();

                Alert.alert(
                    "Download Complete",
                    `Song has been saved to: Melodix/Downloads/${filename}. Would you like to share it?`,
                    [
                        { text: "No", style: "cancel" },
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
            <Stack.Screen options={{ title: song?.name || "Details", headerTitle: song?.name || "Details" }} />
            
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
                                            playTrack(song, [song], audioQuality);
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
                                            const track: any = {
                                                id: song.id,
                                                url: song.downloadUrl[audioQuality === '320kbps' ? (song.downloadUrl.length > 4 ? 4 : song.downloadUrl.length - 1) : 0].url,
                                                title: song.name,
                                                artist: song.artists.primary?.[0]?.name,
                                                artwork: jioSaavnService.sanitizeImageUrl(song.image),
                                                duration: song.duration
                                            };
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
