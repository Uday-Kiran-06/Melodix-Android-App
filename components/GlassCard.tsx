import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface GlassCardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    intensity?: number;
    tint?: 'light' | 'dark' | 'default';
    className?: string;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, style, intensity = 40, tint = 'dark', className }) => {
    return (
        <View style={style} className={className}>
            <View style={styles.container}>
                <BlurView
                    intensity={intensity}
                    style={styles.blur}
                    tint={tint}
                >
                    {children}
                </BlurView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    blur: {
        padding: 16,
    },
});

export default GlassCard;
