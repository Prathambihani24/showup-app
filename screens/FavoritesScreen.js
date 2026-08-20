import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import { getCurrentUser } from '../lib/user';

export default function FavoritesScreen() {
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState(null);

  const fetchSaved = useCallback(async (uid) => {
    const { data, error } = await supabase
      .from('saved_plans')
      .select('plan_id, plans(*)')
      .eq('user_id', uid);
    if (!error) {
      setSaved((data || []).filter(row => row.plans).map(row => row.plans));
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    getCurrentUser().then(u => {
      setUserId(u.id);
      if (u.id) fetchSaved(u.id);
      else setLoading(false);
    });
  }, []);

  const removeSaved = async (planId) => {
    setSaved(saved.filter(p => p.id !== planId));
    await supabase.from('saved_plans').delete().eq('plan_id', planId).eq('user_id', userId);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#7C3AED" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>saved<Text style={styles.dot}>.</Text></Text>
          <Text style={styles.subtitle}>plans you're vibing with</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSaved(userId); }} tintColor="#7C3AED" />
        }
      >
        {saved.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🤍</Text>
            <Text style={styles.emptyTitle}>nothing saved yet</Text>
            <Text style={styles.emptySub}>tap 🤍 on any plan to save it</Text>
          </View>
        ) : saved.map(plan => (
          <View key={plan.id} style={styles.card}>
            <View style={styles.cardInner}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{plan.user_name?.[0]?.toUpperCase() || '?'}</Text>
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardName}>{plan.user_name}</Text>
                  <Text style={styles.cardLocation}>📍 {plan.location_name}</Text>
                </View>
                <TouchableOpacity onPress={() => removeSaved(plan.id)}>
                  <Text style={styles.heart}>❤️</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.cardActivity}>{plan.activity}</Text>
              <Text style={styles.cardMetaText}>⏰ {plan.time_label} · 👥 {plan.spots_left} spots left</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  loadingContainer: { flex: 1, backgroundColor: '#FAFAFA', justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  title: { fontSize: 32, fontWeight: '900', color: '#0a0a0a', letterSpacing: -1.5 },
  dot: { color: '#7C3AED' },
  subtitle: { fontSize: 13, color: '#999', marginTop: 4, fontWeight: '500' },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { color: '#0a0a0a', fontSize: 22, fontWeight: '800' },
  emptySub: { color: '#C4C4C4', fontSize: 14, marginTop: 8, fontWeight: '500' },
  card: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 14, borderWidth: 1, borderColor: '#F5F5F5', shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 4 }, shadowRadius: 16, elevation: 3 },
  cardInner: { padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F3EEFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#7C3AED', fontWeight: '800', fontSize: 17 },
  cardMeta: { flex: 1, marginLeft: 10 },
  cardName: { color: '#0a0a0a', fontWeight: '700', fontSize: 14 },
  cardLocation: { color: '#999', fontSize: 12, marginTop: 1 },
  heart: { fontSize: 22 },
  cardActivity: { color: '#0a0a0a', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  cardMetaText: { color: '#999', fontSize: 12 },
});