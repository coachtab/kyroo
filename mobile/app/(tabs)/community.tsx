import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { spacing, radius, font } from '../../src/lib/theme';
import { apiFetch } from '../../src/lib/api';

const BG      = '#07070F';
const CARD    = '#10101E';
const BORDER  = '#18183A';
const INDIGO  = '#5B5EF4';
const TEXT    = '#E8E8F0';
const MUTED   = '#40405A';
const DIM     = '#1A1A28';

type Plan = {
  id: number;
  program_name: string;
  program_icon: string;
  created_at: string;
};

const MILESTONES = [
  { id: 'first',     emoji: '🌱', label: 'First Steps',   sub: 'Generate your first plan',  threshold: 1  },
  { id: 'committed', emoji: '🔥', label: 'Committed',     sub: '5 plans generated',          threshold: 5  },
  { id: 'dedicated', emoji: '💪', label: 'Dedicated',     sub: '15 plans generated',         threshold: 15 },
  { id: 'elite',     emoji: '⚡', label: 'Elite Athlete', sub: '30 plans generated',         threshold: 30 },
];

export default function ProgressScreen() {
  const router  = useRouter();
  const [plans,   setPlans]   = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    apiFetch('/api/plans')
      .then(r => r.json())
      .then(d => { if (active) setPlans(d.plans || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const total = plans.length;

  // Activity grid — last 30 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const planDays = new Set(
    plans.map(p => {
      const d = new Date(p.created_at);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    return { time: d.getTime(), active: planDays.has(d.getTime()) };
  });

  // Current streak (consecutive days ending today)
  let streak = 0;
  for (let i = 29; i >= 0; i--) {
    if (days[i].active) streak++;
    else break;
  }

  const recentPlans = plans.slice(0, 4);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <Text style={s.eyebrow}>// YOUR JOURNEY</Text>
        <Text style={s.title}>Progress</Text>

        {loading ? (
          <ActivityIndicator color={INDIGO} style={{ marginTop: spacing[10] }} />
        ) : (
          <>
            {/* Hero stats */}
            <View style={s.heroRow}>
              <View style={s.heroCard}>
                <Text style={s.heroNum}>{total}</Text>
                <Text style={s.heroLabel}>Plans Generated</Text>
              </View>
              <View style={[s.heroCard, streak > 0 && s.heroCardAccent]}>
                <Text style={[s.heroNum, streak > 0 && { color: INDIGO }]}>{streak}</Text>
                <Text style={s.heroLabel}>Day Streak</Text>
              </View>
            </View>

            {/* Activity grid */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Activity — Last 30 Days</Text>
              <View style={s.grid}>
                {days.map((d, i) => (
                  <View key={i} style={[s.dot, d.active && s.dotActive]} />
                ))}
              </View>
              <View style={s.gridLegend}>
                <View style={[s.dot, s.legendDot]} />
                <Text style={s.legendText}>No activity</Text>
                <View style={{ width: 16 }} />
                <View style={[s.dot, s.dotActive, s.legendDot]} />
                <Text style={s.legendText}>Plan generated</Text>
              </View>
            </View>

            {/* Milestones */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Milestones</Text>
              <View style={s.milestoneGrid}>
                {MILESTONES.map((m) => {
                  const unlocked = total >= m.threshold;
                  return (
                    <View key={m.id} style={[s.milestoneCard, unlocked && s.milestoneCardUnlocked]}>
                      <Text style={[s.milestoneEmoji, !unlocked && { opacity: 0.2 }]}>{m.emoji}</Text>
                      <Text style={[s.milestoneName, unlocked && { color: TEXT }]}>{m.label}</Text>
                      <Text style={s.milestoneSub}>{m.sub}</Text>
                      {unlocked && (
                        <View style={s.milestoneBadge}>
                          <Text style={s.milestoneBadgeText}>✓</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Recent plans */}
            {recentPlans.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Recent Plans</Text>
                <View style={s.recentList}>
                  {recentPlans.map((p) => (
                    <View key={p.id} style={s.recentCard}>
                      <View style={s.recentIconWrap}>
                        <Text style={{ fontSize: 18 }}>{p.program_icon || '⚡'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.recentName}>{p.program_name}</Text>
                        <Text style={s.recentDate}>{formatDate(p.created_at)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
                {plans.length > 4 && (
                  <TouchableOpacity style={s.viewAllBtn} onPress={() => router.push('/plans')} activeOpacity={0.8}>
                    <Text style={s.viewAllText}>View all {plans.length} plans →</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {total === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>🌱</Text>
                <Text style={s.emptyTitle}>Your journey starts here</Text>
                <Text style={s.emptySub}>Generate your first plan to begin tracking your progress.</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/')} activeOpacity={0.85}>
                  <Text style={s.emptyBtnText}>Browse programs →</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        <View style={{ height: spacing[12] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  container: { padding: spacing[5], paddingTop: spacing[8], paddingBottom: spacing[12] },

  eyebrow: { fontFamily: font.mono, fontSize: 11, color: MUTED, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[2] },
  title:   { fontFamily: font.sansBd, fontSize: 32, color: TEXT, marginBottom: spacing[7] },

  // Hero stats
  heroRow:        { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] },
  heroCard:       {
    flex: 1, backgroundColor: CARD, borderRadius: radius.lg,
    borderWidth: 1, borderColor: BORDER,
    padding: spacing[5], alignItems: 'center', gap: 4,
  },
  heroCardAccent: { borderColor: '#2A2A5A', backgroundColor: '#0D0D1E' },
  heroNum:        { fontFamily: font.sansBd, fontSize: 42, color: TEXT, lineHeight: 48 },
  heroLabel:      { fontFamily: font.mono, fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Section
  section:      { marginBottom: spacing[6] },
  sectionTitle: { fontFamily: font.mono, fontSize: 11, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing[3] },

  // Activity grid
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: spacing[2] },
  dot:        { width: 9, height: 9, borderRadius: 3, backgroundColor: DIM },
  dotActive:  { backgroundColor: INDIGO },
  gridLegend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { margin: 0 },
  legendText: { fontFamily: font.mono, fontSize: 10, color: MUTED },

  // Milestones
  milestoneGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  milestoneCard:         {
    width: '47%', backgroundColor: CARD,
    borderRadius: radius.lg, borderWidth: 1, borderColor: BORDER,
    padding: spacing[4], alignItems: 'center', gap: 6, position: 'relative',
  },
  milestoneCardUnlocked: { borderColor: '#2A2A5A', backgroundColor: '#0D0D1E' },
  milestoneEmoji:        { fontSize: 28 },
  milestoneName:         { fontFamily: font.sansBd, fontSize: 13, color: MUTED, textAlign: 'center' },
  milestoneSub:          { fontFamily: font.mono, fontSize: 10, color: '#2A2A3A', textAlign: 'center', lineHeight: 14 },
  milestoneBadge:        {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: INDIGO, alignItems: 'center', justifyContent: 'center',
  },
  milestoneBadgeText:    { fontFamily: font.sansBd, fontSize: 10, color: '#FFF' },

  // Recent plans
  recentList: { gap: spacing[2] },
  recentCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: CARD, borderRadius: radius.md,
    borderWidth: 1, borderColor: BORDER,
    padding: spacing[3],
  },
  recentIconWrap: {
    width: 40, height: 40, borderRadius: radius.sm,
    backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  recentName: { fontFamily: font.sansBd, fontSize: 13, color: TEXT, marginBottom: 2 },
  recentDate: { fontFamily: font.mono, fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.3 },

  viewAllBtn:  { marginTop: spacing[3], alignItems: 'center', paddingVertical: spacing[3] },
  viewAllText: { fontFamily: font.mono, fontSize: 12, color: INDIGO, letterSpacing: 0.3 },

  // Empty state
  empty:        { alignItems: 'center', paddingVertical: spacing[10], gap: spacing[3] },
  emptyIcon:    { fontSize: 40 },
  emptyTitle:   { fontFamily: font.sansBd, fontSize: 20, color: TEXT },
  emptySub:     { fontFamily: font.sans, fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20 },
  emptyBtn:     {
    marginTop: spacing[3], backgroundColor: INDIGO,
    height: 48, paddingHorizontal: spacing[8],
    borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
  },
  emptyBtnText: { fontFamily: font.sansBd, fontSize: 14, color: '#FFF' },
});
