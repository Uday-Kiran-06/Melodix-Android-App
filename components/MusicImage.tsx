import { jioSaavnService } from '@/services/jiosaavn';
import { Image } from 'expo-image';
import React, { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

const DEFAULT_IMAGE = require('../assets/images/favicon.png');

interface MusicImageProps {
    images: any;
    className?: string;
    style?: any;
    contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
    transition?: number;
    placeholder?: any;
    blurRadius?: number;
}

export const MusicImage = memo(({
    images,
    className,
    style,
    contentFit = 'cover',
    transition = 100,
    placeholder = DEFAULT_IMAGE,
    blurRadius
}: MusicImageProps) => {
    const [error, setError] = useState(false);

    // Sanitize the URL using the service
    const imageUrl = jioSaavnService.sanitizeImageUrl(images);

    // If we have an error or no URL, use the fallback
    const source = (!imageUrl || error) ? DEFAULT_IMAGE : { uri: imageUrl };

    return (
        <View style={[styles.container, style]} className={className}>
            <Image
                source={source}
                style={StyleSheet.absoluteFill}
                contentFit={contentFit}
                transition={transition}
                cachePolicy="memory-disk"
                placeholder={placeholder}
                blurRadius={blurRadius}
                onLoad={() => {
                    if (imageUrl && imageUrl.includes('500x500') && !imageUrl.startsWith('data:')) {
                        // Success!
                    }
                }}
                onError={(e) => {
                    if (!error) {
                        const errorMsg = e?.error || "Unknown Error";
                        console.log(`[MusicImage Error]: Load failed for ${imageUrl}. Reason: ${errorMsg}`);
                        setError(true);
                    }
                }}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        backgroundColor: '#18181b', // zinc-900
    },
});
