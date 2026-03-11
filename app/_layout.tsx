import { Buffer } from 'buffer';
if (!global.Buffer) {
  global.Buffer = Buffer;
}

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';

import { PlaybackService } from '@/services/TrackPlayerService';
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
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
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
          // Additional reliability for background stopping
          stopWithApp: true,
          capabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.Stop,
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
            Capability.Stop,
            Capability.SeekTo,
          ],
          forwardJumpInterval: 10,
          backwardJumpInterval: 10,
        });

        isPlayerInitialized = true;

        // Restore previous session if available
        try {
          const { usePlayerStore } = require('@/hooks/usePlayerStore');
          await usePlayerStore.getState().initPlayer();
        } catch (initErr) {
          console.warn('Player init restoration error:', initErr);
        }

        // Sync downloads
        try {
          const { useLibraryStore } = require('@/hooks/useLibraryStore');
          useLibraryStore.getState().syncDownloadedSongs();
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
                  await Updates.fetchUpdateAsync();
                  await Updates.reloadAsync();
                }
              }
            ]
          );
        }
      } catch (error) {
        // Log error or handle gracefully
        console.log(`Error fetching latest Expo update: ${error}`);
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={navigationTheme}>
            <InitialLayout loaded={loaded} />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
