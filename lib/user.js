// lib/user.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const STORAGE_KEYS = {
  USER_ID: 'showup_user_id',
  USER_NAME: 'showup_user_name',
  USER_CAMPUS: 'showup_user_campus',
  USER_AREA: 'showup_user_area',
  ONBOARDED: 'showup_onboarded',
};

export async function getCurrentUser() {
  // Priority: Supabase Auth session > AsyncStorage
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.user) {
    const { data: profile } = await supabase
      .from('users')
      .select('id, name, campus, area, is_verified')
      .eq('id', session.user.id)
      .single();
    
    if (profile) {
      return {
        id: profile.id,
        name: profile.name,
        campus: profile.campus,
        area: profile.area,
        isVerified: profile.is_verified,
        source: 'supabase',
      };
    }
    // Fallback to session metadata
    return {
      id: session.user.id,
      name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
      campus: null,
      area: null,
      isVerified: false,
      source: 'supabase',
    };
  }
  
  // Fallback to AsyncStorage (legacy)
  const id = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
  const name = await AsyncStorage.getItem(STORAGE_KEYS.USER_NAME);
  const campus = await AsyncStorage.getItem(STORAGE_KEYS.USER_CAMPUS);
  const area = await AsyncStorage.getItem(STORAGE_KEYS.USER_AREA);
  const onboarded = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDED);
  
  return { id, name, campus, area, isVerified: onboarded === 'true', source: 'asyncstorage' };
}

export async function saveUserLocal(user) {
  await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, user.id);
  await AsyncStorage.setItem(STORAGE_KEYS.USER_NAME, user.name);
  if (user.campus) await AsyncStorage.setItem(STORAGE_KEYS.USER_CAMPUS, user.campus);
  if (user.area) await AsyncStorage.setItem(STORAGE_KEYS.USER_AREA, user.area);
  if (user.isVerified) await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDED, 'true');
}

export async function clearUserLocal() {
  await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
}

export async function updateUserProfile(updates) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { error: 'No session' };
  
  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', session.user.id);
  
  if (!error) {
    await saveUserLocal({ ...await getCurrentUser(), ...updates });
  }
  return { error };
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function getOrCreateUser() {
  let userId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
  let userName = await AsyncStorage.getItem(STORAGE_KEYS.USER_NAME);
  
  if (!userId) {
    userId = generateUUID();
    userName = 'Showupper';
    await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, userId);
    await AsyncStorage.setItem(STORAGE_KEYS.USER_NAME, userName);
    
    await supabase.from('users').insert({
      id: userId,
      name: userName,
      campus: 'Pune, India',
    });
  }
  
  return { userId, userName };
}

export async function updateUserName(name) {
  const userId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
  await AsyncStorage.setItem(STORAGE_KEYS.USER_NAME, name);
  await supabase.from('users').update({ name }).eq('id', userId);
}