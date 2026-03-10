import * as Haptics from 'expo-haptics';
import { create } from "zustand";
import { jioSaavnService } from "../services/jiosaavn";
import { supabase } from "../services/supabase";
import { Song } from "../types/music";

interface LibState {
    likedSongs: Song[];
    playlists: any[];
    fetchLibrary: (userId: string) => Promise<void>;
    toggleLike: (song: Song, userId?: string) => Promise<void>;
    isLiked: (songId: string) => boolean;
    createPlaylist: (name: string, userId: string) => Promise<void>;
    addSongToPlaylist: (song: Song, playlistId: string, userId: string) => Promise<void>;
    removeSongFromPlaylist: (songId: string, playlistId: string) => Promise<void>;
    isSongInPlaylist: (songId: string, playlistId: string) => boolean;
    deletePlaylist: (playlistId: string) => Promise<void>;
    downloadedSongs: Song[];
    setDownloadedSongs: (songs: Song[]) => void;
    syncDownloadedSongs: () => Promise<void>;
}

export const useLibraryStore = create<LibState>((set, get) => ({
    likedSongs: [],
    playlists: [],
    downloadedSongs: [],

    setDownloadedSongs: (songs) => set({ downloadedSongs: songs }),

    syncDownloadedSongs: async () => {
        try {
            const FileSystem = require('expo-file-system');
            if (!FileSystem || !FileSystem.documentDirectory) return;

            const downloadDir = `${FileSystem.documentDirectory}Melodix/Downloads/`;
            const dirInfo = await FileSystem.getInfoAsync(downloadDir);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
                return;
            }

            const files = await FileSystem.readDirectoryAsync(downloadDir);
            const metadataFile = `${FileSystem.documentDirectory}Melodix/downloads_metadata.json`;
            const metadataInfo = await FileSystem.getInfoAsync(metadataFile);

            if (metadataInfo.exists) {
                const content = await FileSystem.readAsStringAsync(metadataFile);
                if (!content) return;
                const metadata = JSON.parse(content);
                // Filter metadata to only include files that actually exist
                const validDownloads = Array.isArray(metadata) ? metadata.filter((s: Song) => {
                    const filename = `${(s.name || '').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
                    return files.includes(filename);
                }) : [];
                set({ downloadedSongs: validDownloads });
            }
        } catch (error) {
            console.error("Sync downloads error:", error);
        }
    },

    fetchLibrary: async (userId: string) => {
        const { data: liked } = await supabase
            .from('liked_songs')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        const { data: playlists } = await supabase.from('playlists').select('*').eq('user_id', userId);

        const playlistsWithSongs = await Promise.all((playlists || []).map(async (p) => {
            const { data: mapping } = await supabase
                .from('song_playlist_map')
                .select('song_data')
                .eq('playlist_id', p.id);
            return { ...p, songs: mapping || [] };
        }));

        set({
            likedSongs: liked ? liked.map(item => item.song_data) : [],
            playlists: playlistsWithSongs
        });
    },

    toggleLike: async (song: any, userId?: string) => {
        const { likedSongs } = get();
        const isCurrentlyLiked = likedSongs.some(s => s.id === song.id);

        const normalizedSong: Song = {
            ...song,
            name: song.name || song.title || "Unknown Track",
            artists: song.artists || {
                primary: [{ name: song.artist || "Unknown Artist" }],
                featured: [],
                all: []
            },
            image: jioSaavnService.sanitizeImageUrl(song.image || song.artwork)
        };

        try { await Haptics.selectionAsync(); } catch (e) { }

        if (isCurrentlyLiked) {
            set({ likedSongs: likedSongs.filter(s => s.id !== song.id) });
            await supabase.from('liked_songs').delete().eq('song_id', song.id).eq('user_id', userId);
        } else {
            set({ likedSongs: [normalizedSong, ...likedSongs] });
            await supabase.from('liked_songs').insert({
                song_id: song.id,
                song_data: normalizedSong,
                user_id: userId
            });
        }
    },

    isLiked: (songId) => {
        return get().likedSongs.some(s => s.id === songId);
    },

    createPlaylist: async (name: string, userId: string) => {
        const { data, error } = await supabase
            .from('playlists')
            .insert({ name, user_id: userId })
            .select()
            .single();

        if (data) {
            set(state => ({ playlists: [...state.playlists, { ...data, songs: [] }] }));
        } else if (error) {
            console.error("Create playlist error:", error);
        }
    },

    addSongToPlaylist: async (song: any, playlistId, userId) => {
        const normalizedSong: Song = {
            ...song,
            name: song.name || song.title || "Unknown Track",
            artists: song.artists || {
                primary: [{ name: song.artist || "Unknown Artist" }],
                featured: [],
                all: []
            },
            image: jioSaavnService.sanitizeImageUrl(song.image || song.artwork)
        };

        const { error } = await supabase
            .from('song_playlist_map')
            .insert({
                playlist_id: playlistId,
                song_id: song.id,
                song_data: normalizedSong
            });

        if (!error) {
            const { playlists } = get();
            const updatedPlaylists = playlists.map(p => {
                if (p.id === playlistId) {
                    return { ...p, songs: [...(p.songs || []), { song_data: normalizedSong }] };
                }
                return p;
            });
            set({ playlists: updatedPlaylists });
        } else {
            console.error("Add to playlist error:", error);
        }
    },

    removeSongFromPlaylist: async (songId, playlistId) => {
        const { error } = await supabase
            .from('song_playlist_map')
            .delete()
            .eq('playlist_id', playlistId)
            .eq('song_id', songId);

        if (!error) {
            const { playlists } = get();
            const updatedPlaylists = playlists.map(p => {
                if (p.id === playlistId) {
                    return { ...p, songs: (p.songs || []).filter((s: any) => s.song_data?.id !== songId) };
                }
                return p;
            });
            set({ playlists: updatedPlaylists });
        } else {
            console.error("Remove from playlist error:", error);
        }
    },

    isSongInPlaylist: (songId, playlistId) => {
        const { playlists } = get();
        const playlist = playlists.find(p => p.id === playlistId);
        return playlist ? (playlist.songs || []).some((s: any) => s.song_data?.id === songId) : false;
    },

    deletePlaylist: async (playlistId: string) => {
        const { error } = await supabase
            .from('playlists')
            .delete()
            .eq('id', playlistId);

        if (!error) {
            set(state => ({
                playlists: state.playlists.filter(p => p.id !== playlistId)
            }));
        } else {
            console.error("Delete playlist error:", error);
        }
    },
}));
