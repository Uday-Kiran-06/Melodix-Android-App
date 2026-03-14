import GlassCard from '@/components/GlassCard';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import SongMenu from '@/components/SongMenu';
import { jioSaavnService } from '@/services/jiosaavn';
import { Song } from '@/types/music';
import { FlashList } from '@shopify/flash-list';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, Download, MoreVertical, Play, Shuffle, Trash2, X } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { MusicImage } from '@/components/MusicImage';
import MiniPlayer from '@/components/MiniPlayer';

const AnyFlashList = FlashList as any;

const DownloadItem = memo(({ item, onPlay, onDelete, isDark }: any) => (
    <View className="mb-4">
        <GlassCard intensity={20}>
            <View className="p-2 flex-row items-center">
                <MusicImage
                    images={item.image}
                    className="w-12 h-12 rounded-lg mr-4"
                />
                <View className="flex-1">
                    <Text className={`${isDark ? 'text-white' : 'text-slate-900'} font-bold text-lg`} numberOfLines={1}>
                        {item.name}
                    </Text>
                    <Text className="text-zinc-500" numberOfLines={1}>
                        {item.artists?.primary?.[0]?.name || item.artist}
                    </Text>
                </View>
                <View className="flex-row items-center">
                    <TouchableOpacity
                        onPress={onPlay}
                        className="bg-emerald-500/10 p-2.5 rounded-full mr-1"
                    >
                        <Play size={18} color="#1DB954" fill="#1DB954" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={onDelete}
                        className={`p-2.5 rounded-full ${isDark ? 'bg-white/5' : 'bg-black/5'}`}
                    >
                        <MoreVertical size={20} color={isDark ? "#71717a" : "#94a3b8"} />
                    </TouchableOpacity>
                </View>
            </View>
        </GlassCard>
    </View>
));

export default function DownloadsScreen() {
    const { downloadedSongs, syncDownloadedSongs, deleteDownload } = useLibraryStore();
    const { playTrack, toggleShuffle, setShuffle } = usePlayerStore();
    const { audioQuality, theme } = useSettingsStore();
    const isDark = theme === 'dark';
    const router = useRouter();
    const [selectedSongForMenu, setSelectedSongForMenu] = useState<any>(null);

    useEffect(() => {
        syncDownloadedSongs();
    }, [syncDownloadedSongs]);

    const handleDelete = useCallback(async (song: any) => {
        Alert.alert(
            "Delete Download",
            `Are you sure you want to delete "${song.name}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteDownload(song.id);
                        } catch (error) {
                            Alert.alert("Error", "Failed to delete file.");
                        }
                    }
                }
            ]
        );
    }, [deleteDownload]);

    const handlePlayDownloaded = useCallback(async (song: any) => {
        const fileUri = song.localUri || `${(FileSystem as any).documentDirectory}Melodix/Downloads/${song.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;

        const localSong = {
            ...song,
            downloadUrl: [{ quality: '320kbps', url: fileUri }]
        };

        playTrack(localSong, downloadedSongs.map((s: any) => ({
            ...s,
            downloadUrl: [{ quality: '320kbps', url: s.localUri || `${(FileSystem as any).documentDirectory}Melodix/Downloads/${s.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3` }]
        })), audioQuality);
    }, [playTrack, downloadedSongs, audioQuality]);

    const handlePlayAll = useCallback(async () => {
        if (downloadedSongs.length === 0) return;
        setShuffle(false);
        handlePlayDownloaded(downloadedSongs[0]);
    }, [downloadedSongs, setShuffle, handlePlayDownloaded]);

    const handleShuffleAll = useCallback(async () => {
        if (downloadedSongs.length === 0) return;
        setShuffle(true);
        const randomIndex = Math.floor(Math.random() * downloadedSongs.length);
        handlePlayDownloaded(downloadedSongs[randomIndex]);
    }, [downloadedSongs, setShuffle, handlePlayDownloaded]);

    const renderItem = useCallback(({ item }: { item: Song }) => (
        <DownloadItem
            item={item}
            onPlay={() => handlePlayDownloaded(item)}
            onDelete={() => setSelectedSongForMenu(item)}
            isDark={isDark}
        />
    ), [handlePlayDownloaded, isDark]);

    return (
        <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'}`}>
            <Stack.Screen options={{
                headerShown: true,
                title: "Downloads",
                headerTransparent: true,
                headerTintColor: isDark ? '#fff' : '#000',
                headerLeft: () => (
                    <TouchableOpacity onPress={() => router.back()} className="ml-4 p-2 bg-zinc-800/50 rounded-full">
                        <ChevronLeft size={24} color="#fff" />
                    </TouchableOpacity>
                )
            }} />

            <View className="flex-1 pt-24 px-4">
                <Text className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-2`}>Downloads</Text>
                <Text className="text-zinc-500 mb-6">{downloadedSongs.length} songs saved offline</Text>

                {downloadedSongs.length > 0 && (
                    <View className="flex-row gap-4 mb-6">
                        <TouchableOpacity 
                            onPress={handlePlayAll}
                            className="flex-1 bg-emerald-500 flex-row items-center justify-center py-3.5 rounded-2xl shadow-lg shadow-emerald-500/20"
                        >
                            <Play size={20} color="#fff" fill="#fff" className="mr-2" />
                            <Text className="text-white font-bold text-lg">Play All</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={handleShuffleAll}
                            className={`flex-1 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'} flex-row items-center justify-center py-3.5 rounded-2xl`}
                        >
                            <Shuffle size={20} color={isDark ? "#fff" : "#1e293b"} className="mr-2" />
                            <Text className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>Shuffle</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {downloadedSongs.length === 0 ? (
                    <View className="flex-1 items-center justify-center">
                        <Download size={64} color="#27272a" />
                        <Text className="text-zinc-500 mt-4 text-center">No downloaded songs yet.{"\n"}Download some to listen offline!</Text>
                    </View>
                ) : (
                    <AnyFlashList
                        data={downloadedSongs}
                        renderItem={renderItem}
                        estimatedItemSize={88}
                        keyExtractor={(item: any) => item.id}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 150 }}
                    />
                )}
            </View>

            <SongMenu 
                isVisible={!!selectedSongForMenu} 
                onClose={() => setSelectedSongForMenu(null)} 
                song={selectedSongForMenu}
                extraActions={
                    <SongMenu.Item 
                        icon={Trash2}
                        label="Delete from Device"
                        onPress={() => {
                            const song = selectedSongForMenu;
                            setSelectedSongForMenu(null);
                            handleDelete(song);
                        }}
                        color="#ef4444"
                    />
                }
            />
            <MiniPlayer />
        </View>
    );
}
