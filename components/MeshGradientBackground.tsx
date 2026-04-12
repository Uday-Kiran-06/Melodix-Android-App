import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { DesignSystem } from '@/constants/DesignSystem';

const { width, height } = Dimensions.get('window');

const BLOB_COLORS = [
    '#1DB954', // Melodix Primary
    '#059669', // Emerald 600
    '#065f46', // Emerald 800
    '#10b981', // Emerald 500
    '#1e293b', // Slate 800 (for depth)
];

const Blob = ({ color, size, duration, delay }: { color: string; size: number; duration: number; delay: number }) => {
    return (
        <MotiView
            from={{
                translateX: -width / 2,
                translateY: -height / 2,
                scale: 1,
                opacity: 0.3,
            }}
            animate={{
                translateX: Math.random() * width - width / 2,
                translateY: Math.random() * height - height / 2,
                scale: [1, 1.5, 1.2, 1.8, 1],
                opacity: [0.3, 0.6, 0.4, 0.7, 0.3],
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

export const MeshGradientBackground = () => {
    return (
        <View style={styles.container}>
            {/* Base Background */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />

            {/* Moving Blobs */}
            <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill}>
                <View style={styles.blobContainer}>
                    <Blob color={BLOB_COLORS[0]} size={width * 1.5} duration={15000} delay={0} />
                    <Blob color={BLOB_COLORS[1]} size={width * 1.8} duration={20000} delay={1000} />
                    <Blob color={BLOB_COLORS[2]} size={width * 1.2} duration={12000} delay={500} />
                    <Blob color={BLOB_COLORS[3]} size={width * 1.4} duration={18000} delay={2000} />
                    <Blob color={BLOB_COLORS[4]} size={width * 2.0} duration={25000} delay={3000} />
                </View>
            </BlurView>

            {/* Overlays for Depth & Legibility */}
            <LinearGradient
                colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.6)', 'black']}
                style={StyleSheet.absoluteFill}
            />
            
            {/* Grain/Texture Overlay could go here if available */}
            
            <View 
                style={[
                    StyleSheet.absoluteFill, 
                    { backgroundColor: 'rgba(0,0,0,0.2)' }
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
        opacity: 0.8,
    },
    blob: {
        opacity: 0.5,
        // The blur is the key! We apply it via a container or individual blobs if possible.
        // In Expo/React Native, we use blurRadius on an Image or a blurred View.
        // Since we can't blur a regular View easily without Skia, 
        // we might use a very large blurred image of a circle or just heavy overlapping.
        // Alternatively, we use the absoluteFill MusicImage with high blur as the "blur layer".
    },
});
