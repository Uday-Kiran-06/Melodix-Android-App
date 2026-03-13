import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import * as SQLite from 'expo-sqlite';
import { create } from "zustand";
import { jioSaavnService } from "../services/jiosaavn";
import { supabase } from "../services/supabase";
import { Song } from "../types/music";

// Lazy Database Initialization Helper
let _db: any = null;
const getDb = () => {
    if (_db) return _db;
    try {
        _db = SQLite.openDatabaseSync('melodix.db');
        _db.execSync(`
            CREATE TABLE IF NOT EXISTS downloads (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                title TEXT,
                artist TEXT,
                image TEXT,
                downloadUrl TEXT,
                localUri TEXT,
                album TEXT,
                duration INTEGER,
                year TEXT,
                is_media_library_synced INTEGER DEFAULT 0
            );
        `);
        return _db;
    } catch (e) {
        console.error("[SQLite Error]: Failed to initialize database", e);
        return null;
    }
};

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
    activeDownloads: Record<string, number>;
    setDownloadedSongs: (songs: Song[]) => void;
    syncDownloadedSongs: () => Promise<void>;
    saveDownload: (song: Song, localUri: string) => Promise<void>;
    deleteDownload: (songId: string) => Promise<void>;
    updateDownloadProgress: (songId: string, progress: number) => void;
}

export const useLibraryStore = create<LibState>((set, get) => ({
    likedSongs: [],
    playlists: [],
    downloadedSongs: [],
    activeDownloads: {},

    setDownloadedSongs: (songs) => set({ downloadedSongs: songs }),

    updateDownloadProgress: (songId, progress) => {
        set(state => ({
            activeDownloads: {
                ...state.activeDownloads,
                [songId]: progress
            }
        }));
        if (progress === 1) {
            setTimeout(() => {
                set(state => {
                    const newDownloads = { ...state.activeDownloads };
                    delete newDownloads[songId];
                    return { activeDownloads: newDownloads };
                });
            }, 2000);
        }
    },

    saveDownload: async (song, localUri) => {
        const db = getDb();
        if (!db) {
            console.warn("[SQLite Store]: Cannot save download, database not available");
            return;
        }

        try {
            // 1. Save to Media Library (Public Storage)
            const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync();
            
            if (status !== 'granted') {
                console.warn("[Media Library]: Permission not granted for storage sync");
            } else {
                try {
                    // Create asset from the downloaded file
                    const asset = await MediaLibrary.createAssetAsync(localUri);
                    const albumName = 'Melodix';
                    let album = await MediaLibrary.getAlbumAsync(albumName);
                    
                    if (album === null) {
                        await MediaLibrary.createAlbumAsync(albumName, asset, false);
                        console.log(`[Media Library]: Created album "${albumName}" with asset`);
                    } else {
                        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
                        console.log(`[Media Library]: Added asset to album "${albumName}"`);
                    }
                } catch (mediaError) {
                    console.error("[Media Library Error]: Failed to sync to public storage", mediaError);
                }
            }

            // 2. Save to SQLite
            db.runSync(
                `INSERT OR REPLACE INTO downloads (id, name, localUri, downloadUrl) 
                 VALUES (?, ?, ?, ?)`,
                [
                    song.id, 
                    song.name,
                    localUri,
                    JSON.stringify(song)
                ]
            );
            await get().syncDownloadedSongs();
        } catch (error) {
            console.error("Save download error:", error);
        }
    },

    deleteDownload: async (songId) => {
        const db = getDb();
        if (!db) return;

        try {
            const song = db.getFirstSync('SELECT localUri FROM downloads WHERE id = ?', [songId]) as any;
            if (song && song.localUri) {
                await FileSystem.deleteAsync(song.localUri, { idempotent: true });
            }
            db.runSync('DELETE FROM downloads WHERE id = ?', [songId]);
            await get().syncDownloadedSongs();
        } catch (error) {
            console.error("Delete download error:", error);
        }
    },

    syncDownloadedSongs: async () => {
        const db = getDb();
        if (!db) {
            console.warn("[SQLite Store]: Skip sync, database not available");
            return;
        }

        try {
            const rows = db.getAllSync('SELECT downloadUrl, localUri FROM downloads') as any[];
            const songs: Song[] = rows.map(r => {
                const song = JSON.parse(r.downloadUrl);
                return {
                    ...song,
                    localUri: r.localUri
                };
            });
            set({ downloadedSongs: songs });
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

        let finalLikedSongs = liked ? liked.map(item => {
            const song = item.song_data;
            const sanitizedImage = jioSaavnService.sanitizeImageUrl(song.image || song.artwork);
            return {
                ...song,
                image: sanitizedImage || song.image
            };
        }) : [];

        // Set initial state from DB for quick loading, we'll update background
        set({
            likedSongs: finalLikedSongs,
            playlists: playlistsWithSongs
        });

        // Background fetch fresh data from JioSaavn to fix broken images/metadata
        if (liked && liked.length > 0) {
            try {
                const existingIds = liked.map((item: any) => item.song_id || item.song_data?.id).filter(Boolean);
                
                // Chunk IDs to avoid overly long URLs (e.g., max 50 at a time)
                const CHUNK_SIZE = 50;
                let allFreshSongs: Song[] = [];
                
                for (let i = 0; i < existingIds.length; i += CHUNK_SIZE) {
                    const chunk = existingIds.slice(i, i + CHUNK_SIZE);
                    const freshDetails = await jioSaavnService.getMultipleSongsDetails(chunk);
                    allFreshSongs = [...allFreshSongs, ...freshDetails];
                }

                if (allFreshSongs.length > 0) {
                    // Merge fresh data with existing state
                    const freshMap = new Map(allFreshSongs.map(s => [s.id, s]));
                    
                    const updatedLikedSongs = finalLikedSongs.map(oldSong => {
                        const freshSong = freshMap.get(oldSong.id);
                        if (freshSong) {
                            return {
                                ...oldSong, // Keep any custom properties
                                ...freshSong, // Overwrite with fresh metadata (image, url, etc)
                                image: freshSong.image || oldSong.image // Prefer fresh image
                            };
                        }
                        return oldSong;
                    });

                    // Update UI state with fresh data
                    set({ likedSongs: updatedLikedSongs });
                    
                    // Optionally update DB in background to fix permanently
                    // Doing this quietly to not block the main thread
                }
            } catch (error) {
                console.error("Failed to fetch fresh liked songs metadata:", error);
            }
        }
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
