import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { jioSaavnService } from '@/services/jiosaavn';

const resolveTrackDownloadUrl = (trackData: any, quality: string): string | null => {
    if (!trackData) return null;

    // Check array in originalDownloadUrl or downloadUrl
    const urls = trackData.originalDownloadUrl || trackData.downloadUrl;
    if (urls && Array.isArray(urls) && urls.length > 0) {
        const qualityString = String(quality).toLowerCase();
        // Try exact match or match without 'kbps'
        const target = urls.find((d: any) => {
            if (!d) return false;
            const q = String(d.quality || '').toLowerCase();
            return q === qualityString || q === qualityString.replace('kbps', '') || qualityString.includes(q);
        }) || urls[urls.length - 1];

        const candidate = target?.url || target?.link;
        if (candidate && typeof candidate === 'string' && candidate.startsWith('http')) {
            return candidate;
        }

        // Fallback: search backwards from highest quality
        for (let i = urls.length - 1; i >= 0; i--) {
            const item = urls[i];
            const u = item?.url || item?.link || (typeof item === 'string' ? item : null);
            if (u && typeof u === 'string' && u.startsWith('http')) {
                return u;
            }
        }
    }

    if (trackData.url && typeof trackData.url === 'string' && trackData.url.startsWith('http')) {
        return trackData.url;
    }

    if (trackData.originalUrl && typeof trackData.originalUrl === 'string' && trackData.originalUrl.startsWith('http')) {
        return trackData.originalUrl;
    }

    return null;
};

class DownloadService {
    private activeDownloadTasks = new Map<string, FileSystem.DownloadResumable>();

    /**
     * Check whether a song is already saved on device
     */
    public isSongDownloaded(songId: string): boolean {
        const { downloadedSongs } = useLibraryStore.getState();
        return downloadedSongs.some(s => String(s.id) === String(songId));
    }

    /**
     * Check whether a song is currently downloading
     */
    public isSongDownloading(songId: string): boolean {
        const { activeDownloads } = useLibraryStore.getState();
        return activeDownloads[songId] !== undefined;
    }

    /**
     * Download a single song
     */
    public async downloadSong(
        song: any,
        options: { silent?: boolean; quality?: string } = {}
    ): Promise<boolean> {
        if (!song || !song.id) {
            if (!options.silent) Alert.alert("Error", "Invalid song information.");
            return false;
        }

        const songId = String(song.id);
        const songTitle = song.name || song.title || 'Song';
        const { activeDownloads, downloadedSongs, updateDownloadProgress, saveDownload, syncDownloadedSongs } = useLibraryStore.getState();

        // 1. Check if already downloading
        if (activeDownloads[songId] !== undefined) {
            if (!options.silent) {
                Alert.alert("Downloading", `"${songTitle}" is already downloading.`);
            }
            return false;
        }

        // 2. Check if already downloaded
        const downloadedTrack = downloadedSongs.find(s => String(s.id) === songId);
        if (downloadedTrack?.localUri) {
            try {
                const fileInfo = await FileSystem.getInfoAsync(downloadedTrack.localUri);
                if (fileInfo.exists) {
                    if (!options.silent) {
                        Alert.alert("Already Downloaded", `"${songTitle}" is already saved to your device.`);
                    }
                    return true;
                } else {
                    await syncDownloadedSongs();
                }
            } catch (e) {
                // Ignore file check error and proceed
            }
        }

        try {
            updateDownloadProgress(songId, 0);

            // 3. Resolve song details if downloadUrl is missing
            let songToDownload = { ...song };
            const quality = options.quality || useSettingsStore.getState().audioQuality || "320kbps";
            let downloadUrl = resolveTrackDownloadUrl(songToDownload, quality);

            if (!downloadUrl) {
                try {
                    const fullDetails = await jioSaavnService.getSongDetails(songId);
                    if (fullDetails) {
                        songToDownload = { ...songToDownload, ...fullDetails };
                        downloadUrl = resolveTrackDownloadUrl(songToDownload, quality);
                    }
                } catch (fetchErr) {
                    console.warn("[DownloadService]: Failed to fetch full song details:", fetchErr);
                }
            }

            if (!downloadUrl) {
                updateDownloadProgress(songId, 1);
                if (!options.silent) {
                    Alert.alert("Download Unavailable", "Could not find a valid audio stream for this track.");
                }
                return false;
            }

            // 4. Ensure directory exists
            const downloadDir = `${FileSystem.documentDirectory}Melodix/Downloads/`;
            const dirInfo = await FileSystem.getInfoAsync(downloadDir);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
            }

            // Clean title for display
            const displayTitle = (songToDownload.name || songToDownload.title || 'Song').trim();

            // URI-safe ASCII filename for filesystem storage
            const safePrefix = displayTitle
                .replace(/[^a-zA-Z0-9]/g, '_')
                .replace(/_+/g, '_')
                .substring(0, 40)
                .replace(/^_+|_+$/g, '') || 'track';
            const filename = `${safePrefix}_${songId}.mp3`;
            const fileUri = `${downloadDir}${filename}`;

            const notificationId = `download-${songId}`;
            let lastNotificationTime = Date.now();

            const downloadResumable = FileSystem.createDownloadResumable(
                downloadUrl,
                fileUri,
                {},
                async (progressData) => {
                    if (!progressData.totalBytesExpectedToWrite || progressData.totalBytesExpectedToWrite <= 0) return;
                    const progress = progressData.totalBytesWritten / progressData.totalBytesExpectedToWrite;
                    updateDownloadProgress(songId, progress);

                    const now = Date.now();
                    if (!options.silent && (now - lastNotificationTime > 1200 || progress >= 1)) {
                        lastNotificationTime = now;
                        try {
                            await Notifications.scheduleNotificationAsync({
                                identifier: notificationId,
                                content: {
                                    title: `Downloading: ${displayTitle}`,
                                    body: `Progress: ${Math.round(progress * 100)}%`,
                                },
                                trigger: null,
                            });
                        } catch (e) {}
                    }
                }
            );

            this.activeDownloadTasks.set(songId, downloadResumable);
            const result = await downloadResumable.downloadAsync();
            this.activeDownloadTasks.delete(songId);

            try { await Notifications.dismissNotificationAsync(notificationId); } catch (e) {}

            if (result && result.uri) {
                await saveDownload(songToDownload, result.uri);
                updateDownloadProgress(songId, 1);

                if (!options.silent) {
                    try {
                        await Notifications.scheduleNotificationAsync({
                            identifier: `${notificationId}-complete`,
                            content: {
                                title: "Download Complete",
                                body: `"${displayTitle}" has been saved for offline playback.`,
                            },
                            trigger: null,
                        });
                    } catch (e) {}

                    try {
                        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } catch (e) {}

                    Alert.alert(
                        "Download Complete",
                        `"${displayTitle}" has been saved for offline playback.`
                    );
                }
                return true;
            } else {
                updateDownloadProgress(songId, 1);
                return false;
            }
        } catch (error: any) {
            console.error(`[DownloadService Error for ${songId}]:`, error);
            this.activeDownloadTasks.delete(songId);
            useLibraryStore.getState().updateDownloadProgress(songId, 1);
            if (!options.silent) {
                Alert.alert(
                    "Download Failed",
                    error?.message ? `Failed to download "${songTitle}": ${error.message}` : `Could not download "${songTitle}". Please check your internet connection.`
                );
            }
            return false;
        }
    }

    /**
     * Download an entire playlist or collection of songs sequentially
     */
    public async downloadPlaylist(
        songs: any[],
        playlistTitle: string,
        playlistId?: string,
        quality?: string
    ): Promise<void> {
        if (!songs || songs.length === 0) {
            Alert.alert("Empty Playlist", "This playlist has no songs to download.");
            return;
        }

        const effectivePlaylistId = playlistId || playlistTitle;
        const { downloadedSongs, updatePlaylistProgress } = useLibraryStore.getState();

        // 1. Filter out songs that are already downloaded
        const songsToDownload = songs.filter(
            song => !downloadedSongs.some(ds => String(ds.id) === String(song.id))
        );

        if (songsToDownload.length === 0) {
            Alert.alert("Already Downloaded", `All songs in "${playlistTitle}" are already downloaded!`);
            return;
        }

        const total = songsToDownload.length;
        updatePlaylistProgress(effectivePlaylistId, { current: 0, total });

        try {
            await Notifications.scheduleNotificationAsync({
                identifier: `playlist-${effectivePlaylistId}`,
                content: {
                    title: `Downloading Playlist: ${playlistTitle}`,
                    body: `Starting download of ${total} songs...`,
                },
                trigger: null,
            });
        } catch (e) {}

        let downloadedCount = 0;

        for (let i = 0; i < songsToDownload.length; i++) {
            const song = songsToDownload[i];
            updatePlaylistProgress(effectivePlaylistId, { current: i + 1, total });

            try {
                await Notifications.scheduleNotificationAsync({
                    identifier: `playlist-${effectivePlaylistId}`,
                    content: {
                        title: `Downloading Playlist: ${playlistTitle}`,
                        body: `Downloading (${i + 1}/${total}): ${song.name || song.title || 'Track'}`,
                    },
                    trigger: null,
                });
            } catch (e) {}

            const success = await this.downloadSong(song, { silent: true, quality });
            if (success) {
                downloadedCount++;
            }
        }

        // Finish playlist download
        updatePlaylistProgress(effectivePlaylistId, null);

        try {
            await Notifications.dismissNotificationAsync(`playlist-${effectivePlaylistId}`);
            await Notifications.scheduleNotificationAsync({
                identifier: `playlist-${effectivePlaylistId}-complete`,
                content: {
                    title: "Playlist Download Complete",
                    body: `"${playlistTitle}" downloaded: ${downloadedCount}/${total} songs saved offline.`,
                },
                trigger: null,
            });
        } catch (e) {}

        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {}

        Alert.alert(
            "Playlist Download Complete",
            `Successfully saved ${downloadedCount} song${downloadedCount === 1 ? '' : 's'} from "${playlistTitle}" for offline playback.`
        );
    }
}

export const downloadService = new DownloadService();
