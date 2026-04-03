import { useAuth } from '@/components/AuthContext';
import { DesignSystem } from '@/constants/DesignSystem';
import GlassCard from '@/components/GlassCard';
import MiniPlayer from '@/components/MiniPlayer';
import { MusicImage } from '@/components/MusicImage';
import SongMenu from '@/components/SongMenu';
import { EmptyState } from '@/components/EmptyState';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ArrowLeft, MoreVertical, Play, Search, SortAsc, X } from 'lucide-react-native';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

const AnyFlashList = FlashList as any;

const SongRow = memo(({ song, onPlay, onToggleLike, isDark }: any) => (
    <TouchableOpacity
        onPress={() => {
            Haptics.selectionAsync();
            onPlay();
        }}
        className="mb-1"
    >
        <GlassCard intensity={DesignSystem.glass.intensity}>
            <View className="flex-row items-center p-2">
                <MusicImage
                    images={song.image}
                    className="w-12 h-12 rounded-lg mr-4"
                />
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
                    <MoreVertical size={20} color={isDark ? DesignSystem.colors.textDimmed : "#94a3b8"} />
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
    const [searchQuery, setSearchQuery] = useState('');
    const [sortMode, setSortMode] = useState<'recent' | 'az' | 'artist'>('recent');

    const sortedAndFilteredSongs = useMemo(() => {
        let result = [...likedSongs];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(s => 
                s.name.toLowerCase().includes(q) || 
                (s.artists?.primary?.[0]?.name || '').toLowerCase().includes(q)
            );
        }

        switch (sortMode) {
            case 'az':
                result.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'artist':
                result.sort((a, b) => (a.artists?.primary?.[0]?.name || '').localeCompare(b.artists?.primary?.[0]?.name || ''));
                break;
            case 'recent':
            default:
                break;
        }

        return result;
    }, [likedSongs, searchQuery, sortMode]);

    const handlePlaySong = useCallback((song: any) => {
        Haptics.selectionAsync();
        playTrack(song, sortedAndFilteredSongs, audioQuality);
    }, [playTrack, sortedAndFilteredSongs, audioQuality]);

    const handlePlayAll = useCallback(() => {
        if (sortedAndFilteredSongs.length > 0) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            playTrack(sortedAndFilteredSongs[0], sortedAndFilteredSongs, audioQuality);
        }
    }, [playTrack, sortedAndFilteredSongs, audioQuality]);

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
            <View className="px-5 mb-4">
                <View className="flex-row items-center justify-between mb-4">
                    <TouchableOpacity onPress={() => router.back()}>
                        <ArrowLeft size={28} color={isDark ? "#fff" : "#1e293b"} />
                    </TouchableOpacity>
                    <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Liked Songs</Text>
                    <View style={{ width: 28 }} />
                </View>

                <View className="flex-row items-center space-x-3 mb-4">
                    <View className={`flex-1 flex-row items-center h-10 px-3 rounded-xl ${isDark ? 'bg-zinc-900' : 'bg-slate-200'}`}>
                        <Search size={16} color={isDark ? "#71717a" : "#94a3b8"} className="mr-2" />
                        <TextInput
                            placeholder="Search in library"
                            placeholderTextColor={isDark ? "#3f3f46" : "#cbd5e1"}
                            className={`flex-1 h-full text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <X size={16} color={isDark ? "#71717a" : "#94a3b8"} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity 
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            const modes: Array<'recent' | 'az' | 'artist'> = ['recent', 'az', 'artist'];
                            const nextIdx = (modes.indexOf(sortMode) + 1) % modes.length;
                            setSortMode(modes[nextIdx]);
                        }}
                        className={`w-10 h-10 items-center justify-center rounded-xl ${isDark ? 'bg-zinc-900' : 'bg-slate-200'}`}
                    >
                        <SortAsc size={20} color={sortMode !== 'recent' ? DesignSystem.colors.primary : (isDark ? "#71717a" : "#64748b")} />
                    </TouchableOpacity>
                </View>

                {sortedAndFilteredSongs.length > 0 && (
                    <TouchableOpacity 
                        onPress={handlePlayAll}
                        className="bg-emerald-500 w-full py-3.5 rounded-2xl flex-row justify-center items-center shadow-lg"
                    >
                        <Play fill="#000" color="#000" size={20} />
                        <Text className="text-black font-bold text-lg ml-2">Shuffle Play</Text>
                    </TouchableOpacity>
                )}
            </View>

            {sortedAndFilteredSongs.length === 0 ? (
                <EmptyState 
                    icon={searchQuery ? Search : Play}
                    title={searchQuery ? "No matches found" : "Your library is empty"}
                    message={searchQuery ? "Try a different search term." : "Songs you like will appear here for easy access."}
                    style={{ marginTop: 40 }}
                />
            ) : (
                <View style={{ flex: 1, paddingHorizontal: 16 }}>
                    <AnyFlashList
                        data={sortedAndFilteredSongs}
                        keyExtractor={(song: any) => song.id}
                        estimatedItemSize={72}
                        renderItem={renderItem}
                        contentContainerStyle={{ paddingBottom: 100 }}
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
