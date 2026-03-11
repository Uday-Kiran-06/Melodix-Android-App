import GlassCard from '@/components/GlassCard';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import * as AudioEffects from '@/modules/native-audio-effects';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { Activity, ArrowLeft, Volume2, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

const EQ_BAND_LABELS = ['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'];

export default function AudioSettingsScreen() {
    const router = useRouter();
    const {
        theme,
        bassBoostStrength,
        setBassBoostStrength,
        eqGains,
        setEqGain,
        loudnessGain,
        setLoudnessGain,
        isBassBoostEnabled,
        setBassBoostEnabled,
        isEqEnabled,
        setEqEnabled,
        isLoudnessEnabled,
        setLoudnessEnabled,
        crossfadeEnabled,
        setCrossfadeEnabled,
        crossfadeDuration,
        setCrossfadeDuration
    } = useSettingsStore();

    const isDark = theme === 'dark';
    const [bands, setBands] = useState<{ index: number, frequency: number }[]>([]);

    useEffect(() => {
        const fetchBands = async () => {
            try {
                const b = await AudioEffects.getEqualizerBands();
                if (b && b.length > 0) {
                    setBands(b);
                }
            } catch (e) {
                console.error('Failed to fetch EQ bands:', e);
            }
        };
        fetchBands();
    }, []);

    return (
        <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'} pt-12`}>
            {/* Header */}
            <View className="px-4 flex-row items-center mb-6">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <ArrowLeft size={28} color={isDark ? "#fff" : "#1e293b"} />
                </TouchableOpacity>
                <Text className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Audio Effects</Text>
            </View>

            <ScrollView className="px-4" showsVerticalScrollIndicator={false}>

                {/* Bass Boost */}
                <View className="mb-8">
                    <View className="flex-row justify-between items-center mb-4 px-2">
                        <View className="flex-row items-center">
                            <Zap size={20} color="#10b981" className="mr-2" />
                            <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Bass Boost</Text>
                        </View>
                        <Switch
                            value={isBassBoostEnabled}
                            onValueChange={setBassBoostEnabled}
                            trackColor={{ false: '#3f3f46', true: '#10b981' }}
                            thumbColor="#fff"
                        />
                    </View>
                    <GlassCard intensity={20} tint={isDark ? 'dark' : 'light'}>
                        <View className="p-4">
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-zinc-500">Strength</Text>
                                <Text className="text-emerald-500 font-bold">{Math.round(bassBoostStrength / 10)}%</Text>
                            </View>
                            <Slider
                                style={{ width: '100%', height: 40 }}
                                minimumValue={0}
                                maximumValue={1000}
                                step={10}
                                value={bassBoostStrength}
                                onValueChange={setBassBoostStrength}
                                minimumTrackTintColor="#10b981"
                                maximumTrackTintColor={isDark ? "#3f3f46" : "#e2e8f0"}
                                thumbTintColor="#10b981"
                                disabled={!isBassBoostEnabled}
                            />
                        </View>
                    </GlassCard>
                </View>

                {/* 5-Band Equalizer */}
                <View className="mb-8">
                    <View className="flex-row justify-between items-center mb-4 px-2">
                        <View className="flex-row items-center">
                            <Activity size={20} color="#10b981" className="mr-2" />
                            <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>5-Band EQ</Text>
                        </View>
                        <Switch
                            value={isEqEnabled}
                            onValueChange={setEqEnabled}
                            trackColor={{ false: '#3f3f46', true: '#10b981' }}
                            thumbColor="#fff"
                        />
                    </View>
                    <GlassCard intensity={20} tint={isDark ? 'dark' : 'light'}>
                        <View className="p-4 flex-row justify-between h-48">
                            {eqGains.map((gain, index) => (
                                <View key={index} className="items-center justify-between flex-1">
                                    <Text className="text-emerald-500 text-xs font-bold">{gain > 0 ? `+${gain / 100}` : gain / 100}dB</Text>
                                    <View style={{ height: 120, width: 40, alignItems: 'center', justifyContent: 'center' }}>
                                        <Slider
                                            style={{ width: 120, height: 40, transform: [{ rotate: '-90deg' }] }}
                                            minimumValue={-1500}
                                            maximumValue={1500}
                                            step={100}
                                            value={gain}
                                            onValueChange={(val) => setEqGain(index, val)}
                                            minimumTrackTintColor="#10b981"
                                            maximumTrackTintColor={isDark ? "#3f3f46" : "#e2e8f0"}
                                            thumbTintColor="#10b981"
                                            disabled={!isEqEnabled}
                                        />
                                    </View>
                                    <Text className="text-zinc-500 text-[10px] mt-2">
                                        {bands[index] ? `${Math.round(bands[index].frequency / 1000)}Hz` : EQ_BAND_LABELS[index]}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </GlassCard>
                </View>

                {/* Loudness Normalization */}
                <View className="mb-8">
                    <View className="flex-row justify-between items-center mb-4 px-2">
                        <View className="flex-row items-center">
                            <Volume2 size={20} color="#10b981" className="mr-2" />
                            <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Loudness Normalization</Text>
                        </View>
                        <Switch
                            value={isLoudnessEnabled}
                            onValueChange={setLoudnessEnabled}
                            trackColor={{ false: '#3f3f46', true: '#10b981' }}
                            thumbColor="#fff"
                        />
                    </View>
                    <GlassCard intensity={20} tint={isDark ? 'dark' : 'light'}>
                        <View className="p-4">
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-zinc-500">Target Gain</Text>
                                <Text className="text-emerald-500 font-bold">{loudnessGain} mB</Text>
                            </View>
                            <Slider
                                style={{ width: '100%', height: 40 }}
                                minimumValue={0}
                                maximumValue={1000}
                                step={50}
                                value={loudnessGain}
                                onValueChange={setLoudnessGain}
                                minimumTrackTintColor="#10b981"
                                maximumTrackTintColor={isDark ? "#3f3f46" : "#e2e8f0"}
                                thumbTintColor="#10b981"
                                disabled={!isLoudnessEnabled}
                            />
                            <Text className="text-zinc-600 text-xs mt-2 px-2">Boosts lower volume tracks to ensure a consistent experience.</Text>
                        </View>
                    </GlassCard>
                </View>

                {/* Gapless & Crossfade */}
                <View className="mb-8">
                    <View className="flex-row justify-between items-center mb-4 px-2">
                        <View className="flex-row items-center">
                            <Activity size={20} color="#10b981" className="mr-2" />
                            <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Crossfade</Text>
                        </View>
                        <Switch
                            value={crossfadeEnabled}
                            onValueChange={setCrossfadeEnabled}
                            trackColor={{ false: '#3f3f46', true: '#10b981' }}
                            thumbColor="#fff"
                        />
                    </View>
                    <GlassCard intensity={20} tint={isDark ? 'dark' : 'light'}>
                        <View className="p-4">
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-zinc-500">Duration</Text>
                                <Text className="text-emerald-500 font-bold">{crossfadeDuration} Seconds</Text>
                            </View>
                            <Slider
                                style={{ width: '100%', height: 40 }}
                                minimumValue={0}
                                maximumValue={12}
                                step={1}
                                value={crossfadeDuration}
                                onValueChange={setCrossfadeDuration}
                                minimumTrackTintColor="#10b981"
                                maximumTrackTintColor={isDark ? "#3f3f46" : "#e2e8f0"}
                                thumbTintColor="#10b981"
                                disabled={!crossfadeEnabled}
                            />
                            <Text className="text-zinc-600 text-xs mt-2 px-2">Smoothly blend tracks together for an uninterrupted experience.</Text>
                        </View>
                    </GlassCard>
                </View>

                {/* Streaming Info */}
                <View className="mb-20 items-center">
                    <Text className="text-zinc-500 text-sm">Hi-Res Audio Streaming enabled (320 kbps)</Text>
                </View>

            </ScrollView>
        </View>
    );
}
