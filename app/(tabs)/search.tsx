import { useAuth } from '@/components/AuthContext';
import { MusicImage } from '@/components/MusicImage';
import { Shimmer } from '@/components/Shimmer';
import { useHistoryStore } from '@/hooks/useHistoryStore';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useSearch, useSearchAlbums, useSearchPlaylists } from '@/hooks/useMusic';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { jioSaavnService } from '@/services/jiosaavn';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, Play, Plus, Search as SearchIcon, X } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Text, TextInput, TouchableOpacity, View } from 'react-native';

const AnyFlashList = FlashList as any;

const { width } = Dimensions.get('window');

const SongItem = memo(({ item, onPlay, onToggleLike, isDark, results }: any) => {
  const isLiked = useLibraryStore(state => state.likedSongs.some((s: any) => s.id === item.id));

  return (
    <View className="mb-4 flex-row items-center">
      <TouchableOpacity onPress={() => onPlay?.(item, results)} className="flex-1 flex-row items-center">
        <MusicImage
          images={item}
          className="w-14 h-14 rounded-lg mr-4"
        />
        <View className="flex-1">
          <Text className={`${isDark ? 'text-white' : 'text-slate-800'} font-semibold`} numberOfLines={1}>{item.name}</Text>
          <Text className="text-gray-400 text-sm" numberOfLines={1}>{item.artists?.primary?.[0]?.name || item.artist}</Text>
        </View>
        <Play size={20} color="#1DB954" fill="#1DB954" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onToggleLike?.(item)} className="p-2 ml-4">
        {isLiked ? (
          <CheckCircle2 size={24} color="#1DB954" />
        ) : (
          <Plus size={24} color={isDark ? "#71717a" : "#94a3b8"} />
        )}
      </TouchableOpacity>
    </View>
  );
});

const AlbumItem = memo(({ item, onPress, isDark }: any) => (
  <TouchableOpacity
    className="mb-4 w-[48%]"
    onPress={onPress}
  >
    <MusicImage
      images={item}
      className="w-full aspect-square rounded-lg mb-2"
    />
    <Text className={`${isDark ? 'text-white' : 'text-slate-800'} font-bold text-sm`} numberOfLines={1}>{item.name}</Text>
    <Text className="text-gray-400 text-xs" numberOfLines={1}>{item.artists?.primary?.[0]?.name}</Text>
  </TouchableOpacity>
));

const PlaylistItem = memo(({ item, onPress, isDark }: any) => (
  <TouchableOpacity
    className="mb-4 w-[48%]"
    onPress={onPress}
  >
    <MusicImage
      images={item}
      className="w-full aspect-square rounded-lg mb-2"
    />
    <Text className={`${isDark ? 'text-white' : 'text-slate-800'} font-bold text-sm`} numberOfLines={1}>{item.name}</Text>
  </TouchableOpacity>
));

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(q || '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);

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
  const { recentlyPlayedTracks, clearRecentlyPlayed, addSearchQuery } = useHistoryStore();
  const router = useRouter();
  const isDark = theme === 'dark';

  const handleSongPress = useCallback((item: any, results: any[] | undefined) => {
    if (item && query.trim()) {
      addSearchQuery(query);
    }
    playTrack(item, results || [], audioQuality);
  }, [query, playTrack, audioQuality, addSearchQuery]);

  const handleToggleLike = useCallback((item: any) => {
    toggleLike(item, user?.id);
  }, [toggleLike, user?.id]);

  const handleSearchNavigation = useCallback((q: string) => {
    const decodedQ = jioSaavnService.decodeHtml(q);
    setQuery(decodedQ);
    addSearchQuery(decodedQ);
  }, [addSearchQuery]);

  useEffect(() => {
    if (q) {
      setQuery(q);
      addSearchQuery(q);
    }
  }, [q, addSearchQuery]);

  const [showAllSongs, setShowAllSongs] = useState(false);
  const [showAllAlbums, setShowAllAlbums] = useState(false);
  const [showAllPlaylists, setShowAllPlaylists] = useState(false);

  const listData = useMemo(() => {
    if (!query) {
      return recentlyPlayedTracks.length > 0 ? [{ type: 'recent-header' }, ...recentlyPlayedTracks.map(t => ({ ...t, type: 'recent-song' }))] : [];
    }

    if (songsLoading || albumsLoading || playlistsLoading) {
      return [{ type: 'loading' }];
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
      case 'recent-header':
        return (
          <View className="flex-row justify-between items-center mb-4 mt-2">
            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} `}>Recently Played</Text>
            <TouchableOpacity onPress={clearRecentlyPlayed}>
              <Text className="text-emerald-500 font-bold text-sm">Clear All</Text>
            </TouchableOpacity>
          </View>
        );
      case 'recent-song':
      case 'song':
        return (
          <SongItem
            item={item}
            onPlay={handleSongPress}
            onToggleLike={handleToggleLike}
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
              <AlbumItem key={album.id} item={album} onPress={() => handleSearchNavigation(album.name)} isDark={isDark} />
            ))}
            {item.items.length === 1 && <View style={{ width: '48%' }} />}
          </View>
        );
      case 'playlist-row':
        return (
          <View className="flex-row justify-between">
            {item.items.map((playlist: any) => (
              <PlaylistItem key={playlist.id} item={playlist} onPress={() => handleSearchNavigation(playlist.name)} isDark={isDark} />
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

      <View className={`flex-row items-center ${isDark ? 'bg-zinc-900' : 'bg-white border border-slate-200 shadow-sm'} rounded-full px-4 py-2 mb-6`}>
        <SearchIcon size={20} color={isDark ? "#71717a" : "#64748b"} className="mr-2" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => query.trim() && addSearchQuery(query)}
          placeholder="Songs, albums, or playlists"
          placeholderTextColor={isDark ? "#71717a" : "#94a3b8"}
          className={`flex-1 ${isDark ? 'text-white' : 'text-slate-900'} text-base`}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <X size={20} color={isDark ? "#71717a" : "#64748b"} />
          </TouchableOpacity>
        )}
      </View>

      <AnyFlashList
        data={listData}
        renderItem={renderItem}
        estimatedItemSize={80}
        keyExtractor={(item: any, index: number) => item.id ? `${item.type}-${item.id}` : `type-${item.type}-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150 }}
      />
    </View>
  );
}
