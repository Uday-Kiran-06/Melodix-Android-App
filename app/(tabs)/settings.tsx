import { useAuth } from '@/components/AuthContext';
import GlassCard from '@/components/GlassCard';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Activity, ArrowDownCircle, ChevronRight, Info, LogOut, Moon, Shield, Sun, User, Volume2 } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Switch, Text, TouchableOpacity, View, Alert } from 'react-native';
import * as Updates from 'expo-updates';

import { jioSaavnService } from '@/services/jiosaavn';

export default function SettingsScreen() {
    const { user, signOut } = useAuth();
    const { audioQuality, setAudioQuality, theme, setTheme } = useSettingsStore();
    const router = useRouter();

    const handleSignOut = async () => {
        await signOut();
        router.replace('/login');
    };

    const qualities: { label: string; value: typeof audioQuality }[] = [
        { label: 'Low (12kbps)', value: '12kbps' },
        { label: 'Medium (96kbps)', value: '96kbps' },
        { label: 'High (160kbps)', value: '160kbps' },
        { label: 'Extreme (320kbps)', value: '320kbps' },
    ];

    const handleCheckForUpdates = async () => {
        if (__DEV__) {
            Alert.alert("Development Mode", "Updates are not available in development mode.");
            return;
        }

        if (!Updates.isEnabled) {
            Alert.alert("Updates Disabled", "Over-the-air updates are not enabled for this build.");
            return;
        }
        
        try {
            const update = await Updates.checkForUpdateAsync();
            if (update.isAvailable) {
                Alert.alert(
                    "Update Available",
                    "A new version of Melodix is available. Would you like to update now?",
                    [
                        { text: "Later", style: "cancel" },
                        { text: "Update Now", onPress: async () => {
                            await Updates.fetchUpdateAsync();
                            await Updates.reloadAsync();
                        }}
                    ]
                );
            } else {
                Alert.alert("Up to Date", "You are already on the latest version of Melodix.");
            }
        } catch (error: any) {
            console.error("Update check failed:", error);
            
            const errorMessage = error?.message || "";
            const isServiceUnreachable = errorMessage.includes("checkForUpdateAsync") || 
                                       errorMessage.includes("Failed to check for update");

            if (isServiceUnreachable) {
                Alert.alert(
                    "Update Service Offline",
                    "The update service is currently unreachable or not configured for this build. This is common in development or preview versions.\n\nYou can always check the latest releases on our documentation or GitHub."
                );
            } else {
                const isConnected = await jioSaavnService.checkConnection();
                if (!isConnected) {
                    Alert.alert("Connection Error", "Please check your internet connection and try again.");
                } else {
                    Alert.alert(
                        "Update Error", 
                        `An unexpected error occurred while checking for updates.\n\nCode: ${error.code || 'UNKNOWN'}\nMessage: ${errorMessage.split('\n')[0]}`
                    );
                }
            }
        }
    };

    const isDark = theme === 'dark';
    const [isQualityExpanded, setIsQualityExpanded] = React.useState(false);

    return (
        <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'} pt-12`}>
            <View className="px-4 mb-6">
                <Text className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Settings</Text>
            </View>

            <ScrollView className="px-4" showsVerticalScrollIndicator={false}>
                {/* Profile Section */}
                {user ? (
                    <>
                        <Text className="text-gray-400 font-bold mb-4 uppercase text-xs tracking-widest">Profile</Text>
                        <GlassCard intensity={30} tint={isDark ? 'dark' : 'light'} style={{ marginBottom: 24 }}>
                            <View className="flex-row items-center">
                                {user?.user_metadata?.avatar_url ? (
                                    <Image
                                        source={{ uri: user.user_metadata.avatar_url }}
                                        className="w-16 h-16 rounded-full mr-4"
                                        transition={200}
                                        contentFit="cover"
                                    />
                                ) : (
                                    <View className={`w-16 h-16 ${isDark ? 'bg-transparent border border-zinc-800' : 'bg-slate-200'} rounded-full items-center justify-center mr-4`}>
                                        <User size={32} color={isDark ? "#71717a" : "#64748b"} />
                                    </View>
                                )}
                                <View className="flex-1">
                                    <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={1}>
                                        {user?.user_metadata?.full_name || 'Music Lover'}
                                    </Text>
                                    <Text className="text-gray-500">{user?.email}</Text>
                                </View>
                            </View>
                        </GlassCard>
                    </>
                ) : (
                    <TouchableOpacity
                        onPress={() => router.push('/login')}
                        className={`flex-row items-center justify-center ${isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200 shadow-sm'} py-4 rounded-2xl mb-8 border`}
                    >
                        <User size={20} color="#10b981" className="mr-2" />
                        <Text className="text-emerald-500 font-bold text-lg">Log In / Sign Up</Text>
                    </TouchableOpacity>
                )}

                {/* Appearance Section */}
                <Text className="text-gray-400 font-bold mb-4 uppercase text-xs tracking-widest">Appearance</Text>
                <GlassCard intensity={20} tint={isDark ? 'dark' : 'light'} style={{ marginBottom: 24 }}>
                    <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center">
                            {isDark ? <Moon size={20} color="#71717a" className="mr-3" /> : <Sun size={20} color="#f59e0b" className="mr-3" />}
                            <Text className={`text-lg ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                {isDark ? 'Dark Theme' : 'Light Theme'}
                            </Text>
                        </View>
                        <Switch
                            value={isDark}
                            onValueChange={(val) => setTheme(val ? 'dark' : 'light')}
                            trackColor={{ false: '#3f3f46', true: '#10b981' }}
                            thumbColor="#fff"
                        />
                    </View>
                </GlassCard>

                {/* Audio Quality Section */}
                <Text className="text-gray-400 font-bold mb-4 uppercase text-xs tracking-widest">Audio & Effects</Text>
                <GlassCard intensity={20} tint={isDark ? 'dark' : 'light'} style={{ marginBottom: 24 }}>
                    <TouchableOpacity
                        onPress={() => router.push('/audio-settings' as any)}
                        className={`flex-row justify-between items-center p-4 border-b ${isDark ? 'border-zinc-800' : 'border-slate-200'}`}
                    >
                        <View className="flex-row items-center">
                            <Activity size={20} color="#10b981" className="mr-3" />
                            <Text className={`text-lg ${isDark ? 'text-white' : 'text-slate-800'}`}>Equalizer & Bass Boost</Text>
                        </View>
                        <ChevronRight size={20} color="#71717a" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setIsQualityExpanded(!isQualityExpanded)}
                        className={`flex-row justify-between items-center p-4 ${isQualityExpanded ? (isDark ? 'border-b border-zinc-800' : 'border-b border-slate-200') : ''}`}
                    >
                        <View className="flex-row items-center">
                            <Volume2 size={20} color="#10b981" className="mr-3" />
                            <Text className={`text-lg ${isDark ? 'text-white' : 'text-slate-800 font-bold'}`}>
                                Quality: {qualities.find(q => q.value === audioQuality)?.label.split(' ')[0]}
                            </Text>
                        </View>
                        <ChevronRight size={20} color="#71717a" style={{ transform: [{ rotate: isQualityExpanded ? '90deg' : '0deg' }] }} />
                    </TouchableOpacity>

                    {isQualityExpanded && qualities.map((q, index) => (
                        <TouchableOpacity
                            key={q.value}
                            onPress={() => {
                                setAudioQuality(q.value);
                                setIsQualityExpanded(false);
                            }}
                            className={`flex-row justify-between items-center p-4 pl-8 ${index !== qualities.length - 1 ? (isDark ? 'border-b border-zinc-800' : 'border-b border-slate-200') : ''}`}
                        >
                            <Text className={`text-lg ${audioQuality === q.value ? 'text-emerald-500 font-bold' : (isDark ? 'text-gray-400' : 'text-slate-600')}`}>
                                {q.label}
                            </Text>
                            {audioQuality === q.value && <View className="w-2 h-2 bg-emerald-500 rounded-full" />}
                        </TouchableOpacity>
                    ))}
                </GlassCard>

                {/* App Info */}
                <View className="mb-8">
                    <Text className={`text-sm font-bold ${isDark ? 'text-zinc-500' : 'text-slate-400'} uppercase mb-4 px-2 tracking-widest`}>App Info</Text>
                    <GlassCard intensity={isDark ? 5 : 10} style={{ overflow: 'hidden' }}>
                        <TouchableOpacity className={`p-4 border-b ${isDark ? 'border-zinc-800/50' : 'border-slate-200'}`}>
                            <View className="flex-row items-center mb-1">
                                <Shield size={16} color={isDark ? "#10b981" : "#059669"} className="mr-2" />
                                <Text className={`${isDark ? 'text-white' : 'text-slate-800'} font-medium`}>Privacy Policy</Text>
                            </View>
                            <Text className="text-zinc-500 text-xs">We respect your privacy. No personal music data is shared with third parties.</Text>
                        </TouchableOpacity>
                        <View className="p-4">
                            <View className="flex-row justify-between items-center">
                                <View className="flex-row items-center">
                                    <Info size={16} color={isDark ? "#71717a" : "#64748b"} className="mr-2" />
                                    <Text className={`${isDark ? 'text-white' : 'text-slate-800'} font-medium`}>App Version</Text>
                                </View>
                                <Text className="text-zinc-500 font-bold">1.0.5 (Melux-Edit)</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={handleCheckForUpdates} className={`p-4 border-t ${isDark ? 'border-zinc-800/50' : 'border-slate-200'} flex-row justify-between items-center`}>
                            <View className="flex-row items-center">
                                <ArrowDownCircle size={16} color={isDark ? "#10b981" : "#059669"} className="mr-2" />
                                <Text className={`${isDark ? 'text-white' : 'text-slate-800'} font-medium`}>Check for Updates</Text>
                            </View>
                            <ChevronRight size={16} color="#71717a" />
                        </TouchableOpacity>
                    </GlassCard>
                </View>

                {/* Auth Section */}
                {user && (
                    <TouchableOpacity
                        onPress={handleSignOut}
                        className={`flex-row items-center justify-center ${isDark ? 'bg-transparent border-red-500/20' : 'bg-white border-red-200 shadow-sm'} py-4 rounded-2xl mb-20 border`}
                    >
                        <LogOut size={20} color="#ef4444" className="mr-2" />
                        <Text className="text-red-500 font-bold text-lg">Log Out</Text>
                    </TouchableOpacity>
                )}
                {/* Footer credit */}
                <View className="items-center mb-10">
                    <Text className={`text-xs ${isDark ? 'text-zinc-600' : 'text-slate-400'}`}>Developed by UK</Text>
                </View>
            </ScrollView>
        </View>
    );
}
