import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://tuuctsouyazvyxlcwsnf.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1dWN0c291eWF6dnl4bGN3c25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MTU2NjksImV4cCI6MjA4ODE5MTY2OX0.YGgNv-BdSrYTa6sxP14N9QwVI3cSykTP-IrBUMQmb7s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
