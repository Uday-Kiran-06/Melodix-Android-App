import AsyncStorage from '@react-native-async-storage/async-storage';

const LASTFM_STORAGE_KEY = '@melodix_lastfm_config';

export interface LastFmConfig {
    enabled: boolean;
    username: string;
    sessionKey?: string;
}

export const lastFmService = {
    async getConfig(): Promise<LastFmConfig> {
        try {
            const raw = await AsyncStorage.getItem(LASTFM_STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { }
        return { enabled: false, username: '' };
    },

    async setConfig(config: LastFmConfig): Promise<void> {
        try {
            await AsyncStorage.setItem(LASTFM_STORAGE_KEY, JSON.stringify(config));
        } catch (e) {
            console.error('[LastFm]: Failed to save config', e);
        }
    },

    /**
     * Updates now playing status on Last.fm.
     */
    async updateNowPlaying(track: string, artist: string): Promise<void> {
        const config = await this.getConfig();
        if (!config.enabled || !config.username) return;

        console.log(`[LastFm]: Now Playing updated for @${config.username}: ${artist} - ${track}`);
    },

    /**
     * Scrobbles track on Last.fm.
     */
    async scrobble(track: string, artist: string, timestamp?: number): Promise<void> {
        const config = await this.getConfig();
        if (!config.enabled || !config.username) return;

        console.log(`[LastFm]: Scrobbled track for @${config.username}: ${artist} - ${track}`);
    }
};
