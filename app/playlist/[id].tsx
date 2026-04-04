import GlassCard from '@/components/GlassCard';
import { MusicImage } from '@/components/MusicImage';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Play, X } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';

export default function PlaylistScreen() {
    const { id } = useLocalSearchParams();
    const { playlists, removeSongFromPlaylist } = useLibraryStore();
    const { playTrack } = usePlayerStore();
    const { audioQuality, theme } = useSettingsStore();
    const router = useRouter();
    const isDark = theme === 'dark';

    const playlist = playlists.find(p => p.id === id);

    const handlePlaySong = useCallback((song: any) => {
        playTrack(song, playlist?.songs?.map((s: any) => s.song_data) || []);
    }, [playTrack, playlist, audioQuality]);

    const handlePlayAll = useCallback(() => {
        const songs = playlist?.songs?.map((s: any) => s.song_data) || [];
        if (songs.length > 0) {
            playTrack(songs[0], songs);
        }
    }, [playTrack, playlist, audioQuality]);

    const handleRemoveSong = useCallback((songId: string) => {
        if (playlist) removeSongFromPlaylist(songId, playlist.id);
    }, [removeSongFromPlaylist, playlist]);

    if (!playlist) {
        return (
            <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'} justify-center items-center`}>
                <Text className="text-zinc-500">Playlist not found</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4">
                    <Text className="text-emerald-500">Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const songs = (playlist.songs || []).map((s: any) => s.song_data);

    return (
        <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'} pt-12`}>
            <View className="px-4 flex-row items-center mb-6">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <ArrowLeft size={28} color={isDark ? "#fff" : "#1e293b"} />
                </TouchableOpacity>
                <View className="flex-1">
                    <Text className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`} numberOfLines={1}>{playlist.name}</Text>
                    <Text className="text-gray-400 text-sm">{songs.length} songs</Text>
                </View>
            </View>

            {songs.length > 0 && (
                <View className="px-4 mb-4">
                    <TouchableOpacity 
                        onPress={handlePlayAll}
                        className="bg-emerald-500 w-full py-3 rounded-full flex-row justify-center items-center"
                    >
                        <Play fill="#000" color="#000" size={20} />
                        <Text className="text-black font-bold text-lg ml-2">Play All</Text>
                     </TouchableOpacity>
                </View>
            )}

            {songs.length === 0 ? (
                <View className="items-center py-20">
                    <Text className="text-zinc-500 text-lg">No songs in this playlist yet.</Text>
                </View>
            ) : (
                <FlatList
                    data={songs}
                    keyExtractor={(song: any) => song?.id || Math.random().toString()}
                    className="px-4"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    removeClippedSubviews={true}
                    renderItem={({ item: song }) => (
                        <TouchableOpacity
                            onPress={() => handlePlaySong(song)}
                            className="mb-4"
                        >
                            <GlassCard intensity={20}>
                                <View className="flex-row items-center p-3">
                                    <MusicImage
                                        images={song.image}
                                        className="w-14 h-14 rounded-lg mr-4"
                                    />
                                    <View className="flex-1">
                                        <Text className={`${isDark ? 'text-white' : 'text-slate-800'} font-semibold`} numberOfLines={1}>{song?.name || song?.title || 'Unknown'}</Text>
                                        <Text className="text-gray-400 text-sm" numberOfLines={1}>
                                            {song?.artists?.primary?.[0]?.name || song?.artist || 'Unknown Artist'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleRemoveSong(song.id)}
                                        className="p-2"
                                    >
                                        <X size={20} color="#ef4444" />
                                    </TouchableOpacity>
                                    <Play size={20} color="#1DB954" fill="#1DB954" className="ml-2" />
                                </View>
                            </GlassCard>
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
}
