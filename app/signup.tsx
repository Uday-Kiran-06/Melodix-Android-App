import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { Lock, Mail, Music, User } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import GlassCard from '../components/GlassCard';
import { supabase } from '../services/supabase';

export default function SignupScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSignup = async () => {
        if (!email || !password || !name) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: name }
            }
        });

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            Alert.alert('Success', 'Check your email for the confirmation link!');
            router.replace('/login');
        }
        setLoading(false);
    };

    return (
        <View className="flex-1 bg-black">
            <LinearGradient
                colors={['#0f172a', '#020617']}
                className="absolute w-full h-full"
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 justify-center px-6"
            >
                <View className="items-center mb-10">
                    <View
                        className="w-16 h-16 rounded-2xl items-center justify-center mb-4 bg-zinc-900 border border-zinc-800"
                    >
                        <Music size={32} color="#10b981" />
                    </View>
                    <Text className="text-white text-3xl font-bold tracking-tight">Create Account</Text>
                    <Text className="text-zinc-500 mt-1 font-medium">Join our growing community</Text>
                </View>

                <GlassCard intensity={30} style={{ padding: 24 }}>
                    <View className="flex-row items-center bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-4 py-3 mb-4">
                        <User size={20} color="#52525b" className="mr-3" />
                        <TextInput
                            placeholder="Full Name"
                            placeholderTextColor="#52525b"
                            className="flex-1 text-white"
                            value={name}
                            onChangeText={setName}
                        />
                    </View>

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
                        onPress={handleSignup}
                        disabled={loading}
                        className="bg-emerald-600 py-4 rounded-xl items-center"
                    >
                        <Text className="text-white font-bold text-lg">
                            {loading ? 'Creating...' : 'Sign Up'}
                        </Text>
                    </TouchableOpacity>

                    <View className="flex-row justify-center mt-6">
                        <Text className="text-gray-400">Already have an account? </Text>
                        <Link href="/login" asChild>
                            <TouchableOpacity>
                                <Text className="text-emerald-500 font-bold">Login</Text>
                            </TouchableOpacity>
                        </Link>
                    </View>
                </GlassCard>
            </KeyboardAvoidingView>
        </View>
    );
}
