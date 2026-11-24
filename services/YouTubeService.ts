import { Song } from '../types/music';
import { jioSaavnService } from './jiosaavn';

export interface YouTubeSearchResult {
    id: string;
    title: string;
    artist: string;
    thumbnail: string;
    durationText?: string;
    durationSeconds?: number;
}

/**
 * Service to search YouTube & YouTube Music directly.
 */
export const youTubeService = {
    /**
     * Searches YouTube for tracks using public web scraping (no API key required).
     */
    async search(query: string): Promise<YouTubeSearchResult[]> {
        if (!query || !query.trim()) return [];
        const cleanQuery = query.trim();

        try {
            const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery + ' audio')}`;
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
            });

            if (!res.ok) return [];

            const html = await res.text();
            const match = html.match(/var ytInitialData = ({.*?});<\/script>/);
            if (!match || !match[1]) return [];

            const data = JSON.parse(match[1]);
            const sections = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
            const items = sections?.[0]?.itemSectionRenderer?.contents || [];

            const results: YouTubeSearchResult[] = [];

            for (const item of items) {
                const v = item.videoRenderer;
                if (!v || !v.videoId) continue;

                const id = v.videoId;
                const title = v.title?.runs?.[0]?.text || 'Unknown Title';
                const artist = v.ownerText?.runs?.[0]?.text || 'YouTube Creator';
                const thumbnail = v.thumbnail?.thumbnails?.[v.thumbnail.thumbnails.length - 1]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
                const durationText = v.lengthText?.simpleText || '3:30';

                // Parse duration
                let durationSeconds = 210;
                if (durationText) {
                    const parts = durationText.split(':').map(Number);
                    if (parts.length === 2) {
                        durationSeconds = parts[0] * 60 + parts[1];
                    } else if (parts.length === 3) {
                        durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                    }
                }

                results.push({
                    id,
                    title,
                    artist,
                    thumbnail,
                    durationText,
                    durationSeconds,
                });
            }

            return results.slice(0, 25);
        } catch (e) {
            console.error('[YouTubeService]: Search failed', e);
            return [];
        }
    },

    /**
     * Converts a YouTube result into a Melodix Song object.
     * Matches with JioSaavn's 320 kbps stream for studio audio fidelity,
     * with fallback to audio streaming.
     */
    async convertToSong(ytResult: YouTubeSearchResult): Promise<Song> {
        // Clean title for catalog matching
        const cleanTitle = ytResult.title
            .replace(/\[.*?\]/g, '')
            .replace(/\(Official.*?\)/gi, '')
            .replace(/\(Audio\)/gi, '')
            .replace(/\(Lyric.*?\)/gi, '')
            .replace(/\|\s*.*$/g, '')
            .trim();

        // 1. Attempt high-fidelity matching
        try {
            const query = `${cleanTitle} ${ytResult.artist}`.trim();
            const matched = await jioSaavnService.searchSongs(query, "english,hindi,telugu", 1, 3);
            if (matched && matched.length > 0) {
                const best = matched[0];
                return {
                    ...best,
                    image: ytResult.thumbnail || best.image,
                };
            }
        } catch (e) { }

        // 2. Direct YouTube fallback representation
        return {
            id: `yt_${ytResult.id}`,
            name: ytResult.title,
            title: ytResult.title,
            duration: ytResult.durationSeconds || 210,
            year: String(new Date().getFullYear()),
            image: ytResult.thumbnail,
            url: `https://yewtu.be/latest_version?id=${ytResult.id}&itag=140`,
            downloadUrl: [
                { quality: '320kbps', url: `https://yewtu.be/latest_version?id=${ytResult.id}&itag=140` },
                { quality: '160kbps', url: `https://yewtu.be/latest_version?id=${ytResult.id}&itag=140` }
            ],
            artists: {
                primary: [{ id: `yt_channel_${ytResult.id}`, name: ytResult.artist, role: 'artist', type: 'artist', image: [] }],
                featured: [],
                all: [{ id: `yt_channel_${ytResult.id}`, name: ytResult.artist, role: 'artist', type: 'artist', image: [] }]
            },
            album: {
                id: `yt_album_${ytResult.id}`,
                name: 'YouTube Music',
                url: ''
            }
        } as any;
    }
};
