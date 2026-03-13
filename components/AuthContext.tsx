import { Session, User } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const initializeAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const signInWithGoogle = async () => {
        const redirectTo = Linking.createURL('/login');
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
                skipBrowserRedirect: true,
            },
        });
        
        if (error) throw error;

        if (data?.url) {
            const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
            
            if (result.type === 'success' && result.url) {
                // Manually parse fragment since Linking.parse might not include it in all versions
                const urlParts = result.url.split('#');
                const fragment = urlParts.length > 1 ? urlParts[1] : '';
                const { queryParams } = Linking.parse(result.url);
                
                // Helper to get param from fragment string
                const getFragmentParam = (key: string) => {
                    const match = fragment.match(new RegExp(`${key}=([^&]*)`));
                    return match ? match[1] : null;
                };

                const accessToken = getFragmentParam('access_token') || queryParams?.access_token;
                const refreshToken = getFragmentParam('refresh_token') || queryParams?.refresh_token;

                if (accessToken && refreshToken) {
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: Array.isArray(accessToken) ? accessToken[0] : accessToken,
                        refresh_token: Array.isArray(refreshToken) ? refreshToken[0] : refreshToken,
                    });
                    if (sessionError) console.error('Error setting Supabase session:', sessionError);
                    else router.replace('/(tabs)'); // Redirect on success
                }
            } else if (result.type === 'cancel') {
                console.log('User cancelled Google Login');
            }
        }
    };

    return (
        <AuthContext.Provider value={{ session, user, loading, signOut, signInWithGoogle }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
