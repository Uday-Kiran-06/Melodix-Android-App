import { useAuth } from '@/components/AuthContext';
import { MusicImage } from '@/components/MusicImage';
import { Shimmer } from '@/components/Shimmer';
import SongMenu from '@/components/SongMenu';
import { DesignSystem } from '@/constants/DesignSystem';
import { useHistoryStore } from '@/hooks/useHistoryStore';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useSearch, useSearchAlbums, useSearchPlaylists } from '@/hooks/useMusic';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { jioSaavnService } from '@/services/jiosaavn';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CheckCircle2, MoreVertical, Play, Plus, Search as SearchIcon, X, TrendingUp, Users, Sparkles } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import { EmptyState } from '@/components/EmptyState';

const AnyFlashList = FlashList as any;

const { width } = Dimensions.get('window');

const SongItem = memo(({ item, onPlay, onToggleLike, onMore, isDark, results }: any) => {
  const isLiked = useLibraryStore(state => state.likedSongs.some((s: any) => String(s.id) === String(item.id)));

  return (
    <View className="mb-2 flex-row items-center">
      <TouchableOpacity 
        onPress={() => {
          Haptics.selectionAsync();
          onPlay?.(item, results);
        }} 
        className="flex-1 flex-row items-center"
      >
        <MusicImage
          images={item.image}
          className="w-12 h-12 rounded-lg mr-4"
        />
        <View className="flex-1">
          <Text className={`${isDark ? 'text-white' : 'text-slate-800'} font-semibold`} numberOfLines={1}>{item.name}</Text>
          <Text className="text-gray-400 text-sm" numberOfLines={1}>{item.artists?.primary?.[0]?.name || item.artist}</Text>
        </View>
        <Play size={20} color={DesignSystem.colors.primary} fill={DesignSystem.colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity 
        onPress={() => {
          Haptics.selectionAsync();
          onToggleLike?.(item);
        }} 
        className="p-2 ml-2"
      >
        {isLiked ? (
          <CheckCircle2 size={24} color={DesignSystem.colors.primary} />
        ) : (
          <Plus size={24} color={isDark ? DesignSystem.colors.textDimmed : "#94a3b8"} />
        )}
      </TouchableOpacity>
      <TouchableOpacity 
        onPress={onMore} 
        className={`p-2 rounded-full ${isDark ? 'bg-white/5' : 'bg-black/5'}`}
      >
        <MoreVertical size={20} color={isDark ? "#71717a" : "#94a3b8"} />
      </TouchableOpacity>
    </View>
  );
});

const AlbumItem = memo(({ item, onPress, isDark }: any) => (
  <TouchableOpacity
    className="mb-4 w-[48%]"
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }}
  >
    <MusicImage
      images={item.image}
      className="w-full aspect-square rounded-lg mb-2"
    />
    <Text className={`${isDark ? 'text-white' : 'text-slate-800'} font-bold text-sm`} numberOfLines={1}>{item.name}</Text>
    <Text className="text-gray-400 text-xs" numberOfLines={1}>{item.artists?.primary?.[0]?.name}</Text>
  </TouchableOpacity>
));

const PlaylistItem = memo(({ item, onPress, isDark }: any) => (
  <TouchableOpacity
    className="mb-4 w-[48%]"
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }}
  >
    <MusicImage
      images={item.image}
      className="w-full aspect-square rounded-lg mb-2"
    />
    <Text className={`${isDark ? 'text-white' : 'text-slate-800'} font-bold text-sm`} numberOfLines={1}>{item.name}</Text>
  </TouchableOpacity>
));

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(q || '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [isFocused, setIsFocused] = useState(false);

  const { data: songs, isLoading: songsLoading } = useSearch(debouncedQuery);
  const { data: albums, isLoading: albumsLoading } = useSearchAlbums(debouncedQuery);
  const { data: playlists, isLoading: playlistsLoading } = useSearchPlaylists(debouncedQuery);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);

    return () => clearTimeout(handler);
  }, [query]);

  const { playTrack } = usePlayerStore();
  const toggleLike = useLibraryStore(state => state.toggleLike);
  const { user } = useAuth();
  const { audioQuality, theme } = useSettingsStore();
  const { recentlyPlayedTracks, clearRecentlyPlayed, addSearchQuery, searchHistory, removeSearchQuery, clearSearchHistory, removeItemFromHistory } = useHistoryStore();
  const router = useRouter();
  const isDark = theme === 'dark';
  const primaryColor = DesignSystem.colors.primary;

  const handleSongPress = useCallback((item: any, results: any[] | undefined) => {
    const { likedSongs, playlists } = useLibraryStore.getState();

    // Priority 1: Check Liked Songs
    if (likedSongs.some((s: any) => String(s.id) === String(item.id))) {
      playTrack(item, likedSongs);
      return;
    }

    // Priority 2: Check Custom Playlists
    for (const playlist of playlists) {
      if (playlist.songs && playlist.songs.some((s: any) => String(s.song_data?.id) === String(item.id))) {
        const playlistTracks = playlist.songs.map((s: any) => s.song_data);
        playTrack(item, playlistTracks);
        return;
      }
    }

    // Default Fallback
    playTrack(item, results || []);
  }, [playTrack, audioQuality]);

  const handleToggleLike = useCallback((item: any) => {
    toggleLike(item, user?.id);
  }, [toggleLike, user?.id]);

  const handleSearchNavigation = useCallback((q: string) => {
    const decodedQ = jioSaavnService.decodeHtml(q);
    setQuery(decodedQ);
  }, []);

  useEffect(() => {
    if (q) {
      setQuery(q);
    }
  }, [q]);

  const [showAllSongs, setShowAllSongs] = useState(false);
  const [showAllAlbums, setShowAllAlbums] = useState(false);
  const [showAllPlaylists, setShowAllPlaylists] = useState(false);
  const [selectedSongForMenu, setSelectedSongForMenu] = useState<any>(null);

  const listData = useMemo(() => {
    if (!query) {
      const items: any[] = [];
      
      if (recentlyPlayedTracks.length > 0) {
        const todayItems = recentlyPlayedTracks.filter(t => {
            if (!t.playedAt) return false;
            const today = new Date().setHours(0,0,0,0);
            return t.playedAt >= today;
        });
        const earlierItems = recentlyPlayedTracks.filter(t => !todayItems.includes(t));

        if (todayItems.length > 0) {
            items.push({ type: 'recent-header', title: 'Recently Played (Today)' });
            items.push(...todayItems.map(t => ({ ...t, type: 'recent-song' })));
        }
        if (earlierItems.length > 0) {
            items.push({ type: 'recent-header', title: 'Recently Played (Earlier)' });
            items.push(...earlierItems.map(t => ({ ...t, type: 'recent-song' })));
        }
      }
      
      if (items.length === 0) {
        items.push({ type: 'empty-state' });
      }

      return items;
    }

    if (query !== debouncedQuery) {
        // Show local suggestions while waiting for debounce
        const localMatches = recentlyPlayedTracks.filter(t => {
            const trackName = t.name?.toLowerCase() || '';
            const artistName = (t.artists?.primary?.[0]?.name || t.artist || '').toLowerCase();
            const searchLower = query.toLowerCase();
            return trackName.includes(searchLower) || artistName.includes(searchLower);
        }).slice(0, 5);

        if (localMatches.length > 0) {
            return [{ type: 'suggestion-header' }, ...localMatches.map(s => ({ ...s, type: 'suggestion' }))];
        }
        return [{ type: 'loading' }];
    }

    if (songsLoading || albumsLoading || playlistsLoading) {
      return [{ type: 'loading' }];
    }

    // Check for "No Results" state
    if (debouncedQuery === query && (!songs || songs.length === 0) && (!albums || albums.length === 0) && (!playlists || playlists.length === 0)) {
        return [{ type: 'no-results', query: debouncedQuery }];
    }

    const items: any[] = [];
    if (songs && songs.length > 0) {
      const visibleSongs = showAllSongs ? songs : songs.slice(0, 5);
      items.push({ type: 'section-header', title: 'Songs' });
      items.push(...visibleSongs.map(s => ({ ...s, type: 'song' })));
      if (songs.length > 5) items.push({ type: 'toggle', target: 'songs', expanded: showAllSongs });
    }

    if (albums && albums.length > 0) {
      const visibleAlbums = showAllAlbums ? albums : albums.slice(0, 4);
      items.push({ type: 'section-header', title: 'Albums' });
      // Group albums into pairs for grid-like feel in FlashList
      for (let i = 0; i < visibleAlbums.length; i += 2) {
        items.push({ type: 'album-row', items: visibleAlbums.slice(i, i + 2) });
      }
      if (albums.length > 4) items.push({ type: 'toggle', target: 'albums', expanded: showAllAlbums });
    }

    if (playlists && playlists.length > 0) {
      const visiblePlaylists = showAllPlaylists ? playlists : playlists.slice(0, 4);
      items.push({ type: 'section-header', title: 'Playlists' });
      for (let i = 0; i < visiblePlaylists.length; i += 2) {
        items.push({ type: 'playlist-row', items: visiblePlaylists.slice(i, i + 2) });
      }
      if (playlists.length > 4) items.push({ type: 'toggle', target: 'playlists', expanded: showAllPlaylists });
    }

    return items;
  }, [query, recentlyPlayedTracks, songs, albums, playlists, songsLoading, albumsLoading, playlistsLoading, showAllSongs, showAllAlbums, showAllPlaylists]);

  const renderItem = useCallback(({ item }: any) => {
    switch (item.type) {
      case 'suggestion-header':
         return (
            <View className="flex-row items-center mb-4 mt-2">
                <TrendingUp size={16} color={DesignSystem.colors.primary} className="mr-2" />
                <Text className={`text-sm font-bold ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>Search Suggestions</Text>
            </View>
         );
      case 'suggestion':
         return (
            <TouchableOpacity 
                className="flex-row items-center py-3 border-b border-white/5"
                onPress={() => setQuery(item.name)}
            >
                <SearchIcon size={16} color={isDark ? "#3f3f46" : "#cbd5e1"} className="mr-3" />
                <Text className={`${isDark ? 'text-zinc-300' : 'text-slate-700'} text-base flex-1`} numberOfLines={1}>{item.name}</Text>
            </TouchableOpacity>
         );
      case 'empty-state':
         return (
             <EmptyState 
                 icon={SearchIcon}
                 title="Find your favorite music"
                 message="Search for songs, albums, or artists to start your musical journey."
             />
         );
      case 'no-results':
         return (
             <View className="items-center justify-center py-12">
                 <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}>
                     <SearchIcon size={32} color={isDark ? "#71717a" : "#94a3b8"} />
                 </View>
                 <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-2 text-center`}>No results found</Text>
                 <Text className={`text-base ${isDark ? 'text-gray-400' : 'text-slate-500'} text-center px-8`}>
                     We couldn't find any matches for "{item.query}". Try searching for something else.
                 </Text>
             </View>
         );

      case 'recent-header':
        return (
          <View className="flex-row justify-between items-center mb-4 mt-6">
            <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title || "Recently Played"}</Text>
            {item.title?.includes('Today') && (
                <TouchableOpacity onPress={clearRecentlyPlayed}>
                    <Text className="text-emerald-500 font-bold text-sm">Clear All</Text>
                </TouchableOpacity>
            )}
          </View>
        );
      case 'recent-song':
      case 'song':
        return (
          <SongItem
            item={item}
            onPlay={handleSongPress}
            onToggleLike={handleToggleLike}
            onMore={() => setSelectedSongForMenu(item)}
            isDark={isDark}
            results={item.type === 'recent-song' ? recentlyPlayedTracks : songs}
          />
        );
      case 'section-header':
        return <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-4 mt-2`}>{item.title}</Text>;
      case 'album-row':
        return (
          <View className="flex-row justify-between">
            {item.items.map((album: any) => (
              <AlbumItem key={album.id} item={album} onPress={() => router.push(`/album/${album.id}` as any)} isDark={isDark} />
            ))}
            {item.items.length === 1 && <View style={{ width: '48%' }} />}
          </View>
        );
      case 'playlist-row':
        return (
          <View className="flex-row justify-between">
            {item.items.map((playlist: any) => (
              <PlaylistItem key={playlist.id} item={playlist} onPress={() => router.push(`/saavn-playlist/${playlist.id}` as any)} isDark={isDark} />
            ))}
            {item.items.length === 1 && <View style={{ width: '48%' }} />}
          </View>
        );
      case 'toggle':
        return (
          <TouchableOpacity
            onPress={() => {
              if (item.target === 'songs') setShowAllSongs(!item.expanded);
              if (item.target === 'albums') setShowAllAlbums(!item.expanded);
              if (item.target === 'playlists') setShowAllPlaylists(!item.expanded);
            }}
            className={`self-center px-8 py-2.5 rounded-full border ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-slate-200 bg-white shadow-sm'} mt-2 mb-6`}
          >
            <Text className={`font-bold ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              {item.expanded ? 'Show Less' : 'Show More'}
            </Text>
          </TouchableOpacity>
        );
      case 'loading':
        return (
          <View className="mb-8">
            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-4`}>Searching...</Text>
            {[1, 2, 3, 4, 5].map((_, i) => (
              <View key={i} className="mb-4 flex-row items-center">
                <Shimmer width={56} height={56} borderRadius={8} className="mr-4" />
                <View className="flex-1">
                  <Shimmer width="70%" height={20} borderRadius={4} className="mb-2" />
                  <Shimmer width="40%" height={16} borderRadius={4} />
                </View>
              </View>
            ))}
          </View>
        );
      default:
        return null;
    }
  }, [isDark, handleSongPress, recentlyPlayedTracks, songs, handleToggleLike, handleSearchNavigation, clearRecentlyPlayed]);

  return (
    <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'} pt-12 px-4`}>
      <Text className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-6`}>Search</Text>

      <View style={isFocused ? { borderColor: primaryColor, borderWidth: 1 } : undefined} className={`flex-row items-center ${isDark ? 'bg-zinc-900' : 'bg-white border border-slate-200 shadow-sm'} rounded-2xl px-4 py-3 mb-6 transition-all duration-300 ${isFocused && isDark ? 'bg-zinc-800' : ''}`}>
        <SearchIcon size={20} color={isFocused ? primaryColor : (isDark ? "#71717a" : "#64748b")} className="mr-3" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => query.trim()}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Songs, albums, or playlists"
          placeholderTextColor={isDark ? "#71717a" : "#94a3b8"}
          className={`flex-1 ${isDark ? 'text-white' : 'text-slate-900'} text-base font-medium`}
          selectionColor={primaryColor}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} className="p-1 rounded-full bg-slate-200 dark:bg-zinc-700 opacity-80" pressRetentionOffset={10}>
            <X size={14} color={isDark ? "#d4d4d8" : "#475569"} />
          </TouchableOpacity>
        )}
      </View>

      <AnyFlashList
        data={listData}
        renderItem={renderItem}
        estimatedItemSize={64}
        keyExtractor={(item: any, index: number) => item.id ? `${item.type}-${item.id}` : `type-${item.type}-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150 }}
      />
      <SongMenu 
        isVisible={!!selectedSongForMenu} 
        onClose={() => setSelectedSongForMenu(null)} 
        song={selectedSongForMenu}
        userId={user?.id}
        extraActions={
          selectedSongForMenu?.type === 'recent-song' ? (
            <SongMenu.Item
              icon={X}
              label="Remove from History"
              onPress={() => {
                removeItemFromHistory(selectedSongForMenu.id);
                setSelectedSongForMenu(null);
              }}
              color={DesignSystem.colors.error}
            />
          ) : null
        }
      />
    </View>
  );
}
