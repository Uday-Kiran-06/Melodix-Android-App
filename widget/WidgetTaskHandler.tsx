import React from 'react';
import { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { MelodixWidget } from './Widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, { State } from 'react-native-track-player';
import { Linking } from 'react-native';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  try {
    // 1. Handle Playback Actions if any
    if (props.widgetAction === 'WIDGET_CLICK') {
      const clickAction = (props as any).clickAction;
      
      if (clickAction === 'PLAY_PAUSE') {
        const state = await TrackPlayer.getState();
        if (state === State.Playing) {
          await TrackPlayer.pause();
        } else {
          await TrackPlayer.play();
        }
      } else if (clickAction === 'SKIP_NEXT') {
        await TrackPlayer.skipToNext();
      } else if (clickAction === 'SKIP_PREV') {
        await TrackPlayer.skipToPrevious();
      } else if (clickAction === 'OPEN_PLAYLIST' && props.clickActionData) {
        const { id, type } = props.clickActionData as { id: string; type: string };
        // Deep link to the app's playlist/album screen
        const url = `melodix://${type}/${id}`;
        await Linking.openURL(url);
      }
    }

    // 2. Fetch Fresh Data for Rendering
    const [historyData, playerData] = await Promise.all([
      AsyncStorage.getItem('melodix-history'),
      AsyncStorage.getItem('player-storage'),
    ]);

    let trackName = 'Melodix Player';
    let artistName = 'Start listening!';
    let artwork = undefined;
    let isPlaying = false;
    let recentItems: any[] = [];

    // Parse Player Data
    if (playerData) {
      const parsedPlayer = JSON.parse(playerData);
      const currentTrack = parsedPlayer.state?.currentTrack;
      if (currentTrack) {
        trackName = currentTrack.title || trackName;
        artistName = currentTrack.artist || artistName;
        artwork = currentTrack.artwork;
      }
      // Note: isPlaying might not be perfectly sync'd in AsyncStorage, but we can check actual state
      const state = await TrackPlayer.getState();
      isPlaying = state === State.Playing;
    }

    // Parse History Data for Playlists/Recent Items
    if (historyData) {
      const parsedHistory = JSON.parse(historyData);
      const items = parsedHistory.state?.recentlyPlayedItems || [];
      
      // Filter for items that aren't just the current track, or just take the top ones
      recentItems = items.map((item: any) => ({
        id: item.id,
        name: item.name || item.title || 'Unknown',
        image: item.image || (Array.isArray(item.images) ? item.images[0]?.url : item.artwork),
        type: item.type || (item.song_data ? 'playlist' : 'album')
      })).slice(0, 3);
    }

    // 3. Render the Widget
    switch (props.widgetAction) {
      case 'WIDGET_ADDED':
      case 'WIDGET_UPDATE':
      case 'WIDGET_RESIZED':
      case 'WIDGET_CLICK':
        props.renderWidget(
          <MelodixWidget 
            trackName={trackName} 
            artistName={artistName} 
            artwork={artwork}
            isPlaying={isPlaying}
            recentItems={recentItems}
          />
        );
        break;

      default:
        break;
    }
  } catch (error) {
    console.error('Widget task error:', error);
    // Fallback render
    props.renderWidget(
      <MelodixWidget trackName="Melodix" artistName="Tap to play" />
    );
  }
}
