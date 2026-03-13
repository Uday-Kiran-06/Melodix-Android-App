import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { ArrowLeft, Lock, Mail, Music } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View, ActivityIndicator, Image } from 'react-native';
import { useAuth } from '../components/AuthContext';
import GlassCard from '../components/GlassCard';
import { supabase } from '../services/supabase';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const router = useRouter();
    const { signInWithGoogle } = useAuth();

    const handleLogin = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            router.replace('/(tabs)');
        }
        setLoading(false);
    };

    const handleGoogleLogin = async () => {
        setGoogleLoading(true);
        try {
            await signInWithGoogle();
        } catch (error: any) {
            Alert.alert('Google Login Error', error.message);
        } finally {
            setGoogleLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-black">
            <LinearGradient
                colors={['#0f172a', '#020617']}
                className="absolute w-full h-full"
            />

            <TouchableOpacity
                onPress={() => router.replace('/(tabs)')}
                className="absolute top-12 left-6 z-10 w-10 h-10 items-center justify-center rounded-full bg-zinc-900/50 border border-zinc-800"
            >
                <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 justify-center px-6"
            >
                <View className="items-center mb-10">
                    <View
                        className="w-20 h-20 rounded-2xl items-center justify-center mb-4 bg-zinc-900 border border-zinc-800"
                    >
                        <Music size={40} color="#10b981" />
                    </View>
                    <Text className="text-white text-4xl font-bold tracking-tight">Melodix</Text>
                    <Text className="text-zinc-500 mt-2 font-medium">Your personal music companion</Text>
                </View>

                <GlassCard intensity={30} style={{ padding: 24 }}>
                    <Text className="text-white text-2xl font-bold mb-6">Login</Text>

                    <View className="flex-row items-center bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-4 py-3 mb-4">
                        <Mail size={20} color="#52525b" className="mr-3" />
                        <TextInput
                            placeholder="Email"
                            placeholderTextColor="#52525b"
                            className="flex-1 text-white"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View className="flex-row items-center bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-4 py-3 mb-8">
                        <Lock size={20} color="#52525b" className="mr-3" />
                        <TextInput
                            placeholder="Password"
                            placeholderTextColor="#52525b"
                            className="flex-1 text-white"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleLogin}
                        disabled={loading || googleLoading}
                        className="bg-emerald-600 py-4 rounded-xl items-center mb-4"
                    >
                        <Text className="text-white font-bold text-lg">
                            {loading ? 'Logging in...' : 'Sign In'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleGoogleLogin}
                        disabled={loading || googleLoading}
                        className="bg-white py-4 rounded-xl items-center flex-row justify-center shadow-lg"
                        style={{ elevation: 3 }}
                    >
                        {googleLoading ? (
                            <ActivityIndicator color="#000" size="small" />
                        ) : (
                            <>
                                <Image 
                                    source={{ uri: 'https://developers.google.com/static/identity/images/g-logo.png' }} 
                                    style={{ width: 24, height: 24 }}
                                    resizeMode="contain"
                                    className="mr-3"
                                />
                                <Text className="text-zinc-900 font-bold text-lg">
                                    Continue with Google
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <View className="flex-row justify-center mt-6">
                        <Text className="text-gray-400">Don't have an account? </Text>
                        <Link href="/signup" asChild>
                            <TouchableOpacity>
                                <Text className="text-emerald-500 font-bold">Sign Up</Text>
                            </TouchableOpacity>
                        </Link>
                    </View>
                </GlassCard>
            </KeyboardAvoidingView>
        </View>
    );
}
