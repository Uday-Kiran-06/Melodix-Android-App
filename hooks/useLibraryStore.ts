import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import * as SQLite from 'expo-sqlite';
import { create } from "zustand";
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    activePlaylistDownloads: Record<string, { current: number; total: number }>;
    setDownloadedSongs: (songs: Song[]) => void;
    syncDownloadedSongs: () => Promise<void>;
    saveDownload: (song: Song, localUri: string) => Promise<void>;
    deleteDownload: (songId: string) => Promise<void>;
    updateDownloadProgress: (songId: string, progress: number) => void;
    updatePlaylistProgress: (playlistId: string, progress: { current: number; total: number } | null) => void;
}

export const useLibraryStore = create<LibState>()(
    persist(
        (set, get) => ({
            likedSongs: [],
            playlists: [],
            downloadedSongs: [],
            activeDownloads: {},
            activePlaylistDownloads: {},

            setDownloadedSongs: (songs: Song[]) => set({ downloadedSongs: songs }),

            updateDownloadProgress: (songId: string, progress: number) => {
                set((state: LibState) => ({
                    activeDownloads: {
                        ...state.activeDownloads,
                        [songId]: progress
                    }
                }));
                if (progress === 1) {
                    setTimeout(() => {
                        set((state: LibState) => {
                            const newDownloads = { ...state.activeDownloads };
                            delete newDownloads[songId];
                            return { activeDownloads: newDownloads };
                        });
                    }, 2000);
                }
            },

            updatePlaylistProgress: (playlistId: string, progress: { current: number; total: number } | null) => {
                set((state: LibState) => {
                    const newPlaylistDownloads = { ...state.activePlaylistDownloads };
                    if (!progress) {
                        delete newPlaylistDownloads[playlistId];
                    } else {
                        newPlaylistDownloads[playlistId] = progress;
                    }
                    return { activePlaylistDownloads: newPlaylistDownloads };
                });
            },

            saveDownload: async (song: any, localUri: string) => {
                const db = getDb();
                if (!db) {
                    console.warn("[SQLite Store]: Cannot save download, database not available");
                    return;
                }

                try {
                    // 1. Normalize Song Data (Player object has 'title'/'artist', Library needs 'name'/'artists')
                    const sanitizedImage = jioSaavnService.sanitizeImageUrl(song.image || song.artwork || song.artworkUrl || song.artwork_url);
                    const normalizedSong: Song = {
                        ...song,
                        id: song.id,
                        name: song.name || song.title || "Unknown Track",
                        duration: song.duration || 0,
                        image: sanitizedImage,
                        artists: song.artists || {
                            primary: [{ name: song.artist || "Unknown Artist", id: "", role: "", image: null, url: "" }],
                            featured: [],
                            all: []
                        },
                        downloadUrl: Array.isArray(song.downloadUrl) ? song.downloadUrl : []
                    };

                    // 2. Save to Media Library (Public Storage)
                    const { status } = await MediaLibrary.requestPermissionsAsync();
                    
                    if (status !== 'granted') {
                        console.warn("[Media Library]: Permission not granted for storage sync");
                    } else {
                        try {
                            // Ensure internal download directory exists
                            const downloadDir = `${FileSystem.documentDirectory}Melodix/Downloads/`;
                            const dirInfo = await FileSystem.getInfoAsync(downloadDir);
                            if (!dirInfo.exists) {
                                await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
                            }

                            const cleanTitle = (normalizedSong.name || 'song')
                                .replace(/[\\/:*?"<>|]/g, '_')
                                .replace(/\s+/g, '_')
                                .trim();
                            const ext = localUri.endsWith('.m4a') ? '.m4a' : '.mp3';
                            const tempCacheUri = `${FileSystem.cacheDirectory}${cleanTitle}_${normalizedSong.id}${ext}`;
                            await FileSystem.copyAsync({ from: localUri, to: tempCacheUri });
                            
                            const asset = await MediaLibrary.createAssetAsync(tempCacheUri);
                            const albumName = 'Melodix'; 
                            let album = await MediaLibrary.getAlbumAsync(albumName);
                            
                            // Note: copyAsset must be false so the asset is moved into the Melodix album without creating a duplicate file in storage
                            if (album === null) {
                                await MediaLibrary.createAlbumAsync(albumName, asset, false);
                            } else {
                                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
                            }
                            
                            await FileSystem.deleteAsync(tempCacheUri, { idempotent: true });
                        } catch (mediaError: any) {
                            console.error("[Media Library Error]:", mediaError.message);
                        }
                    }

                    // 3. Save to SQLite
                    db.runSync(
                        `INSERT OR REPLACE INTO downloads (id, name, localUri, downloadUrl) 
                         VALUES (?, ?, ?, ?)`,
                        [
                            normalizedSong.id, 
                            normalizedSong.name,
                            localUri,
                            JSON.stringify(normalizedSong)
                        ]
                    );
                    await get().syncDownloadedSongs();
                } catch (error) {
                    console.error("Save download error:", error);
                }
            },

            deleteDownload: async (songId: string) => {
                const db = getDb();
                if (!db) return;

                try {
                    // 1. Delete from internal storage
                    const song = db.getFirstSync('SELECT localUri FROM downloads WHERE id = ?', [songId]) as any;
                    if (song && song.localUri) {
                        await FileSystem.deleteAsync(song.localUri, { idempotent: true });
                    }

                    // 2. Delete from public MediaLibrary (Android Music Folder)
                    const { status } = await MediaLibrary.requestPermissionsAsync();
                    if (status === 'granted') {
                        const album = await MediaLibrary.getAlbumAsync('Melodix');
                        if (album) {
                            const { assets } = await MediaLibrary.getAssetsAsync({ album, mediaType: 'audio' });
                            // Find assets ending in the song ID or exactly matching the asset ID
                            const matchingAssets = assets.filter(a => a.filename.includes(`_${songId}.`) || a.id === songId);
                            if (matchingAssets.length > 0) {
                                await MediaLibrary.deleteAssetsAsync(matchingAssets);
                            }
                        }
                    }

                    // 3. Remove DB entry & sync
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
                    // Ensure internal directories exist
                    const melodixDir = `${FileSystem.documentDirectory}Melodix/`;
                    const downloadsDir = `${melodixDir}Downloads/`;
                    const melodixInfo = await FileSystem.getInfoAsync(melodixDir);
                    if (!melodixInfo.exists) {
                        await FileSystem.makeDirectoryAsync(melodixDir, { intermediates: true });
                    }
                    const downloadsInfo = await FileSystem.getInfoAsync(downloadsDir);
                    if (!downloadsInfo.exists) {
                        await FileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true });
                    }

                    // 1. Get songs from SQLite
                    const rows = db.getAllSync('SELECT id, downloadUrl, localUri FROM downloads ORDER BY rowid DESC') as any[];
                    const dbSongs: Song[] = [];

                    for (const r of rows) {
                        try {
                            // Verify if file still exists on disk
                            const fileInfo = await FileSystem.getInfoAsync(r.localUri);
                            if (!fileInfo.exists) {
                                console.log(`[Sync]: Local file missing, removing from DB: ${r.id}`);
                                db.runSync('DELETE FROM downloads WHERE id = ?', [r.id]);
                                continue;
                            }

                            const song = JSON.parse(r.downloadUrl);
                            const rawImage = song.image || song.artwork || song.artworkUrl || song.artwork_url || song.images;
                            dbSongs.push({
                                ...song,
                                id: song.id,
                                name: song.name || song.title || "Unknown Track",
                                image: jioSaavnService.sanitizeImageUrl(rawImage),
                                artists: song.artists || {
                                    primary: [{ name: song.artist || "Unknown Artist", id: "", role: "", image: null, url: "" }],
                                    featured: [],
                                    all: []
                                },
                                localUri: r.localUri
                            });
                        } catch (e) {
                            console.error("[Sync]: Error processing DB row", e);
                        }
                    }

                    // 2. Discover files in Music/Melodix (External Sync)
                    const { status } = await MediaLibrary.requestPermissionsAsync();
                    if (status === 'granted') {
                        const album = await MediaLibrary.getAlbumAsync('Melodix');
                        if (album) {
                            const { assets } = await MediaLibrary.getAssetsAsync({ album, mediaType: 'audio' });
                            
                            for (const asset of assets) {
                                const filename = asset.filename || '';
                                
                                // Extract potential ID from filename format: <Title>_<ID>.<ext>
                                const lastUnderscore = filename.lastIndexOf('_');
                                const lastDot = filename.lastIndexOf('.');
                                let extractedId: string | null = null;
                                if (lastUnderscore !== -1 && lastDot > lastUnderscore) {
                                    extractedId = filename.substring(lastUnderscore + 1, lastDot);
                                }
                                
                                let extractedTitle = (lastUnderscore !== -1 ? filename.substring(0, lastUnderscore) : filename.replace(/\.[^/.]+$/, ''))
                                    .replace(/_/g, ' ')
                                    .trim();

                                // Check if already present in dbSongs (either by ID, filename containing song ID, or asset uri)
                                const dbMatch = dbSongs.find(s => {
                                    if (s.id && extractedId && String(s.id) === String(extractedId)) return true;
                                    if (s.id && filename.includes(`_${s.id}.`)) return true;
                                    if (s.id && String(s.id) === String(asset.id)) return true;
                                    if (s.localUri && s.localUri === asset.uri) return true;
                                    
                                    // Normalized title comparison as fallback
                                    const normDbName = (s.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                                    const normExtracted = extractedTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
                                    return normDbName.length > 3 && normDbName === normExtracted;
                                });

                                if (dbMatch) {
                                    // Song already tracked in DB, don't create a duplicate entry
                                    if (!dbMatch.localUri) {
                                        dbMatch.localUri = asset.uri;
                                    }
                                    continue;
                                }

                                // 2. Add as new local asset if not found
                                dbSongs.push({
                                    id: extractedId || asset.id,
                                    name: extractedTitle || "Unknown Track",
                                    duration: asset.duration,
                                    image: null,
                                    artists: { primary: [{ name: "Local File" }], featured: [], all: [] },
                                    localUri: asset.uri,
                                    downloadUrl: []
                                } as any);
                            }
                        }
                    }

                    // 3. Final deduplication pass by id and localUri
                    const uniqueSongs: Song[] = [];
                    const seenIds = new Set<string>();
                    const seenUris = new Set<string>();

                    for (const song of dbSongs) {
                        const songId = song.id ? String(song.id) : null;
                        const uri = song.localUri || null;
                        if (songId && seenIds.has(songId)) continue;
                        if (uri && seenUris.has(uri)) continue;
                        if (songId) seenIds.add(songId);
                        if (uri) seenUris.add(uri);
                        uniqueSongs.push(song);
                    }

                    set({ downloadedSongs: uniqueSongs });
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

                set({
                    likedSongs: finalLikedSongs,
                    playlists: playlistsWithSongs
                });

                if (liked && liked.length > 0) {
                    try {
                        const existingIds = liked.map((item: any) => item.song_id || item.song_data?.id).filter(Boolean);
                        const CHUNK_SIZE = 50;
                        let allFreshSongs: Song[] = [];
                        
                        for (let i = 0; i < existingIds.length; i += CHUNK_SIZE) {
                            const chunk = existingIds.slice(i, i + CHUNK_SIZE);
                            const freshDetails = await jioSaavnService.getMultipleSongsDetails(chunk);
                            allFreshSongs = [...allFreshSongs, ...freshDetails];
                        }

                        if (allFreshSongs.length > 0) {
                            const freshMap = new Map(allFreshSongs.map(s => [s.id, s]));
                            const updatedLikedSongs = finalLikedSongs.map(oldSong => {
                                const freshSong = freshMap.get(oldSong.id);
                                if (freshSong) {
                                    return {
                                        ...oldSong,
                                        ...freshSong,
                                        image: freshSong.image || oldSong.image
                                    };
                                }
                                return oldSong;
                            });
                            set({ likedSongs: updatedLikedSongs });
                        }
                    } catch (error) {
                        console.error("Failed to fetch fresh liked songs metadata:", error);
                    }
                }
            },

            toggleLike: async (song: any, userId?: string) => {
                const { likedSongs } = get();
                const isCurrentlyLiked = likedSongs.some(s => String(s.id) === String(song.id));

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
                    set({ likedSongs: likedSongs.filter(s => String(s.id) !== String(song.id)) });
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

            isLiked: (songId: string) => {
                return get().likedSongs.some(s => String(s.id) === String(songId));
            },

            createPlaylist: async (name: string, userId: string) => {
                const { data, error } = await supabase
                    .from('playlists')
                    .insert({ name, user_id: userId })
                    .select()
                    .single();

                if (data) {
                    set((state: LibState) => ({ playlists: [...state.playlists, { ...data, songs: [] }] }));
                } else if (error) {
                    console.error("Create playlist error:", error);
                }
            },

            addSongToPlaylist: async (song: any, playlistId: string, userId: string) => {
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

            removeSongFromPlaylist: async (songId: string, playlistId: string) => {
                const { error } = await supabase
                    .from('song_playlist_map')
                    .delete()
                    .eq('playlist_id', playlistId)
                    .eq('song_id', songId);

                if (!error) {
                    const { playlists } = get();
                    const updatedPlaylists = playlists.map(p => {
                        if (p.id === playlistId) {
                            return { ...p, songs: (p.songs || []).filter((s: any) => String(s.song_data?.id) !== String(songId)) };
                        }
                        return p;
                    });
                    set({ playlists: updatedPlaylists });
                } else {
                    console.error("Remove from playlist error:", error);
                }
            },

            isSongInPlaylist: (songId: string, playlistId: string) => {
                const { playlists } = get();
                const playlist = playlists.find(p => p.id === playlistId);
                return playlist ? (playlist.songs || []).some((s: any) => String(s.song_data?.id) === String(songId)) : false;
            },

            deletePlaylist: async (playlistId: string) => {
                const { error } = await supabase
                    .from('playlists')
                    .delete()
                    .eq('id', playlistId);

                if (!error) {
                    set((state: LibState) => ({
                        playlists: state.playlists.filter(p => p.id !== playlistId)
                    }));
                } else {
                    console.error("Delete playlist error:", error);
                }
            },
        }),
        {
            name: 'library-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state: LibState) => ({
                likedSongs: state.likedSongs,
                playlists: state.playlists,
                downloadedSongs: state.downloadedSongs
            }),
        }
    )
);
