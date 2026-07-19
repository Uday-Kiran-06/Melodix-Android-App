import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { jioSaavnService } from '../services/jiosaavn';
import { useHistoryStore } from './useHistoryStore';

export const useInfiniteSongs = (query: string) => {
    const getPreferredLanguages = useHistoryStore(state => state.getPreferredLanguages);
    return useInfiniteQuery({
        queryKey: ['infinite-songs', query, getPreferredLanguages()],
        queryFn: ({ pageParam = 1 }) => jioSaavnService.searchSongs(query, getPreferredLanguages(), pageParam),
        getNextPageParam: (lastPage, allPages) => lastPage.length > 0 ? allPages.length + 1 : undefined,
        initialPageParam: 1,
        enabled: !!query,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
    });
};



export const useTrending = () => {
    return useQuery({
        queryKey: ['trending'],
        queryFn: () => jioSaavnService.getTrending(),
        staleTime: 1000 * 60 * 10,
        gcTime: 1000 * 60 * 30,
    });
};

export const useSearch = (query: string) => {
    const getPreferredLanguages = useHistoryStore(state => state.getPreferredLanguages);
    return useQuery({
        queryKey: ['search', query, getPreferredLanguages()],
        queryFn: () => jioSaavnService.searchSongs(query, getPreferredLanguages()),
        enabled: !!query,
        staleTime: 1000 * 60 * 2, // Shorter stale time for search
    });
};

export const useSearchAlbums = (query: string) => {
    const getPreferredLanguages = useHistoryStore(state => state.getPreferredLanguages);
    return useQuery({
        queryKey: ['search-albums', query, getPreferredLanguages()],
        queryFn: () => jioSaavnService.searchAlbums(query, getPreferredLanguages()),
        enabled: !!query
    });
};

export const useSearchPlaylists = (query: string) => {
    const getPreferredLanguages = useHistoryStore(state => state.getPreferredLanguages);
    return useQuery({
        queryKey: ['search-playlists', query, getPreferredLanguages()],
        queryFn: () => jioSaavnService.searchPlaylists(query, getPreferredLanguages()),
        enabled: !!query
    });
};

export const useNewReleases = () => {
    return useQuery({
        queryKey: ['new-releases'],
        queryFn: () => jioSaavnService.searchSongs('latest telugu new releases'),
        staleTime: 1000 * 60 * 30, // 30 minutes
    });
};

export const useSmartRecommendations = (keywords: string[]) => {
    const query = keywords.length > 0 ? keywords.join(' ') + ' latest telugu hits' : 'top telugu hits';
    return useQuery({
        queryKey: ['smart-recommendations', query],
        queryFn: () => jioSaavnService.searchSongs(query),
        staleTime: 1000 * 60 * 5,
    });
};

export const useArtistSongs = (artistName: string = 'Devi Sri Prasad') => {
    return useQuery({
        queryKey: ['artist-songs', artistName],
        queryFn: () => jioSaavnService.searchSongs(`${artistName} latest hits`),
        enabled: !!artistName,
        staleTime: 1000 * 60 * 60,
        gcTime: 1000 * 60 * 60 * 24,
    });
};

export const useMoodMusic = (mood: string) => {
    return useQuery({
        queryKey: ['mood-music', mood],
        queryFn: () => jioSaavnService.searchSongs(`${mood} telugu hits`),
        enabled: !!mood,
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 60 * 24,
    });
};

export const useRecommendations = (songId: string) => {
    return useQuery({
        queryKey: ['recommendations', songId],
        queryFn: () => jioSaavnService.getRecommendations(songId),
        enabled: !!songId,
        staleTime: 1000 * 60 * 15,
        gcTime: 1000 * 60 * 60 * 24,
    });
};

export const useHomeModules = () => {
    return useQuery({
        queryKey: ['home-modules'],
        queryFn: () => jioSaavnService.getModules()
    });
};

export const useMovieAlbums = () => {
    return useQuery({
        queryKey: ['movie-albums'],
        queryFn: () => jioSaavnService.searchAlbums('latest telugu movie albums'),
        staleTime: 1000 * 60 * 60 * 3,
        gcTime: 1000 * 60 * 60 * 24,
    });
};

export const useFeaturedPlaylists = () => {
    return useQuery({
        queryKey: ['featured-playlists'],
        queryFn: () => jioSaavnService.searchPlaylists('telugu popular playlists'),
        staleTime: 1000 * 60 * 60 * 12,
        gcTime: 1000 * 60 * 60 * 48,
    });
};



export const useSmartAlbums = (keywords: string[]) => {
    const query = keywords.length > 0 ? keywords.join(' ') + ' latest telugu albums' : 'latest telugu movie albums 2024';
    return useQuery({
        queryKey: ['smart-albums', query],
        queryFn: () => jioSaavnService.searchAlbums(query),
        staleTime: 1000 * 60 * 60 * 6,
        gcTime: 1000 * 60 * 60 * 48,
    });
};

export const useEnglishHits = () => {
    return useQuery({
        queryKey: ['english-hits'],
        queryFn: () => jioSaavnService.searchSongs('top english pop hits billboard', 'english'),
        staleTime: 1000 * 60 * 60 * 6,
        gcTime: 1000 * 60 * 60 * 24,
    });
};

export const useGlobalTrending = () => {
    return useQuery({
        queryKey: ['global-trending'],
        queryFn: () => jioSaavnService.searchSongs('trending global hits billboard', 'english')
    });
};

export const useRetroTelugu = () => {
    return useQuery({
        queryKey: ['retro-telugu'],
        queryFn: () => jioSaavnService.searchSongs('90s telugu golden hits', 'telugu'),
        staleTime: 1000 * 60 * 60 * 24,
        gcTime: 1000 * 60 * 60 * 72,
    });
};

export const useMusicCategory = (name: string, query: string, lang: string = 'telugu,english') => {
    return useQuery({
        queryKey: ['music-category', name],
        queryFn: () => jioSaavnService.searchSongs(query, lang),
        staleTime: 1000 * 60 * 60 * 6,
        gcTime: 1000 * 60 * 60 * 24,
    });
};
export const useLikedRecommendations = (songId: string | null) => {
    return useQuery({
        queryKey: ['liked-recommendations', songId],
        queryFn: () => jioSaavnService.getRecommendations(songId!),
        enabled: !!songId,
        staleTime: 1000 * 60 * 15,
    });
};

// ─── Personalized Hooks (preference-driven) ─────────────────────────────────

/**
 * Top hits for a specific artist, optionally scoped to a language.
 */
export const usePersonalizedArtistHits = (artistName: string, language?: string) => {
    const langSuffix = language ? ` ${language}` : '';
    const query = `${artistName} top hits${langSuffix}`;
    return useQuery({
        queryKey: ['personalized-artist', artistName, language],
        queryFn: () => jioSaavnService.searchSongs(query, language || 'telugu,hindi,english'),
        enabled: !!artistName,
        staleTime: 1000 * 60 * 60,
        gcTime: 1000 * 60 * 60 * 24,
    });
};

/**
 * Top hits for a specific language (e.g. Telugu Hits, Hindi Hits).
 */
export const usePersonalizedLanguageHits = (language: string) => {
    const query = `top ${language} hits songs`;
    return useQuery({
        queryKey: ['personalized-lang-hits', language],
        queryFn: () => jioSaavnService.searchSongs(query, language),
        enabled: !!language,
        staleTime: 1000 * 60 * 60 * 3,
        gcTime: 1000 * 60 * 60 * 24,
    });
};

/**
 * Mood-based music biased toward the user's top language.
 */
export const usePersonalizedMoodHits = (mood: string, language: string) => {
    const query = `${mood} ${language} hits`;
    return useQuery({
        queryKey: ['personalized-mood', mood, language],
        queryFn: () => jioSaavnService.searchSongs(query, language),
        enabled: !!mood && !!language,
        staleTime: 1000 * 60 * 60,
        gcTime: 1000 * 60 * 60 * 24,
    });
};

/**
 * New releases biased toward the user's top language.
 */
export const usePersonalizedNewReleases = (language: string) => {
    const query = `latest new ${language} releases 2024 2025`;
    return useQuery({
        queryKey: ['personalized-new-releases', language],
        queryFn: () => jioSaavnService.searchSongs(query, language),
        enabled: !!language,
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 60 * 24,
    });
};

/**
 * Movie albums biased toward the user's top language.
 */
export const usePersonalizedMovieAlbums = (language: string) => {
    const query = `latest ${language} movie albums`;
    return useQuery({
        queryKey: ['personalized-movie-albums', language],
        queryFn: () => jioSaavnService.searchAlbums(query, language),
        enabled: !!language,
        staleTime: 1000 * 60 * 60 * 3,
        gcTime: 1000 * 60 * 60 * 24,
    });
};

/**
 * Retro classics for the user's top language (only shown if they've listened to it).
 */
export const usePersonalizedRetro = (language: string) => {
    const query = `90s old classic ${language} hits`;
    return useQuery({
        queryKey: ['personalized-retro', language],
        queryFn: () => jioSaavnService.searchSongs(query, language),
        enabled: !!language,
        staleTime: 1000 * 60 * 60 * 24,
        gcTime: 1000 * 60 * 60 * 72,
    });
};
