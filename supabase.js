// supabase.js
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://nyqjraaggqwehuxhqajz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55cWpyYWFnZ3F3ZWh1eGhxYWp6Iiwicm9sZSI6ImFub25fa2V5IiwiaWF0IjoxNzU0MTIwNTA5LCJleHAiOjIwNjk2OTY1MDl9.1vQ8vJq7QqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqK';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
