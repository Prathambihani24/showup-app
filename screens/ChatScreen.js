import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { getOrCreateUser } from '../lib/user';

export default function ChatScreen({ route, navigation }) {
  const { planId, planName } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => { init(); const interval = setInterval(loadMessages, 2000); return () => clearInterval(interval); }, []);
  const init = async () => {
    const user = await getOrCreateUser();
    setUserId(user.userId); setUserName(user.userName); loadMessages();
  };

  const loadMessages = async () => {
    const { data, error } = await supabase.from('plan_messages').select('*').eq('plan_id', planId).order('created_at', { ascending: true });
    if (!error && data) setMessages(data);
  };

  const sendMessage = async () => {
    if (!text.trim() || !userId) return;
    const msg = text.trim(); setText('');
    await supabase.from('plan_messages').insert({ plan_id: planId, user_id: userId, user_name: userName, text: msg });
    loadMessages();
  };

  const formatTime = (ts) => { const d = new Date(ts); return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['rgba(139,92,246,0.15)', 'transparent']} style={styles.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>←</Text></TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{planName}</Text>
          <View style={{ width: 30 }} />
        </View>
      </LinearGradient>

      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={{ padding: 16, gap: 8 }} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {messages.length === 0 && <Text style={styles.empty}>No messages yet. Say hi! 👋</Text>}
        {messages.map((msg) => (
          <View key={msg.id} style={[styles.bubble, msg.user_id === userId ? styles.myBubble : styles.theirBubble]}>
            <Text style={msg.user_id === userId ? styles.myText : styles.theirText}>{msg.text}</Text>
            <View style={styles.bubbleMeta}>
              <Text style={styles.bubbleName}>{msg.user_name}</Text>
              <Text style={styles.bubbleTime}>{formatTime(msg.created_at)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.inputBox}>
          <TextInput style={styles.input} placeholder="type a message..." placeholderTextColor="#333" value={text} onChangeText={setText} onSubmitEditing={sendMessage} />
          <TouchableOpacity activeOpacity={0.8} onPress={sendMessage}>
            <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.sendBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.sendText}>➤</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  headerGradient: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  back: { color: '#fff', fontSize: 20, fontWeight: '700' },
  title: { color: '#fff', fontSize: 16, fontWeight: '800', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  messages: { flex: 1 },
  empty: { color: '#333', textAlign: 'center', marginTop: 40, fontWeight: '500' },
  bubble: { maxWidth: '80%', borderRadius: 20, padding: 14, marginBottom: 4 },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#111', borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)' },
  theirBubble: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  myText: { color: '#fff', fontSize: 15, lineHeight: 22, fontWeight: '500' },
  theirText: { color: '#fff', fontSize: 15, lineHeight: 22, fontWeight: '500' },
  bubbleMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 8 },
  bubbleName: { color: '#8B5CF6', fontSize: 10, fontWeight: '800' },
  bubbleTime: { color: '#333', fontSize: 10 },
  inputBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', gap: 10 },
  input: { flex: 1, backgroundColor: '#111', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', fontWeight: '500' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#fff', fontSize: 16 },
});