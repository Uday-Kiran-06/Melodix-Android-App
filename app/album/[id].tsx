import { useAuth } from '@/components/AuthContext';
import GlassCard from '@/components/GlassCard';
import { MusicImage } from '@/components/MusicImage';
import { Shimmer } from '@/components/Shimmer';
import SongMenu from '@/components/SongMenu';
import { EmptyState } from '@/components/EmptyState';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { jioSaavnService } from '@/services/jiosaavn';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, MoreVertical, Play, Plus } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

const AnyFlashList = FlashList as any;

export default function AlbumScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const { playTrack } = usePlayerStore();
    const { audioQuality, theme } = useSettingsStore();
    const toggleLike = useLibraryStore(state => state.toggleLike);
    const likedSongs = useLibraryStore(state => state.likedSongs);
    const isDark = theme === 'dark';

    const [album, setAlbum] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSongForMenu, setSelectedSongForMenu] = useState<any>(null);

    useEffect(() => {
        const fetchAlbum = async () => {
            if (!id) return;
            setLoading(true);
            setError(null);
            try {
                const data = await jioSaavnService.getAlbumDetails(id as string);
                if (data) {
                    setAlbum(data);
                } else {
                    setError("Album not found");
                }
            } catch (e) {
                setError("Failed to load album");
            } finally {
                setLoading(false);
            }
        };
        fetchAlbum();
    }, [id]);

    const handlePlaySong = useCallback((song: any) => {
        playTrack(song, album?.songs || [], audioQuality);
    }, [playTrack, album, audioQuality]);

    const handlePlayAll = useCallback(() => {
        if (album?.songs && album.songs.length > 0) {
            playTrack(album.songs[0], album.songs, audioQuality);
        }
    }, [playTrack, album, audioQuality]);

    const handleToggleLike = useCallback((item: any) => {
        toggleLike(item, user?.id);
    }, [toggleLike, user?.id]);

    if (loading) {
        return (
            <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'} pt-12 px-4`}>
                <View className="mb-6 flex-row items-center">
                    <Shimmer width={32} height={32} borderRadius={16} className="mr-4" />
                    <View className="flex-1">
                        <Shimmer width="60%" height={28} borderRadius={4} className="mb-2" />
                        <Shimmer width="30%" height={16} borderRadius={4} />
                    </View>
                </View>
                <View className="items-center mb-6">
                    <Shimmer width={192} height={192} borderRadius={16} className="mb-4" />
                    <Shimmer width="100%" height={48} borderRadius={24} />
                </View>
                {[1, 2, 3, 4, 5].map(i => (
                    <View key={i} className={`flex-row items-center p-3 mb-4 rounded-xl ${isDark ? 'bg-zinc-900/50' : 'bg-slate-200/50'}`}>
                        <Shimmer width={56} height={56} borderRadius={8} className="mr-4" />
                        <View className="flex-1">
                            <Shimmer width="70%" height={20} borderRadius={4} className="mb-2" />
                            <Shimmer width="40%" height={16} borderRadius={4} />
                        </View>
                    </View>
                ))}
            </View>
        );
    }

    if (error || !album) {
        return (
            <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'} justify-center items-center`}>
                <Text className="text-zinc-500">{error || "Album not found"}</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4">
                    <Text className="text-emerald-500">Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const songs = album.songs || [];
    const primaryArtist = album.artists?.primary?.[0]?.name;

    const renderHeader = () => (
        <View>
            <View className="px-4 flex-row items-center justify-between mb-6 pt-4">
                <View className="flex-row items-center flex-1 pr-2">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4">
                        <ArrowLeft size={28} color={isDark ? "#fff" : "#1e293b"} />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`} numberOfLines={2}>{album.name}</Text>
                        <Text className="text-gray-400 text-sm">{songs.length} songs</Text>
                    </View>
                </View>
            </View>

            <View className="items-center mb-6 px-4">
                 <MusicImage images={album.image} className="w-48 h-48 rounded-2xl mb-4 shadow-lg" />
                 {primaryArtist && (
                     <Text className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>by {primaryArtist}</Text>
                 )}
                 {songs.length > 0 && (
                     <TouchableOpacity 
                         onPress={handlePlayAll}
                         className="bg-emerald-500 w-full py-3 rounded-full flex-row justify-center items-center mt-2"
                     >
                         <Play fill="#000" color="#000" size={20} />
                         <Text className="text-black font-bold text-lg ml-2">Play All</Text>
                     </TouchableOpacity>
                 )}
            </View>
        </View>
    );

    const renderItem = ({ item: song }: { item: any }) => {
        const isLiked = likedSongs.some((s: any) => s.id === song.id);
        
        return (
            <View className="mb-2 px-4">
                <GlassCard intensity={20}>
                    <TouchableOpacity
                        onPress={() => handlePlaySong(song)}
                        className="flex-row items-center p-2"
                    >
                        <MusicImage
                            images={song.image || album.image}
                            className="w-12 h-12 rounded-lg mr-4"
                        />
                        <View className="flex-1 pr-2">
                            <Text className={`${isDark ? 'text-white' : 'text-slate-800'} font-semibold`} numberOfLines={1}>{song?.name || song?.title || 'Unknown'}</Text>
                            <Text className="text-gray-400 text-sm" numberOfLines={1}>
                                {song?.artists?.primary?.[0]?.name || song?.artist || 'Unknown Artist'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => handleToggleLike(song)} className="p-2 ml-2">
                            {isLiked ? (
                                <CheckCircle2 size={24} color="#1DB954" />
                            ) : (
                                <Plus size={24} color={isDark ? "#71717a" : "#94a3b8"} />
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setSelectedSongForMenu(song)} 
                            className={`p-2 rounded-full ml-1 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}
                        >
                            <MoreVertical size={20} color={isDark ? "#71717a" : "#94a3b8"} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                </GlassCard>
            </View>
        );
    };

    return (
        <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'} pt-8`}>
            {songs.length === 0 ? (
                <View className="flex-1">
                    {renderHeader()}
                    <EmptyState
                        icon={Play}
                        title="No songs found"
                        message="This album doesn't seem to have any tracks available at the moment."
                    />
                </View>
            ) : (
                <AnyFlashList
                    data={songs}
                    keyExtractor={(song: any, index: number) => song?.id || `song-${index}`}
                    estimatedItemSize={72}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListHeaderComponent={renderHeader}
                    renderItem={renderItem}
                />
            )}
            
            <SongMenu 
                isVisible={!!selectedSongForMenu} 
                onClose={() => setSelectedSongForMenu(null)} 
                song={selectedSongForMenu}
                userId={user?.id}
            />
        </View>
    );
}
