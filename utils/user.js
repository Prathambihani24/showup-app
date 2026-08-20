import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getCurrentUser() {
  const id = await AsyncStorage.getItem('showup_user_id');
  const name = await AsyncStorage.getItem('showup_user_name');
  return { id, name };
}