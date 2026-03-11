import { useAuth } from '@/components/AuthContext';
import GlassCard from '@/components/GlassCard';
import MiniPlayer from '@/components/MiniPlayer';
import SongMenu from '@/components/SongMenu';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { jioSaavnService } from '@/services/jiosaavn';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft, MoreVertical, Play, X } from 'lucide-react-native';
import React, { memo, useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

const AnyFlashList = FlashList as any;

const SongRow = memo(({ song, onPlay, onToggleLike, isDark }: any) => (
    <TouchableOpacity
        onPress={onPlay}
        className="mb-2"
    >
        <GlassCard intensity={20}>
            <View className="flex-row items-center p-3">
                {song?.image?.[0]?.url ? (
                    <Image
                        source={jioSaavnService.sanitizeImageUrl(song.image) ? { uri: jioSaavnService.sanitizeImageUrl(song.image) } : require('../assets/images/favicon.png')}
                        className="w-12 h-12 rounded-lg mr-4"
                        transition={200}
                        contentFit="cover"
                        placeholder={require('../assets/images/favicon.png')}
                        onError={(e) => console.log(`[Liked Song Image Error]: ${song.id}`, e.error)}
                    />
                ) : (
                    <View className="w-12 h-12 bg-zinc-800 rounded-lg mr-4 items-center justify-center">
                        <Play size={18} color="#71717a" />
                    </View>
                )}
                <View className="flex-1">
                    <Text className={`${isDark ? 'text-white' : 'text-slate-800'} font-semibold`} numberOfLines={1}>{(song as any)?.name || (song as any)?.title || 'Unknown'}</Text>
                    <Text className="text-gray-400 text-sm" numberOfLines={1}>
                        {(song as any)?.artists?.primary?.[0]?.name || (song as any)?.artist || 'Unknown Artist'}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={onToggleLike}
                    className={`p-2 ml-2 rounded-full ${isDark ? 'bg-white/5' : 'bg-black/5'}`}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <MoreVertical size={20} color={isDark ? "#71717a" : "#94a3b8"} />
                </TouchableOpacity>
            </View>
        </GlassCard>
    </TouchableOpacity>
));

export default function LikedSongsScreen() {
    const { likedSongs, toggleLike } = useLibraryStore();
    const { playTrack } = usePlayerStore();
    const { user } = useAuth();
    const { audioQuality, theme } = useSettingsStore();
    const router = useRouter();
    const isDark = theme === 'dark';
    const [selectedSongForMenu, setSelectedSongForMenu] = useState<any>(null);

    const handlePlaySong = useCallback((song: any) => {
        playTrack(song, likedSongs, audioQuality);
    }, [playTrack, likedSongs, audioQuality]);

    const handleToggleLike = useCallback((song: any) => {
        toggleLike(song, user?.id);
    }, [toggleLike, user?.id]);

    const renderItem = useCallback(({ item }: { item: any }) => (
        <SongRow
            song={item}
            onPlay={() => handlePlaySong(item)}
            onToggleLike={() => setSelectedSongForMenu(item)}
            isDark={isDark}
        />
    ), [handlePlaySong, isDark]);

    return (
        <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'} pt-12`}>
            <View className="px-4 flex-row items-center mb-6">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <ArrowLeft size={28} color={isDark ? "#fff" : "#1e293b"} />
                </TouchableOpacity>
                <Text className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Liked Songs</Text>
            </View>

            {(likedSongs || []).length === 0 ? (
                <View className="items-center py-20">
                    <Text className="text-zinc-500 text-lg">No liked songs yet.</Text>
                </View>
            ) : (
                <View style={{ flex: 1, paddingHorizontal: 16 }}>
                    <AnyFlashList
                        data={likedSongs}
                        renderItem={renderItem}
                        estimatedItemSize={72}
                        keyExtractor={(song: any) => song?.id || Math.random().toString()}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 120 }}
                    />
                </View>
            )}
            <SongMenu 
                isVisible={!!selectedSongForMenu} 
                onClose={() => setSelectedSongForMenu(null)} 
                song={selectedSongForMenu}
                userId={user?.id}
            />
            <MiniPlayer />
        </View>
    );
}
