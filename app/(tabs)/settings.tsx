import { useAuth } from '@/components/AuthContext';
import GlassCard from '@/components/GlassCard';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Activity, ArrowDownCircle, ChevronRight, Info, LogOut, Moon, Shield, Sun, User, Volume2, Settings as SettingsIcon } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Switch, Text, TouchableOpacity, View, Alert } from 'react-native';
import * as Updates from 'expo-updates';

import { jioSaavnService } from '@/services/jiosaavn';

const ACCENT_COLOR = "#10b981"; // Melodix Green

export default function SettingsScreen() {
    const { user, signOut } = useAuth();
    const { audioQuality, theme, setTheme } = useSettingsStore();
    const router = useRouter();

    const handleSignOut = async () => {
        Alert.alert(
            "Log Out",
            "Are you sure you want to sign out of Melodix?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Log Out", style: "destructive", onPress: async () => {
                    await signOut();
                    router.replace('/login');
                }}
            ]
        );
    };

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
            const errorMessage = error?.message || "Unknown error";
            Alert.alert("Update Error", `Failed to check for updates: ${errorMessage}`);
        }
    };

    const isDark = theme === 'dark';

    return (
        <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-slate-50'} pt-12`}>
            {/* Header */}
            <View className="px-6 mb-8 flex-row justify-between items-center">
                <Text className={`text-4xl font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>Settings</Text>
                <View className="w-10 h-10 rounded-full bg-zinc-800/50 items-center justify-center">
                    <SettingsIcon size={20} color={isDark ? "#71717a" : "#64748b"} />
                </View>
            </View>

            <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
                {/* Profile Section */}
                {user ? (
                    <View className="mb-10">
                        <Text className={`text-[10px] font-black uppercase tracking-[2px] mb-4 ml-1 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Subscriber Profile</Text>
                        <GlassCard intensity={35} tint={isDark ? 'dark' : 'light'}>
                            <View className="p-5 flex-row items-center">
                                {user?.user_metadata?.avatar_url ? (
                                    <Image
                                        source={{ uri: user.user_metadata.avatar_url }}
                                        className="w-16 h-16 rounded-2xl mr-5"
                                        transition={200}
                                        contentFit="cover"
                                    />
                                ) : (
                                    <View className={`w-16 h-16 ${isDark ? 'bg-zinc-800/50' : 'bg-slate-200'} rounded-2xl items-center justify-center mr-5 border border-zinc-700/30`}>
                                        <User size={32} color={isDark ? "#71717a" : "#64748b"} />
                                    </View>
                                )}
                                <View className="flex-1">
                                    <View className="flex-row items-center mb-0.5">
                                        <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={1}>
                                            {user?.user_metadata?.full_name || 'Music Lover'}
                                        </Text>
                                        <View className="ml-2 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                                            <Text className="text-emerald-500 text-[8px] font-black uppercase">Pro</Text>
                                        </View>
                                    </View>
                                    <Text className="text-zinc-500 text-sm font-medium">{user?.email}</Text>
                                </View>
                            </View>
                        </GlassCard>
                    </View>
                ) : (
                    <TouchableOpacity
                        onPress={() => router.push('/login?mode=connect')}
                        activeOpacity={0.8}
                        className={`flex-row items-center justify-center bg-emerald-600 py-4 rounded-3xl mb-10 shadow-lg shadow-emerald-500/30`}
                    >
                        <User size={20} color="#fff" strokeWidth={2.5} className="mr-2" />
                        <Text className="text-white font-black text-lg">Connect Account</Text>
                    </TouchableOpacity>
                )}

                {/* Appearance Section */}
                <View className="mb-10">
                    <Text className={`text-[10px] font-black uppercase tracking-[2px] mb-4 ml-1 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Look & Feel</Text>
                    <GlassCard intensity={25} tint={isDark ? 'dark' : 'light'}>
                        <View className="p-5 flex-row justify-between items-center">
                            <View className="flex-row items-center">
                                <View className={`w-8 h-8 rounded-lg items-center justify-center ${isDark ? 'bg-zinc-800/50' : 'bg-slate-200'} mr-4`}>
                                    {isDark ? <Moon size={18} color={ACCENT_COLOR} /> : <Sun size={18} color="#f59e0b" />}
                                </View>
                                <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                    {isDark ? 'Dark Mode' : 'Light Mode'}
                                </Text>
                            </View>
                            <Switch
                                value={isDark}
                                onValueChange={(val) => setTheme(val ? 'dark' : 'light')}
                                trackColor={{ false: '#27272a', true: ACCENT_COLOR }}
                                thumbColor="#fff"
                            />
                        </View>
                    </GlassCard>
                </View>

                {/* Audio Section */}
                <View className="mb-10">
                    <Text className={`text-[10px] font-black uppercase tracking-[2px] mb-4 ml-1 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Playback Engine</Text>
                    <GlassCard intensity={25} tint={isDark ? 'dark' : 'light'}>
                        <TouchableOpacity
                            onPress={() => router.push('/audio-settings' as any)}
                            activeOpacity={0.7}
                            className="p-5 flex-row justify-between items-center"
                        >
                            <View className="flex-row items-center">
                                <View className={`w-8 h-8 rounded-lg items-center justify-center ${isDark ? 'bg-zinc-800/50' : 'bg-slate-200'} mr-4`}>
                                    <Activity size={18} color={ACCENT_COLOR} />
                                </View>
                                <View>
                                    <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Audio Lab</Text>
                                    <Text className="text-zinc-500 text-xs font-medium">EQ, Bass, {audioQuality} Streaming</Text>
                                </View>
                            </View>
                            <ChevronRight size={20} color={isDark ? "#3f3f46" : "#cbd5e1"} />
                        </TouchableOpacity>
                    </GlassCard>
                </View>

                {/* Technical Section */}
                <View className="mb-10">
                    <Text className={`text-[10px] font-black uppercase tracking-[2px] mb-4 ml-1 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>System & Info</Text>
                    <GlassCard intensity={15} tint={isDark ? 'dark' : 'light'}>
                        <TouchableOpacity 
                            onPress={handleCheckForUpdates}
                            className={`p-5 flex-row justify-between items-center border-b ${isDark ? 'border-zinc-800/50' : 'border-slate-100'}`}
                        >
                            <View className="flex-row items-center">
                                <ArrowDownCircle size={18} color={isDark ? "#71717a" : "#64748b"} className="mr-4" />
                                <Text className={`text-base font-bold ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Check for Updates</Text>
                            </View>
                            <Text className={`text-[10px] font-black ${isDark ? 'text-zinc-600' : 'text-slate-400'} mr-2`}>v1.0.5</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            onPress={() => {
                                Alert.alert(
                                    "Privacy Protocol",
                                    "Your privacy is our priority. Melodix does not sell or share your music listening history with third-party advertisers. All downloads are stored locally and encrypted. We only collect basic diagnostic data to improve your experience.",
                                    [{ text: "Understood", style: "default" }]
                                );
                            }}
                            className={`p-5 flex-row justify-between items-center border-b ${isDark ? 'border-zinc-800/50' : 'border-slate-100'}`}
                        >
                            <View className="flex-row items-center">
                                <Shield size={18} color={isDark ? "#71717a" : "#64748b"} className="mr-4" />
                                <Text className={`text-base font-bold ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Privacy Protocol</Text>
                            </View>
                            <ChevronRight size={16} color={isDark ? "#3f3f46" : "#cbd5e1"} />
                        </TouchableOpacity>

                        <View className="p-5 flex-row justify-between items-center">
                            <View className="flex-row items-center">
                                <Info size={18} color={isDark ? "#71717a" : "#64748b"} className="mr-4" />
                                <Text className={`text-base font-bold ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Core Version</Text>
                            </View>
                            <Text className="text-zinc-500 font-bold text-xs">Melux-Edit</Text>
                        </View>
                    </GlassCard>
                </View>

                {/* Danger Zone */}
                {user && (
                    <TouchableOpacity
                        onPress={handleSignOut}
                        activeOpacity={0.7}
                        className={`flex-row items-center justify-center border ${isDark ? 'border-red-500/20 bg-red-500/5' : 'border-red-100 bg-red-50'} py-4 rounded-2xl mb-12`}
                    >
                        <LogOut size={18} color="#ef4444" className="mr-2" />
                        <Text className="text-red-500 font-bold">Sign Out</Text>
                    </TouchableOpacity>
                )}

                {/* Footer Attribution */}
                <View className="items-center mb-24 opacity-40">
                    <Text className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-700' : 'text-slate-400'}`}>Engineered by Uday Kiran</Text>
                </View>
            </ScrollView>
        </View>
    );
}
