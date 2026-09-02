/**
 * LanguageEngine.ts
 * 
 * Centralized service for:
 * 1. Robust language detection and normalization.
 * 2. Strict category language isolation and validation.
 * 3. Personalized Trend Now mixing based on user listening preference weights.
 */

export type SupportedLanguage = 'telugu' | 'hindi' | 'english' | 'tamil' | 'kannada' | 'malayalam' | 'punjabi' | 'unknown';

const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
    // Telugu
    'telugu': 'telugu',
    'te': 'telugu',
    'tel': 'telugu',
    'telugu music': 'telugu',
    'tollywood': 'telugu',

    // Hindi
    'hindi': 'hindi',
    'hi': 'hindi',
    'hin': 'hindi',
    'hindi music': 'hindi',
    'bollywood': 'hindi',

    // English
    'english': 'english',
    'en': 'english',
    'eng': 'english',
    'english music': 'english',
    'pop': 'english',
    'hollywood': 'english',
    'international': 'english',

    // Tamil
    'tamil': 'tamil',
    'ta': 'tamil',
    'tam': 'tamil',
    'tamil music': 'tamil',
    'kollywood': 'tamil',

    // Kannada
    'kannada': 'kannada',
    'kn': 'kannada',
    'kan': 'kannada',
    'kannada music': 'kannada',
    'sandalwood': 'kannada',

    // Malayalam
    'malayalam': 'malayalam',
    'ml': 'malayalam',
    'mal': 'malayalam',
    'malayalam music': 'malayalam',
    'mollywood': 'malayalam',

    // Punjabi
    'punjabi': 'punjabi',
    'pa': 'punjabi',
    'pun': 'punjabi',
    'punjabi music': 'punjabi',
};

// Well-known Indian record labels for fallback detection when metadata language is missing
const LABEL_LANGUAGE_HINTS: Record<string, SupportedLanguage> = {
    'aditya music': 'telugu',
    'lahari music': 'telugu',
    'mango music': 'telugu',
    'madhura audio': 'telugu',
    't-series telugu': 'telugu',
    'sony music telugu': 'telugu',
    'saregama telugu': 'telugu',
    'zee music telugu': 'telugu',
    't-series': 'hindi',
    'zee music company': 'hindi',
    'sony music india': 'hindi',
    'yrf music': 'hindi',
    'tips official': 'hindi',
    'saregama': 'hindi',
    't-series tamil': 'tamil',
    'sony music south': 'tamil',
    'think music': 'tamil',
};

export const normalizeLanguage = (raw: string | undefined | null): SupportedLanguage => {
    if (!raw || typeof raw !== 'string') return 'unknown';
    const clean = raw.toLowerCase().trim();
    if (!clean) return 'unknown';

    if (LANGUAGE_ALIASES[clean]) {
        return LANGUAGE_ALIASES[clean];
    }

    // Substring checking for compounds like "telugu romantic" or "english pop"
    for (const [alias, canonical] of Object.entries(LANGUAGE_ALIASES)) {
        if (clean === alias || clean.startsWith(`${alias} `) || clean.endsWith(` ${alias}`) || clean.includes(` ${alias} `)) {
            return canonical;
        }
    }

    return 'unknown';
};

/**
 * Extracts and normalizes the language of a track using multi-field fallback inspection.
 * Never defaults to English simply because the title uses Latin characters.
 */
export const getTrackLanguage = (track: any): SupportedLanguage => {
    if (!track) return 'unknown';

    // 1. Direct language field
    if (track.language) {
        const lang = normalizeLanguage(track.language);
        if (lang !== 'unknown') return lang;
    }

    // 2. More info / raw JioSaavn payload
    if (track.more_info?.language) {
        const lang = normalizeLanguage(track.more_info.language);
        if (lang !== 'unknown') return lang;
    }

    // 3. Genre field
    if (track.genre) {
        const lang = normalizeLanguage(track.genre);
        if (lang !== 'unknown') return lang;
    }

    // 4. Subtitle or Album metadata hints
    if (track.subtitle) {
        const lang = normalizeLanguage(track.subtitle);
        if (lang !== 'unknown') return lang;
    }

    // 5. Label / Copyright metadata hints
    const label = (track.label || track.copyright_text || track.more_info?.copyright_text || '').toLowerCase().trim();
    if (label) {
        for (const [hintLabel, canonical] of Object.entries(LABEL_LANGUAGE_HINTS)) {
            if (label.includes(hintLabel)) {
                return canonical;
            }
        }
    }

    return 'unknown';
};

/**
 * Strict category validation: determines whether a track belongs to a language-specific category.
 * If categoryLanguage is 'unknown' or not specified, passes through.
 */
export const isTrackValidForCategory = (track: any, categoryLanguage: string): boolean => {
    const expected = normalizeLanguage(categoryLanguage);
    if (expected === 'unknown') return true;

    const trackLang = getTrackLanguage(track);
    // Strict isolation: mismatched or unknown languages are rejected from language-specific categories
    return trackLang === expected;
};

/**
 * Filters a track list to strictly contain only tracks matching the given category language.
 */
export const filterCategoryTracks = (tracks: any[], categoryLanguage: string): any[] => {
    if (!Array.isArray(tracks) || tracks.length === 0) return [];
    const expected = normalizeLanguage(categoryLanguage);
    if (expected === 'unknown') return tracks;

    const seenIds = new Set<string>();
    const valid: any[] = [];

    for (const track of tracks) {
        if (!track || !track.id) continue;
        if (seenIds.has(track.id)) continue;

        if (isTrackValidForCategory(track, expected)) {
            seenIds.add(track.id);
            valid.push(track);
        }
    }

    return valid;
};

/**
 * Builds a personalized Trend Now track pool from real trending candidates.
 * 
 * Rules:
 * 1. Uses the real JioSaavn trending catalog.
 * 2. Filters strictly to supported languages (Telugu, Hindi, English).
 * 3. Allocates slots proportionally to the user's preference weights.
 * 4. Preserves relative trending ranking within each language.
 * 5. Applies diversity to prevent single-album domination.
 */
export const personalizeTrendingPool = (
    trendingSongs: any[],
    languageWeights: Record<string, number>,
    targetCount: number = 20
): any[] => {
    if (!Array.isArray(trendingSongs) || trendingSongs.length === 0) return [];

    // Group candidates into language buckets preserving their trending rank
    const pools: Record<string, any[]> = {
        telugu: [],
        hindi: [],
        english: [],
    };

    const seenIds = new Set<string>();

    for (const song of trendingSongs) {
        if (!song || !song.id || seenIds.has(song.id)) continue;
        seenIds.add(song.id);

        const lang = getTrackLanguage(song);
        if (pools[lang]) {
            pools[lang].push(song);
        }
    }

    // Normalize user weights for the 3 primary languages
    const wTelugu = Math.max(0, languageWeights.telugu ?? 0.50);
    const wHindi = Math.max(0, languageWeights.hindi ?? 0.30);
    const wEnglish = Math.max(0, languageWeights.english ?? 0.20);
    const totalWeight = wTelugu + wHindi + wEnglish || 1.0;

    const normWeights: Record<string, number> = {
        telugu: wTelugu / totalWeight,
        hindi: wHindi / totalWeight,
        english: wEnglish / totalWeight,
    };

    // Calculate initial quotas
    const quotas: Record<string, number> = {
        telugu: Math.round(targetCount * normWeights.telugu),
        hindi: Math.round(targetCount * normWeights.hindi),
        english: Math.round(targetCount * normWeights.english),
    };

    // Sort languages by weight descending
    const sortedLangs: SupportedLanguage[] = ['telugu', 'hindi', 'english'].sort(
        (a, b) => (normWeights[b] || 0) - (normWeights[a] || 0)
    ) as SupportedLanguage[];

    // Collect tracks respecting quotas and catalog availability
    const selectedByLang: Record<string, any[]> = {
        telugu: [],
        hindi: [],
        english: [],
    };
    const albumCounts: Record<string, number> = {};

    let totalSelected = 0;

    for (const lang of sortedLangs) {
        const quota = quotas[lang];
        const pool = pools[lang];

        for (const song of pool) {
            if (selectedByLang[lang].length >= quota) break;
            if (totalSelected >= targetCount) break;

            const albumKey = song.album?.name || song.album?.id || 'unknown';
            if (albumKey !== 'unknown') {
                const count = albumCounts[albumKey] || 0;
                if (count >= 2) continue; // Max 2 tracks per album for diversity
                albumCounts[albumKey] = count + 1;
            }

            selectedByLang[lang].push(song);
            totalSelected++;
        }
    }

    // If quotas were not met due to catalog limits, backfill from other languages in preference order
    if (totalSelected < targetCount) {
        for (const lang of sortedLangs) {
            const pool = pools[lang];
            for (const song of pool) {
                if (totalSelected >= targetCount) break;
                if (selectedByLang[lang].some(s => s.id === song.id)) continue;

                const albumKey = song.album?.name || song.album?.id || 'unknown';
                if (albumKey !== 'unknown') {
                    const count = albumCounts[albumKey] || 0;
                    if (count >= 2) continue;
                    albumCounts[albumKey] = count + 1;
                }

                selectedByLang[lang].push(song);
                totalSelected++;
            }
        }
    }

    // Interleave ranked items according to preference order
    const finalResult: any[] = [];
    const indices: Record<string, number> = { telugu: 0, hindi: 0, english: 0 };
    const addedIds = new Set<string>();

    while (finalResult.length < totalSelected) {
        let addedInRound = false;
        for (const lang of sortedLangs) {
            const list = selectedByLang[lang];
            const idx = indices[lang];
            if (idx < list.length) {
                const song = list[idx];
                indices[lang]++;
                if (!addedIds.has(song.id)) {
                    addedIds.add(song.id);
                    finalResult.push(song);
                    addedInRound = true;
                }
            }
        }
        if (!addedInRound) break;
    }

    return finalResult;
};
