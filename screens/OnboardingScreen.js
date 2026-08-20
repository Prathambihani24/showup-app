import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, KeyboardAvoidingView,
  Platform, Image, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const VIBES = ['☕ Food', '🏸 Sport', '🧋 Chill', '🚗 Vibe', '📚 Study', '🎮 Gaming', '🎵 Music', '🎬 Movie'];

const PUNE_CAMPUSES = [
  'BVCOE Dhankawadi',
  'MIT WPU Kothrud',
  'Indira College Wakad',
  'Sinhgad Vadgaon',
  'Other',
];

const CAMPUS_AREAS = {
  'BVCOE Dhankawadi': ['BVCOE Campus', 'Dhankawadi', 'Katraj', 'Ambegaon', 'Balajinagar', 'Satara Road', 'Other'],
  'MIT WPU Kothrud': ['MIT Campus', 'Kothrud', 'Karve Nagar', 'Bavdhan', 'Paud Road', 'Other'],
  'Indira College Wakad': ['Indira Campus', 'Wakad', 'Hinjewadi', 'Baner', 'Aundh', 'Other'],
  'Sinhgad Vadgaon': ['Sinhgad Campus', 'Vadgaon', 'Narhe', 'Ambegaon BK', 'Kirkatwadi', 'Other'],
  'Other': ['FC Road', 'JM Road', 'Koregaon Park', 'Viman Nagar', 'Kharadi', 'Pune Station', 'Other'],
};

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function OnboardingScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [campus, setCampus] = useState('');
  const [area, setArea] = useState('');
  const [selectedVibes, setSelectedVibes] = useState([]);

  const toggleVibe = (v) => {
    if (selectedVibes.includes(v)) {
      setSelectedVibes(selectedVibes.filter(x => x !== v));
    } else if (selectedVibes.length < 4) {
      setSelectedVibes([...selectedVibes, v]);
    }
  };

  const handleFinish = async () => {
    const userId = generateUUID();
    await AsyncStorage.setItem('showup_user_id', userId);
    await AsyncStorage.setItem('showup_user_name', name.trim());
    await AsyncStorage.setItem('showup_user_campus', campus);
    await AsyncStorage.setItem('showup_user_area', area);
    await AsyncStorage.setItem('showup_onboarded', 'true');

    await supabase.from('users').insert({
      id: userId,
      name: name.trim(),
      campus: campus,
      area: area,
      bio: selectedVibes.join(', '),
      is_verified: true,
    });

    navigation.navigate('Home');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.inner}
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          {/* Step 1 — Name */}
          {step === 1 && (
            <View style={styles.stepBox}>
              <Text style={styles.heading}>what's your name?</Text>
              <Text style={styles.subheading}>how should people know you 👀</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Pratham"
                placeholderTextColor="#C4C4C4"
                value={name}
                onChangeText={setName}
                autoFocus
                autoCapitalize="words"
              />
              <TouchableOpacity
                style={[styles.btn, name.trim().length < 2 && styles.btnDisabled]}
                onPress={() => setStep(2)}
                disabled={name.trim().length < 2}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>next →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2 — Campus */}
          {step === 2 && (
            <View style={styles.stepBox}>
              <Text style={styles.heading}>which campus?</Text>
              <Text style={styles.subheading}>so we find people near you 📍</Text>
              <View style={styles.grid}>
                {PUNE_CAMPUSES.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, campus === c && styles.chipActive]}
                    onPress={() => setCampus(c)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, campus === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.btn, !campus && styles.btnDisabled]}
                onPress={() => setStep(3)}
                disabled={!campus}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>next →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                <Text style={styles.backText}>← go back</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 3 — Area */}
          {step === 3 && (
            <View style={styles.stepBox}>
              <Text style={styles.heading}>which area?</Text>
              <Text style={styles.subheading}>for finding plans nearby 📍</Text>
              <View style={styles.grid}>
                {(CAMPUS_AREAS[campus] || CAMPUS_AREAS['Other']).map(a => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.chip, area === a && styles.chipActive]}
                    onPress={() => setArea(a)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, area === a && styles.chipTextActive]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.btn, !area && styles.btnDisabled]}
                onPress={() => setStep(4)}
                disabled={!area}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>next →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}>
                <Text style={styles.backText}>← go back</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 4 — Vibes */}
          {step === 4 && (
            <View style={styles.stepBox}>
              <Text style={styles.heading}>pick your vibes</Text>
              <Text style={styles.subheading}>choose up to 4 🔥</Text>
              <View style={styles.grid}>
                {VIBES.map(v => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.chip, selectedVibes.includes(v) && styles.chipActive]}
                    onPress={() => toggleVibe(v)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, selectedVibes.includes(v) && styles.chipTextActive]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.btn, selectedVibes.length === 0 && styles.btnDisabled]}
                onPress={handleFinish}
                disabled={selectedVibes.length === 0}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>let's gooo 🔥</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(3)}>
                <Text style={styles.backText}>← go back</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Progress dots */}
          <View style={styles.dots}>
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={[styles.dot, step === i && styles.dotActive]} />
            ))}
          </View>

          <Text style={styles.footer}>
            by continuing you agree to just vibe responsibly 😌
          </Text>

        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  inner: { paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center' },
  logo: { width: 180, height: 70, marginTop: 40, marginBottom: 40 },
  stepBox: { width: '100%', gap: 16 },
  heading: { fontSize: 28, fontWeight: '900', color: '#0a0a0a', letterSpacing: -0.5 },
  subheading: { fontSize: 14, color: '#999', fontWeight: '500', marginTop: -8 },
  input: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 18, fontSize: 18, color: '#0a0a0a', borderWidth: 1, borderColor: '#F0F0F0', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#F0F0F0', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipText: { color: '#999', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  btn: { backgroundColor: '#7C3AED', borderRadius: 18, paddingVertical: 18, alignItems: 'center', shadowColor: '#7C3AED', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 8 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  backBtn: { alignItems: 'center', paddingVertical: 8 },
  backText: { color: '#999', fontSize: 14, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 8, marginTop: 40, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F0F0F0' },
  dotActive: { backgroundColor: '#7C3AED', width: 24 },
  footer: { color: '#C4C4C4', fontSize: 12, fontWeight: '500', textAlign: 'center' },
});
