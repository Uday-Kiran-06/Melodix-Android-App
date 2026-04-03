import { Buffer } from 'buffer';
import MiniPlayer from '@/components/MiniPlayer';
if (!global.Buffer) {
  global.Buffer = Buffer;
}

import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from '../widget/WidgetTaskHandler';
registerWidgetTaskHandler(widgetTaskHandler);

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import React, { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';

import { PlaybackService } from '@/services/TrackPlayerService';
import { jioSaavnService } from '@/services/jiosaavn';
import TrackPlayer, { AppKilledPlaybackBehavior, Capability } from 'react-native-track-player';

import { AuthProvider, useAuth } from '@/components/AuthContext';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter, useSegments } from 'expo-router';
import { useColorScheme as useRNColorScheme, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60,      // 1 hour global default
      gcTime: 1000 * 60 * 60 * 24,    // 24 hour garbage collection
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
  },
});

function InitialLayout({ loaded }: { loaded: boolean }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading || !loaded) return;

    const authRoutes = ['login', 'signup'];
    const protectedRoutes = ['liked-songs', 'settings'];
    const currentRoute = segments[0];

    // Ensure we are in a stable state before redirecting
    const redirect = (path: string) => {
      // Use a slightly longer delay to ensure the layout is fully mounted
      setTimeout(() => {
        try {
          router.replace(path as any);
        } catch (e) {
          console.error("Redirection error:", e);
        }
      }, 50);
    };

    if (!session && protectedRoutes.includes(currentRoute)) {
      redirect('/login');
    } else if (session && authRoutes.includes(currentRoute)) {
      redirect('/(tabs)');
    }
  }, [session, loading, loaded, segments]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="player" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="liked-songs" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
    </Stack>
  );
}


export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Global variable to track if TrackPlayer is already setting up or set up
let isPlayerSettingUp = false;
let isPlayerInitialized = false;

export default function RootLayout() {
  const [loaded, error] = useFonts({
    // Add custom fonts here if needed
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    const setup = async () => {
      if (isPlayerSettingUp || isPlayerInitialized) return;
      isPlayerSettingUp = true;

      try {
        await TrackPlayer.setupPlayer({
          waitForBuffer: true,
        });
        await TrackPlayer.updateOptions({
          progressUpdateEventInterval: 1,
          android: {
            appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
            alwaysPauseOnInterruption: false,
          },
          capabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.SeekTo,
            Capability.JumpForward,
            Capability.JumpBackward,
          ],
          compactCapabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
          ],
          notificationCapabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.SeekTo,
          ],
          forwardJumpInterval: 10,
          backwardJumpInterval: 10,
        });

        isPlayerInitialized = true;

        // Restore previous session if available
        try {
          const store = require('@/hooks/usePlayerStore');
          if (store && store.usePlayerStore) {
            await store.usePlayerStore.getState().initPlayer();
          }
        } catch (initErr) {
          console.warn('Player init restoration error:', initErr);
        }

        // Sync downloads
        try {
          const store = require('@/hooks/useLibraryStore');
          if (store && store.useLibraryStore) {
            store.useLibraryStore.getState().syncDownloadedSongs();
          }
        } catch (storeErr) {
          console.warn('Store sync error during setup:', storeErr);
        }
      } catch (e: any) {
        if (e && e.message && e.message.includes('already been initialized')) {
          isPlayerInitialized = true;
        } else {
          console.error('Player setup error:', e);
        }
      } finally {
        isPlayerSettingUp = false;
      }
    };
    setup();
  }, []);

  useEffect(() => {
    async function onFetchUpdateAsync() {
      if (!Updates.isEnabled) return;

      try {
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          Alert.alert(
            "Update Available",
            "A new version of Melodix is available. Would you like to update now?",
            [
              { text: "Later", style: "cancel" },
              { 
                text: "Update Now", 
                onPress: async () => {
                  try {
                    await Updates.fetchUpdateAsync();
                    await Updates.reloadAsync();
                  } catch (e) {
                    Alert.alert("Update Failed", "Failed to download the update. Please check your connection.");
                  }
                }
              }
            ]
          );
        }
      } catch (error: any) {
        // Only log connectivity-related errors if we are actually offline
        const isConnected = await jioSaavnService.checkConnection();
        if (isConnected) {
          console.log(`Update check failed (Service Side): ${error.message}`);
        } else {
          console.log("Update check skipped: No internet connection.");
        }
      }
    }

    // Only check for updates in production
    if (!__DEV__) {
      onFetchUpdateAsync();
    }
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutNav loaded={loaded} />
    </AuthProvider>
  );
}


function RootLayoutNav({ loaded }: { loaded: boolean }) {
  const systemColorScheme = useRNColorScheme();
  const { theme } = useSettingsStore();
  const { useAudioEffects } = require('@/hooks/useAudioEffects');

  // Initialize audio effects
  useAudioEffects();

  const currentTheme = theme === 'system' ? systemColorScheme : theme;
  const navigationTheme = currentTheme === 'dark' ? DarkTheme : DefaultTheme;

  useEffect(() => {
    // Initialize Download Notification Channel for Android
    const setupNotifications = async () => {
      if (require('react-native').Platform.OS === 'android') {
        const Notifications = require('expo-notifications');
        await Notifications.setNotificationChannelAsync('download', {
          name: 'Download Updates',
          importance: Notifications.AndroidImportance.LOW,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#1DB954',
          showBadge: false,
        });
      }
    };
    setupNotifications();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={navigationTheme}>
            <InitialLayout loaded={loaded} />
            <MiniPlayer />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
