import { useAuth } from '@/components/AuthContext';
import GlassCard from '@/components/GlassCard';
import { MusicImage } from '@/components/MusicImage';
import { Shimmer } from '@/components/Shimmer';
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
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { jioSaavnService } from '@/services/jiosaavn';
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
    <TouchableOpacity onPress={onPress} className="mr-5">
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

const SongListItem = memo(({ item, onPress, isDark }: { item: any; onPress: () => void; isDark: boolean }) => {
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
      <TouchableOpacity className="p-2">
        <MoreVertical size={20} color={isDark ? '#71717a' : '#64748b'} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { fetchLibrary, likedSongs = [] } = useLibraryStore();
  const { theme } = useSettingsStore();
  const { recentlyPlayedItems = [] } = useHistoryStore();
  const [activeFilter, setActiveFilter] = useState('All');
  const isDark = theme === 'dark';

  const handleSongPress = useCallback((id: string) => {
    router.push(`/song/${id}` as any);
  }, [router]);

  const handleSearchPress = useCallback((query: string) => {
    router.push({ pathname: '/search', params: { q: query } });
  }, [router]);

  // "All" View Data
  const { recentKeywords: searchHistory = [] } = useHistoryStore();

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

  // "Music" View Data (Infinite)
  const infiniteSongs = useInfiniteSongs('trending telugu songs 2024');

  // "Podcasts" View Data (Infinite)
  const infinitePodcasts = useInfinitePodcasts();

  useEffect(() => {
    const runDiagnostics = async () => {
      console.log("[Diagnostics]: Starting startup connectivity check...");
      const isOnline = await jioSaavnService.checkConnectivity();
      if (!isOnline) {
        console.warn("[Diagnostics]: App started without internet reachability to google.com");
      } else {
        console.log("[Diagnostics]: Internet reachability confirmed.");
      }
    };
    runDiagnostics();
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
      { id: 'liked-songs', name: 'Liked Songs', type: 'special' },
      ...recentlyPlayedItems
    ];
    return items.slice(0, 6);
  }, [recentlyPlayedItems]);

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

  const renderSkeleton = () => (
    <View className="px-5">
      <View className="mb-8">
        <Shimmer width={200} height={24} className="mb-4" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[1, 2, 3].map((i) => (
            <View key={i} className="mr-4">
              <Shimmer width={140} height={140} borderRadius={12} className="mb-2" />
              <Shimmer width={100} height={16} className="mb-1" />
              <Shimmer width={80} height={12} />
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  const renderHeader = () => (
    <View className="pt-16">
      <View className="px-5 flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.push('/settings')} className="mr-3">
            <View className="w-9 h-9 rounded-full overflow-hidden">
              {user?.user_metadata?.avatar_url ? (
                <ExpoImage
                  source={{ uri: user.user_metadata.avatar_url }}
                  className="w-full h-full"
                />
              ) : (
                <View className="w-full h-full bg-pink-500 items-center justify-center">
                  <Text className="text-white font-bold text-lg">{user?.user_metadata?.full_name?.[0] || 'U'}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
      {renderFilterChips()}
    </View>
  );

  const renderAllView = () => (
    <View>
      {/* Greeting and Quick Access Grid */}
      <View className="px-5 mb-8">
        <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-4`}>{currentGreeting}</Text>
        <View className="flex-row flex-wrap -m-1">
          {gridItems.map((item: any) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => item.id === 'liked-songs' ? router.push('/liked-songs') : handleSongPress(item.id)}
              className={`w-[48%] h-14 ${isDark ? 'bg-zinc-900/80' : 'bg-white'} rounded-md overflow-hidden m-1 flex-row items-center shadow-sm`}
            >
              {item.id === 'liked-songs' ? (
                <LinearGradient colors={['#450eff', '#89d7fb']} className="w-14 h-14 items-center justify-center">
                  <Text className="text-white text-xl">♥</Text>
                </LinearGradient>
              ) : (
                <View className={`w-14 h-14 ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
                  <MusicImage
                    images={getImageUrl(item)}
                    className="w-full h-full"
                  />
                </View>
              )}
              <Text className={`flex-1 px-2 text-[11px] font-bold ${isDark ? 'text-white' : 'text-slate-900'}`} numberOfLines={2}>
                {item?.name || item?.title || "Unknown"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Music Sections */}
      {likedSongs.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="Your Liked Songs" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {likedSongs.map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => handleSongPress(item.id)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}

      {lastLikedSong && (likedRecommendationsQuery.isLoading ? renderSkeleton() : likedRecommendations.length > 0 && (
        <View className="mb-8">
          <SectionHeader title={`Because you liked ${lastLikedSong.name}`} isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {likedRecommendations.map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => handleSongPress(item.id)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      ))}

      {smartRecommendationsQuery.isLoading ? renderSkeleton() : smartRecommendations.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="Top Telugu Hits for You" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {smartRecommendations.map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => handleSongPress(item.id)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}


      {smartAlbumsQuery.isLoading ? renderSkeleton() : smartAlbums.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="Recommended Albums for You" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {smartAlbums.slice(0, 10).map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => handleSearchPress(item.name)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}

      {arRahmanHitsQuery.isLoading ? renderSkeleton() : arRahmanHits.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="AR Rahman Classics" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {arRahmanHits.map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => handleSongPress(item.id)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}

      {artistSongsQuery.isLoading ? renderSkeleton() : artistSongs.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="Top Hits of Devi Sri Prasad" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {artistSongs.map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => handleSongPress(item.id)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}

      {featuredPlaylistsQuery.isLoading ? renderSkeleton() : featuredPlaylists.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="Telugu Popular" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {featuredPlaylists.map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => handleSearchPress(item.name)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}

      {newReleasesQuery.isLoading ? renderSkeleton() : newReleases.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="New Telugu Releases" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {newReleases.map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => handleSongPress(item.id)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}

      {englishHitsQuery.isLoading ? renderSkeleton() : englishHits.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="Top English Pop" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {englishHits.slice(0, 10).map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => handleSongPress(item.id)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}

      {trendingQuery.isLoading ? renderSkeleton() : trending.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="Trending in Telugu" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {trending.slice(0, 10).map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => handleSongPress(item.id)} isDark={isDark} type="rectangle" />
            ))}
          </ScrollView>
        </View>
      )}

      {taylorSwiftHitsQuery.isLoading ? renderSkeleton() : taylorSwiftHits.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="Taylor Swift Special" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {taylorSwiftHits.map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => handleSongPress(item.id)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}

      {romanticSongsQuery.isLoading ? renderSkeleton() : romanticSongs.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="Romantic Telugu Melodies" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {romanticSongs.map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => handleSongPress(item.id)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}

      {happySongsQuery.isLoading ? renderSkeleton() : happySongs.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="Happy Telugu Vibes" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {happySongs.map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => handleSongPress(item.id)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}

      {retroTeluguQuery.isLoading ? renderSkeleton() : retroTelugu.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="Retro Telugu Golden Hits" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {retroTelugu.map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => handleSongPress(item.id)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}

      {singlesSongsQuery.isLoading ? renderSkeleton() : singlesSongs.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="Singles & Latest Hits" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {singlesSongs.map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => handleSongPress(item.id)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}

      {movieAlbumsQuery.isLoading ? renderSkeleton() : movieAlbums.length > 0 && (
        <View className="mb-12">
          <SectionHeader title="Latest Telugu Movie Albums" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {movieAlbums.map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => handleSearchPress(item.name)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const renderMusicHeader = () => (
    <View>
      {/* Quick Access sections repeated or specifically music focused */}
      {smartRecommendationsQuery.isLoading ? renderSkeleton() : smartRecommendations.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="Top Telugu Hits for You" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {smartRecommendations.map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => router.push(`/song/${item.id}` as any)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}

      {smartAlbumsQuery.isLoading ? renderSkeleton() : smartAlbums.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="Top Albums" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {smartAlbums.slice(0, 8).map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => router.push({ pathname: '/search', params: { q: item.name } })} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}

      <View className="mb-8">
        <SectionHeader title="Featured Artists" isDark={isDark} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
          {['Devi Sri Prasad', 'Anirudh Ravichander', 'S. Thaman', 'Sid Sriram'].map((artist: string, index: number) => (
            <SongCard
              key={index}
              item={{ name: artist, image: [{ url: `https://ui-avatars.com/api/?name=${artist}&background=10b981&color=fff` }] }}
              onPress={() => router.push({ pathname: '/search', params: { q: artist } })}
              isDark={isDark}
              type="circle"
            />
          ))}
        </ScrollView>
      </View>

      {newReleasesQuery.isLoading ? renderSkeleton() : newReleases.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="New Telugu Releases" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {newReleases.map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => router.push(`/song/${item.id}` as any)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}

      {trendingQuery.isLoading ? renderSkeleton() : trending.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="Trending in Telugu" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {trending.slice(0, 10).map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => router.push(`/song/${item.id}` as any)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}

      {romanticSongsQuery.isLoading ? renderSkeleton() : romanticSongs.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="Romantic Telugu Melodies" isDark={isDark} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {romanticSongs.map((item: any, index: number) => (
              <SongCard key={item?.id || index} item={item} onPress={() => router.push(`/song/${item.id}` as any)} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      )}

      <View className="px-5 mb-4">
        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Popular Songs</Text>
      </View>
    </View>
  );

  const renderPodcastHeader = () => {
    const firstPage = infinitePodcasts.data?.pages?.[0] || [];
    return (
      <View>
        <View className="px-5 mb-6">
          <GlassCard intensity={20}>
            <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-1`}>Explore Podcasts</Text>
            <Text className="text-zinc-500 text-sm">Discover stories, news, and more from around the world.</Text>
          </GlassCard>
        </View>

        {firstPage.length > 0 && (
          <View className="mb-8">
            <SectionHeader title="Trending Podcasts" isDark={isDark} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
              {firstPage.slice(0, 10).map((item: any, index: number) => (
                <SongCard key={item?.id || index} item={item} onPress={() => router.push(`/song/${item.id}` as any)} isDark={isDark} type="rectangle" />
              ))}
            </ScrollView>
          </View>
        )}

        {firstPage.length > 10 && (
          <View className="mb-8">
            <SectionHeader title="Featured Shows" isDark={isDark} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
              {firstPage.slice(10, 20).map((item: any, index: number) => (
                <SongCard key={item?.id || index} item={item} onPress={() => router.push(`/song/${item.id}` as any)} isDark={isDark} />
              ))}
            </ScrollView>
          </View>
        )}

        <View className="px-5 mb-4">
          <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Popular Episodes</Text>
        </View>
      </View>
    );
  };

  if (activeFilter === 'Music') {
    const data = infiniteSongs.data?.pages.flatMap(page => page) || [];
    return (
      <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'}`}>
        <FlatList
          data={data}
          keyExtractor={(item, index) => item.id + index}
          renderItem={({ item }: { item: any }) => <SongListItem item={item} onPress={() => handleSongPress(item.id)} isDark={isDark} />}
          ListHeaderComponent={() => (
            <>
              {renderHeader()}
              {renderMusicHeader()}
            </>
          )}
          onEndReached={() => infiniteSongs.hasNextPage && infiniteSongs.fetchNextPage()}
          onEndReachedThreshold={0.5}
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
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
          renderItem={({ item }: { item: any }) => <SongListItem item={item} onPress={() => handleSongPress(item.id)} isDark={isDark} />}
          ListHeaderComponent={() => (
            <>
              {renderHeader()}
              {renderPodcastHeader()}
            </>
          )}
          onEndReached={() => infinitePodcasts.hasNextPage && infinitePodcasts.fetchNextPage()}
          onEndReachedThreshold={0.5}
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          ListFooterComponent={() => (
            infinitePodcasts.isFetchingNextPage ? <ActivityIndicator size="small" color="#10b981" className="py-4" /> : <View className="h-32" />
          )}
        />
      </View>
    );
  }

  return (
    <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'}`}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {renderHeader()}
        {renderAllView()}
      </ScrollView>
    </View>
  );
}
