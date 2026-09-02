import { Track } from 'react-native-track-player';
import { Song } from '../types/music';
import { jioSaavnService } from './jiosaavn';

export interface RecommendationContext {
    primarySeedId: string;
    seedIds: string[];
    targetLanguage: string;
    primaryArtist?: string;
    targetArtists: string[];
    primaryAlbumId?: string;
    musicalKeywords: string[];
}

// Common mood / vibe keywords to match contextual similarity
const VIBE_KEYWORDS = [
    'love', 'romantic', 'romance', 'melody', 'sad', 'heartbreak', 'breakup', 'emotional',
    'feel', 'acoustic', 'unplugged', 'duet', 'soul', 'peace', 'soothing', 'breeze',
    'party', 'dance', 'mass', 'beat', 'dj', 'remix', 'energetic', 'club', 'folk',
    'devotional', 'bhakti', 'spiritual', 'stotram', 'mantra', 'pooja',
    'lofi', 'chill', 'instrumental', 'theme', 'bgm', 'classical', 'carnatic'
];

/**
 * Extracts mood/vibe keywords from track titles, descriptions, and artist names.
 */
function extractMusicalKeywords(text: string): string[] {
    if (!text) return [];
    const lower = text.toLowerCase();
    return VIBE_KEYWORDS.filter(kw => lower.includes(kw));
}

/**
 * Normalizes language string (e.g. 'Telugu' -> 'telugu').
 */
function normalizeLanguage(lang: string | undefined | null): string {
    if (!lang) return '';
    const clean = lang.trim().toLowerCase();
    if (clean === 'music' || clean === 'unknown' || clean === 'undefined' || clean === 'null') return '';
    return clean;
}

/**
 * Extracts artist names from a string (e.g. "Sid Sriram, Shreya Ghoshal" -> ["Sid Sriram", "Shreya Ghoshal"]).
 */
function splitArtists(artistStr: string | undefined | null): string[] {
    if (!artistStr) return [];
    return artistStr
        .split(/[,&/|]/)
        .map(a => a.trim())
        .filter(a => a.length > 0 && a.toLowerCase() !== 'unknown artist');
}

export const recommendationEngine = {
    /**
     * Builds a rich recommendation context from the primary seed, recent listening history,
     * and current queue without contaminating the seed pool with heterogeneous manual queue items.
     */
    buildContext: (
        seedId: string,
        currentTrack: Track | null,
        recentTracks: Track[] = [],
        recentHistoryItems: any[] = []
    ): RecommendationContext => {
        const seedIds: string[] = [seedId];
        const targetArtists: string[] = [];
        const musicalKeywords: string[] = [];

        // 1. Determine target language
        // Priority: currentTrack genre (stores language in Melodix) -> currentTrack language metadata -> history
        let targetLanguage = normalizeLanguage(currentTrack?.genre);
        if (!targetLanguage && currentTrack?.description) {
            targetLanguage = normalizeLanguage(currentTrack.description);
        }

        // Extract keywords & artists from active track
        if (currentTrack) {
            if (currentTrack.title) {
                musicalKeywords.push(...extractMusicalKeywords(currentTrack.title));
            }
            if (currentTrack.artist) {
                const artists = splitArtists(currentTrack.artist);
                targetArtists.push(...artists);
            }
        }

        // 2. Look for 1-2 additional recent seeds with matching language/vibe
        // Filter from recent history / queue tracks preceding current track
        const candidateSeeds = [...recentTracks, ...recentHistoryItems];
        for (const item of candidateSeeds) {
            if (seedIds.length >= 3) break;
            const itemId = String(item.id);
            if (!itemId || seedIds.includes(itemId)) continue;

            const itemLang = normalizeLanguage(item.genre || item.language);
            // Only add recent seed if it shares the target language or language was unknown
            if (!targetLanguage && itemLang) {
                targetLanguage = itemLang;
            }

            if (!targetLanguage || itemLang === targetLanguage) {
                seedIds.push(itemId);
                const itemArtists = splitArtists(item.artist || item.artists?.primary?.[0]?.name);
                targetArtists.push(...itemArtists);
                if (item.title || item.name) {
                    musicalKeywords.push(...extractMusicalKeywords(item.title || item.name));
                }
            }
        }

        const uniqueArtists = Array.from(new Set(targetArtists));
        const uniqueKeywords = Array.from(new Set(musicalKeywords));

        let userDefaultLang = 'telugu';
        try {
            const { useHistoryStore } = require('../hooks/useHistoryStore');
            const topLangs = useHistoryStore.getState().getTopLanguages(1);
            if (topLangs && topLangs.length > 0 && topLangs[0]) {
                userDefaultLang = topLangs[0].toLowerCase();
            }
        } catch (e) { }

        return {
            primarySeedId: seedId,
            seedIds,
            targetLanguage: targetLanguage || userDefaultLang,
            primaryArtist: uniqueArtists[0],
            targetArtists: uniqueArtists,
            primaryAlbumId: currentTrack?.album ? String(currentTrack.album) : undefined,
            musicalKeywords: uniqueKeywords
        };
    },

    /**
     * Fetches recommendation candidates from multiple seed API calls, related artists,
     * and contextual queries adhering to the Step 14 fallback hierarchy.
     */
    fetchCandidates: async (
        context: RecommendationContext,
        isManual: boolean = false
    ): Promise<Song[]> => {
        const candidateMap = new Map<string, Song>();

        const addCandidates = (songs: Song[]) => {
            if (!songs || !Array.isArray(songs)) return;
            for (const s of songs) {
                if (s && s.id && !candidateMap.has(String(s.id))) {
                    candidateMap.set(String(s.id), s);
                }
            }
        };

        // PASS 1: Multi-seed recommendations (parallel fan-out)
        try {
            const multiSeedResults = await jioSaavnService.getMultiSeedRecommendations(context.seedIds);
            addCandidates(multiSeedResults);
        } catch (e) {
            console.error('[RecommendationEngine]: Multi-seed fetch failed:', e);
        }

        // PASS 2: If candidate count is below 15 or in manual mode, fetch related artist top hits
        if (candidateMap.size < 15 && context.targetArtists.length > 0) {
            try {
                const primaryArtist = context.primaryArtist || context.targetArtists[0];
                if (primaryArtist && primaryArtist !== 'Unknown Artist') {
                    const artistQuery = `${context.targetLanguage} ${primaryArtist} top hits`;
                    const artistSongs = await jioSaavnService.searchSongs(artistQuery);
                    addCandidates(artistSongs || []);
                }
            } catch (e) {
                console.error('[RecommendationEngine]: Artist top hits search failed:', e);
            }
        }

        // PASS 3: Contextual search based on musical vibe / language (e.g. "telugu romantic melody songs")
        if (candidateMap.size < 15) {
            try {
                let contextQuery = `${context.targetLanguage} top songs`;
                if (context.musicalKeywords.length > 0) {
                    contextQuery = `${context.targetLanguage} ${context.musicalKeywords.slice(0, 2).join(' ')} songs`;
                }
                const contextSongs = await jioSaavnService.searchSongs(contextQuery);
                addCandidates(contextSongs || []);
            } catch (e) {
                console.error('[RecommendationEngine]: Contextual vibe search failed:', e);
            }
        }

        return Array.from(candidateMap.values());
    },

    /**
     * Scores candidates based on language matching, artist relationship,
     * mood/vibe similarity, and applies diversity penalties for albums and artists.
     */
    scoreAndRankCandidates: (
        candidates: Song[],
        context: RecommendationContext,
        liveQueueIds: Set<string>,
        sessionRecommendedIds: Set<string>,
        recentlyPlayedIds: Set<string>
    ): Song[] => {
        const albumCounts = new Map<string, number>();
        const artistCounts = new Map<string, number>();
        const scoredCandidates: { song: Song; score: number }[] = [];

        const targetLangLower = context.targetLanguage.toLowerCase();
        const targetArtistsLower = context.targetArtists.map(a => a.toLowerCase());

        for (const song of candidates) {
            const songId = String(song.id);
            if (!songId) continue;

            // 1. Strict Exclusions:
            if (context.seedIds.includes(songId)) continue;
            if (liveQueueIds.has(songId)) continue;
            if (sessionRecommendedIds.has(songId)) continue;
            if (recentlyPlayedIds.has(songId)) continue;

            // Must have audio URL or downloadUrl
            if (!song.url && (!song.downloadUrl || song.downloadUrl.length === 0)) continue;

            let score = 50; // Base score

            // 2. Language Preference (Highest weight)
            const songLang = normalizeLanguage(song.language);
            if (songLang && targetLangLower) {
                if (songLang === targetLangLower) {
                    score += 120; // Strong positive boost
                } else {
                    score -= 200; // Strong penalty against cross-language bleeding
                }
            }

            // 3. Artist Relationship
            const primaryArtistName = (song.artists?.primary?.[0]?.name || '').toLowerCase();
            if (primaryArtistName && targetArtistsLower.some(a => a.includes(primaryArtistName) || primaryArtistName.includes(a))) {
                score += 35;
            } else if (song.artists?.all?.some((a: any) => targetArtistsLower.includes((a.name || '').toLowerCase()))) {
                score += 15;
            }

            // 4. Musical Context / Vibe Keywords
            const songNameLower = (song.name || '').toLowerCase();
            for (const kw of context.musicalKeywords) {
                if (songNameLower.includes(kw)) {
                    score += 25;
                    break;
                }
            }

            // 5. Album Diversity Penalty (Step 7: Fix Same-Album Domination)
            const albumKey = song.album?.id ? String(song.album.id) : (song.album?.name || 'unknown');
            const currentAlbumCount = albumCounts.get(albumKey) || 0;

            if (currentAlbumCount === 0) {
                // 1st track from this album -> 0 penalty
            } else if (currentAlbumCount === 1) {
                // 2nd track from this album -> moderate penalty
                score -= 30;
            } else if (currentAlbumCount === 2) {
                // 3rd track from this album -> heavy penalty
                score -= 80;
            } else {
                // >3 tracks from same album -> disqualified
                score -= 300;
            }

            // Penalty if matching current seed album
            if (context.primaryAlbumId && (albumKey === context.primaryAlbumId || song.album?.name === context.primaryAlbumId)) {
                score -= 35;
            }

            // 6. Artist Diversity Penalty (Step 8: Artist Diversity)
            const artistKey = primaryArtistName || 'unknown';
            const currentArtistCount = artistCounts.get(artistKey) || 0;

            if (currentArtistCount < 2) {
                // 1st & 2nd track from artist -> 0 penalty
            } else if (currentArtistCount === 2) {
                score -= 25;
            } else if (currentArtistCount === 3) {
                score -= 60;
            } else {
                score -= 180;
            }

            // Record track presence for diversity counting
            albumCounts.set(albumKey, currentAlbumCount + 1);
            artistCounts.set(artistKey, currentArtistCount + 1);

            if (score > 0) {
                scoredCandidates.push({ song, score });
            }
        }

        // Sort candidates by score descending
        scoredCandidates.sort((a, b) => b.score - a.score);

        return scoredCandidates.map(sc => sc.song);
    },

    /**
     * Interleaves a batch of songs so consecutive tracks do not repeat
     * the exact same album or artist.
     */
    interleaveBatch: (songs: Song[], batchSize: number = 15): Song[] => {
        if (songs.length <= 1) return songs.slice(0, batchSize);

        const result: Song[] = [];
        const pool = [...songs];

        while (pool.length > 0 && result.length < batchSize) {
            const lastSong = result[result.length - 1];
            let bestIndex = 0;

            if (lastSong) {
                const lastAlbum = lastSong.album?.name;
                const lastArtist = lastSong.artists?.primary?.[0]?.name;

                // Find first candidate that differs in album and artist
                const foundIndex = pool.findIndex(s => {
                    const sAlbum = s.album?.name;
                    const sArtist = s.artists?.primary?.[0]?.name;
                    return sAlbum !== lastAlbum && sArtist !== lastArtist;
                });

                if (foundIndex !== -1) {
                    bestIndex = foundIndex;
                }
            }

            result.push(pool.splice(bestIndex, 1)[0]);
        }

        return result;
    },

    /**
     * Top-level pipeline for fetching, scoring, and ranking recommendations
     * for a given seed track and current player state.
     */
    getRecommendations: async (
        seedId: string,
        currentTrack: Track | null,
        liveQueueIds: Set<string>,
        sessionRecommendedIds: Set<string>,
        isManual: boolean = false
    ): Promise<Song[]> => {
        let recentHistory: any[] = [];
        try {
            const { useHistoryStore } = require('../hooks/useHistoryStore');
            recentHistory = useHistoryStore.getState().history || [];
        } catch (e) { }

        const context = recommendationEngine.buildContext(seedId, currentTrack, [], recentHistory);
        const candidates = await recommendationEngine.fetchCandidates(context, isManual);
        const recentlyPlayedIds = new Set(recentHistory.slice(0, 20).map((h: any) => String(h.id)));
        const ranked = recommendationEngine.scoreAndRankCandidates(
            candidates,
            context,
            liveQueueIds,
            sessionRecommendedIds,
            recentlyPlayedIds
        );
        return recommendationEngine.interleaveBatch(ranked, isManual ? 20 : 15);
    }
};
