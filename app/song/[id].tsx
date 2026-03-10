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
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

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

            const downloadDir = `${FileSystem.documentDirectory}Melodix/Downloads/`;
            const dirInfo = await FileSystem.getInfoAsync(downloadDir);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
            }

            const filename = `${song.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
            const fileUri = `${downloadDir}${filename}`;

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
                const metadataFile = `${FileSystem.documentDirectory}Melodix/downloads_metadata.json`;
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

    if (loading) {
        return (
            <View className="flex-1 bg-black items-center justify-center">
                <ActivityIndicator size="large" color="#1DB954" />
            </View>
        );
    }

    if (!song) return null;

    return (
        <View className="flex-1 bg-black">
            <Stack.Screen options={{ title: "Details", headerTitle: "Details" }} />
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <Image
                    source={jioSaavnService.sanitizeImageUrl(song.image) ? { uri: jioSaavnService.sanitizeImageUrl(song.image) } : require('../../assets/images/favicon.png')}
                    className="w-full h-[500px]"
                    style={{ position: 'absolute' }}
                    transition={500}
                    contentFit="cover"
                    blurRadius={20}
                    onError={(e) => console.log(`[Song Background Error]: ${song.id}`, e.error)}
                />
                <LinearGradient
                    colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', '#000']}
                    style={{ position: 'absolute', width: '100%', height: 600 }}
                />

                <View className="px-6 pt-12">
                    <View className="flex-row justify-between items-center mb-8">
                        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-black/30 rounded-full">
                            <ChevronLeft color="#fff" size={28} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setIsMenuVisible(true)} className="w-10 h-10 items-center justify-center bg-black/30 rounded-full">
                            <MoreVertical color="#fff" size={24} />
                        </TouchableOpacity>
                    </View>

                    <View className="items-center mt-20">
                        <Image
                            source={jioSaavnService.sanitizeImageUrl(song.image) ? { uri: jioSaavnService.sanitizeImageUrl(song.image) } : require('../../assets/images/favicon.png')}
                            style={{ width: width * 0.8, height: width * 0.8 }}
                            className="rounded-2xl shadow-2xl"
                            transition={300}
                            contentFit="cover"
                            placeholder={require('../../assets/images/favicon.png')}
                            onError={(e) => console.log(`[Song Image Error]: ${song.id}`, e.error)}
                        />
                    </View>

                    <View className="mt-8 px-4">
                        <Text className="text-white text-3xl font-bold mb-2">{song.name}</Text>
                        <Text className="text-zinc-400 text-xl">{song.artists.primary?.[0]?.name}</Text>
                        <Text className="text-zinc-500 mt-2 uppercase tracking-widest text-xs">
                            {song.album?.name || "Single"} • {song.year || "Unknown"}
                        </Text>
                    </View>

                    <View className="flex-row items-center justify-between mt-10 px-4">
                        <TouchableOpacity
                            onPress={() => toggleLike(song, user?.id)}
                            className="w-12 h-12 items-center justify-center bg-zinc-900 rounded-full"
                        >
                            <Heart
                                size={28}
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
                            className="w-20 h-20 bg-emerald-500 rounded-full items-center justify-center shadow-lg"
                        >
                            {isCurrentPlaying && isPlaying ? (
                                <Pause size={40} color="#000" fill="#000" />
                            ) : (
                                <Play size={40} color="#000" fill="#000" className="ml-1" />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setIsPlaylistModalVisible(true)}
                            className="w-12 h-12 items-center justify-center bg-zinc-900 rounded-full"
                        >
                            <Plus size={28} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <View className="mt-12 h-40" />
                </View>
            </ScrollView>

            <PlaylistModal
                isVisible={isPlaylistModalVisible}
                onClose={() => setIsPlaylistModalVisible(false)}
                song={song}
            />

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
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}
