import GlassCard from '@/components/GlassCard';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import * as AudioEffects from '@/modules/native-audio-effects';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { Activity, ArrowLeft, RotateCcw, Volume2, Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');
const ACCENT_COLOR = "#10b981"; // Melodix Green

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
        setCrossfadeDuration,
        audioQuality,
        setAudioQuality,
        resetAudioEffects
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

    const handleReset = () => {
        Alert.alert(
            "Reset Audio Effects",
            "Are you sure you want to revert all audio settings to their defaults?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Reset", style: "destructive", onPress: resetAudioEffects }
            ]
        );
    };

    return (
        <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'} pt-12`}>
            {/* Header */}
            <View className="px-6 flex-row items-center justify-between mb-8">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className="mr-5 p-1">
                        <ArrowLeft size={28} color={isDark ? "#fff" : "#1e293b"} />
                    </TouchableOpacity>
                    <Text className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Audio Lab</Text>
                </View>
                <TouchableOpacity onPress={handleReset} className="bg-zinc-800/50 p-3 rounded-full">
                    <RotateCcw size={20} color={ACCENT_COLOR} />
                </TouchableOpacity>
            </View>

            <ScrollView className="px-5" showsVerticalScrollIndicator={false}>

                {/* Audio Quality (Moved to top for visibility) */}
                <View className="mb-10">
                    <View className="flex-row items-center mb-5 px-1">
                        <View className="w-8 h-8 rounded-lg items-center justify-center bg-emerald-500/20 mr-3">
                            <Activity size={18} color={ACCENT_COLOR} />
                        </View>
                        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Streaming Quality</Text>
                    </View>
                    <GlassCard intensity={25} tint={isDark ? 'dark' : 'light'}>
                        <View className="p-5">
                            <View className="flex-row bg-zinc-900/40 rounded-2xl p-1.5">
                                {(["96kbps", "160kbps", "320kbps"] as const).map((q) => (
                                    <TouchableOpacity
                                        key={q}
                                        onPress={() => setAudioQuality(q)}
                                        className={`flex-1 py-3.5 rounded-xl items-center ${audioQuality === q ? 'bg-emerald-600' : 'transparent'}`}
                                    >
                                        <Text className={`font-bold ${audioQuality === q ? 'text-white' : 'text-zinc-400'}`}>
                                            {q === '96kbps' ? 'Basic' : q === '160kbps' ? 'Standard' : 'Extreme'}
                                        </Text>
                                        <Text className={`text-[10px] mt-0.5 ${audioQuality === q ? 'text-white/80' : 'text-zinc-600'}`}>{q}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text className="text-zinc-500 text-xs mt-4 px-1 text-center font-medium">Higher bitrates require a stable internet connection.</Text>
                        </View>
                    </GlassCard>
                </View>

                {/* Bass Boost */}
                <View className="mb-10">
                    <View className="flex-row justify-between items-center mb-5 px-1">
                        <View className="flex-row items-center">
                            <View className="w-8 h-8 rounded-lg items-center justify-center bg-emerald-500/20 mr-3">
                                <Zap size={18} color={ACCENT_COLOR} />
                            </View>
                            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Deep Bass</Text>
                        </View>
                        <Switch
                            value={isBassBoostEnabled}
                            onValueChange={setBassBoostEnabled}
                            trackColor={{ false: '#27272a', true: ACCENT_COLOR }}
                            thumbColor="#fff"
                        />
                    </View>
                    <GlassCard intensity={25} tint={isDark ? 'dark' : 'light'}>
                        <View className="p-5">
                            <View className="flex-row justify-between mb-4">
                                <Text className="text-zinc-400 font-medium">Strength</Text>
                                <Text style={{ color: ACCENT_COLOR }} className="font-black">{Math.round(bassBoostStrength / 10)}%</Text>
                            </View>
                            <Slider
                                style={{ width: '100%', height: 40 }}
                                minimumValue={0}
                                maximumValue={1000}
                                step={10}
                                value={bassBoostStrength}
                                onValueChange={setBassBoostStrength}
                                minimumTrackTintColor={ACCENT_COLOR}
                                maximumTrackTintColor={isDark ? "#27272a" : "#e2e8f0"}
                                thumbTintColor={ACCENT_COLOR}
                                disabled={!isBassBoostEnabled}
                            />
                        </View>
                    </GlassCard>
                </View>

                {/* 5-Band Equalizer */}
                <View className="mb-10">
                    <View className="flex-row justify-between items-center mb-5 px-1">
                        <View className="flex-row items-center">
                            <View className="w-8 h-8 rounded-lg items-center justify-center bg-emerald-500/20 mr-3">
                                <Activity size={18} color={ACCENT_COLOR} />
                            </View>
                            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Precision EQ</Text>
                        </View>
                        <Switch
                            value={isEqEnabled}
                            onValueChange={setEqEnabled}
                            trackColor={{ false: '#27272a', true: ACCENT_COLOR }}
                            thumbColor="#fff"
                        />
                    </View>
                    <GlassCard intensity={25} tint={isDark ? 'dark' : 'light'}>
                        <View className="p-5 flex-row justify-between h-56">
                            {eqGains.map((gain, index) => (
                                <View key={index} className="items-center justify-between flex-1">
                                    <View className="bg-zinc-800/50 px-1.5 py-0.5 rounded-sm">
                                        <Text style={{ color: ACCENT_COLOR }} className="text-[10px] font-black">{gain > 0 ? `+${gain / 100}` : gain / 100}</Text>
                                    </View>
                                    <View style={{ height: 140, width: 40, alignItems: 'center', justifyContent: 'center' }}>
                                        <Slider
                                            style={{ width: 140, height: 40, transform: [{ rotate: '-90deg' }] }}
                                            minimumValue={-1500}
                                            maximumValue={1500}
                                            step={100}
                                            value={gain}
                                            onValueChange={(val) => setEqGain(index, val)}
                                            minimumTrackTintColor={ACCENT_COLOR}
                                            maximumTrackTintColor={isDark ? "#27272a" : "#e2e8f0"}
                                            thumbTintColor={ACCENT_COLOR}
                                            disabled={!isEqEnabled}
                                        />
                                    </View>
                                    <Text className="text-zinc-500 text-[10px] tracking-tighter mt-2 font-bold">
                                        {bands[index] ? `${Math.round(bands[index].frequency / 1000)}Hz` : EQ_BAND_LABELS[index]}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </GlassCard>
                </View>

                {/* Loudness Normalization */}
                <View className="mb-10">
                    <View className="flex-row justify-between items-center mb-5 px-1">
                        <View className="flex-row items-center">
                            <View className="w-8 h-8 rounded-lg items-center justify-center bg-emerald-500/20 mr-3">
                                <Volume2 size={18} color={ACCENT_COLOR} />
                            </View>
                            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Smart Loudness</Text>
                        </View>
                        <Switch
                            value={isLoudnessEnabled}
                            onValueChange={setLoudnessEnabled}
                            trackColor={{ false: '#27272a', true: ACCENT_COLOR }}
                            thumbColor="#fff"
                        />
                    </View>
                    <GlassCard intensity={25} tint={isDark ? 'dark' : 'light'}>
                        <View className="p-5">
                            <View className="flex-row justify-between mb-4">
                                <Text className="text-zinc-400 font-medium">Target Gain</Text>
                                <Text style={{ color: ACCENT_COLOR }} className="font-black">{loudnessGain} mB</Text>
                            </View>
                            <Slider
                                style={{ width: '100%', height: 40 }}
                                minimumValue={0}
                                maximumValue={1000}
                                step={50}
                                value={loudnessGain}
                                onValueChange={setLoudnessGain}
                                minimumTrackTintColor={ACCENT_COLOR}
                                maximumTrackTintColor={isDark ? "#27272a" : "#e2e8f0"}
                                thumbTintColor={ACCENT_COLOR}
                                disabled={!isLoudnessEnabled}
                            />
                            <Text className="text-zinc-500 text-xs mt-3 px-1 leading-4">Maintains consistent volume levels across different recordings.</Text>
                        </View>
                    </GlassCard>
                </View>

                {/* Gapless & Crossfade */}
                <View className="mb-10">
                    <View className="flex-row justify-between items-center mb-5 px-1">
                        <View className="flex-row items-center">
                            <View className="w-8 h-8 rounded-lg items-center justify-center bg-emerald-500/20 mr-3">
                                <Activity size={18} color={ACCENT_COLOR} />
                            </View>
                            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Seamless Crossfade</Text>
                        </View>
                        <Switch
                            value={crossfadeEnabled}
                            onValueChange={setCrossfadeEnabled}
                            trackColor={{ false: '#27272a', true: ACCENT_COLOR }}
                            thumbColor="#fff"
                        />
                    </View>
                    <GlassCard intensity={25} tint={isDark ? 'dark' : 'light'}>
                        <View className="p-5">
                            <View className="flex-row justify-between mb-4">
                                <Text className="text-zinc-400 font-medium">Transition Duration</Text>
                                <Text style={{ color: ACCENT_COLOR }} className="font-black">{crossfadeDuration}s</Text>
                            </View>
                            <Slider
                                style={{ width: '100%', height: 40 }}
                                minimumValue={0}
                                maximumValue={12}
                                step={1}
                                value={crossfadeDuration}
                                onValueChange={setCrossfadeDuration}
                                minimumTrackTintColor={ACCENT_COLOR}
                                maximumTrackTintColor={isDark ? "#27272a" : "#e2e8f0"}
                                thumbTintColor={ACCENT_COLOR}
                                disabled={!crossfadeEnabled}
                            />
                            <Text className="text-zinc-500 text-xs mt-3 px-1 leading-4">Fades songs into each other for an uninterrupted flow.</Text>
                        </View>
                    </GlassCard>
                </View>

                {/* Premium Info Footer */}
                <View className="mt-4 mb-24 items-center">
                    <View className="bg-zinc-800/30 px-4 py-2 rounded-full flex-row items-center">
                        <View className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                        <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Melodix Pro Audio Core v2.0</Text>
                    </View>
                    <Text className="text-zinc-600 text-[9px] mt-3 uppercase tracking-tighter">Professional Frequency Control Engine</Text>
                </View>

            </ScrollView>
        </View>
    );
}
