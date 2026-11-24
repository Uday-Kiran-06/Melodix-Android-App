import { jioSaavnService } from './jiosaavn';
import { Song } from '../types/music';

export interface ImportedTrack {
    title: string;
    artist: string;
    matchedSong?: Song;
}

export interface ImportResult {
    source: 'spotify' | 'youtube' | 'unknown';
    type: 'track' | 'playlist' | 'album';
    title: string;
    totalTracks: number;
    tracks: ImportedTrack[];
}

/**
 * Service to resolve Spotify and YouTube links and import songs into Melodix.
 */
export const platformImporter = {
    /**
     * Checks if a string is a supported music platform URL.
     */
    isSupportedUrl(url: string): boolean {
        if (!url || typeof url !== 'string') return false;
        const clean = url.trim().toLowerCase();
        return (
            clean.includes('spotify.com') ||
            clean.includes('spotify.link') ||
            clean.includes('youtube.com') ||
            clean.includes('youtu.be')
        );
    },

    /**
     * Extracts platform and resource ID from a URL.
     */
    parseUrl(url: string): { platform: 'spotify' | 'youtube' | 'unknown'; type: 'track' | 'playlist' | 'album'; id: string } {
        const clean = url.trim();

        // Spotify
        if (clean.includes('spotify.com') || clean.includes('spotify.link')) {
            const trackMatch = clean.match(/track\/([a-zA-Z0-9]+)/);
            if (trackMatch) return { platform: 'spotify', type: 'track', id: trackMatch[1] };

            const playlistMatch = clean.match(/playlist\/([a-zA-Z0-9]+)/);
            if (playlistMatch) return { platform: 'spotify', type: 'playlist', id: playlistMatch[1] };

            const albumMatch = clean.match(/album\/([a-zA-Z0-9]+)/);
            if (albumMatch) return { platform: 'spotify', type: 'album', id: albumMatch[1] };

            return { platform: 'spotify', type: 'track', id: '' };
        }

        // YouTube / YouTube Music
        if (clean.includes('youtube.com') || clean.includes('youtu.be')) {
            const playlistMatch = clean.match(/[?&]list=([a-zA-Z0-9_-]+)/);
            if (playlistMatch) return { platform: 'youtube', type: 'playlist', id: playlistMatch[1] };

            const videoMatch = clean.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/|\/watch\?v=)([a-zA-Z0-9_-]{11})/);
            if (videoMatch) return { platform: 'youtube', type: 'track', id: videoMatch[1] };

            return { platform: 'youtube', type: 'track', id: '' };
        }

        return { platform: 'unknown', type: 'track', id: '' };
    },

    /**
     * Resolves metadata from Spotify (via public oEmbed & Embed scraper).
     */
    async resolveSpotify(url: string): Promise<ImportResult> {
        const { type, id } = this.parseUrl(url);

        if (type === 'track') {
            try {
                const oembedRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
                if (oembedRes.ok) {
                    const data = await oembedRes.json();
                    const titleText = data.title || '';
                    // Usually "Track Title by Artist" or "Track Title"
                    let title = titleText;
                    let artist = '';
                    if (titleText.includes(' by ')) {
                        const parts = titleText.split(' by ');
                        title = parts[0].trim();
                        artist = parts[1].trim();
                    }

                    return {
                        source: 'spotify',
                        type: 'track',
                        title: title || 'Spotify Track',
                        totalTracks: 1,
                        tracks: [{ title, artist }],
                    };
                }
            } catch (e) {
                console.warn('[PlatformImporter]: Spotify oEmbed failed, fallback to direct search', e);
            }
        }

        // For playlists / albums, scrape Spotify embed page for track names
        try {
            const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
            const res = await fetch(embedUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
            });

            if (res.ok) {
                const html = await res.text();
                // Attempt to parse Next.js data
                const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
                if (match && match[1]) {
                    const parsed = JSON.parse(match[1]);
                    const entity = parsed?.props?.pageProps?.state?.data?.entity;
                    const playlistTitle = entity?.title || entity?.name || `Spotify ${type.toUpperCase()}`;
                    const trackList: ImportedTrack[] = [];

                    const rawTracks = entity?.trackList || entity?.tracks?.items || [];
                    for (const t of rawTracks) {
                        const trackObj = t.track || t;
                        const trackTitle = trackObj?.title || trackObj?.name || '';
                        const trackArtist = trackObj?.subtitle || trackObj?.artists?.[0]?.name || '';
                        if (trackTitle) {
                            trackList.push({ title: trackTitle, artist: trackArtist });
                        }
                    }

                    if (trackList.length > 0) {
                        return {
                            source: 'spotify',
                            type,
                            title: playlistTitle,
                            totalTracks: trackList.length,
                            tracks: trackList,
                        };
                    }
                }
            }
        } catch (e) {
            console.error('[PlatformImporter]: Spotify embed scrape failed', e);
        }

        throw new Error('Unable to extract track list from Spotify link.');
    },

    /**
     * Resolves metadata from YouTube / YouTube Music.
     */
    async resolveYouTube(url: string): Promise<ImportResult> {
        try {
            const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
            if (oembedRes.ok) {
                const data = await oembedRes.json();
                let title = data.title || '';
                let artist = data.author_name || '';

                // Clean standard YouTube title formats like "Artist - Title (Official Video)"
                let cleanedTitle = title
                    .replace(/\[.*?\]/g, '')
                    .replace(/\(Official.*?\)/gi, '')
                    .replace(/\(Audio\)/gi, '')
                    .replace(/\(Lyric.*?\)/gi, '')
                    .trim();

                if (cleanedTitle.includes(' - ')) {
                    const parts = cleanedTitle.split(' - ');
                    artist = parts[0].trim();
                    cleanedTitle = parts.slice(1).join(' - ').trim();
                }

                return {
                    source: 'youtube',
                    type: 'track',
                    title: cleanedTitle || title,
                    totalTracks: 1,
                    tracks: [{ title: cleanedTitle || title, artist }],
                };
            }
        } catch (e) {
            console.error('[PlatformImporter]: YouTube oEmbed failed', e);
        }

        throw new Error('Unable to resolve YouTube track info.');
    },

    /**
     * Resolves any supported URL.
     */
    async resolveUrl(url: string): Promise<ImportResult> {
        const { platform } = this.parseUrl(url);
        if (platform === 'spotify') {
            return this.resolveSpotify(url);
        } else if (platform === 'youtube') {
            return this.resolveYouTube(url);
        }
        throw new Error('Unsupported music link. Melodix supports Spotify and YouTube links.');
    },

    /**
     * Matches an imported track with JioSaavn's 320kbps catalog.
     */
    async matchTrackWithCatalog(track: ImportedTrack): Promise<Song | null> {
        try {
            const query = `${track.title} ${track.artist}`.trim();
            const results = await jioSaavnService.searchSongs(query, "english,hindi,telugu", 1, 5);
            if (results && results.length > 0) {
                return results[0];
            }
            // Fallback: search just title
            const fallbackResults = await jioSaavnService.searchSongs(track.title, "english,hindi,telugu", 1, 3);
            if (fallbackResults && fallbackResults.length > 0) {
                return fallbackResults[0];
            }
        } catch (e) {
            console.error('[PlatformImporter]: Failed to match track:', track.title, e);
        }
        return null;
    },
};
