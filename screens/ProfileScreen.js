import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Linking, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/user';

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [userId, setUserId] = useState(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [myPlans, setMyPlans] = useState([]);
  const [stats, setStats] = useState({ dropped: 0, joined: 0, saved: 0 });

  const loadProfile = useCallback(async () => {
    const u = await getCurrentUser();
    if (!u.id) { setLoading(false); return; }
    setUserId(u.id);

    const { data: userRow } = await supabase.from('users').select('*').eq('id', u.id).single();
    if (userRow) {
      setName(userRow.name || '');
      setBio(userRow.bio || '');
      setCity(userRow.city || '');
      setPhone(userRow.phone || '');
      setWhatsapp(userRow.whatsapp || '');
    }

    const { data: plans } = await supabase.from('plans').select('*').eq('user_id', u.id).order('created_at', { ascending: false });
    setMyPlans(plans || []);

    const { count: joinedCount } = await supabase.from('plan_joins').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
    const { count: savedCount } = await supabase.from('saved_plans').select('*', { count: 'exact', head: true }).eq('user_id', u.id);

    setStats({
      dropped: (plans || []).length,
      joined: joinedCount || 0,
      saved: savedCount || 0,
    });

    setLoading(false);
  }, []);

  useEffect(() => { loadProfile(); }, []);

  const saveProfile = async () => {
    if (!userId) return;
    await supabase.from('users').update({ name, bio, city, phone, whatsapp }).eq('id', userId);
    setEditing(false);
  };

  const cancelPlan = async (planId) => {
    setMyPlans(myPlans.filter(p => p.id !== planId));
    await supabase.from('plans').update({ is_active: false }).eq('id', planId);
  };

  const openWhatsApp = (number) => {
    const url = `whatsapp://send?phone=91${number}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url);
      else Alert.alert('WhatsApp not installed');
    });
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
          <Text style={styles.title}>me<Text style={styles.dot}>.</Text></Text>
          <TouchableOpacity
            style={[styles.editBtn, editing && styles.editBtnActive]}
            onPress={() => editing ? saveProfile() : setEditing(true)}
          >
            <Text style={[styles.editText, editing && styles.editTextActive]}>{editing ? 'save ✓' : 'edit'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.profileRow}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>{name?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View style={styles.profileInfo}>
            {editing ? (
              <TextInput style={styles.nameInput} value={name} onChangeText={setName} />
            ) : (
              <Text style={styles.name}>{name || 'Unnamed'}</Text>
            )}
            {editing ? (
              <TextInput style={styles.cityInput} value={city} onChangeText={setCity} />
            ) : (
              <Text style={styles.city}>📍 {city || 'no city set'}</Text>
            )}
          </View>
        </View>

        <View style={styles.bioBox}>
          {editing ? (
            <TextInput style={styles.bioInput} value={bio} onChangeText={setBio} multiline placeholder="what's your vibe?" placeholderTextColor="#C4C4C4" />
          ) : (
            <Text style={styles.bio}>{bio ? `"${bio}"` : 'no bio yet'}</Text>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}><Text style={styles.statValue}>{stats.dropped}</Text><Text style={styles.statLabel}>DROPPED</Text></View>
          <View style={styles.statBox}><Text style={styles.statValue}>{stats.joined}</Text><Text style={styles.statLabel}>JOINED</Text></View>
          <View style={styles.statBox}><Text style={styles.statValue}>{stats.saved}</Text><Text style={styles.statLabel}>SAVED</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONTACT</Text>
          <View style={styles.contactBox}>
            <View style={styles.contactRow}>
              <Text style={styles.contactIcon}>📞</Text>
              {editing ? (
                <TextInput style={styles.contactInput} value={phone} onChangeText={setPhone} placeholder="add phone number" placeholderTextColor="#C4C4C4" keyboardType="phone-pad" maxLength={10} />
              ) : (
                <Text style={styles.contactValue}>{phone || 'add phone number'}</Text>
              )}
              {!editing && phone ? (
                <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(`tel:${phone}`)}>
                  <Text style={styles.actionBtnText}>call</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.divider} />
            <View style={styles.contactRow}>
              <Text style={styles.contactIcon}>💬</Text>
              {editing ? (
                <TextInput style={styles.contactInput} value={whatsapp} onChangeText={setWhatsapp} placeholder="add whatsapp number" placeholderTextColor="#C4C4C4" keyboardType="phone-pad" maxLength={10} />
              ) : (
                <Text style={styles.contactValue}>{whatsapp || 'add whatsapp'}</Text>
              )}
              {!editing && whatsapp ? (
                <TouchableOpacity style={[styles.actionBtn, styles.waBtn]} onPress={() => openWhatsApp(whatsapp)}>
                  <Text style={styles.actionBtnText}>chat</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MY PLANS</Text>
          {myPlans.length === 0 ? (
            <Text style={{ color: '#C4C4C4', fontSize: 13 }}>you haven't dropped any plans yet</Text>
          ) : myPlans.map(plan => (
            <View key={plan.id} style={styles.planCard}>
              <View>
                <Text style={styles.planActivity}>{plan.activity}</Text>
                <Text style={styles.planMeta}>⏰ {plan.time_label} · {plan.spots_left} spots left</Text>
              </View>
              {plan.is_active && (
                <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelPlan(plan.id)}>
                  <Text style={styles.cancelText}>cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  loadingContainer: { flex: 1, backgroundColor: '#FAFAFA', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 32, fontWeight: '900', color: '#0a0a0a', letterSpacing: -1.5 },
  dot: { color: '#7C3AED' },
  editBtn: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#F0F0F0' },
  editBtnActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  editText: { color: '#999', fontWeight: '700', fontSize: 13 },
  editTextActive: { color: '#fff' },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatarLarge: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F3EEFF', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#7C3AED' },
  avatarText: { color: '#7C3AED', fontSize: 30, fontWeight: '900' },
  profileInfo: { flex: 1, marginLeft: 16 },
  name: { color: '#0a0a0a', fontSize: 22, fontWeight: '900' },
  nameInput: { color: '#0a0a0a', fontSize: 22, fontWeight: '900', borderBottomWidth: 2, borderBottomColor: '#7C3AED', paddingBottom: 4 },
  city: { color: '#999', fontSize: 13, marginTop: 3 },
  cityInput: { color: '#999', fontSize: 13, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingBottom: 2 },
  bioBox: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F0F0F0' },
  bio: { color: '#999', fontSize: 14, fontStyle: 'italic', lineHeight: 22 },
  bioInput: { color: '#0a0a0a', fontSize: 14, lineHeight: 22 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statBox: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#F0F0F0' },
  statValue: { color: '#7C3AED', fontSize: 26, fontWeight: '900' },
  statLabel: { color: '#C4C4C4', fontSize: 10, marginTop: 4, fontWeight: '700', letterSpacing: 1 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 10, color: '#C4C4C4', fontWeight: '700', letterSpacing: 1.5, marginBottom: 12 },
  contactBox: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden' },
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  contactIcon: { fontSize: 18 },
  contactInput: { flex: 1, color: '#0a0a0a', fontSize: 14 },
  contactValue: { flex: 1, color: '#999', fontSize: 14 },
  actionBtn: { backgroundColor: '#F3EEFF', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  waBtn: { backgroundColor: '#DCFCE7' },
  actionBtnText: { color: '#7C3AED', fontSize: 12, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginHorizontal: 16 },
  planCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#F0F0F0' },
  planActivity: { color: '#0a0a0a', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  planMeta: { color: '#C4C4C4', fontSize: 12 },
  cancelBtn: { backgroundColor: '#FFF0F0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  cancelText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
});