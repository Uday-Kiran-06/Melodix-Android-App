import { SearchResponse, Song } from "../types/music";
import { decodeHtml, sanitizeImageUrl } from "../utils/stringUtils";

const PRIMARY_BASE_URL = process.env.EXPO_PUBLIC_SAAVN_API || "https://saavn.dev/api"; // Updated to stable dev instance
const SECONDARY_BASE_URL = "https://jiosaavn-api-cyan-theta.vercel.app/api"; // Currently verified working
const INTERNATIONAL_BASE_URL = "https://jio-saavn-api.vercel.app/api"; // English/International specialist
const FALLBACK_BASE_URL = "https://saavn.revanced.dev/api"; // Extra fallback layer

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
};

const fetchWithTimeout = async (url: string, options: any = {}, timeout: number = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...DEFAULT_HEADERS,
                ...options.headers,
            },
            signal: controller.signal,
        });
        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        
        // Handle RangeError: status 0 by wrapping it in a standard Error
        if (error.message?.includes('status (0)') || error.name === 'RangeError') {
            throw new Error(`Network failure (Status 0): ${url}`);
        }
        
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out for ${url}`);
        }
        throw error;
    }
};

const safeParseJson = async (response: Response) => {
    const text = await response.text();
    if (!text || text.trim() === "") {
        throw new Error("Empty response body");
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        if (text.includes('<html>') || text.includes('DOCTYPE html')) {
            throw new Error("Provider returned HTML error page instead of JSON");
        }
        throw new Error(`Invalid JSON format: ${text.substring(0, 50)}...`);
    }
};

export const jioSaavnService = {
    checkConnectivity: async (): Promise<boolean> => {
        try {
            const response = await fetchWithTimeout("https://www.google.com", {
                method: "HEAD",
                mode: "no-cors",
            }, 3000);
            return response.ok || response.type === 'opaque';
        } catch (e) {
            return false;
        }
    },

    isInternationalQuery: (query: string): boolean => {
        // Broad check for typical International (non-regional Indian) song/artist searches
        const lowerQuery = query.toLowerCase();
        // If it contains regional markers explicitly, it's not an "international" search for routing purposes
        if (lowerQuery.includes('telugu') || lowerQuery.includes('hindi') || lowerQuery.includes('punjabi') || lowerQuery.includes('tamil')) return false;

        // Route queries that don't have Indian language markers to the International-capable API
        // If it's primarily ASCII/Latin characters, it's likely international
        return /^[\x00-\x7F\u00C0-\u00FF]*$/.test(query);
    },

    /**
     * Decodes HTML entities and performs custom cleanup for Melodix
     */
    decodeHtml: (text: string): string => {
        if (!text) return "";

        let cleaned = decodeHtml(text);

        // Remove unwanted "From" metadata blocks (case-insensitive)
        cleaned = cleaned
            .replace(/\(From.*?\)/gi, "")
            .replace(/\[From.*?\]/gi, "")
            .trim();

        // Fix unmatched or multiple trailing brackets
        const openCount = (cleaned.match(/\(/g) || []).length;
        const closeCount = (cleaned.match(/\)/g) || []).length;

        if (closeCount > openCount) {
            // Normalize multiple trailing brackets into a single one
            cleaned = cleaned.replace(/\)+$/g, (match) => {
                return match.length > 1 ? ")" : match;
            });
            
            // Re-check after normalization
            const newCloseCount = (cleaned.match(/\)/g) || []).length;
            if (newCloseCount > openCount) {
              // If still unbalanced (e.g. no opening bracket at all), remove them
              cleaned = cleaned.replace(/\)+$/g, "");
            }
        }

        return cleaned.trim();
    },

    /**
     * Sanitizes image URLs using shared utility
     */
    sanitizeImageUrl: (images: any, _quality: string = '500x500'): string | null => {
        return sanitizeImageUrl(images);
    },

    searchSongs: async (query: string, languages: string = "english,hindi,telugu", page: number = 1, limit: number = 20): Promise<Song[]> => {
        try {
            const baseUrls = [
                jioSaavnService.isInternationalQuery(query) ? INTERNATIONAL_BASE_URL : PRIMARY_BASE_URL,
                SECONDARY_BASE_URL,
                PRIMARY_BASE_URL,
                INTERNATIONAL_BASE_URL
            ];

            let lastError;
            for (const baseUrl of [...new Set(baseUrls)]) { // Unique URLs
                try {
                    const fullUrl = `${baseUrl}/search/songs?query=${encodeURIComponent(query)}&language=${languages}&page=${page}&limit=${limit}`;
                    console.log(`[API Request]: Fetching ${fullUrl}`);
                    const response = await fetchWithTimeout(fullUrl);
                    if (response.ok) {
                        const data: SearchResponse = await safeParseJson(response);
                        const results = data?.data?.results || [];
                        if (results.length > 0) {
                            const deduplicatedResults = jioSaavnService.deduplicateSongs(results);
                            return deduplicatedResults.map(song => ({
                                ...song,
                                name: jioSaavnService.decodeHtml(song.name),
                                image: song.image ? jioSaavnService.sanitizeImageUrl(song.image) : null,
                                artists: {
                                    ...song.artists,
                                    primary: (song.artists?.primary || []).map(a => ({
                                        ...a,
                                        name: jioSaavnService.decodeHtml(a.name),
                                        image: a.image ? jioSaavnService.sanitizeImageUrl(a.image) : null
                                    }))
                                }
                            }));
                        }
                    } else {
                        console.warn(`[API Response Error] Provider ${baseUrl} returned status: ${response.status}`);
                    }
                } catch (e: any) {
                    console.error(`[API Connection Failure] Provider ${baseUrl}:`, e.message);
                    lastError = e;
                }
            }
            if (lastError) console.error("Search API failed across all providers. Check your internet or provider status.");
            return [];
        } catch (error) {
            console.error("Search API failed:", error);
            return [];
        }
    },

    searchAlbums: async (query: string, languages: string = "english,hindi,telugu") => {
        try {
            const baseUrls = [
                jioSaavnService.isInternationalQuery(query) ? INTERNATIONAL_BASE_URL : PRIMARY_BASE_URL,
                SECONDARY_BASE_URL,
                PRIMARY_BASE_URL,
                INTERNATIONAL_BASE_URL
            ];

            let allResults: any[] = [];
            const uniqueUrls = [...new Set(baseUrls)];

            for (const baseUrl of uniqueUrls) {
                try {
                    const fullUrl = `${baseUrl}/search/albums?query=${encodeURIComponent(query)}&language=${languages}`;
                    const response = await fetchWithTimeout(fullUrl);
                    if (response.ok) {
                        const data = await safeParseJson(response);
                        const results = data?.data?.results || [];
                        if (results.length > 0) {
                            const formatted = results.map((album: any) => ({
                                ...album,
                                name: jioSaavnService.decodeHtml(album.name),
                                image: album.image ? jioSaavnService.sanitizeImageUrl(album.image) : null,
                                artists: {
                                    ...album.artists,
                                    primary: (album.artists?.primary || []).map((a: any) => ({
                                        ...a,
                                        name: jioSaavnService.decodeHtml(a.name),
                                        image: a.image ? jioSaavnService.sanitizeImageUrl(a.image) : null
                                    }))
                                }
                            }));
                            allResults = [...allResults, ...formatted];
                        }
                    }
                } catch (e: any) {
                    console.error(`[API Error] searchAlbums on ${baseUrl}:`, e.message);
                }
            }
            return jioSaavnService.deduplicateItems(allResults);
        } catch (error) {
            return [];
        }
    },

    searchPlaylists: async (query: string, languages: string = "english,hindi,telugu") => {
        try {
            const baseUrls = [
                jioSaavnService.isInternationalQuery(query) ? INTERNATIONAL_BASE_URL : PRIMARY_BASE_URL,
                SECONDARY_BASE_URL,
                PRIMARY_BASE_URL,
                INTERNATIONAL_BASE_URL
            ];

            let allResults: any[] = [];
            const uniqueUrls = [...new Set(baseUrls)];

            for (const baseUrl of uniqueUrls) {
                try {
                    const fullUrl = `${baseUrl}/search/playlists?query=${encodeURIComponent(query)}&language=${languages}`;
                    const response = await fetchWithTimeout(fullUrl);
                    if (response.ok) {
                        const data = await safeParseJson(response);
                        const results = data?.data?.results || [];
                        if (results.length > 0) {
                            const formatted = results.map((playlist: any) => ({
                                ...playlist,
                                name: jioSaavnService.decodeHtml(playlist.name),
                                image: playlist.image ? jioSaavnService.sanitizeImageUrl(playlist.image) : null
                            }));
                            allResults = [...allResults, ...formatted];
                        }
                    }
                } catch (e: any) {
                    console.error(`[API Error] searchPlaylists on ${baseUrl}:`, e.message);
                }
            }
            return jioSaavnService.deduplicateItems(allResults);
        } catch (error) {
            return [];
        }
    },





    deduplicateItems: (items: any[]): any[] => {
        const seen = new Set();
        return items.filter(item => {
            if (!item.id) return true;
            const duplicate = seen.has(item.id);
            seen.add(item.id);
            return !duplicate;
        });
    },

    deduplicateSongs: (songs: Song[]): Song[] => {
        const seen = new Map<string, Song>();

        songs.forEach(song => {
            const primaryArtist = song.artists?.primary?.[0]?.name || "Unknown";
            const key = `${song.name.toLowerCase().trim()}|${primaryArtist.toLowerCase().trim()}`;

            const existing = seen.get(key);
            if (!existing) {
                seen.set(key, song);
            } else {
                // Priority logic: Prefer the one WITHOUT "(From ...)" or shorter name if both have it
                // Also prefer ones with higher play count or better metadata if available
                const isExistingOriginal = !existing.name.includes('(From');
                const isCurrentOriginal = !song.name.includes('(From');

                if (isCurrentOriginal && !isExistingOriginal) {
                    seen.set(key, song);
                } else if (isCurrentOriginal === isExistingOriginal) {
                    // If both are same type, keep the one with more information (e.g., duration or year)
                    if ((song.playCount || 0) > (existing.playCount || 0)) {
                        seen.set(key, song);
                    }
                }
            }
        });

        return Array.from(seen.values());
    },

    getTrending: async (): Promise<Song[]> => {
        try {
            // Priority for Telugu/Hindi on home screen as requested
            const endpoints = [`${PRIMARY_BASE_URL}/trending?type=songs&language=telugu,hindi`, `${PRIMARY_BASE_URL}/modules?language=telugu,hindi,english`];

            for (const url of endpoints) {
                try {
                    const response = await fetchWithTimeout(url);
                    if (response.ok) {
                        const data = await safeParseJson(response);
                        // Handle different response structures
                        const songs = data?.data?.songs || data?.data?.trending?.songs || [];
                        if (songs.length > 0) {
                            return songs.map((s: any) => ({
                                ...s,
                                name: jioSaavnService.decodeHtml(s.name),
                                image: s.image ? jioSaavnService.sanitizeImageUrl(s.image) : null
                            }));
                        }
                    }
                } catch (e) { }
            }
            throw new Error("All trending endpoints failed");
        } catch (error) {
            // Silently fallback to search to keep the UI populated without polluting terminal
            try {
                const fallbackUrl = `${PRIMARY_BASE_URL}/search/songs?query=latest telugu songs 2024&limit=50`;
                const fallbackResponse = await fetchWithTimeout(fallbackUrl);
                if (!fallbackResponse.ok) return [];
                const fallbackData: SearchResponse = await fallbackResponse.json();
                return (fallbackData?.data?.results || []).map((s: any) => ({
                    ...s,
                    name: jioSaavnService.decodeHtml(s.name),
                    image: s.image ? jioSaavnService.sanitizeImageUrl(s.image) : null
                }));
            } catch (innerError) {
                return [];
            }
        }
    },

    getSongDetails: async (id: string): Promise<Song> => {
        const cacheKey = `song_${id}`;
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

        try {
            // Try English API first as it often has better metadata for international tracks
            const endpoints = [`${INTERNATIONAL_BASE_URL}/songs?ids=${id}`, `${PRIMARY_BASE_URL}/songs?ids=${id}`];

            for (const url of endpoints) {
                try {
                    const response = await fetchWithTimeout(url);
                    if (response.ok) {
                        const data: { success: boolean; data: Song[] } = await safeParseJson(response);
                        const song = data?.data?.[0];
                        if (song) {
                            const result = {
                                ...song,
                                name: jioSaavnService.decodeHtml(song.name),
                                image: song.image ? jioSaavnService.sanitizeImageUrl(song.image) : null,
                                artists: {
                                    ...song.artists,
                                    primary: song.artists?.primary?.map(a => ({
                                        ...a,
                                        name: jioSaavnService.decodeHtml(a.name),
                                        image: a.image ? jioSaavnService.sanitizeImageUrl(a.image) : null
                                    }))
                                }
                            };
                            cache.set(cacheKey, { data: result, timestamp: Date.now() });
                            return result;
                        }
                    }
                } catch (e) { }
            }
            throw new Error("Song details failed");
        } catch (error) {
            console.error("GetSongDetails failed:", error);
            throw error;
        }
    },

    getMultipleSongsDetails: async (ids: string[]): Promise<Song[]> => {
        if (!ids || ids.length === 0) return [];
        
        try {
            const idString = ids.join(',');
            // Primary and secondary endpoints
            const endpoints = [`${PRIMARY_BASE_URL}/songs?ids=${idString}`, `${INTERNATIONAL_BASE_URL}/songs?ids=${idString}`];

            for (const url of endpoints) {
                try {
                    const response = await fetchWithTimeout(url);
                    if (response.ok) {
                        const data: { success: boolean; data: Song[] } = await safeParseJson(response);
                        const songs = data?.data || [];
                        if (songs.length > 0) {
                            const results = songs.map(song => ({
                                ...song,
                                name: jioSaavnService.decodeHtml(song.name),
                                image: song.image ? jioSaavnService.sanitizeImageUrl(song.image) : null,
                                artists: {
                                    ...song.artists,
                                    primary: song.artists?.primary?.map(a => ({
                                        ...a,
                                        name: jioSaavnService.decodeHtml(a.name),
                                        image: a.image ? jioSaavnService.sanitizeImageUrl(a.image) : null
                                    }))
                                }
                            }));
                            results.forEach(song => {
                                cache.set(`song_${song.id}`, { data: song, timestamp: Date.now() });
                            });
                            return results;
                        }
                    }
                } catch (e) { }
            }
            return [];
        } catch (error) {
            console.error("GetMultipleSongsDetails failed:", error);
            return [];
        }
    },

    getAlbumDetails: async (id: string) => {
        const cacheKey = `album_${id}`;
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

        try {
            const endpoints = [`${PRIMARY_BASE_URL}/albums?id=${id}`, `${INTERNATIONAL_BASE_URL}/albums?id=${id}`];
            for (const url of endpoints) {
                try {
                    const response = await fetchWithTimeout(url);
                    if (response.ok) {
                        const data = await safeParseJson(response);
                        if (data?.data) {
                            const album = {
                                ...data.data,
                                name: jioSaavnService.decodeHtml(data.data.name),
                                image: data.data.image ? jioSaavnService.sanitizeImageUrl(data.data.image) : null,
                                songs: (data.data.songs || []).map((s: any) => ({
                                    ...s,
                                    name: jioSaavnService.decodeHtml(s.name),
                                    image: s.image ? jioSaavnService.sanitizeImageUrl(s.image) : null
                                }))
                            };
                            cache.set(cacheKey, { data: album, timestamp: Date.now() });
                            return album;
                        }
                    }
                } catch (e) { }
            }
            return null;
        } catch (error) {
            console.error("GetAlbumDetails failed:", error);
            return null;
        }
    },

    getPlaylistDetails: async (id: string) => {
        const cacheKey = `playlist_${id}`;
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

        try {
            const endpoints = [`${PRIMARY_BASE_URL}/playlists?id=${id}`, `${INTERNATIONAL_BASE_URL}/playlists?id=${id}`];
            for (const url of endpoints) {
                try {
                    const response = await fetchWithTimeout(url);
                    if (response.ok) {
                        const data = await safeParseJson(response);
                        if (data?.data) {
                            const playlist = {
                                ...data.data,
                                name: jioSaavnService.decodeHtml(data.data.name),
                                image: data.data.image ? jioSaavnService.sanitizeImageUrl(data.data.image) : null,
                                songs: (data.data.songs || []).map((s: any) => ({
                                    ...s,
                                    name: jioSaavnService.decodeHtml(s.name),
                                    image: s.image ? jioSaavnService.sanitizeImageUrl(s.image) : null
                                }))
                            };
                            cache.set(cacheKey, { data: playlist, timestamp: Date.now() });
                            return playlist;
                        }
                    }
                } catch (e) { }
            }
            return null;
        } catch (error) {
            console.error("GetPlaylistDetails failed:", error);
            return null;
        }
    },

    getArtistSongs: async (artistId: string): Promise<Song[]> => {
        try {
            // Try English API for possibly better artist catalog
            const endpoints = [`${INTERNATIONAL_BASE_URL}/artists?id=${artistId}`, `${PRIMARY_BASE_URL}/artists?id=${artistId}`];
            for (const url of endpoints) {
                try {
                    const response = await fetchWithTimeout(url);
                    if (response.ok) {
                        const data = await safeParseJson(response);
                        const songs = data?.data?.topSongs || [];
                        if (songs.length > 0) {
                            return songs.map((song: Song) => ({
                                ...song,
                                name: jioSaavnService.decodeHtml(song.name),
                                image: song.image ? jioSaavnService.sanitizeImageUrl(song.image) : null
                            }));
                        }
                    }
                } catch (e) { }
            }
            return [];
        } catch (e) {
            return [];
        }
    },

    getRecommendations: async (songId: string): Promise<Song[]> => {
        try {
            const baseUrls = [INTERNATIONAL_BASE_URL, PRIMARY_BASE_URL];
            for (const baseUrl of baseUrls) {
                try {
                    const suggestionResponse = await fetchWithTimeout(`${baseUrl}/songs/${songId}/suggestions`);
                    if (suggestionResponse.ok) {
                        const data = await suggestionResponse.json();
                        if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
                            return data.data.map((s: Song) => ({
                                ...s,
                                name: jioSaavnService.decodeHtml(s.name),
                                image: s.image ? jioSaavnService.sanitizeImageUrl(s.image) : null
                            }));
                        }
                    }

                    const recommendationResponse = await fetchWithTimeout(`${baseUrl}/songs/${songId}/recommendations`);
                    if (recommendationResponse.ok) {
                        const data = await recommendationResponse.json();
                        if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
                            return data.data.map((s: Song) => ({
                                ...s,
                                name: jioSaavnService.decodeHtml(s.name),
                                image: s.image ? jioSaavnService.sanitizeImageUrl(s.image) : null
                            }));
                        }
                    }
                } catch (e) { }
            }

            // Fallback: If both fail, create a "Vibe" manually using Album, Artist, or Name
            try {
                const details = await jioSaavnService.getSongDetails(songId);
                if (!details) return [];

                const albumId = details.album?.id;
                const artistName = details.artists?.primary?.[0]?.name;
                const songName = details.name;

                let fallbackSongs: Song[] = [];

                // 1. Try Album
                if (albumId) {
                    try {
                        const albumData = await jioSaavnService.getAlbumDetails(albumId);
                        if (albumData?.songs) fallbackSongs = [...fallbackSongs, ...albumData.songs];
                    } catch (e) { }
                }

                // 2. Try Artist Top Hits
                if (fallbackSongs.length < 5 && artistName) {
                    try {
                        const artistSongs = await jioSaavnService.searchSongs(`${artistName} top hits`);
                        fallbackSongs = [...fallbackSongs, ...artistSongs];
                    } catch (e) { }
                }

                // 3. Final Fallback: Search by Name (handles 500 errors on specific songs)
                if (fallbackSongs.length < 5 && songName) {
                    try {
                        const searchSongs = await jioSaavnService.searchSongs(songName);
                        fallbackSongs = [...fallbackSongs, ...searchSongs];
                    } catch (e) { }
                }

                return fallbackSongs
                    .filter(s => s.id !== songId)
                    .map(s => ({
                        ...s,
                        name: jioSaavnService.decodeHtml(s.name),
                        image: s.image ? jioSaavnService.sanitizeImageUrl(s.image) : null
                    }))
                    .slice(0, 15);
            } catch (fallbackError) {
                return [];
            }
        } catch (error) {
            console.error("Vibe matching failed:", error);
            return [];
        }
    },

    /**
     * Fetches recommendations from multiple seed song IDs in parallel,
     * merges, deduplicates, and returns a shuffled pool.
     * Much more diverse than single-song seeding.
     */
    getMultiSeedRecommendations: async (songIds: string[]): Promise<Song[]> => {
        if (!songIds || songIds.length === 0) return [];

        try {
            // Fan out parallel recommendation calls for each seed
            const results = await Promise.allSettled(
                songIds.map(id => jioSaavnService.getRecommendations(id))
            );

            // Merge all fulfilled results
            const merged: Song[] = [];
            const seedSet = new Set(songIds);

            for (const result of results) {
                if (result.status === 'fulfilled' && result.value.length > 0) {
                    for (const song of result.value) {
                        if (!seedSet.has(String(song.id))) {
                            merged.push(song);
                        }
                    }
                }
            }

            // Deduplicate by ID
            const seen = new Set<string>();
            const deduped = merged.filter(s => {
                const id = String(s.id);
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            });

            // Fisher-Yates shuffle for diversity
            for (let i = deduped.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [deduped[i], deduped[j]] = [deduped[j], deduped[i]];
            }

            return deduped;
        } catch (error) {
            console.error('[jioSaavnService]: getMultiSeedRecommendations failed:', error);
            return [];
        }
    },

    getModules: async (languages: string = "telugu,hindi,english") => {
        try {
            const response = await fetchWithTimeout(`${PRIMARY_BASE_URL}/modules?language=${languages}`);
            if (!response.ok) return null;
            const data = await safeParseJson(response);
            return data?.data;
        } catch (e) {
            return null;
        }
    },

    getLyrics: async (songId: string): Promise<string | null> => {
        try {
            // Using JioSaavn's internal internal API for lyrics
            // Note: songId should be the numerical ID from the API response
            const url = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&ctx=web6dot0&_format=json&_marker=0&song_id=${songId}`;
            const response = await fetchWithTimeout(url);
            if (response.ok) {
                const data = await response.json();
                return data.lyrics || null;
            }
            return null;
        } catch (e) {
            console.error("[jioSaavnService]: getLyrics failed", e);
            return null;
        }
    },

    checkConnectivity: async () => {
        try {
            const response = await fetchWithTimeout("https://www.google.com", { method: 'HEAD' }, 3000);
            return response.ok;
        } catch (e) {
            return false;
        }
    },
};
