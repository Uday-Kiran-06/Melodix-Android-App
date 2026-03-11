import TrackPlayer from 'react-native-track-player';
import { PlaybackService } from './services/TrackPlayerService';

// Ensure the playback service is registered as early as possible
TrackPlayer.registerPlaybackService(() => PlaybackService);

// Load the Expo Router entry point
import 'expo-router/entry';
