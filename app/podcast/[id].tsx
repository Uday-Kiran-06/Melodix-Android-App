import { useAuth } from '@/components/AuthContext';
import { MusicImage } from '@/components/MusicImage';
import { Shimmer } from '@/components/Shimmer';
import SongMenu from '@/components/SongMenu';
import { EmptyState } from '@/components/EmptyState';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { jioSaavnService } from '@/services/jiosaavn';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MoreVertical, Play } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import GlassCard from '@/components/GlassCard';

const AnyFlashList = FlashList as any;

export default function PodcastShowScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const { playTrack } = usePlayerStore();
    const { theme } = useSettingsStore();
    const isDark = theme === 'dark';

    const [podcast, setPodcast] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSongForMenu, setSelectedSongForMenu] = useState<any>(null);

    useEffect(() => {
        const fetchPodcast = async () => {
            if (!id) return;
            setLoading(true);
            setError(null);
            try {
                const data = await jioSaavnService.getPodcastDetails(id as string);
                if (data) {
                    setPodcast(data);
                } else {
                    setError("Podcast show not found");
                }
            } catch (e) {
                setError("Failed to load podcast episodes");
            } finally {
                setLoading(false);
            }
        };
        fetchPodcast();
    }, [id]);

    const handlePlayEpisode = useCallback((episode: any) => {
        // Episodes are treated as songs for playback
        playTrack(episode, podcast?.episodes || []);
    }, [playTrack, podcast]);

    if (loading) {
        return (
            <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'} pt-12 px-4`}>
                <Shimmer width="40%" height={32} borderRadius={8} className="mb-8" />
                <View className="items-center mb-8">
                    <Shimmer width={200} height={200} borderRadius={20} className="mb-4" />
                    <Shimmer width="70%" height={24} borderRadius={4} />
                </View>
                {[1, 2, 3].map(i => (
                    <View key={i} className="mb-4">
                        <Shimmer width="100%" height={80} borderRadius={16} />
                    </View>
                ))}
            </View>
        );
    }

    if (error || !podcast) {
        return (
            <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'} justify-center items-center`}>
                <Text className="text-zinc-500">{error || "Podcast not found"}</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4">
                    <Text className="text-emerald-500">Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const episodes = podcast.episodes || [];

    const renderHeader = () => (
        <View className="px-4 pt-4 mb-6">
            <TouchableOpacity onPress={() => router.back()} className="mb-6">
                <ArrowLeft size={28} color={isDark ? "#fff" : "#1e293b"} />
            </TouchableOpacity>
            
            <View className="items-center">
                <MusicImage images={podcast.image} className="w-56 h-56 rounded-3xl mb-6 shadow-2xl" />
                <Text className={`text-2xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{podcast.name}</Text>
                <Text className="text-zinc-500 text-center mb-6 px-4">{podcast.subtitle || podcast.artist || "Podcast Series"}</Text>
                
                {episodes.length > 0 && (
                    <TouchableOpacity 
                        onPress={() => handlePlayEpisode(episodes[0])}
                        className="bg-emerald-500 px-10 py-4 rounded-full flex-row items-center"
                    >
                        <Play fill="#000" color="#000" size={20} />
                        <Text className="text-black font-bold text-lg ml-2">Latest Episode</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const renderItem = ({ item: episode }: { item: any }) => (
        <View className="mb-3 px-4">
            <GlassCard intensity={15}>
                <TouchableOpacity
                    onPress={() => handlePlayEpisode(episode)}
                    className="flex-row items-center p-3"
                >
                    <MusicImage
                        images={episode.image || podcast.image}
                        className="w-16 h-16 rounded-xl mr-4"
                    />
                    <View className="flex-1">
                        <Text className={`${isDark ? 'text-white' : 'text-slate-800'} font-bold text-base`} numberOfLines={2}>
                            {episode.name}
                        </Text>
                        <Text className="text-zinc-500 text-xs mt-1" numberOfLines={1}>
                            {episode.releaseDate || "Episode"}
                        </Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => setSelectedSongForMenu(episode)} 
                        className="p-2 ml-2"
                    >
                        <MoreVertical size={20} color={isDark ? "#71717a" : "#94a3b8"} />
                    </TouchableOpacity>
                </TouchableOpacity>
            </GlassCard>
        </View>
    );

    return (
        <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'} pt-8`}>
            {episodes.length === 0 ? (
                <View className="flex-1">
                    {renderHeader()}
                    <EmptyState
                        icon={Play}
                        title="No episodes"
                        message="This podcast doesn't have any episodes available right now."
                    />
                </View>
            ) : (
                <AnyFlashList
                    data={episodes}
                    keyExtractor={(e: any, i: number) => e.id || `ep-${i}`}
                    estimatedItemSize={100}
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
