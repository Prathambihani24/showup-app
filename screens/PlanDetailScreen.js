import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { getOrCreateUser } from '../lib/user';
import { getCurrentLocation, getDistanceFromLatLonInKm } from '../lib/location';

export default function PlanDetailScreen({ route, navigation }) {
  const { planId } = route.params;
  const [plan, setPlan] = useState(null);
  const [joinedUsers, setJoinedUsers] = useState([]);
  const [hasJoined, setHasJoined] = useState(false);
  const [userId, setUserId] = useState(null);
  const [distance, setDistance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { init(); }, []);
  const init = async () => {
    const user = await getOrCreateUser();
    setUserId(user.userId); await loadPlan(user.userId);
  };

  const loadPlan = async (uid) => {
    const { data, error } = await supabase.from('plans').select('*').eq('id', planId).single();
    if (error || !data) { navigation.goBack(); return; }
    setPlan(data);
    try { const loc = await getCurrentLocation(); const dist = getDistanceFromLatLonInKm(loc.latitude, loc.longitude, data.latitude, data.longitude); setDistance(dist.toFixed(1)); } catch (e) { setDistance('?'); }
    const { data: jd } = await supabase.from('plan_joins').select('*').eq('plan_id', planId).eq('user_id', uid);
    setHasJoined(jd && jd.length > 0);
    const { data: joins } = await supabase.from('plan_joins').select('user_id, user_name').eq('plan_id', planId);
    setJoinedUsers(joins || []); setLoading(false);
  };

  const handleJoin = async () => {
    if (!plan || plan.spots_left <= 0 || hasJoined) return;
    const { error } = await supabase.from('plan_joins').insert({ plan_id: planId, user_id: userId });
    if (error) { Alert.alert('Oops', 'Could not join'); return; }
    await supabase.from('plans').update({ spots_left: plan.spots_left - 1 }).eq('id', planId);
    setHasJoined(true); setPlan({ ...plan, spots_left: plan.spots_left - 1 }); loadPlan(userId);
  };

  if (loading || !plan) return <SafeAreaView style={styles.container}><TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 20 }}><Text style={{ color: '#fff' }}>← back</Text></TouchableOpacity></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <LinearGradient colors={['rgba(139,92,246,0.25)', 'rgba(236,72,153,0.1)', 'transparent']} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 20, paddingBottom: 10 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>← back</Text>
          </TouchableOpacity>
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.avatarRing}><View style={styles.avatarLarge}><Text style={styles.avatarText}>{plan.user_name?.[0] || '?'}</Text></View></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroName}>{plan.user_name}</Text>
                <Text style={styles.heroMeta}>📍 {plan.location_name} • {distance} km</Text>
              </View>
            </View>
            <Text style={styles.heroActivity}>{plan.activity}</Text>
            <View style={styles.heroTags}>
              <View style={styles.tag}><Text style={styles.tagText}>⏰ {plan.time_label}</Text></View>
              <View style={styles.tag}><Text style={styles.tagText}>{plan.category}</Text></View>
              <View style={[styles.tag, plan.spots_left === 0 && styles.tagFull]}><Text style={styles.tagText}>{plan.spots_left} spots left</Text></View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.joinBtn, (hasJoined || plan.spots_left === 0) && styles.joinBtnDone]} onPress={handleJoin} disabled={hasJoined || plan.spots_left === 0}>
            <Text style={styles.actionBtnText}>{hasJoined ? "you're in ✅" : plan.spots_left === 0 ? "full 😔" : "i'm in 🙋"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.chatBtn]} onPress={() => navigation.navigate('Chat', { planId, planName: plan.activity })}>
            <Text style={styles.actionBtnText}>💬 chat</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHO'S GOING ({joinedUsers.length})</Text>
          {joinedUsers.length === 0 ? <Text style={styles.emptyText}>No one yet. Be the first! 🔥</Text> : (
            <View style={styles.peopleRow}>
              {joinedUsers.map((u, i) => (
                <View key={i} style={styles.person}>
                  <View style={styles.personAvatar}><Text style={styles.personAvatarText}>{u.user_name?.[0] || '?'}</Text></View>
                  <Text style={styles.personName}>{u.user_name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  hero: { paddingBottom: 24 },
  heroCard: { marginHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  avatarRing: { width: 60, height: 60, borderRadius: 30, padding: 3, borderWidth: 2, borderColor: '#8B5CF6', marginRight: 16 },
  avatarLarge: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroName: { color: '#fff', fontSize: 20, fontWeight: '900' },
  heroMeta: { color: '#555', fontSize: 13, marginTop: 3, fontWeight: '500' },
  heroActivity: { color: '#fff', fontSize: 26, fontWeight: '900', marginBottom: 16, letterSpacing: -0.5, lineHeight: 32 },
  heroTags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  tagFull: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' },
  tagText: { color: '#666', fontSize: 12, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', marginHorizontal: 20, gap: 12, marginBottom: 28 },
  actionBtn: { flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  joinBtn: { backgroundColor: '#fff' },
  joinBtnDone: { backgroundColor: 'rgba(255,255,255,0.06)' },
  chatBtn: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  actionBtnText: { color: '#000', fontWeight: '900', fontSize: 15 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 11, color: '#333', fontWeight: '800', letterSpacing: 1.5, marginBottom: 14 },
  emptyText: { color: '#444', fontSize: 14 },
  peopleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  person: { alignItems: 'center' },
  personAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  personAvatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  personName: { color: '#666', fontSize: 12, fontWeight: '600' },
});