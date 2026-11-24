import React, { useMemo } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { usePlayerStore } from '@/hooks/usePlayerStore';

const { width, height } = Dimensions.get('window');

// Apple Music-inspired fluid color palettes
const APPLE_GLASS_PALETTES = [
    ['#10b981', '#059669', '#14b8a6', '#047857', '#064e3b'], // Emerald Forest
    ['#6366f1', '#4f46e5', '#8b5cf6', '#3b82f6', '#1e1b4b'], // Royal Violet
    ['#ec4899', '#db2777', '#f43f5e', '#a855f7', '#310d20'], // Neon Velvet
    ['#3b82f6', '#2563eb', '#06b6d4', '#0284c7', '#0c2340'], // Oceanic Glass
    ['#f59e0b', '#d97706', '#f97316', '#ef4444', '#381404'], // Sunset Amber
    ['#8b5cf6', '#7c3aed', '#ec4899', '#c084fc', '#240d3a'], // Amethyst Dream
    ['#06b6d4', '#0891b2', '#10b981', '#3b82f6', '#042738'], // Aurora Borealis
    ['#f43f5e', '#be123c', '#9f1239', '#e11d48', '#2e0610'], // Crimson Passion
];

const Blob = ({ color, size, duration, delay }: { color: string; size: number; duration: number; delay: number }) => {
    return (
        <MotiView
            from={{
                translateX: -width / 2,
                translateY: -height / 2,
                scale: 1,
                opacity: 0.35,
            }}
            animate={{
                translateX: Math.random() * width - width / 2,
                translateY: Math.random() * height - height / 2,
                scale: [1, 1.4, 1.1, 1.6, 1],
                opacity: [0.35, 0.65, 0.45, 0.75, 0.35],
            }}
            transition={{
                loop: true,
                type: 'timing',
                duration: duration,
                delay: delay,
            }}
            style={[
                styles.blob,
                {
                    backgroundColor: color,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    position: 'absolute',
                },
            ]}
        />
    );
};

interface MeshGradientBackgroundProps {
    colors?: string[];
}

export const MeshGradientBackground: React.FC<MeshGradientBackgroundProps> = ({ colors: customColors }) => {
    const { currentTrack } = usePlayerStore();

    // Dynamically derive palette from active track title + artist
    const activePalette = useMemo(() => {
        if (customColors && customColors.length >= 3) {
            return customColors;
        }

        if (!currentTrack) {
            return APPLE_GLASS_PALETTES[0];
        }

        const seed = `${currentTrack.title || ''}${currentTrack.artist || ''}${currentTrack.album || ''}`;
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = seed.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % APPLE_GLASS_PALETTES.length;
        return APPLE_GLASS_PALETTES[index];
    }, [customColors, currentTrack?.title, currentTrack?.artist, currentTrack?.album]);

    return (
        <View style={styles.container}>
            {/* Base Background */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />

            {/* Apple Music Dynamic Moving Mesh Blobs */}
            <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill}>
                <View style={styles.blobContainer}>
                    <Blob color={activePalette[0]} size={width * 1.5} duration={14000} delay={0} />
                    <Blob color={activePalette[1]} size={width * 1.8} duration={19000} delay={1000} />
                    <Blob color={activePalette[2]} size={width * 1.3} duration={12000} delay={500} />
                    <Blob color={activePalette[3]} size={width * 1.6} duration={17000} delay={2000} />
                    <Blob color={activePalette[4] || activePalette[0]} size={width * 2.0} duration={24000} delay={3000} />
                </View>
            </BlurView>

            {/* Subtle Liquid Frosted Overlays for depth */}
            <LinearGradient
                colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.65)', '#050505']}
                style={StyleSheet.absoluteFill}
            />

            <View 
                style={[
                    StyleSheet.absoluteFill, 
                    { backgroundColor: 'rgba(0,0,0,0.18)' }
                ]} 
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    blobContainer: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.85,
    },
    blob: {
        opacity: 0.55,
    },
});
