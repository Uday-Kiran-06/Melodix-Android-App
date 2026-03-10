import { useAuth } from '@/components/AuthContext';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { Song } from '@/types/music';
import { Check, ListMusic, Plus, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface PlaylistModalProps {
    isVisible: boolean;
    onClose: () => void;
    song: Song | null;
}

export default function PlaylistModal({ isVisible, onClose, song }: PlaylistModalProps) {
    const { playlists, createPlaylist, addSongToPlaylist, removeSongFromPlaylist, isSongInPlaylist } = useLibraryStore();
    const { user } = useAuth();
    const [isCreating, setIsCreating] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [successId, setSuccessId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCreate = async () => {
        if (!user) {
            Alert.alert("Log In Required", "Please log in to create playlists.");
            setIsCreating(false);
            return;
        }

        if (!newPlaylistName.trim()) return;

        setIsSubmitting(true);
        try {
            await createPlaylist(newPlaylistName, user.id);
            setNewPlaylistName('');
            setIsCreating(false);
        } catch (error) {
            Alert.alert("Error", "Failed to create playlist.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAdd = async (playlistId: string) => {
        if (!user) {
            Alert.alert("Log In Required", "Please log in to add songs.");
            return;
        }
        if (!song) return;

        setIsSubmitting(true);
        try {
            await addSongToPlaylist(song, playlistId, user.id);
            setSuccessId(playlistId);
            setTimeout(() => {
                setSuccessId(null);
                onClose();
            }, 1000);
        } catch (error) {
            Alert.alert("Error", "Failed to add song.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            visible={isVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <TouchableOpacity
                activeOpacity={1}
                onPress={onClose}
                className="flex-1 justify-end"
            >
                <View
                    style={{ backgroundColor: '#18181b' }} // Zinc-900
                    className="h-2/3 rounded-t-3xl overflow-hidden"
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        className="flex-1 p-6"
                    >
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-white text-2xl font-bold">Add to Playlist</Text>
                            <TouchableOpacity onPress={onClose}>
                                <X color="#fff" size={24} />
                            </TouchableOpacity>
                        </View>

                        {isCreating ? (
                            <View className="mb-6">
                                <TextInput
                                    className="bg-zinc-800 text-white p-4 rounded-xl mb-4 font-medium"
                                    placeholder="Playlist Name"
                                    placeholderTextColor="#71717a"
                                    value={newPlaylistName}
                                    onChangeText={setNewPlaylistName}
                                    autoFocus
                                />
                                <View className="flex-row justify-end gap-4">
                                    <TouchableOpacity
                                        onPress={() => setIsCreating(false)}
                                        className="px-6 py-3 rounded-full bg-zinc-800"
                                    >
                                        <Text className="text-white font-bold">Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleCreate}
                                        className="px-6 py-3 rounded-full bg-green-500"
                                    >
                                        <Text className="text-black font-bold">Create</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => setIsCreating(true)}
                                className="flex-row items-center bg-zinc-800/50 p-4 rounded-xl mb-6 border border-zinc-700/50"
                            >
                                <View className="w-12 h-12 bg-green-500 rounded-lg items-center justify-center mr-4">
                                    <Plus color="#000" size={24} />
                                </View>
                                <Text className="text-white font-bold text-lg">Create New Playlist</Text>
                            </TouchableOpacity>
                        )}

                        <FlatList
                            data={playlists}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => {
                                const inPlaylist = isSongInPlaylist(song?.id || "", item.id);
                                return (
                                    <View className="flex-row items-center p-4 rounded-xl mb-2 bg-zinc-900/30">
                                        <TouchableOpacity
                                            onPress={() => handleAdd(item.id)}
                                            className="flex-row items-center flex-1"
                                        >
                                            <View className="w-12 h-12 bg-zinc-800 rounded-lg items-center justify-center mr-4">
                                                <ListMusic color="#71717a" size={24} />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-white font-bold text-lg">{item.name}</Text>
                                                <Text className="text-zinc-500">{item.songs?.length || 0} songs</Text>
                                            </View>
                                            {successId === item.id && (
                                                <Check color="#22c55e" size={24} />
                                            )}
                                        </TouchableOpacity>

                                        {inPlaylist && (
                                            <TouchableOpacity
                                                onPress={() => removeSongFromPlaylist(song?.id || "", item.id)}
                                                className="p-2 ml-4"
                                            >
                                                <X color="#ef4444" size={20} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            }}
                        />
                    </KeyboardAvoidingView>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}
