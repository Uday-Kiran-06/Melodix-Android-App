import { Track } from "react-native-track-player";

export interface LrcLine {
    time: number; // in seconds
    text: string;
}

export const lyricsService = {
    /**
     * Fetches synced lyrics from LrcLib.net
     */
    getSyncedLyrics: async (track: Track): Promise<{ synced: LrcLine[] | null; plain: string | null }> => {
        try {
            const title = encodeURIComponent(track.title || "");
            const artist = encodeURIComponent(track.artist || "");
            // LrcLib works best with duration for matching
            const duration = track.duration ? Math.round(track.duration) : 0;
            
            const url = `https://lrclib.net/api/get?artist_name=${artist}&track_name=${title}${duration ? `&duration=${duration}` : ''}`;
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Melodix Music App (https://github.com/Uday-Kiran-06/Melodix-Android-App)',
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                if (data.syncedLyrics) {
                    const parsed = lyricsService.parseLrc(data.syncedLyrics);
                    return { synced: parsed, plain: data.plainLyrics || null };
                }
                
                return { synced: null, plain: data.plainLyrics || null };
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
        // Support [mm:ss], [mm:ss.xx], [mm:ss:xx]
        const timeRegex = /\[(\d{2}):(\d{2})[.:]?(\d{2,3})?\]/g;

        lines.forEach(line => {
            let match;
            // A line might have multiple timestamp tags
            while ((match = timeRegex.exec(line)) !== null) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const milliseconds = match[3] ? parseInt(match[3]) : 0;
                
                // Convert to total seconds
                const time = minutes * 60 + seconds + (milliseconds / (match[3]?.length === 3 ? 1000 : 100));
                
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
