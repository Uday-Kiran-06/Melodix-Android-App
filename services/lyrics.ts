import { Track } from "react-native-track-player";

export interface LrcLine {
    time: number; // in seconds
    text: string;
}

export const lyricsService = {
    /**
     * Fetches synced lyrics from LrcLib.net
     */
    /**
     * Fetches synced lyrics from LrcLib.net with intelligent regional matching
     */
    getSyncedLyrics: async (track: Track, context?: { album?: string; language?: string }): Promise<{ synced: LrcLine[] | null; plain: string | null }> => {
        try {
            const title = track.title || "";
            const artist = track.artist || "";
            const duration = track.duration ? Math.round(track.duration) : 0;
            const targetLang = context?.language?.toLowerCase();
            const targetAlbum = context?.album?.toLowerCase();

            // Known regional language markers used by LrcLib in album/track names
            const otherLangs = ['tamil', 'malayalam', 'telugu', 'hindi', 'kannada', 'marathi', 'bengali'].filter(
                l => l !== targetLang
            );

            const detectsOtherLang = (text: string) =>
                otherLangs.some(l => text.toLowerCase().includes(l));

            // Strict album similarity check
            const albumMatches = (foundAlbum: string): boolean => {
                if (!targetAlbum || !foundAlbum) return true; // No context to compare
                const f = foundAlbum.toLowerCase();
                // Reject if the found album mentions a different regional language
                if (targetLang && detectsOtherLang(f)) return false;
                // Accept if there's meaningful overlap
                const longEnough = targetAlbum.length >= 4 && foundAlbum.length >= 4;
                const overlap = f.includes(targetAlbum) || targetAlbum.includes(f);
                return !longEnough || overlap;
            };

            // Step 1: Try the exact deterministic 'get' API first
            const getUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}${duration ? `&duration=${duration}` : ''}`;
            const getResponse = await fetch(getUrl, {
                headers: { 'User-Agent': 'Melodix Music App' }
            });

            if (getResponse.ok) {
                const data = await getResponse.json();
                const foundAlbum = (data.albumName || "").toLowerCase();
                const foundTrack = (data.trackName || "").toLowerCase();

                const noLanguageConflict = !targetLang ||
                    (!detectsOtherLang(foundAlbum) && !detectsOtherLang(foundTrack));
                const isGoodAlbumMatch = albumMatches(data.albumName || "");

                if (data.syncedLyrics && noLanguageConflict && isGoodAlbumMatch) {
                    return { synced: lyricsService.parseLrc(data.syncedLyrics), plain: data.plainLyrics || null };
                }
            }

            // Step 2: Search API with filtering and ranking
            console.log(`[lyricsService]: 'get' mismatched/failed, searching for: ${title}`);
            const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
            const searchResponse = await fetch(searchUrl);

            if (searchResponse.ok) {
                const results = await searchResponse.json();
                if (Array.isArray(results) && results.length > 0) {
                    const bestMatch = results
                        .filter(r => {
                            // 1. Duration filter
                            if (duration > 0 && Math.abs(r.duration - duration) > 4) return false;

                            // 2. Language conflict check (title AND album)
                            if (targetLang) {
                                const rTrack = (r.trackName || "").toLowerCase();
                                const rAlbum = (r.albumName || "").toLowerCase();
                                if (detectsOtherLang(rTrack) || detectsOtherLang(rAlbum)) return false;
                            }
                            return true;
                        })
                        .sort((a, b) => {
                            // Priority 1: Album name match
                            const aAlbumMatch = albumMatches(a.albumName || "");
                            const bAlbumMatch = albumMatches(b.albumName || "");
                            if (aAlbumMatch && !bAlbumMatch) return -1;
                            if (!aAlbumMatch && bAlbumMatch) return 1;

                            // Priority 2: Closest duration
                            return Math.abs(a.duration - duration) - Math.abs(b.duration - duration);
                        })[0];

                    if (bestMatch?.syncedLyrics) {
                        return { synced: lyricsService.parseLrc(bestMatch.syncedLyrics), plain: bestMatch.plainLyrics || null };
                    } else if (bestMatch?.plainLyrics) {
                        return { synced: null, plain: bestMatch.plainLyrics };
                    }
                }
            }

            return { synced: null, plain: null };
        } catch (error) {
            console.error("[lyricsService]: getSyncedLyrics failed", error);
            return { synced: null, plain: null };
        }
    },

    /**
     * Parses LRC string into LrcLine array
     * Format: [mm:ss.xx] or [mm:ss:xx] or [mm:ss] Text
     */
    parseLrc: (lrcString: string): LrcLine[] => {
        if (!lrcString) return [];
        
        const lines = lrcString.split('\n');
        const parsed: LrcLine[] = [];
        // Support [mm:ss], [mm:ss.x], [mm:ss.xx], [mm:ss.xxx]
        const timeRegex = /\[(\d{2}):(\d{2})[.:]?(\d{1,3})?\]/g;

        lines.forEach(line => {
            let match;
            // A line might have multiple timestamp tags
            while ((match = timeRegex.exec(line)) !== null) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const millisecondsStr = match[3] || "0";
                const milliseconds = parseInt(millisecondsStr);
                
                // Convert to total seconds: 
                // .1 = 0.1s, .01 = 0.01s, .001 = 0.001s
                const fraction = milliseconds / Math.pow(10, millisecondsStr.length);
                const time = minutes * 60 + seconds + fraction;
                
                // Clean the text by removing ALL [tags] from the line
                const text = line.replace(/\[[^\]]*\]/g, '').trim();
                
                if (text) {
                    parsed.push({ time, text });
                }
            }
        });

        return parsed.sort((a, b) => a.time - b.time);
    },

    /**
     * Cleans plain lyrics string by removing any leftover LRC tags
     */
    cleanPlainLyrics: (text: string): string => {
        if (!text) return "";
        return text
            .replace(/\[\d{2}:\d{2}([.:]\d{2,3})?\]/g, '') // Remove timestamps
            .replace(/\[[^\]]*\]/g, '') // Remove metadata tags like [offset:0]
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');
    }
};
