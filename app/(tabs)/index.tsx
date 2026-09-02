import { useAuth } from '@/components/AuthContext';
import { MusicImage } from '@/components/MusicImage';
import { Shimmer } from '@/components/Shimmer';
import SongMenu from '@/components/SongMenu';
import { useHistoryStore } from '@/hooks/useHistoryStore';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import {
  useEnglishHits,
  useFeaturedPlaylists,
  useInfiniteSongs,
  useLikedRecommendations,
  usePersonalizedArtistHits,
  usePersonalizedLanguageHits,
  usePersonalizedMovieAlbums,
  usePersonalizedMoodHits,
  usePersonalizedNewReleases,
  usePersonalizedRetro,
  useSmartRecommendations,
  useTrending
} from '@/hooks/useMusic';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { jioSaavnService } from '@/services/jiosaavn';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { MoreVertical } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

// ─── Shared UI Components ─────────────────────────────────────────────────────

const SectionHeader = memo(({ title, isDark }: { title: string; isDark: boolean }) => (
  <View className="flex-row justify-between items-center mb-4 px-5">
    <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</Text>
  </View>
));

const CardShimmer = memo(({ type, isDark }: { type: string; isDark: boolean }) => (
  <View className="mr-5">
    <View
      className={`${type === 'circle' ? 'w-24 h-24 rounded-full' : type === 'rectangle' ? 'w-[180px] h-[110px] rounded-xl' : 'w-[140px] h-36 rounded-2xl'} mb-2 ${isDark ? 'bg-zinc-900' : 'bg-slate-200'} overflow-hidden`}
    >
      <Shimmer width="100%" height="100%" />
    </View>
    <Shimmer width={type === 'circle' ? 80 : 100} height={16} borderRadius={4} className="mb-1" />
    {type !== 'rectangle' && <Shimmer width={60} height={12} borderRadius={4} />}
  </View>
));

const SectionShimmer = memo(({ isDark, type = 'square' }: { isDark: boolean; type?: string }) => (
  <View className="mb-8">
    <View className="px-5 mb-4">
      <Shimmer width={160} height={24} borderRadius={4} />
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
      {[1, 2, 3, 4].map(i => (
        <CardShimmer key={i} type={type} isDark={isDark} />
      ))}
    </ScrollView>
  </View>
));

const getImageUrl = (item: any) => {
  if (!item) return null;
  return item.image || item.artwork || item.images;
};

const SongCard = memo(({ item, onPress, isDark, type = 'square' }: {
  item: any; onPress: () => void; isDark: boolean; type?: 'square' | 'circle' | 'rectangle';
}) => {
  const imageUrl = getImageUrl(item);
  if (type === 'rectangle') {
    return (
      <TouchableOpacity onPress={onPress} className="mr-4 mb-4">
        <View style={{ width: 180, height: 110 }} className={`rounded-xl overflow-hidden relative ${isDark ? 'bg-zinc-900' : 'bg-slate-200'}`}>
          <MusicImage images={imageUrl} className="w-full h-full" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} className="absolute inset-0 justify-end p-2 pb-3">
            <Text className="text-white text-sm font-bold" numberOfLines={1}>{item?.name || item?.title || 'Unknown'}</Text>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} className="mr-5">
      <View style={{ width: type === 'circle' ? 110 : 140 }}>
        <View className={`${type === 'circle' ? 'w-24 h-24 rounded-full' : 'w-full h-36 rounded-2xl'} mb-2 shadow-sm overflow-hidden ${isDark ? 'bg-zinc-900' : 'bg-slate-200'}`}>
          <MusicImage images={imageUrl} className="w-full h-full" />
        </View>
        <Text className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={1}>
          {item?.name || item?.title || 'Unknown'}
        </Text>
        {(item?.artist || item?.artists?.primary?.[0]?.name) && (
          <Text className="text-zinc-500 text-xs" numberOfLines={1}>
            {item?.artist || item?.artists?.primary?.[0]?.name}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

const SongListItem = memo(({ item, onPress, onMore, isDark }: {
  item: any; onPress: () => void; onMore: () => void; isDark: boolean;
}) => {
  const imageUrl = getImageUrl(item);
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center px-5 py-3 mb-2 ${isDark ? 'bg-zinc-900/40' : 'bg-white'} rounded-2xl mx-5 border border-white/5`}
    >
      <View className={`w-14 h-14 rounded-xl mr-4 overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
        <MusicImage images={imageUrl} className="w-full h-full" />
      </View>
      <View className="flex-1">
        <Text className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`} numberOfLines={1}>
          {item?.name || item?.title || item?.showName || 'Unknown'}
        </Text>
        <Text className="text-zinc-500 text-sm" numberOfLines={1}>
          {item?.artists?.primary?.[0]?.name || item?.artist || item?.subtitle || 'Unknown Artist'}
        </Text>
      </View>
      <TouchableOpacity onPress={onMore} className={`p-2 rounded-full ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
        <MoreVertical size={20} color={isDark ? '#71717a' : '#94a3b8'} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

import { personalizeTrendingPool } from '@/services/LanguageEngine';

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { fetchLibrary, likedSongs = [] } = useLibraryStore();
  const { theme } = useSettingsStore();
  const { playTrack } = usePlayerStore();
  const {
    recentlyPlayedItems = [],
    recentKeywords = [],
    searchHistory = [],
    getTopLanguages,
    getLanguageWeights,
    getTopArtists,
  } = useHistoryStore();

  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedSongForMenu, setSelectedSongForMenu] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const isDark = theme === 'dark';

  // ── Preference derivation ─────────────────────────────────────────────────
  const topLanguages = useMemo(() => getTopLanguages(3), [getTopLanguages, recentlyPlayedItems]);
  const languageWeights = useMemo(() => getLanguageWeights(), [getLanguageWeights, recentlyPlayedItems]);
  const topArtists   = useMemo(() => getTopArtists(3),   [getTopArtists,   recentlyPlayedItems]);

  const primaryLang   = topLanguages[0] ?? 'telugu';
  const secondaryLang = topLanguages[1] ?? 'hindi';
  // Fixed artist slots so hook call count never changes
  const artist0 = topArtists[0] ?? 'Sid Sriram';
  const artist1 = topArtists[1] ?? 'Anirudh Ravichander';
  const artist2 = topArtists[2] ?? 'Arijit Singh';

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // ── Utilities ─────────────────────────────────────────────────────────────
  const shuffle = (arr: any[]) => {
    if (!arr?.length) return [];
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await queryClient.refetchQueries();
    setRefreshing(false);
  }, [queryClient]);

  const goSong    = useCallback((id: string) => router.push(`/song/${id}` as any), [router]);
  const goSearch  = useCallback((q: string)  => router.push({ pathname: '/search', params: { q } }), [router]);

  // ── ALL Data Queries (all at component level — fire immediately on mount) ──

  const trendingQuery   = useTrending();
  const trending        = useMemo(
    () => personalizeTrendingPool(trendingQuery.data || [], languageWeights, 20),
    [trendingQuery.data, languageWeights]
  );

  const combinedHistory = useMemo(
    () => Array.from(new Set([...searchHistory, ...recentKeywords])).slice(0, 5),
    [searchHistory, recentKeywords]
  );

  const smartRecsQuery  = useSmartRecommendations(combinedHistory, primaryLang);
  const smartRecs       = smartRecsQuery.data || [];

  const playlistsQuery  = useFeaturedPlaylists(primaryLang);
  const playlists       = playlistsQuery.data || [];

  const likedRecsQuery  = useLikedRecommendations(likedSongs[0]?.id || null);
  const likedRecs       = likedRecsQuery.data || [];

  // Primary language sections
  const newRelQuery  = usePersonalizedNewReleases(primaryLang);
  const newRel       = useMemo(() => (newRelQuery.data || []).slice(0, 20), [newRelQuery.data]);

  const albumsQuery  = usePersonalizedMovieAlbums(primaryLang);
  const albums       = albumsQuery.data || [];

  const romanticQuery = usePersonalizedMoodHits('romantic', primaryLang);
  const romantic      = romanticQuery.data || [];

  const happyQuery   = usePersonalizedMoodHits('happy', primaryLang);
  const happy        = happyQuery.data || [];

  const retroQuery   = usePersonalizedRetro(primaryLang);
  const retro        = retroQuery.data || [];

  // Secondary language hits
  const langHitsPrimQuery = usePersonalizedLanguageHits(primaryLang);
  const langHitsPrim      = langHitsPrimQuery.data || [];

  const langHitsSecQuery  = usePersonalizedLanguageHits(secondaryLang);
  const langHitsSec       = langHitsSecQuery.data || [];

  // Top 3 artist sections (fixed hook slots — counts never change)
  const artist0Query = usePersonalizedArtistHits(artist0, primaryLang);
  const artist0Data  = artist0Query.data || [];

  const artist1Query = usePersonalizedArtistHits(artist1, primaryLang);
  const artist1Data  = artist1Query.data || [];

  const artist2Query = usePersonalizedArtistHits(artist2, primaryLang);
  const artist2Data  = artist2Query.data || [];

  // English — always fetched, conditionally shown when not already covered in primary/secondary
  const englishQuery = useEnglishHits();
  const english      = englishQuery.data || [];
  const showEnglishExtra = primaryLang !== 'english' && secondaryLang !== 'english' && topLanguages.includes('english');

  const infiniteSongs = useInfiniteSongs(`trending ${primaryLang} songs`);

  useEffect(() => { if (user) fetchLibrary(user.id); }, [user]);

  // When Home comes into focus, revalidate trending data if staleTime has elapsed
  useFocusEffect(
    useCallback(() => {
      if (trendingQuery.isStale) {
        trendingQuery.refetch();
      }
    }, [trendingQuery.isStale, trendingQuery.refetch])
  );

  useEffect(() => {
    trending.slice(0, 10).forEach(item => {
      const url = getImageUrl(item);
      if (url) {
        const s = jioSaavnService.sanitizeImageUrl(url);
        if (s) ExpoImage.prefetch([s]);
      }
    });
  }, [trending]);

  const currentGreeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return 'Good Morning';
    if (h >= 12 && h < 17) return 'Good Afternoon';
    if (h >= 17 && h < 22) return 'Good Evening';
    return 'Good Night';
  }, []);

  const gridItems = useMemo(() => {
    return [{ id: 'liked-songs', name: 'Liked Songs' }, ...recentlyPlayedItems].slice(0, 6);
  }, [recentlyPlayedItems]);

  // ── Build dynamic section list (all data already loaded above) ────────────
  const allViewData = useMemo(() => {
    const L = (loading: boolean, data: any[]) => loading || data.length > 0;

    const sections: any[] = [
      { type: 'quick_access', id: 'qa' },

      // Trending
      { type: 'section', id: 'trending',   title: 'Trending Now',                  data: trending,   loading: trendingQuery.isLoading },

      // Liked-song recommendations (conditional)
      { type: 'section', id: 'liked_recs', title: 'Recommended for You',          data: likedRecs,  loading: likedRecsQuery.isLoading,  enabled: L(likedRecsQuery.isLoading, likedRecs) },

      // Search-based recommendations (conditional)
      { type: 'section', id: 'smart_recs', title: 'Based on your Search',         data: smartRecs,  loading: smartRecsQuery.isLoading,  enabled: L(smartRecsQuery.isLoading, smartRecs) },

      // Top artist 0
      { type: 'section', id: 'artist_0',   title: `Top Hits • ${artist0}`,        data: artist0Data, loading: artist0Query.isLoading },
      // Primary language hits
      { type: 'section', id: 'lang_prim',  title: `${cap(primaryLang)} Hits`,     data: langHitsPrim, loading: langHitsPrimQuery.isLoading },

      // Top artist 1
      { type: 'section', id: 'artist_1',   title: `Top Hits • ${artist1}`,        data: artist1Data, loading: artist1Query.isLoading },

      // New releases
      { type: 'section', id: 'new_rel',    title: `New ${cap(primaryLang)} Releases`, data: newRel, loading: newRelQuery.isLoading },

      // Featured playlists
      { type: 'section', id: 'playlists',  title: 'Popular Playlists',            data: playlists,  loading: playlistsQuery.isLoading, cardType: 'rectangle' },

      // Movie albums
      { type: 'section', id: 'albums',     title: `${cap(primaryLang)} Movie Albums`, data: albums, loading: albumsQuery.isLoading, cardType: 'rectangle' },

      // Top artist 2
      { type: 'section', id: 'artist_2',   title: `Top Hits • ${artist2}`,        data: artist2Data, loading: artist2Query.isLoading },

      // Secondary language hits
      { type: 'section', id: 'lang_sec',   title: `${cap(secondaryLang)} Hits`,   data: langHitsSec, loading: langHitsSecQuery.isLoading },

      // Mood sections
      { type: 'section', id: 'romantic',   title: `Romantic ${cap(primaryLang)}`, data: romantic,   loading: romanticQuery.isLoading },
      { type: 'section', id: 'happy',      title: 'Happy Vibes',                  data: happy,      loading: happyQuery.isLoading },

      // Retro
      { type: 'section', id: 'retro',      title: `Retro ${cap(primaryLang)} Classics`, data: retro, loading: retroQuery.isLoading },

      // English (only if user listens to English and not already shown as primary/secondary)
      ...(showEnglishExtra ? [{ type: 'section', id: 'english', title: 'English Pop Hits', data: english, loading: englishQuery.isLoading }] : []),

      // More hits (bottom)
      { type: 'section', id: 'more',       title: `More ${cap(primaryLang)} Hits`, data: infiniteSongs.data?.pages[0]?.slice(0, 15) || [], loading: infiniteSongs.isLoading },
    ];

    return sections.filter(s => s.enabled !== false);
  }, [
    trending, trendingQuery.isLoading,
    likedRecs, likedRecsQuery.isLoading,
    smartRecs, smartRecsQuery.isLoading,
    artist0, artist0Data, artist0Query.isLoading,
    artist1, artist1Data, artist1Query.isLoading,
    artist2, artist2Data, artist2Query.isLoading,
    langHitsPrim, langHitsPrimQuery.isLoading,
    langHitsSec, langHitsSecQuery.isLoading,
    newRel, newRelQuery.isLoading,
    playlists, playlistsQuery.isLoading,
    albums, albumsQuery.isLoading,
    romantic, romanticQuery.isLoading,
    happy, happyQuery.isLoading,
    retro, retroQuery.isLoading,
    english, englishQuery.isLoading, showEnglishExtra,
    infiniteSongs.data, infiniteSongs.isLoading,
    primaryLang, secondaryLang,
  ]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderSection = useCallback(({ title, data, loading, cardType }: any) => {
    const type = cardType === 'rectangle' ? 'rectangle' : 'square';
    if (loading) return <SectionShimmer isDark={isDark} type={type} />;
    if (!data?.length) return null;
    return (
      <View className="mb-8">
        <SectionHeader title={title} isDark={isDark} />
        <FlatList
          horizontal showsHorizontalScrollIndicator={false}
          data={data}
          keyExtractor={(item, i) => item?.id ? `${item.id}-${i}` : `sec-item-${i}`}
          renderItem={({ item }) => (
            <SongCard
              item={item}
              onPress={() => {
                if (item.type === 'album') {
                  router.push(`/album/${item.id}` as any);
                } else if (item.type === 'playlist') {
                  router.push(`/saavn-playlist/${item.id}` as any);
                } else {
                  goSong(item.id);
                }
              }}
              isDark={isDark}
              type={type}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          removeClippedSubviews
        />
      </View>
    );
  }, [isDark, goSong, router]);

  const renderAllItem = useCallback(({ item }: any) => {
    if (item.type === 'quick_access') {
      return (
        <View className="px-5 mb-8">
          <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-4`}>{currentGreeting}</Text>
          <View className="flex-row flex-wrap -m-1">
            {gridItems.map((gItem: any) => (
              <TouchableOpacity
                key={gItem.id}
                onPress={() => {
                  if (gItem.id === 'liked-songs') router.push('/liked-songs');
                  else if (gItem.type === 'category') goSearch(gItem.name);
                  else playTrack(gItem, recentlyPlayedItems);
                }}
                className={`w-[48%] h-14 ${isDark ? 'bg-zinc-900/80' : 'bg-white'} rounded-md overflow-hidden m-1 flex-row items-center shadow-sm`}
              >
                {gItem.id === 'liked-songs' ? (
                  <LinearGradient colors={['#450eff', '#89d7fb']} className="w-14 h-14 items-center justify-center">
                    <Text className="text-white text-xl">♥</Text>
                  </LinearGradient>
                ) : (
                  <View className={`w-14 h-14 ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
                    <MusicImage images={getImageUrl(gItem)} className="w-full h-full" />
                  </View>
                )}
                <Text className={`ml-3 flex-1 font-bold text-xs ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={2}>
                  {gItem.name || gItem.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }
    if (item.type === 'section') return renderSection(item);
    return null;
  }, [isDark, currentGreeting, gridItems, goSearch, goSong, playTrack, recentlyPlayedItems, renderSection, router]);

  const renderFilterChips = () => (
    <View className="flex-row px-5 mb-6">
      {['All', 'Music'].map(f => (
        <TouchableOpacity
          key={f}
          onPress={() => setActiveFilter(f)}
          className={`px-6 py-2.5 rounded-full mr-2.5 ${activeFilter === f ? 'bg-emerald-500' : isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}
        >
          <Text className={`font-bold text-sm ${activeFilter === f ? 'text-black' : isDark ? 'text-zinc-400' : 'text-slate-600'}`}>{f}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderHeader = () => (
    <View className="pt-16">
      <View className="px-5 flex-row items-center justify-between mb-4">
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <View className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 items-center justify-center">
            {user?.user_metadata?.avatar_url
              ? <ExpoImage source={{ uri: user.user_metadata.avatar_url }} className="w-full h-full" />
              : <Text className="text-white font-bold">{user?.user_metadata?.full_name?.[0] || 'U'}</Text>
            }
          </View>
        </TouchableOpacity>
      </View>
      {renderFilterChips()}
    </View>
  );

  // ── Music tab ─────────────────────────────────────────────────────────────

  if (activeFilter === 'Music') {
    const data = infiniteSongs.data?.pages.flatMap((p: any) => p) || [];
    return (
      <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'}`}>
        <FlatList
          data={data}
          keyExtractor={(item, i) => `${item.id}-${i}`}
          renderItem={({ item }) => (
            <SongListItem item={item} onPress={() => goSong(item.id)} onMore={() => setSelectedSongForMenu(item)} isDark={isDark} />
          )}
          ListHeaderComponent={() => (
            <>
              {renderHeader()}
              <View className="mb-8">
                <SectionHeader title="Your Artists" isDark={isDark} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
                  {topArtists.slice(0, 4).map((artist: string, i: number) => (
                    <SongCard
                      key={i}
                      item={{ name: artist, image: [{ url: `https://ui-avatars.com/api/?name=${artist}&background=10b981&color=fff` }] }}
                      onPress={() => goSearch(artist)}
                      isDark={isDark}
                      type="circle"
                    />
                  ))}
                </ScrollView>
              </View>
              <View className="px-5 mb-4">
                <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Popular Tracks</Text>
              </View>
            </>
          )}
          onEndReached={() => infiniteSongs.hasNextPage && infiniteSongs.fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() =>
            infiniteSongs.isFetchingNextPage
              ? <ActivityIndicator size="small" color="#10b981" className="py-4" />
              : <View className="h-32" />
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" colors={['#10b981']} />}
        />
        <SongMenu isVisible={!!selectedSongForMenu} onClose={() => setSelectedSongForMenu(null)} song={selectedSongForMenu} userId={user?.id} />
      </View>
    );
  }

  // ── All tab ───────────────────────────────────────────────────────────────

  return (
    <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'}`}>
      <FlatList
        data={allViewData}
        renderItem={renderAllItem}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={<View className="h-32" />}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={8}
        removeClippedSubviews={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" colors={['#10b981']} />}
      />
      <SongMenu isVisible={!!selectedSongForMenu} onClose={() => setSelectedSongForMenu(null)} song={selectedSongForMenu} userId={user?.id} />
    </View>
  );
}
