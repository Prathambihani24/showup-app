import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://nyqjraaggqwehuxhqajz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55cWpyYWFnZ3F3ZWh1eGhxYWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMzkwMzksImV4cCI6MjA5NzYxNTAzOX0.gCCI2dUdt2o9hd0dgbzaITjQWcq8dnhnTzMLGl4hZFU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});