import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { spacing, radius, font } from '../src/lib/theme';
import { apiFetch } from '../src/lib/api';
import { useAuth } from '../src/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

type State = 'loading' | 'success' | 'error';

export default function PaymentSuccessScreen() {
  const { session_id }  = useLocalSearchParams<{ session_id?: string }>();
  const router          = useRouter();
  const { refresh }     = useAuth();
  const [state, setState]   = useState<State>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!session_id) { setState('error'); setMessage('No session ID found.'); return; }
    verify();
  }, [session_id]);

  async function verify() {
    setState('loading');
    try {
      const res  = await apiFetch(`/api/stripe/verify-session?session_id=${session_id}`);
      const data = await res.json();
      if (!res.ok) { setState('error'); setMessage(data.error || 'Verification failed.'); return; }
      // Store fresh token and refresh auth state
      if (data.token) await AsyncStorage.setItem('kyroo_token', data.token);
      await refresh();
      setState('success');
    } catch {
      setState('error');
      setMessage('Network error. Please check your connection and try restoring from the upgrade page.');
    }
  }

  if (state === 'loading') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color="#3D9E6A" size="large" />
          <Text style={s.loadingText}>Activating your Pro account…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'error') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <View style={s.iconWrap}>
            <Text style={s.iconError}>✕</Text>
          </View>
          <Text style={s.title}>Something went wrong</Text>
          <Text style={s.sub}>{message}</Text>
          <TouchableOpacity style={s.btn} onPress={() => router.push('/upgrade')} activeOpacity={0.85}>
            <Text style={s.btnText}>Back to upgrade</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.retryBtn} onPress={verify} activeOpacity={0.7}>
            <Text style={s.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Success
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <View style={s.iconWrapSuccess}>
          <Text style={s.iconSuccess}>✦</Text>
        </View>
        <Text style={s.eyebrow}>// WELCOME TO PRO</Text>
        <Text style={s.title}>You're all set.</Text>
        <Text style={s.sub}>
          Your Pro access is now active. Every program, unlimited generations, and all premium features are unlocked.
        </Text>

        <View style={s.perks}>
          {['All programs unlocked', 'Unlimited plan generations', 'Full plan history', 'Priority AI responses'].map((perk, i) => (
            <View key={i} style={s.perkRow}>
              <Text style={s.perkCheck}>✓</Text>
              <Text style={s.perkText}>{perk}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={s.btn} onPress={() => router.push('/')} activeOpacity={0.85}>
          <Text style={s.btnText}>Start exploring →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#0D0D0B' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[7] },

  loadingText: { fontFamily: font.sans, fontSize: 14, color: '#555', marginTop: spacing[5] },

  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#2A1510', borderWidth: 1, borderColor: '#C06848',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[5],
  },
  iconError: { fontSize: 30, color: '#C06848' },

  iconWrapSuccess: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#0F2318', borderWidth: 1.5, borderColor: '#3D9E6A',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[5],
  },
  iconSuccess: { fontSize: 40, color: '#3D9E6A' },

  eyebrow: { fontFamily: font.mono, fontSize: 11, color: '#3D9E6A', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[3] },
  title:   { fontFamily: font.sansBd, fontSize: 30, color: '#F5F5F2', textAlign: 'center', marginBottom: spacing[3] },
  sub:     { fontFamily: font.sans, fontSize: 15, color: '#555', lineHeight: 22, textAlign: 'center', marginBottom: spacing[6] },

  perks: { width: '100%', backgroundColor: '#181816', borderRadius: radius.md, borderWidth: 1, borderColor: '#252520', padding: spacing[4], gap: spacing[3], marginBottom: spacing[7] },
  perkRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  perkCheck:{ fontFamily: font.sansBd, fontSize: 14, color: '#3D9E6A', width: 20 },
  perkText: { fontFamily: font.sans, fontSize: 14, color: '#CCCCC8', flex: 1 },

  btn:      { backgroundColor: '#3D9E6A', height: 52, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: spacing[3] },
  btnText:  { fontFamily: font.sansBd, fontSize: 15, color: '#F5F5F2' },
  retryBtn: { paddingVertical: spacing[2] },
  retryText:{ fontFamily: font.sans, fontSize: 13, color: '#444' },
});
