import { useAuth } from '@/components/AuthContext';
import GlassCard from '@/components/GlassCard';
import { MusicImage } from '@/components/MusicImage';
import { Shimmer } from '@/components/Shimmer';
import SongMenu from '@/components/SongMenu';
import { useHistoryStore } from '@/hooks/useHistoryStore';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import {
  useArtistSongs,
  useEnglishHits,
  useFeaturedPlaylists,
  useInfinitePodcasts,
  useInfiniteSongs,
  useLikedRecommendations,
  useMoodMusic,
  useMovieAlbums,
  useMusicCategory,
  useNewReleases,
  useRetroTelugu,
  useSmartAlbums,
  useSmartRecommendations,
  useTrending
} from '@/hooks/useMusic';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { jioSaavnService } from '@/services/jiosaavn';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { MoreVertical } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

const SectionHeader = memo(({ title, onSeeAll, isDark }: { title: string; onSeeAll?: () => void; isDark: boolean }) => (
  <View className="flex-row justify-between items-center mb-4 px-5">
    <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} `}>{title || "Untitled Section"}</Text>
    {onSeeAll && (
      <TouchableOpacity onPress={onSeeAll}>
        <Text className="text-emerald-500 font-medium">See all</Text>
      </TouchableOpacity>
    )}
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

const SectionShimmer = memo(({ title, isDark, type = 'square' }: { title: string; isDark: boolean; type?: string }) => (
  <View className="mb-8">
    <View className="px-5 mb-4">
      <Shimmer width={150} height={24} borderRadius={4} />
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

const SongCard = memo(({ item, onPress, isDark, type = 'square' }: { item: any; onPress: () => void; isDark: boolean; type?: 'square' | 'circle' | 'rectangle' }) => {
  const imageUrl = getImageUrl(item);

  if (type === 'rectangle') {
    return (
      <TouchableOpacity onPress={onPress} className="mr-4 mb-4">
        <View
          style={{ width: 180, height: 110 }}
          className={`rounded-xl overflow-hidden relative ${isDark ? 'bg-zinc-900' : 'bg-slate-200'}`}
        >
          <MusicImage
            images={imageUrl}
            className="w-full h-full"
          />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} className="absolute inset-0 justify-end p-2 pb-3">
            <Text className="text-white text-sm font-bold" numberOfLines={1}>{item?.name || item?.title || "Unknown"}</Text>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} className="mr-5 nest-ignore">
      <View style={{ width: type === 'circle' ? 110 : 140 }}>
        <View
          className={`${type === 'circle' ? 'w-24 h-24 rounded-full' : 'w-full h-36 rounded-2xl'} mb-2 shadow-sm overflow-hidden ${isDark ? 'bg-zinc-900' : 'bg-slate-200'}`}
        >
          <MusicImage
            images={imageUrl}
            className="w-full h-full"
          />
        </View>
        <Text className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'} `} numberOfLines={1}>
          {item?.name || item?.title || "Unknown"}
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

const SongListItem = memo(({ item, onPress, onMore, isDark }: { item: any; onPress: () => void; onMore: () => void; isDark: boolean }) => {
  const imageUrl = getImageUrl(item);

  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center px-5 py-3 mb-2 ${isDark ? 'bg-zinc-900/40' : 'bg-white'} rounded-2xl mx-5 border border-white/5`}
    >
      <View
        className={`w-14 h-14 rounded-xl mr-4 overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`}
      >
        <MusicImage
          images={imageUrl}
          className="w-full h-full"
        />
      </View>
      <View className="flex-1">
        <Text className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`} numberOfLines={1}>
          {item?.name || item?.title || "Unknown Track"}
        </Text>
        <Text className="text-zinc-500 text-sm" numberOfLines={1}>
          {item?.artists?.primary?.[0]?.name || item?.artist || "Unknown Artist"}
        </Text>
      </View>
      <TouchableOpacity 
        onPress={onMore} 
        className={`p-2 rounded-full ${isDark ? 'bg-white/5' : 'bg-black/5'}`}
      >
        <MoreVertical size={20} color={isDark ? "#71717a" : "#94a3b8"} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { fetchLibrary, likedSongs = [] } = useLibraryStore();
  const { theme, audioQuality } = useSettingsStore();
  const { playTrack } = usePlayerStore();
  const { recentlyPlayedItems = [], recentKeywords: searchHistory = [] } = useHistoryStore();
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedSongForMenu, setSelectedSongForMenu] = useState<any>(null);
  const isDark = theme === 'dark';

  const quickAccessData = useMemo(() => {
    if (recentlyPlayedItems.length > 0) {
        return recentlyPlayedItems.slice(0, 8);
    }
    // Fallback to top categories if no history
    return [
        { id: 'trending', name: 'Trending', type: 'category' },
        { id: 'english', name: 'English', type: 'category' },
        { id: 'hindi', name: 'Hindi', type: 'category' },
        { id: 'telugu', name: 'Telugu', type: 'category' }
    ];
  }, [recentlyPlayedItems]);

  const handleSongPress = useCallback((id: string) => {
    router.push(`/song/${id}` as any);
  }, [router]);

  const handleSearchPress = useCallback((query: string) => {
    router.push({ pathname: '/search', params: { q: query } });
  }, [router]);

  // Data Queries
  const trendingQuery = useTrending();
  const trending = trendingQuery.data || [];

  const newReleasesQuery = useNewReleases();
  const newReleases = newReleasesQuery.data || [];

  const smartRecommendationsQuery = useSmartRecommendations(searchHistory);
  const smartRecommendations = smartRecommendationsQuery.data || [];

  const smartAlbumsQuery = useSmartAlbums(searchHistory);
  const smartAlbums = smartAlbumsQuery.data || [];

  const artistSongsQuery = useArtistSongs('Devi Sri Prasad');
  const artistSongs = artistSongsQuery.data || [];

  const featuredPlaylistsQuery = useFeaturedPlaylists();
  const featuredPlaylists = featuredPlaylistsQuery.data || [];

  const englishHitsQuery = useEnglishHits();
  const englishHits = englishHitsQuery.data || [];

  const arRahmanHitsQuery = useMusicCategory('AR Rahman', 'A.R. Rahman telugu hindi hits');
  const arRahmanHits = arRahmanHitsQuery.data || [];

  const taylorSwiftHitsQuery = useMusicCategory('Taylor Swift', 'Taylor Swift pop hits', 'english');
  const taylorSwiftHits = taylorSwiftHitsQuery.data || [];

  const romanticSongsQuery = useMoodMusic('romantic');
  const romanticSongs = romanticSongsQuery.data || [];

  const happySongsQuery = useMoodMusic('happy');
  const happySongs = happySongsQuery.data || [];

  const singlesSongsQuery = useMoodMusic('singles');
  const singlesSongs = singlesSongsQuery.data || [];

  const movieAlbumsQuery = useMovieAlbums();
  const movieAlbums = movieAlbumsQuery.data || [];

  const retroTeluguQuery = useRetroTelugu();
  const retroTelugu = retroTeluguQuery.data || [];

  const lastLikedSong = likedSongs[0];
  const likedRecommendationsQuery = useLikedRecommendations(lastLikedSong?.id || null);
  const likedRecommendations = likedRecommendationsQuery.data || [];

  // "Music" & "Podcasts" View Data (Infinite)
  const infiniteSongs = useInfiniteSongs('trending telugu songs 2024');
  const infinitePodcasts = useInfinitePodcasts();

  useEffect(() => {
    if (user) fetchLibrary(user.id);
  }, [user]);

  // Pre-fetch trending artwork
  useEffect(() => {
    if (trending.length > 0) {
      const topTrending = trending.slice(0, 10);
      topTrending.forEach(item => {
        const url = getImageUrl(item);
        if (url) {
          const sanitized = jioSaavnService.sanitizeImageUrl(url);
          if (sanitized) ExpoImage.prefetch([sanitized]);
        }
      });
    }
  }, [trending]);

  const currentGreeting = useMemo(() => {
    const hrs = new Date().getHours();
    if (hrs >= 5 && hrs < 12) return "Good Morning";
    if (hrs >= 12 && hrs < 17) return "Good Afternoon";
    if (hrs >= 17 && hrs < 22) return "Good Evening";
    return "Good Night";
  }, []);

  const gridItems = useMemo(() => {
    const items = [
      { id: 'liked-songs', name: 'Liked Songs' },
      ...recentlyPlayedItems
    ];
    return items.slice(0, 6);
  }, [recentlyPlayedItems]);

  const allViewData = useMemo(() => [
    { type: 'quick_access', id: 'quick_access' },
    { type: 'section', id: 'trending', title: 'Trending Now', data: trending, isLoading: trendingQuery.isLoading },
    { type: 'section', id: 'liked_recommendations', title: 'Recommended for You', data: likedRecommendations, enabled: likedRecommendations.length > 0 || likedRecommendationsQuery.isLoading, isLoading: likedRecommendationsQuery.isLoading },
    { type: 'section', id: 'new_releases', title: 'New Releases', data: newReleases, isLoading: newReleasesQuery.isLoading },
    { type: 'section', id: 'smart_recommendations', title: 'Based on your Search', data: smartRecommendations, enabled: smartRecommendations.length > 0 || smartRecommendationsQuery.isLoading, isLoading: smartRecommendationsQuery.isLoading },
    { type: 'section', id: 'artist_songs', title: 'Top Hits by DSP', data: artistSongs, isLoading: artistSongsQuery.isLoading },
    { type: 'section', id: 'featured_playlists', title: 'Popular Playlists', data: featuredPlaylists, isLoading: featuredPlaylistsQuery.isLoading },
    { type: 'section', id: 'movie_albums', title: 'New Movie Albums', data: movieAlbums, isLoading: movieAlbumsQuery.isLoading },
    { type: 'section', id: 'english_hits', title: 'English Pop Hits', data: englishHits, isLoading: englishHitsQuery.isLoading },
    { type: 'section', id: 'ar_rahman', title: 'A.R. Rahman Hits', data: arRahmanHits, isLoading: arRahmanHitsQuery.isLoading },
    { type: 'section', id: 'taylor_swift', title: 'Taylor Swift Collection', data: taylorSwiftHits, isLoading: taylorSwiftHitsQuery.isLoading },
    { type: 'section', id: 'romantic', title: 'Romantic Hits', data: romanticSongs, isLoading: romanticSongsQuery.isLoading },
    { type: 'section', id: 'retro', title: 'Retro Classics', data: retroTelugu, isLoading: retroTeluguQuery.isLoading },
    { type: 'section', id: 'happy', title: 'Happy Vibes', data: happySongs, isLoading: happySongsQuery.isLoading },
    { type: 'section', id: 'singles', title: 'Latest Singles', data: singlesSongs, isLoading: singlesSongsQuery.isLoading },
  ].filter(s => s.enabled !== false), [
    trending, trendingQuery.isLoading,
    likedRecommendations, likedRecommendationsQuery.isLoading,
    newReleases, newReleasesQuery.isLoading,
    smartRecommendations, smartRecommendationsQuery.isLoading,
    artistSongs, artistSongsQuery.isLoading,
    featuredPlaylists, featuredPlaylistsQuery.isLoading,
    movieAlbums, movieAlbumsQuery.isLoading,
    englishHits, englishHitsQuery.isLoading,
    arRahmanHits, arRahmanHitsQuery.isLoading,
    taylorSwiftHits, taylorSwiftHitsQuery.isLoading,
    romanticSongs, romanticSongsQuery.isLoading,
    retroTelugu, retroTeluguQuery.isLoading,
    happySongs, happySongsQuery.isLoading,
    singlesSongs, singlesSongsQuery.isLoading
  ]);

  const HorizontalSection = memo(({ title, data, isDark, type = 'square' }: any) => (
    <View className="mb-8">
      <SectionHeader title={title} isDark={isDark} />
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={(item, index) => `${item.id || item.name || index}`}
        renderItem={({ item }) => (
          <SongCard
            item={item}
            onPress={() => item.type === 'album' ? router.push(`/album/${item.id}` as any) : item.type === 'playlist' ? router.push(`/saavn-playlist/${item.id}` as any) : handleSongPress(item.id)}
            isDark={isDark}
            type={type}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        removeClippedSubviews={true}
      />
    </View>
  ));

  const QuickAccess = memo(() => (
    <View className="flex-row flex-wrap justify-between mb-8">
      {quickAccessData.map((item, index) => (
        <TouchableOpacity
          key={item.id}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (item.type === 'category') {
                handleSearchPress(item.name);
            } else {
                playTrack(item, recentlyPlayedItems);
            }
          }}
          className={`w-[48%] h-14 mb-3 rounded-lg flex-row items-center overflow-hidden ${isDark ? 'bg-zinc-900/40' : 'bg-slate-200/50'}`}
        >
          <MusicImage
            images={item.image || item.artwork || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'M')}&background=random`}
            className="w-14 h-14"
          />
          <Text className={`flex-1 px-3 py-1 font-bold text-[13px] ${isDark ? 'text-white' : 'text-slate-900'}`} numberOfLines={2}>
            {item.name || item.title || "Unknown"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  ));

  const renderFilterChips = () => (
    <View className="flex-row px-5 mb-6">
      {['All', 'Music', 'Podcasts'].map((filter) => (
        <TouchableOpacity
          key={filter}
          onPress={() => setActiveFilter(filter)}
          className={`px-6 py-2.5 rounded-full mr-2.5 ${activeFilter === filter ? 'bg-emerald-500' : isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}
        >
          <Text className={`font-bold text-sm ${activeFilter === filter ? 'text-black' : isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
            {filter}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderHeader = () => (
    <View className="pt-16">
      <View className="px-5 flex-row items-center justify-between mb-4">
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <View className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 items-center justify-center">
            {user?.user_metadata?.avatar_url ? (
              <ExpoImage source={{ uri: user.user_metadata.avatar_url }} className="w-full h-full" />
            ) : (
              <Text className="text-white font-bold">{user?.user_metadata?.full_name?.[0] || 'U'}</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
      {renderFilterChips()}
    </View>
  );

  const renderAllItem = useCallback(({ item }: any) => {
    switch (item.type) {
      case 'quick_access':
        return (
          <View className="px-5 mb-8">
            <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-4`}>{currentGreeting}</Text>
            <View className="flex-row flex-wrap -m-1">
              {gridItems.map((gItem: any) => (
                <TouchableOpacity
                  key={gItem.id}
                  onPress={() => gItem.id === 'liked-songs' ? router.push('/liked-songs') : handleSongPress(gItem.id)}
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
      case 'section':
        if (item.isLoading) {
          return <SectionShimmer title={item.title} isDark={isDark} type={item.id === 'movie_albums' || item.id === 'featured_playlists' ? 'rectangle' : 'square'} />;
        }
        if (!item.data || item.data.length === 0) return null;
        return (
          <HorizontalSection
            title={item.title}
            data={item.data}
            isDark={isDark}
            type={item.id === 'movie_albums' || item.id === 'featured_playlists' ? 'rectangle' : 'square'}
          />
        );
      default:
        return null;
    }
  }, [isDark, currentGreeting, gridItems, handleSongPress, router]);

  const renderMusicHeader = () => (
    <View>
      <View className="mb-8">
        <SectionHeader title="Featured Artists" isDark={isDark} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
          {['Devi Sri Prasad', 'Anirudh Ravichander', 'S. Thaman', 'Sid Sriram'].map((artist: string, index: number) => (
            <SongCard
              key={index}
              item={{ name: artist, image: [{ url: `https://ui-avatars.com/api/?name=${artist}&background=10b981&color=fff` }] }}
              onPress={() => handleSearchPress(artist)}
              isDark={isDark}
              type="circle"
            />
          ))}
        </ScrollView>
      </View>
      <View className="px-5 mb-4">
        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Popular Tracks</Text>
      </View>
    </View>
  );

  const renderPodcastHeader = () => (
    <View>
      <View className="px-5 mb-6">
        <GlassCard intensity={20}>
          <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-1`}>Explore Podcasts</Text>
          <Text className="text-zinc-500 text-sm">Discover stories and insights from around the world.</Text>
        </GlassCard>
      </View>
      <View className="px-5 mb-4">
        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Recent Episodes</Text>
      </View>
    </View>
  );

  if (activeFilter === 'Music') {
    const data = infiniteSongs.data?.pages.flatMap(page => page) || [];
    return (
      <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'}`}>
        <FlatList
          data={data}
          keyExtractor={(item, index) => item.id + index}
          renderItem={({ item }) => (
            <SongListItem 
               item={item} 
               onPress={() => handleSongPress(item.id)} 
               onMore={() => setSelectedSongForMenu(item)}
               isDark={isDark} 
            />
          )}
          ListHeaderComponent={() => (
            <>
              {renderHeader()}
              {renderMusicHeader()}
            </>
          )}
          onEndReached={() => infiniteSongs.hasNextPage && infiniteSongs.fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() => (
            infiniteSongs.isFetchingNextPage ? <ActivityIndicator size="small" color="#10b981" className="py-4" /> : <View className="h-32" />
          )}
        />
      </View>
    );
  }

  if (activeFilter === 'Podcasts') {
    const data = infinitePodcasts.data?.pages.flatMap(page => page) || [];
    return (
      <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'}`}>
        <FlatList
          data={data}
          keyExtractor={(item, index) => item.id + index}
          renderItem={({ item }) => (
            <SongListItem 
               item={item} 
               onPress={() => handleSongPress(item.id)} 
               onMore={() => setSelectedSongForMenu(item)}
               isDark={isDark} 
            />
          )}
          ListHeaderComponent={() => (
            <>
              {renderHeader()}
              {renderPodcastHeader()}
            </>
          )}
          onEndReached={() => infinitePodcasts.hasNextPage && infinitePodcasts.fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() => (
            infinitePodcasts.isFetchingNextPage ? <ActivityIndicator size="small" color="#10b981" className="py-4" /> : <View className="h-32" />
          )}
        />
      </View>
    );
  }

  return (
    <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'}`}>
      <FlatList
        data={allViewData}
        renderItem={renderAllItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={<View className="h-32" />}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews={true}
      />
      <SongMenu 
        isVisible={!!selectedSongForMenu} 
        onClose={() => setSelectedSongForMenu(null)} 
        song={selectedSongForMenu}
        userId={user?.id}
      />
    </View>
  );
}
