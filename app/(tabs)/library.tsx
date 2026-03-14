import { useAuth } from '@/components/AuthContext';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { jioSaavnService } from '@/services/jiosaavn';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Download, Heart, ListMusic, MoreVertical, Plus, X } from 'lucide-react-native';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MusicImage } from '@/components/MusicImage';

const AnyFlashList = FlashList as any;

const LibraryRow = memo(({ title, subtitle, image, icon, onPress, onLongPress, type, isDark }: any) => (
    <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        className="flex-row items-center mb-4 active:opacity-70 px-5"
    >
        <View className="mr-4">
            {image ? (
                <MusicImage
                    images={image}
                    className={`w-16 h-16 ${type === 'artist' ? 'rounded-full' : 'rounded-lg'}`}
                />
            ) : (
                <View className={`w-16 h-16 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'} rounded-lg items-center justify-center`}>
                    {icon}
                </View>
            )}
        </View>
        <View className="flex-1">
            <Text className={`${isDark ? 'text-white' : 'text-slate-900'} font-semibold text-lg`} numberOfLines={1}>{title}</Text>
            <Text className="text-zinc-500 text-sm " numberOfLines={1}>{subtitle}</Text>
        </View>
        {onLongPress && <MoreVertical size={20} color="#71717a" />}
    </TouchableOpacity>
));

export default function LibraryScreen() {
    const { likedSongs, playlists, createPlaylist, deletePlaylist, downloadedSongs, syncDownloadedSongs } = useLibraryStore();
    const { user } = useAuth();
    const { theme } = useSettingsStore();
    const isDark = theme === 'dark';
    const router = useRouter();
    
    React.useEffect(() => {
        syncDownloadedSongs();
    }, [syncDownloadedSongs]);

    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [filter, setFilter] = useState<'all' | 'playlists' | 'songs'>('all');

    const handleCreatePlaylist = useCallback(async () => {
        if (!user) {
            Alert.alert("Log In Required", "Please log in to create playlists.");
            setIsCreateModalVisible(false);
            return;
        }

        if (newPlaylistName.trim()) {
            setIsSubmitting(true);
            try {
                await createPlaylist(newPlaylistName.trim(), user.id);
                setNewPlaylistName('');
                setIsCreateModalVisible(false);
            } catch (error) {
                Alert.alert("Error", "Failed to create playlist.");
            } finally {
                setIsSubmitting(false);
            }
        }
    }, [user, newPlaylistName, createPlaylist]);

    const handleDeletePlaylist = useCallback((id: string, name: string) => {
        Alert.alert(
            "Delete Playlist",
            `Are you sure you want to delete "${name}"?`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => deletePlaylist(id) }
            ]
        );
    }, [deletePlaylist]);

    const listData = useMemo(() => {
        const items: any[] = [];

        if (filter === 'all' || filter === 'songs') {
            items.push({
                id: 'liked-songs',
                type: 'fixed',
                title: 'Liked Songs',
                subtitle: `Playlist • ${likedSongs.length} songs`,
                image: likedSongs[0]?.image,
                icon: <Heart size={32} color="#fff" fill="#1DB954" />,
                onPress: () => router.push('/liked-songs')
            });
            items.push({
                id: 'downloads',
                type: 'fixed',
                title: 'Downloads',
                subtitle: `Playlist • ${downloadedSongs.length} songs`,
                image: downloadedSongs[0]?.image,
                icon: <Download size={32} color="#1DB954" />,
                onPress: () => router.push('/downloads' as any)
            });
        }

        if (filter === 'all' || filter === 'playlists') {
            playlists.forEach(p => {
                items.push({
                    id: p.id,
                    type: 'playlist',
                    title: p.name,
                    subtitle: `Playlist • ${user?.email || 'User'}`,
                    icon: <ListMusic size={32} color="#71717a" />,
                    onPress: () => router.push({ pathname: '/playlist/[id]', params: { id: p.id } } as any),
                    onLongPress: () => handleDeletePlaylist(p.id, p.name)
                });
            });
        }

        return items;
    }, [filter, likedSongs.length, downloadedSongs.length, playlists, user?.email, router, handleDeletePlaylist]);

    const renderItem = useCallback(({ item }: { item: any }) => (
        <LibraryRow
            title={item.title}
            subtitle={item.subtitle}
            image={item.image}
            icon={item.icon}
            onPress={item.onPress}
            onLongPress={item.onLongPress}
            type={item.type}
            isDark={isDark}
        />
    ), [isDark]);

    return (
        <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'} pt-14`}>
            {/* Header */}
            <View className="flex-row justify-between items-center px-5 mb-6">
                <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-emerald-500 items-center justify-center mr-3">
                        <Text className="text-white font-bold text-lg">{user?.email?.[0].toUpperCase() || 'M'}</Text>
                    </View>
                    <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Your Library</Text>
                </View>
                <TouchableOpacity onPress={() => setIsCreateModalVisible(true)}>
                    <Plus size={28} color={isDark ? "#fff" : "#1e293b"} />
                </TouchableOpacity>
            </View>

            {/* Filter Chips */}
            <View className="px-5 mb-6 flex-row gap-3">
                {(['all', 'playlists', 'songs'] as const).map((f) => (
                    <TouchableOpacity
                        key={f}
                        onPress={() => setFilter(f)}
                        className={`px-4 py-2 rounded-full ${filter === f ? 'bg-emerald-500' : isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}
                    >
                        <Text className={`${filter === f ? 'text-black' : isDark ? 'text-white' : 'text-slate-900'} font-medium capitalize`}>
                            {f}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View className="flex-1">
                <AnyFlashList
                    data={listData}
                    renderItem={renderItem}
                    estimatedItemSize={80}
                    keyExtractor={(item: any) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 150 }}
                    ListEmptyComponent={
                        filter === 'playlists' ? (
                            <View className="items-center py-20">
                                <Text className="text-zinc-500">No playlists yet.</Text>
                            </View>
                        ) : null
                    }
                />
            </View>

            {/* Create Playlist Modal */}
            <Modal
                visible={isCreateModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsCreateModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className={`${isDark ? 'bg-zinc-900' : 'bg-white'} p-6 rounded-t-3xl`}>
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>New Playlist</Text>
                            <TouchableOpacity onPress={() => setIsCreateModalVisible(false)}>
                                <X size={24} color={isDark ? "#71717a" : "#64748b"} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            value={newPlaylistName}
                            onChangeText={setNewPlaylistName}
                            placeholder="Playlist Name"
                            placeholderTextColor="#71717a"
                            autoFocus
                            className={`${isDark ? 'bg-zinc-800 text-white' : 'bg-slate-100 text-slate-900'} p-4 rounded-xl text-lg mb-6`}
                        />
                        <TouchableOpacity
                            onPress={handleCreatePlaylist}
                            disabled={!newPlaylistName.trim() || isSubmitting}
                            className={`py-4 rounded-full items-center ${newPlaylistName.trim() && !isSubmitting ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text className="text-white font-bold text-lg">Create</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
