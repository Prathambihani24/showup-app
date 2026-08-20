import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Dimensions, Animated, ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { supabase } from '../supabase';
import { getCurrentUser } from '../lib/user';
import { fetchPlansNearMe, formatDistance, BVCOE_CAMPUS, calculateDistanceKm } from '../lib/spatial-queries';

const { width } = Dimensions.get('window');

const ACCENT_COLORS = [
  { accent: '#FF6B6B', bg: '#FFF5F5' },
  { accent: '#7C3AED', bg: '#F5F0FF' },
  { accent: '#059669', bg: '#F0FDF4' },
  { accent: '#EC4899', bg: '#FDF2F8' },
  { accent: '#3B82F6', bg: '#EFF6FF' },
  { accent: '#F59E0B', bg: '#FFFBEB' },
];

const FILTERS = ['All', 'Food', 'Sport', 'Chill', 'Vibe', 'Study'];

const getCategoryEmoji = (category) => {
  const map = {
    Food: '🍜', Sport: '🏸', Chill: '🧋',
    Vibe: '🚗', Study: '📚', Gaming: '🎮',
    Music: '🎵', Movie: '🎬'
  };
  return map[category] || '⚡';
};

function PlanCard({ plan, onJoin, joined, onToggleSave, isSaved }) {
  const scale = new Animated.Value(1);
  const isJoined = joined.includes(plan.id);
  const isFull = plan.spots_left === 0;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => onJoin(plan.id));
  };

  // Use PostGIS-calculated distance_m (meters) or fall back to client-side
  const displayDistance = plan.distance_m 
    ? formatDistance(plan.distance_m / 1000)  // convert meters to km
    : plan.distance;  // fallback for legacy data

  return (
    <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
      <View style={[styles.accentBar, { backgroundColor: plan.accent }]} />
      <View style={styles.cardInner}>

        <View style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: plan.bg }]}>
            <Text style={[styles.avatarText, { color: plan.accent }]}>{plan.initial}</Text>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.cardName}>{plan.user_name}</Text>
            <Text style={styles.cardLocation}>📍 {plan.location_name}</Text>
          </View>
          <TouchableOpacity onPress={() => onToggleSave(plan.id)} style={{ marginRight: 8 }}>
            <Text style={{ fontSize: 20 }}>{isSaved ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
          <View style={[styles.distancePill, { backgroundColor: plan.bg }]}>
            <Text style={[styles.distanceText, { color: plan.accent }]}>{displayDistance}</Text>
          </View>
        </View>

        <View style={styles.activityRow}>
          <Text style={styles.emoji}>{plan.emoji}</Text>
          <Text style={styles.cardActivity}>{plan.activity}</Text>
        </View>

        <View style={styles.cardBottom}>
          <View style={styles.pills}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>⏰ {plan.time_label}</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>👥 {plan.spots_left} spots</Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.joinBtn, { backgroundColor: isJoined || isFull ? '#F0F0F0' : plan.accent }]}
              onPress={handlePress}
              disabled={isJoined || isFull}
              activeOpacity={0.8}
            >
              <Text style={[styles.joinText, { color: isJoined || isFull ? '#999' : '#fff' }]}>
                {isJoined ? '✓ in' : isFull ? 'full' : "i'm in"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reportBtn}
              onPress={() =>
                Alert.alert(
                  'Report Plan 🚩',
                  'Why are you reporting this?',
                  [
                    { text: 'Spam', onPress: () => Alert.alert('Reported ✅', 'Thanks for keeping Showup safe!') },
                    { text: 'Inappropriate', onPress: () => Alert.alert('Reported ✅', 'Thanks for keeping Showup safe!') },
                    { text: 'Fake plan', onPress: () => Alert.alert('Reported ✅', 'Thanks for keeping Showup safe!') },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                )
              }
            >
              <Text style={styles.reportText}>🚩</Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [joined, setJoined] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState({ lat: 18.4592, lng: 73.8567 }); // BVCOE Dhankawadi
  const [savedIds, setSavedIds] = useState([]);
  const [currentUser, setCurrentUser] = useState({ id: null, name: null, campus: null });

  const fetchPlans = useCallback(async () => {
    try {
      let lat = BVCOE_CAMPUS.lat, lng = BVCOE_CAMPUS.lng; // BVCOE default

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        setUserLocation({ lat, lng });
      }

      // Get user's campus
      const { data: userProfile } = await supabase
        .from('users')
        .select('campus')
        .eq('id', currentUser.id)
        .single();

      const userCampus = userProfile?.campus || BVCOE_CAMPUS.name;

      // Use optimized PostGIS spatial query (RPC function)
      // Falls back to client-side if RPC not available
      const { data, error } = await fetchPlansNearMe({
        lat,
        lng,
        radiusMeters: BVCOE_CAMPUS.defaultRadiusMeters,
        limit: 20,
        campus: userCampus,
      });

      if (error) {
        // Fallback to legacy query if RPC not deployed yet
        console.log('PostGIS RPC not available, falling back to legacy query:', error.message);
        return fetchPlansLegacy(lat, lng, userCampus);
      }

      const enriched = (data || []).map((plan, i) => ({
        ...plan,
        ...ACCENT_COLORS[i % ACCENT_COLORS.length],
        initial: plan.user_name?.[0]?.toUpperCase() || '?',
        emoji: getCategoryEmoji(plan.category),
        // distance_m is in meters from PostGIS, formatDistance expects km
        distance: plan.distance_m ? formatDistance(plan.distance_m / 1000) : null,
      }));

      setPlans(enriched);
    } catch (err) {
      console.log('Error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser.id]);

  // Legacy fallback query (client-side distance calculation)
  const fetchPlansLegacy = async (lat, lng, campus) => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .eq('campus', campus)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enriched = (data || []).map((plan, i) => ({
        ...plan,
        ...ACCENT_COLORS[i % ACCENT_COLORS.length],
        initial: plan.user_name?.[0]?.toUpperCase() || '?',
        emoji: getCategoryEmoji(plan.category),
        distance: formatDistance(
          calculateDistanceKm(lat, lng, plan.latitude, plan.longitude)
        ),
      }));

      setPlans(enriched);
    } catch (err) {
      console.log('Legacy fetch error:', err.message);
    }
  };

  const loadUserAndSaves = async () => {
    const u = await getCurrentUser();
    setCurrentUser(u);
    if (u.id) {
      const { data: saves } = await supabase.from('saved_plans').select('plan_id').eq('user_id', u.id);
      setSavedIds((saves || []).map(d => d.plan_id));
      
      // Get user's campus
      const { data: profile } = await supabase.from('users').select('campus').eq('id', u.id).single();
      if (profile?.campus) {
        setCurrentUser(prev => ({ ...prev, campus: profile.campus }));
      }
    }
  };

  useEffect(() => {
    fetchPlans();
    loadUserAndSaves();
  }, []);

  const handleJoin = async (id) => {
    if (joined.includes(id)) return;
    const plan = plans.find(p => p.id === id);
    if (!plan || plan.spots_left <= 0) return;

    setJoined([...joined, id]);
    setPlans(plans.map(p =>
      p.id === id ? { ...p, spots_left: Math.max(0, p.spots_left - 1) } : p
    ));

    await supabase
      .from('plans')
      .update({ spots_left: plan.spots_left - 1 })
      .eq('id', id);

    if (currentUser.id) {
      await supabase.from('plan_joins').insert({ plan_id: id, user_id: currentUser.id });
    }
  };

  const handleToggleSave = async (planId) => {
    if (!currentUser.id) return;
    if (savedIds.includes(planId)) {
      setSavedIds(savedIds.filter(id => id !== planId));
      await supabase.from('saved_plans').delete().eq('plan_id', planId).eq('user_id', currentUser.id);
    } else {
      setSavedIds([...savedIds, planId]);
      await supabase.from('saved_plans').insert({ plan_id: planId, user_id: currentUser.id });
    }
  };

  const filtered = plans.filter(p => {
    const matchFilter = activeFilter === 'All' || p.category === activeFilter;
    const matchSearch =
      p.activity?.toLowerCase().includes(search.toLowerCase()) ||
      p.location_name?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#7C3AED" size="large" />
        <Text style={styles.loadingText}>finding plans near you...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>showup<Text style={styles.dot}>.</Text></Text>
            <Text style={styles.subtitle}>📍 {filtered.length} plans near you</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>live</Text>
          </View>
        </View>

        <View style={styles.searchWrapper}>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="search plans or places..."
              placeholderTextColor="#C4C4C4"
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={styles.clearText}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
          style={{ marginBottom: 8 }}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, activeFilter === f && styles.filterActive]}
              onPress={() => setActiveFilter(f)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      <ScrollView
        style={styles.feed}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.feedContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchPlans(); loadUserAndSaves(); }}
            tintColor="#7C3AED"
            colors={['#7C3AED']}
          />
        }
      >
        <Text style={styles.feedLabel}>NEAR YOU · {filtered.length} PLANS</Text>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🤷</Text>
            <Text style={styles.emptyText}>no plans yet</Text>
            <Text style={styles.emptySubtext}>be the first to drop one 🔥</Text>
          </View>
        ) : (
          filtered.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onJoin={handleJoin}
              joined={joined}
              onToggleSave={handleToggleSave}
              isSaved={savedIds.includes(plan.id)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  loadingContainer: { flex: 1, backgroundColor: '#FAFAFA', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#999', marginTop: 12, fontWeight: '600', fontSize: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  logo: { fontSize: 30, fontWeight: '900', color: '#0a0a0a', letterSpacing: -1.5 },
  dot: { color: '#7C3AED' },
  subtitle: { fontSize: 12, color: '#999', marginTop: 2, fontWeight: '500' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#BBF7D0' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  liveText: { color: '#16A34A', fontSize: 12, fontWeight: '700' },
  searchWrapper: { paddingHorizontal: 20, marginBottom: 14 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#EFEFEF', gap: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: '#0a0a0a', fontSize: 14 },
  clearText: { color: '#C4C4C4', fontSize: 14 },
  filtersContainer: { paddingHorizontal: 20, gap: 8 },
  filterChip: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#EFEFEF' },
  filterActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  filterText: { color: '#999', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  feed: { flex: 1 },
  feedContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  feedLabel: { fontSize: 10, color: '#C4C4C4', fontWeight: '700', letterSpacing: 1.5, marginBottom: 14 },
  card: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 4 }, shadowRadius: 16, elevation: 3, borderWidth: 1, borderColor: '#F5F5F5' },
  accentBar: { height: 4, width: '100%' },
  cardInner: { padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', fontSize: 17 },
  cardMeta: { flex: 1, marginLeft: 10 },
  cardName: { color: '#0a0a0a', fontWeight: '700', fontSize: 14 },
  cardLocation: { color: '#999', fontSize: 12, marginTop: 1 },
  distancePill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  distanceText: { fontSize: 11, fontWeight: '700' },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  emoji: { fontSize: 26 },
  cardActivity: { color: '#0a0a0a', fontSize: 19, fontWeight: '800', letterSpacing: -0.4, flex: 1 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pills: { flexDirection: 'row', gap: 6 },
  pill: { backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { color: '#888', fontSize: 11, fontWeight: '600' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  joinBtn: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  joinText: { fontWeight: '800', fontSize: 13 },
  reportBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFE4E4' },
  reportText: { fontSize: 14 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#0a0a0a', fontSize: 20, fontWeight: '800' },
  emptySubtext: { color: '#999', fontSize: 14, marginTop: 6 },
});