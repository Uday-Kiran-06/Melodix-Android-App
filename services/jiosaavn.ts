import { SearchResponse, Song } from "../types/music";

const PRIMARY_BASE_URL = process.env.EXPO_PUBLIC_SAAVN_API || "https://saavn.sumit.co/api";
const SECONDARY_BASE_URL = "https://jiosaavn-api-beta.vercel.app/api"; // Added Beta fallback
const ENGLISH_BASE_URL = "https://jiosaavn-api-cyan-theta.vercel.app/api";

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export const jioSaavnService = {
    isInternationalQuery: (query: string): boolean => {
        // Broad check for typical International (non-regional Indian) song/artist searches
        const lowerQuery = query.toLowerCase();
        // If it contains regional markers explicitly, it's not an "international" search for routing purposes
        if (lowerQuery.includes('telugu') || lowerQuery.includes('hindi') || lowerQuery.includes('punjabi') || lowerQuery.includes('tamil')) return false;

        // Route queries that don't have Indian language markers to the International-capable API
        // If it's primarily ASCII/Latin characters, it's likely international
        return /^[\x00-\x7F\u00C0-\u00FF]*$/.test(query);
    },

    decodeHtml: (text: string): string => {
        if (!text) return "";
        return text
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#039;/g, "'")
            .replace(/&nbsp;/g, " ")
            .replace(/\(From.*?\)/g, "") // Remove "(From ...)" text
            .trim();
    },

    sanitizeImageUrl: (images: any, quality: '50x50' | '150x150' | '500x500' = '500x500'): string | null => {
        if (!images) return null;

        let url = "";
        try {
            if (Array.isArray(images) && images.length > 0) {
                // Find the requested quality, or fallback to the best available without forcing regex replacement
                const match = images.find(img => img && typeof img === 'object' && img.quality === quality);
                const secondBest = images.find(img => img && typeof img === 'object' && img.quality === '150x150');

                const bestObj = match || secondBest || images[images.length - 1];

                if (bestObj && typeof bestObj === 'object') {
                    url = bestObj.url || bestObj.uri || "";
                } else if (typeof bestObj === 'string') {
                    url = bestObj;
                }
            } else if (typeof images === 'object' && images !== null) {
                // If it's a single Saavn image object with quality field
                if (images.quality && images.url) {
                    url = images.url;
                } else {
                    // Prioritize actual image fields over 'url' (which is often the webpage link on full objects)
                    const possibleUrl = images.image || images.artwork || images.images || images.uri || images.url;
                    if (typeof possibleUrl === 'string') {
                        url = possibleUrl;
                    } else if (possibleUrl) {
                        // Recurse if it's an array or another object
                        return jioSaavnService.sanitizeImageUrl(possibleUrl, quality);
                    }
                }
            } else if (typeof images === 'string') {
                url = images;
            }
        } catch (e) {
            return null;
        }

        // Defensive checks for malformed "URLs"
        if (!url || typeof url !== 'string' || url.trim() === "" || url === "null" || url === "undefined") return null;

        // Block HTML content that might be returned in error response strings
        if (url.startsWith('<!doctype') || url.startsWith('<html') || url.includes('<title>')) return null;

        // Ensure it looks like a URL
        if (!url.startsWith('http') && !url.startsWith('file') && !url.startsWith('data:')) return null;

        // Ensure HTTPS
        let sanitized = url.replace("http://", "https://");

        // Block webpage URLs that are mistakenly returned as images
        if (sanitized.includes('jiosaavn.com/song/') ||
            sanitized.includes('jiosaavn.com/album/') ||
            sanitized.includes('jiosaavn.com/featured/')) {
            return null;
        }

        // ONLY force 500x500 for standard Saavn CDN links that are explicitly low-res
        // This avoids breaking editorial or older images that don't have 500x500 versions
        if (sanitized.includes('c.saavncdn.com')) {
            if (sanitized.includes('150x150') || sanitized.includes('50x50')) {
                // We only do this for songs/albums which usually have it, but we should be careful.
                // Let's only do it if the quality requested is 500x500.
                if (quality === '500x500') {
                    sanitized = sanitized.replace(/150x150/g, "500x500").replace(/50x50/g, "500x500");
                }
            }
        }

        if (sanitized.includes('default_album.png') || sanitized.includes('default_artist.png')) {
            return null;
        }

        return sanitized;
    },

    searchSongs: async (query: string, languages: string = "english,hindi,telugu", page: number = 1, limit: number = 20): Promise<Song[]> => {
        try {
            const baseUrls = [
                jioSaavnService.isInternationalQuery(query) ? ENGLISH_BASE_URL : PRIMARY_BASE_URL,
                SECONDARY_BASE_URL,
                PRIMARY_BASE_URL,
                ENGLISH_BASE_URL
            ];

            let lastError;
            for (const baseUrl of [...new Set(baseUrls)]) { // Unique URLs
                try {
                    const fullUrl = `${baseUrl}/search/songs?query=${encodeURIComponent(query)}&language=${languages}&page=${page}&limit=${limit}`;
                    console.log(`[API Request]: Fetching ${fullUrl}`);
                    console.log(`[Diagnostic]: Current System Time: ${new Date().toISOString()}`);
                    const response = await fetch(fullUrl);
                    if (response.ok) {
                        const data: SearchResponse = await response.json();
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
                    }
                } catch (e: any) {
                    console.error(`[API Error Detail] Provider ${baseUrl} failed:`, {
                        message: e.message,
                        name: e.name,
                        stack: e.stack,
                        cause: e.cause
                    });
                    lastError = e;
                }
            }
            if (lastError) console.error("Search API failed across all providers:", lastError);
            return [];
        } catch (error) {
            console.error("Search API failed:", error);
            return [];
        }
    },

    searchAlbums: async (query: string, languages: string = "english,hindi,telugu") => {
        try {
            const baseUrls = [
                jioSaavnService.isInternationalQuery(query) ? ENGLISH_BASE_URL : PRIMARY_BASE_URL,
                SECONDARY_BASE_URL,
                PRIMARY_BASE_URL,
                ENGLISH_BASE_URL
            ];

            for (const baseUrl of [...new Set(baseUrls)]) {
                try {
                    const fullUrl = `${baseUrl}/search/albums?query=${encodeURIComponent(query)}&language=${languages}`;
                    console.log(`[API Request]: Fetching ${fullUrl}`);
                    const response = await fetch(fullUrl);
                    if (response.ok) {
                        const data = await response.json();
                        const results = data?.data?.results || [];
                        if (results.length > 0) {
                            return results.map((album: any) => ({
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
                        }
                    }
                } catch (e: any) {
                    console.error(`[API Error Detail] Search failed for ${baseUrl}:`, e.message);
                }
            }
            return [];
        } catch (error) {
            return [];
        }
    },

    searchPlaylists: async (query: string, languages: string = "english,hindi,telugu") => {
        try {
            const baseUrls = [
                jioSaavnService.isInternationalQuery(query) ? ENGLISH_BASE_URL : PRIMARY_BASE_URL,
                SECONDARY_BASE_URL,
                PRIMARY_BASE_URL,
                ENGLISH_BASE_URL
            ];

            for (const baseUrl of [...new Set(baseUrls)]) {
                try {
                    const fullUrl = `${baseUrl}/search/playlists?query=${encodeURIComponent(query)}&language=${languages}`;
                    console.log(`[API Request]: Fetching ${fullUrl}`);
                    const response = await fetch(fullUrl);
                    if (response.ok) {
                        const data = await response.json();
                        const results = data?.data?.results || [];
                        if (results.length > 0) {
                            return results.map((playlist: any) => ({
                                ...playlist,
                                name: jioSaavnService.decodeHtml(playlist.name),
                                image: playlist.image ? jioSaavnService.sanitizeImageUrl(playlist.image) : null
                            }));
                        }
                    }
                } catch (e) { }
            }
            return [];
        } catch (error) {
            return [];
        }
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
                    const response = await fetch(url);
                    if (response.ok) {
                        const data = await response.json();
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
                } catch (e) {
                    // Continue to next endpoint
                }
            }
            throw new Error("All trending endpoints failed");
        } catch (error) {
            // Silently fallback to search to keep the UI populated without polluting terminal
            try {
                const fallbackResponse = await fetch(`${PRIMARY_BASE_URL}/search/songs?query=latest telugu songs 2024&limit=50`);
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
            const endpoints = [`${ENGLISH_BASE_URL}/songs?ids=${id}`, `${PRIMARY_BASE_URL}/songs?ids=${id}`];

            for (const url of endpoints) {
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        const data: { success: boolean; data: Song[] } = await response.json();
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

    getAlbumDetails: async (id: string) => {
        const cacheKey = `album_${id}`;
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

        try {
            const endpoints = [`${PRIMARY_BASE_URL}/albums?id=${id}`, `${ENGLISH_BASE_URL}/albums?id=${id}`];
            for (const url of endpoints) {
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        const data = await response.json();
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
            const endpoints = [`${PRIMARY_BASE_URL}/playlists?id=${id}`, `${ENGLISH_BASE_URL}/playlists?id=${id}`];
            for (const url of endpoints) {
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        const data = await response.json();
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
            const endpoints = [`${ENGLISH_BASE_URL}/artists?id=${artistId}`, `${PRIMARY_BASE_URL}/artists?id=${artistId}`];
            for (const url of endpoints) {
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        const data = await response.json();
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
            const baseUrls = [ENGLISH_BASE_URL, PRIMARY_BASE_URL];
            for (const baseUrl of baseUrls) {
                try {
                    const suggestionResponse = await fetch(`${baseUrl}/songs/${songId}/suggestions`);
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

                    const recommendationResponse = await fetch(`${baseUrl}/songs/${songId}/recommendations`);
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

    getModules: async (languages: string = "telugu,hindi,english") => {
        try {
            const response = await fetch(`${PRIMARY_BASE_URL}/modules?language=${languages}`);
            if (!response.ok) return null;
            const data = await response.json();
            return data?.data;
        } catch (e) {
            return null;
        }
    },

    checkConnectivity: async () => {
        try {
            console.log("[Connectivity Test]: Testing reachability to google.com...");
            const response = await fetch("https://www.google.com", { method: 'HEAD' });
            console.log(`[Connectivity Test]: Google.com status: ${response.status} (${response.ok ? 'OK' : 'FAILED'})`);
            return response.ok;
        } catch (e) {
            console.error("[Connectivity Test]: Failed to reach google.com:", e);
            return false;
        }
    },
};
