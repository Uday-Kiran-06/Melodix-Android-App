export interface Song {
    id: string;
    name: string;
    type: string;
    year: string;
    releaseDate: string | null;
    duration: number;
    label: string | null;
    explicitContent: boolean;
    playCount: number;
    language: string;
    hasLyrics: boolean;
    url: string;
    copyright: string | null;
    album: {
        id: string;
        name: string;
        url: string;
    };
    artists: {
        primary: {
            id: string;
            name: string;
            role: string;
            image: string | { quality: string; url: string }[] | null;
            url: string;
        }[];
        featured: any[];
        all: any[];
    };
    image: string | {
        quality: string;
        url: string;
    }[] | null;
    downloadUrl: {
        quality: string;
        url: string;
    }[];
    localUri?: string;
}

export interface SearchResponse {
    success: boolean;
    data: {
        total: number;
        start: number;
        results: Song[];
    };
}

export interface TrendingResponse {
    success: boolean;
    data: {
        songs: Song[];
        albums: any[];
    };
}
