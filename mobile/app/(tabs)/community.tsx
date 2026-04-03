import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { spacing, radius, font } from '../../src/lib/theme';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/lib/api';
import { useTrainingWS } from '../../src/hooks/useTrainingWS';

export default function CommunityScreen() {
  const { user, isPremium } = useAuth();
  const router = useRouter();

  const [training, setTraining] = useState(false);
  const { count, connected: wsReady } = useTrainingWS(isPremium);

  const pulse     = useRef(new Animated.Value(1)).current;
  const heartbeat = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulsing animation for the live dot
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.5, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Heartbeat every 60s to keep session alive
  useEffect(() => {
    if (training) {
      heartbeat.current = setInterval(() => {
        apiFetch('/api/training/heartbeat', { method: 'POST' }).catch(() => {});
      }, 60_000);
    } else {
      if (heartbeat.current) clearInterval(heartbeat.current);
    }
    return () => { if (heartbeat.current) clearInterval(heartbeat.current); };
  }, [training]);

  async function toggleTraining() {
    const next = !training;
    setTraining(next);
    try {
      const res  = await apiFetch(next ? '/api/training/join' : '/api/training/leave', { method: 'POST' });
      const data = await res.json();
      setCount(data.count ?? 0);
    } catch {}
  }

  // ── Locked for free users ──────────────────────────────────
  if (!isPremium) {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
          <Text style={s.eyebrow}>// COMMUNITY</Text>
          <Text style={s.title}>We Are Training.</Text>
          <Text style={s.sub}>See who in the Kyroo community is training right now — live, anonymous, real.</Text>

          <View style={s.lockedCard}>
            <View style={s.lockedIcon}><Text style={{ fontSize: 28 }}>🔒</Text></View>
            <Text style={s.lockedTitle}>Pro feature</Text>
            <Text style={s.lockedSub}>Upgrade to Pro to join the live training community.</Text>
            <TouchableOpacity style={s.upgradeBtn} onPress={() => router.push('/upgrade')} activeOpacity={0.85}>
              <Text style={s.upgradeBtnText}>Upgrade to Pro →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Pro: live training view ────────────────────────────────
  const others = training ? Math.max(0, count - 1) : count;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        <Text style={s.eyebrow}>// COMMUNITY</Text>
        <Text style={s.title}>We Are Training.</Text>
        <Text style={s.sub}>Anonymous live presence. No names — just the energy of the community.</Text>

        {/* Live counter card */}
        <View style={s.liveCard}>
          <View style={s.liveHeader}>
            <Animated.View style={[s.liveDot, { transform: [{ scale: pulse }] }]} />
            <Text style={s.liveLabel}>LIVE NOW</Text>
            {wsReady && <View style={s.wsIndicator}><Text style={s.wsIndicatorText}>connected</Text></View>}
          </View>

          <Text style={s.countNum}>{count}</Text>
          <Text style={s.countLabel}>
            {count === 1 ? 'Kyroo athlete training' : 'Kyroo athletes training'}
          </Text>

          {training && (
            <View style={s.youBadge}>
              <Text style={s.youBadgeText}>including you</Text>
            </View>
          )}
        </View>

        {/* Others message */}
        {others > 0 && (
          <View style={s.messageCard}>
            <Text style={s.messageText}>
              {others === 1
                ? '1 other athlete is putting in the work right now.'
                : `${others} other athletes are putting in the work right now.`}
            </Text>
            <Text style={s.messageSub}>Stay consistent. They are.</Text>
          </View>
        )}

        {others === 0 && !training && (
          <View style={s.messageCard}>
            <Text style={s.messageText}>No one is training right now.</Text>
            <Text style={s.messageSub}>Be the first to start the session.</Text>
          </View>
        )}

        {/* Toggle button */}
        <TouchableOpacity
          style={[s.toggleBtn, training && s.toggleBtnActive]}
          onPress={toggleTraining}
          activeOpacity={0.85}
        >
          <View style={[s.toggleDot, training && s.toggleDotActive]} />
          <Text style={[s.toggleText, training && s.toggleTextActive]}>
            {training ? 'I\'m done training' : 'I\'m training now'}
          </Text>
        </TouchableOpacity>

        <Text style={s.privacyNote}>
          Your identity is never shared. Only the total count is visible to the community.
        </Text>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statValue}>{count}</Text>
            <Text style={s.statLabel}>Live now</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{training ? 'On' : 'Off'}</Text>
            <Text style={s.statLabel}>Your mode</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0D0D0B' },
  container: { padding: spacing[5], paddingTop: spacing[8], paddingBottom: spacing[12] },

  eyebrow: { fontFamily: font.mono, fontSize: 11, color: '#555', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[3] },
  title:   { fontFamily: font.sansBd, fontSize: 32, color: '#F5F5F2', marginBottom: spacing[2] },
  sub:     { fontFamily: font.sans, fontSize: 14, color: '#555', lineHeight: 21, marginBottom: spacing[7] },

  // Locked state
  lockedCard: {
    backgroundColor: '#181816', borderWidth: 1, borderColor: '#252520',
    borderRadius: radius.lg, padding: spacing[6],
    alignItems: 'center', gap: spacing[3],
  },
  lockedIcon:    { width: 64, height: 64, borderRadius: 32, backgroundColor: '#252520', alignItems: 'center', justifyContent: 'center' },
  lockedTitle:   { fontFamily: font.sansBd, fontSize: 18, color: '#F5F5F2' },
  lockedSub:     { fontFamily: font.sans, fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20 },
  upgradeBtn:    { backgroundColor: '#3D9E6A', height: 48, paddingHorizontal: spacing[8], borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginTop: spacing[2] },
  upgradeBtnText:{ fontFamily: font.sansBd, fontSize: 14, color: '#F5F5F2' },

  // Live card
  liveCard: {
    backgroundColor: '#0F2318', borderWidth: 1, borderColor: '#3D9E6A30',
    borderRadius: radius.lg, padding: spacing[6],
    alignItems: 'center', marginBottom: spacing[4],
  },
  liveHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[5] },
  liveDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3D9E6A' },
  liveLabel:  { fontFamily: font.mono, fontSize: 11, color: '#3D9E6A', letterSpacing: 1, textTransform: 'uppercase' },
  wsIndicator:{ backgroundColor: '#1C1C18', borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 2, marginLeft: spacing[2] },
  wsIndicatorText: { fontFamily: font.mono, fontSize: 9, color: '#444' },

  countNum:   { fontFamily: font.sansBd, fontSize: 72, color: '#F5F5F2', lineHeight: 80 },
  countLabel: { fontFamily: font.mono, fontSize: 12, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing[1] },

  youBadge:     { marginTop: spacing[4], backgroundColor: '#3D9E6A20', borderRadius: radius.full, borderWidth: 1, borderColor: '#3D9E6A50', paddingHorizontal: spacing[4], paddingVertical: 5 },
  youBadgeText: { fontFamily: font.mono, fontSize: 11, color: '#6DBF8A', letterSpacing: 0.5 },

  // Message
  messageCard: {
    backgroundColor: '#181816', borderWidth: 1, borderColor: '#252520',
    borderRadius: radius.md, padding: spacing[4],
    marginBottom: spacing[5],
  },
  messageText: { fontFamily: font.sans, fontSize: 15, color: '#CCCCC8', lineHeight: 22, marginBottom: 4 },
  messageSub:  { fontFamily: font.mono, fontSize: 11, color: '#555' },

  // Toggle
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[3], height: 54, borderRadius: radius.md,
    backgroundColor: '#181816', borderWidth: 1.5, borderColor: '#252520',
    marginBottom: spacing[4],
  },
  toggleBtnActive: { backgroundColor: '#0F2318', borderColor: '#3D9E6A' },
  toggleDot:       { width: 12, height: 12, borderRadius: 6, backgroundColor: '#333' },
  toggleDotActive: { backgroundColor: '#3D9E6A' },
  toggleText:      { fontFamily: font.sansBd, fontSize: 15, color: '#555' },
  toggleTextActive:{ color: '#F5F5F2' },

  privacyNote: { fontFamily: font.mono, fontSize: 10, color: '#333', textAlign: 'center', lineHeight: 15, marginBottom: spacing[6] },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing[3] },
  statCard: {
    flex: 1, backgroundColor: '#181816', borderRadius: radius.md,
    borderWidth: 1, borderColor: '#252520',
    padding: spacing[4], alignItems: 'center', gap: 4,
  },
  statValue: { fontFamily: font.sansBd, fontSize: 22, color: '#F5F5F2' },
  statLabel: { fontFamily: font.mono, fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 },
});
