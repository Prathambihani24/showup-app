import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

const CATEGORIES = [
  { label: 'Food', emoji: '🍜' },
  { label: 'Sport', emoji: '🏸' },
  { label: 'Chill', emoji: '🧋' },
  { label: 'Vibe', emoji: '🚗' },
  { label: 'Study', emoji: '📚' },
  { label: 'Gaming', emoji: '🎮' },
  { label: 'Music', emoji: '🎵' },
  { label: 'Movie', emoji: '🎬' },
];

const TIMES = [
  'Right now', 'In 30 mins', 'In 1 hour',
  'In 2 hours', 'Tonight', 'Custom'
];

const BVCOE_PLACES = [
  'BVCOE Campus',
  'Dhankawadi Chowk',
  'Katraj Chowk',
  'Balajinagar',
  'Ambegaon BK',
  'Satara Road',
  'Katraj Dairy',
  'Rajiv Gandhi Zoo',
  'Other',
];

const CAMPUS_PLACES = {
  'BVCOE Dhankawadi': BVCOE_PLACES,
  'MIT WPU Kothrud': ['MIT Campus', 'Kothrud Depot', 'Karve Nagar', 'Bavdhan', 'Paud Phata', 'Other'],
  'Indira College Wakad': ['Indira Campus', 'Wakad', 'Hinjewadi Phase 1', 'Baner', 'Aundh', 'Other'],
  'Sinhgad Vadgaon': ['Sinhgad Campus', 'Vadgaon', 'Narhe', 'Kirkatwadi', 'Ambegaon', 'Other'],
  'Other': ['FC Road', 'JM Road', 'Koregaon Park', 'Viman Nagar', 'Kharadi', 'Pune Station', 'Other'],
};

export default function CreatePlanScreen() {
  const [activity, setActivity] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [time, setTime] = useState('');
  const [spots, setSpots] = useState(2);
  const [customTime, setCustomTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [userCampus, setUserCampus] = useState('');
  const [places, setPlaces] = useState(CAMPUS_PLACES['BVCOE Dhankawadi']);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const name = session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          session.user.email?.split('@')[0] ||
          'Anonymous';
        setUserName(name);
      }
    });
    
    // Get user's campus from profile
    supabase.from('users').select('campus').eq('id', session?.user?.id).single()
      .then(({ data }) => {
        if (data?.campus) {
          setUserCampus(data.campus);
          setPlaces(CAMPUS_PLACES[data.campus] || CAMPUS_PLACES['BVCOE Dhankawadi']);
        }
      });
  }, []);

  const handlePost = async () => {
    if (!activity || !location || !category || !time) {
      Alert.alert('Missing stuff 😅', 'Fill in all the details!');
      return;
    }
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 18.4592, lng = 73.8567; // BVCOE Dhankawadi default

      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }

      const { data: { session } } = await supabase.auth.getSession();

      const { error } = await supabase.from('plans').insert({
        user_id: session?.user?.id || null,
        user_name: userName || 'Anonymous',
        activity,
        location_name: location,
        latitude: lat,
        longitude: lng,
        // PostGIS geography column for spatial indexing
        location: `POINT(${lng} ${lat})`,
        campus: userCampus || 'BVCOE Dhankawadi',
        category,
        time_label: time === 'Custom' ? customTime : time,
        spots_total: spots,
        spots_left: spots,
        is_active: true,
      });

      if (error) throw error;

      Alert.alert('Plan dropped! 🔥', 'People on your campus can see your plan now!', [
        {
          text: "let's go!",
          onPress: () => {
            setActivity('');
            setLocation('');
            setCategory('');
            setTime('');
            setSpots(2);
            setCustomTime('');
          }
        }
      ]);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>drop a plan<Text style={styles.dot}>.</Text></Text>
          <Text style={styles.subtitle}>what's the wave in Surat? 🌊</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Activity */}
        <View style={styles.section}>
          <Text style={styles.label}>WHAT'S HAPPENING?</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. chai at Nanpura, walk at Dumas..."
            placeholderTextColor="#C4C4C4"
            value={activity}
            onChangeText={setActivity}
            multiline
          />
        </View>

        {/* Quick location picks */}
        <View style={styles.section}>
          <Text style={styles.label}>📍 WHERE?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
          >
            {places.map(place => (
              <TouchableOpacity
                key={place}
                style={[styles.placeChip, location === place && styles.chipActive]}
                onPress={() => setLocation(place)}
                activeOpacity={0.7}
              >
                <Text style={[styles.placeChipText, location === place && styles.chipTextActive]}>
                  {place}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            placeholder="or type a specific spot..."
            placeholderTextColor="#C4C4C4"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.label}>PICK A VIBE</Text>
          <View style={styles.grid}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.label}
                style={[styles.chip, category === c.label && styles.chipActive]}
                onPress={() => setCategory(c.label)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipEmoji}>{c.emoji}</Text>
                <Text style={[styles.chipText, category === c.label && styles.chipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Time */}
        <View style={styles.section}>
          <Text style={styles.label}>⏰ WHEN?</Text>
          <View style={styles.grid}>
            {TIMES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.timeChip, time === t && styles.chipActive]}
                onPress={() => setTime(t)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, time === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {time === 'Custom' && (
            <TextInput
              style={[styles.input, { marginTop: 10 }]}
              placeholder="e.g. 11:30 PM, after dinner..."
              placeholderTextColor="#C4C4C4"
              value={customTime}
              onChangeText={setCustomTime}
            />
          )}
        </View>

        {/* Spots */}
        <View style={styles.section}>
          <Text style={styles.label}>👥 SQUAD SIZE</Text>
          <View style={styles.spotsRow}>
            <TouchableOpacity
              style={styles.spotsBtn}
              onPress={() => setSpots(Math.max(1, spots - 1))}
              activeOpacity={0.7}
            >
              <Text style={styles.spotsBtnText}>−</Text>
            </TouchableOpacity>
            <View style={styles.spotsCountBox}>
              <Text style={styles.spotsCount}>{spots}</Text>
              <Text style={styles.spotsLabel}>people</Text>
            </View>
            <TouchableOpacity
              style={styles.spotsBtn}
              onPress={() => setSpots(Math.min(20, spots + 1))}
              activeOpacity={0.7}
            >
              <Text style={styles.spotsBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Post */}
        <TouchableOpacity
          style={[styles.postBtn, loading && styles.btnDisabled]}
          onPress={handlePost}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.postText}>drop it 🔥</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  title: { fontSize: 32, fontWeight: '900', color: '#0a0a0a', letterSpacing: -1.5 },
  dot: { color: '#7C3AED' },
  subtitle: { fontSize: 13, color: '#999', marginTop: 4, fontWeight: '500' },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  section: { marginBottom: 28 },
  label: { fontSize: 10, color: '#C4C4C4', fontWeight: '700', letterSpacing: 1.5, marginBottom: 12 },
  input: { backgroundColor: '#fff', borderRadius: 16, padding: 16, color: '#0a0a0a', fontSize: 15, borderWidth: 1, borderColor: '#F0F0F0', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#F0F0F0', flexDirection: 'row', alignItems: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1 },
  timeChip: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#F0F0F0' },
  placeChip: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#F0F0F0' },
  chipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipEmoji: { fontSize: 14 },
  chipText: { color: '#999', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  placeChipText: { color: '#999', fontSize: 13, fontWeight: '600' },
  spotsRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  spotsBtn: { backgroundColor: '#fff', width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F0F0F0', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  spotsBtnText: { color: '#0a0a0a', fontSize: 24, fontWeight: '300' },
  spotsCountBox: { alignItems: 'center' },
  spotsCount: { color: '#0a0a0a', fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  spotsLabel: { color: '#C4C4C4', fontSize: 11, fontWeight: '600', marginTop: -4 },
  postBtn: { backgroundColor: '#7C3AED', borderRadius: 18, paddingVertical: 18, alignItems: 'center', marginTop: 8, shadowColor: '#7C3AED', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 8 },
  btnDisabled: { opacity: 0.6 },
  postText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});