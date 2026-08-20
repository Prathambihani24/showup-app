import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, KeyboardAvoidingView,
  Platform, Image, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function AuthScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email');
  const [loading, setLoading] = useState(false);

 const sendOTP = async () => {
  if (!email.includes('@')) {
    Alert.alert('Invalid email', 'Enter a valid email address');
    return;
  }
  const emailDomain = email.trim().toLowerCase().split('@')[1];
  const ALLOWED_DOMAINS = [
    'bvcoe.ac.in',
    'mitwpu.edu.in',
    'indiraicollege.edu.in',
    'sinhgad.edu',
  ];
  if (!ALLOWED_DOMAINS.includes(emailDomain)) {
    Alert.alert(
      'Campus email required 🎓',
      'Please use your college .edu email to join Showup Campus.\n\nSupported: BVCOE, MIT WPU, Indira, Sinhgad'
    );
    return;
  }
  setLoading(true);
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: null,
    },
  });
  setLoading(false);
  if (error) {
    Alert.alert('Error', error.message);
  } else {
    setStep('otp');
    Alert.alert(
      'Code sent! 📬',
      'Check your email for a 6-digit code. Check spam folder if not visible.'
    );
  }
};

  const verifyOTP = async () => {
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp,
      type: 'email',
    });
    setLoading(false);
    if (error) {
      Alert.alert('Wrong code', error.message);
    } else {
      navigation.navigate('Onboarding');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.inner}>

        <View style={styles.logoSection}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>just show up 🙌</Text>
        </View>

        {step === 'email' ? (
          <View style={styles.form}>
            <Text style={styles.heading}>what's your email?</Text>
            <Text style={styles.subheading}>
              we'll send you a 6-digit code
            </Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#C4C4C4"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.btn, (!email.includes('@') || loading) && styles.btnDisabled]}
              onPress={sendOTP}
              disabled={!email.includes('@') || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>send code 📲</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.heading}>check your email</Text>
            <Text style={styles.subheading}>
              6-digit code sent to {email}
            </Text>
            <TextInput
              style={styles.otpInput}
              placeholder="000000"
              placeholderTextColor="#C4C4C4"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.btn, (otp.length !== 6 || loading) && styles.btnDisabled]}
              onPress={verifyOTP}
              disabled={otp.length !== 6 || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>let's go 🔥</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => { setStep('email'); setOtp(''); }}
            >
              <Text style={styles.backText}>← change email</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.footer}>
          by continuing you agree to just vibe responsibly 😌
        </Text>

      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingBottom: 40 },
  logoSection: { alignItems: 'center', marginTop: 60 },
  logoImage: { width: 200, height: 80 },
  tagline: { fontSize: 15, color: '#999', marginTop: 8, fontWeight: '500' },
  form: { flex: 1, justifyContent: 'center', gap: 16 },
  heading: { fontSize: 28, fontWeight: '900', color: '#0a0a0a', letterSpacing: -0.5 },
  subheading: { fontSize: 14, color: '#999', fontWeight: '500', marginTop: -8 },
  input: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 18, fontSize: 16, color: '#0a0a0a', borderWidth: 1, borderColor: '#F0F0F0', fontWeight: '500' },
  otpInput: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 20, fontSize: 32, color: '#0a0a0a', borderWidth: 1, borderColor: '#F0F0F0', fontWeight: '800', letterSpacing: 12 },
  btn: { backgroundColor: '#7C3AED', borderRadius: 18, paddingVertical: 18, alignItems: 'center', shadowColor: '#7C3AED', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 8 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  backBtn: { alignItems: 'center', paddingVertical: 8 },
  backText: { color: '#999', fontSize: 14, fontWeight: '600' },
  footer: { textAlign: 'center', color: '#C4C4C4', fontSize: 12, fontWeight: '500' },
});