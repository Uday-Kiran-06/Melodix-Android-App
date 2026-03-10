import { useSettingsStore } from '@/hooks/useSettingsStore';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import React from 'react';
import { DimensionValue, StyleSheet, View } from 'react-native';

interface ShimmerProps {
    width: DimensionValue;
    height: DimensionValue;
    borderRadius?: number;
    className?: string;
}

export const Shimmer: React.FC<ShimmerProps> = ({ width, height, borderRadius = 8, className }) => {
    const { theme } = useSettingsStore();
    const isDark = theme === 'dark';

    const baseColor = isDark ? '#27272a' : '#e2e8f0'; // zinc-800 or slate-200
    const highlightColor = isDark ? '#3f3f46' : '#f1f5f9'; // zinc-700 or slate-100

    return (
        <View
            style={[{ width, height, borderRadius, backgroundColor: baseColor, overflow: 'hidden' }]}
            className={className}
        >
            <MotiView
                from={{ translateX: -150 }}
                animate={{ translateX: 300 }}
                transition={{
                    loop: true,
                    duration: 1500,
                    type: 'timing',
                }}
                style={StyleSheet.absoluteFill}
            >
                <LinearGradient
                    colors={[baseColor, highlightColor, baseColor]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                />
            </MotiView>
        </View>
    );
};
