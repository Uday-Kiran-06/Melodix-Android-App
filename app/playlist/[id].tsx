import GlassCard from '@/components/GlassCard';
import { MusicImage } from '@/components/MusicImage';
import SongMenu from '@/components/SongMenu';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { downloadService } from '@/services/DownloadService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, Download, MoreVertical, Play, X } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';

export default function PlaylistScreen() {
    const { id } = useLocalSearchParams();
    const { playlists, removeSongFromPlaylist, downloadedSongs, activePlaylistDownloads } = useLibraryStore();
    const { playTrack } = usePlayerStore();
    const { audioQuality, theme } = useSettingsStore();
    const router = useRouter();
    const isDark = theme === 'dark';

    const [selectedSongForMenu, setSelectedSongForMenu] = useState<any>(null);

    const playlist = playlists.find(p => p.id === id);
    const songs = (playlist?.songs || []).map((s: any) => s.song_data);

    const playlistId = String(id);
    const playlistProgress = activePlaylistDownloads[playlistId];
    const isDownloadingPlaylist = !!playlistProgress;
    const allDownloaded = songs.length > 0 && songs.every((s: any) => downloadedSongs.some((ds: any) => String(ds.id) === String(s.id)));

    const handlePlaySong = useCallback((song: any) => {
        playTrack(song, songs);
    }, [playTrack, songs, audioQuality]);

    const handlePlayAll = useCallback(() => {
        if (songs.length > 0) {
            playTrack(songs[0], songs);
        }
    }, [playTrack, songs, audioQuality]);

    const handleDownloadPlaylist = useCallback(() => {
        downloadService.downloadPlaylist(songs, playlist?.name || "Playlist", playlistId);
    }, [songs, playlist?.name, playlistId]);

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
                <View className="px-4 mb-4 flex-row gap-3">
                    <TouchableOpacity 
                        onPress={handlePlayAll}
                        className="flex-1 bg-emerald-500 py-3.5 rounded-full flex-row justify-center items-center shadow-lg shadow-emerald-500/20"
                    >
                        <Play fill="#000" color="#000" size={20} />
                        <Text className="text-black font-bold text-base ml-2">Play All</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={handleDownloadPlaylist}
                        disabled={isDownloadingPlaylist || allDownloaded}
                        className={`flex-1 py-3.5 rounded-full flex-row justify-center items-center ${
                            allDownloaded 
                                ? 'bg-emerald-500/15 border border-emerald-500/30' 
                                : isDownloadingPlaylist
                                ? 'bg-zinc-800 border border-emerald-500/50'
                                : isDark ? 'bg-zinc-800' : 'bg-slate-200'
                        }`}
                    >
                        {isDownloadingPlaylist ? (
                            <ActivityIndicator size="small" color="#10b981" />
                        ) : allDownloaded ? (
                            <CheckCircle2 size={20} color="#10b981" />
                        ) : (
                            <Download size={20} color={isDark ? "#fff" : "#1e293b"} />
                        )}
                        <Text className={`font-bold text-base ml-2 ${
                            allDownloaded ? 'text-emerald-400' : isDark ? 'text-white' : 'text-slate-900'
                        }`}>
                            {isDownloadingPlaylist 
                                ? `${playlistProgress?.current || 0}/${playlistProgress?.total || songs.length}` 
                                : allDownloaded 
                                ? 'Downloaded' 
                                : 'Download'}
                        </Text>
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
                    keyExtractor={(song: any, index: number) => song?.id || `song-${index}`}
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
                                        onPress={() => setSelectedSongForMenu(song)}
                                        className="p-2 mr-1"
                                    >
                                        <MoreVertical size={20} color={isDark ? "#71717a" : "#94a3b8"} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleRemoveSong(song.id)}
                                        className="p-2"
                                    >
                                        <X size={20} color="#ef4444" />
                                    </TouchableOpacity>
                                    <Play size={20} color="#1DB954" fill="#1DB954" className="ml-1" />
                                </View>
                            </GlassCard>
                        </TouchableOpacity>
                    )}
                />
            )}

            <SongMenu 
                isVisible={!!selectedSongForMenu} 
                onClose={() => setSelectedSongForMenu(null)} 
                song={selectedSongForMenu} 
            />
        </View>
    );
}
