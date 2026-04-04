import { useState, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { spacing, radius, font } from '../../src/lib/theme';
import { PROGRAMS, Program } from '../../src/lib/programs';
import { useAuth } from '../../src/context/AuthContext';
import { useTrainingWS } from '../../src/hooks/useTrainingWS';

// ── Design tokens ──────────────────────────────────────────────────────────────
const BG      = '#07070F';
const SURFACE = '#0C0C1A';
const CARD    = '#10101E';
const BORDER  = '#18183A';
const INDIGO  = '#5B5EF4';
const VIOLET  = '#8B5CF6';
const GREEN   = '#3D9E6A';
const TEXT    = '#F0F0EE';
const MUTED   = '#52526A';
const DIM     = '#1A1A2E';

// ── Adaptive scoring ───────────────────────────────────────────────────────────
function matchScore(p: Program, energy: number, mins: number): number {
  let s = 0;
  const f = p.filters;
  if (mins <= 20) {
    if (f.includes('home') || f.includes('beginner') || f.includes('fat-loss')) s += 3;
    if (f.includes('strength') || f.includes('sport')) s -= 2;
  } else if (mins >= 45) {
    if (f.includes('strength') || f.includes('sport')) s += 2;
  } else {
    s += 1;
  }
  if (energy <= 2) {
    if (f.includes('home') || f.includes('beginner')) s += 3;
    if (f.includes('strength') || f.includes('sport')) s -= 2;
  } else if (energy >= 4) {
    if (f.includes('strength') || f.includes('sport')) s += 2;
    if (f.includes('beginner')) s -= 1;
  }
  return s;
}

// ── Energy / time config ───────────────────────────────────────────────────────
const ENERGY_LEVELS = [
  { id: 1, emoji: '💤', label: 'Low' },
  { id: 2, emoji: '😔', label: 'Tired' },
  { id: 3, emoji: '😊', label: 'Good' },
  { id: 4, emoji: '💪', label: 'Strong' },
  { id: 5, emoji: '⚡', label: 'Peak' },
];

const TIME_OPTIONS = [
  { label: '15m', mins: 15 },
  { label: '20m', mins: 20 },
  { label: '30m', mins: 30 },
  { label: '45m', mins: 45 },
  { label: '60m+', mins: 60 },
];

const PALETTES = [
  { bg: '#0F2318', accent: '#3D9E6A' },
  { bg: '#1A1200', accent: '#D4923F' },
  { bg: '#0E1A2B', accent: '#4A8FC4' },
  { bg: '#1E0F0A', accent: '#C06848' },
  { bg: '#12180A', accent: '#74A84E' },
  { bg: '#160A1E', accent: '#9A6AC8' },
];

// ── Main screen ────────────────────────────────────────────────────────────────
export default function TodayScreen() {
  const router = useRouter();
  const { user, isPremium } = useAuth();
  const { count: liveCount } = useTrainingWS(isPremium);

  const [energy, setEnergy] = useState<number | null>(null);
  const [time,   setTime]   = useState<number | null>(null);

  const scales = useRef(ENERGY_LEVELS.map(() => new Animated.Value(1))).current;
  const scrollRef = useRef<ScrollView>(null);
  const programsY = useRef(0);

  function selectEnergy(id: number) {
    scales.forEach((s, i) => {
      Animated.spring(s, {
        toValue: ENERGY_LEVELS[i].id === id ? 1.22 : 0.9,
        useNativeDriver: true,
        damping: 14,
        stiffness: 220,
      }).start();
    });
    setEnergy(id);
  }

  const adapted = useMemo(() => {
    if (!energy || !time) return { recommended: [] as Program[], rest: PROGRAMS };
    const scored = [...PROGRAMS].sort((a, b) =>
      matchScore(b, energy, time) - matchScore(a, energy, time)
    );
    const top = scored.slice(0, 3);
    const rest = scored.slice(3);
    return { recommended: top, rest };
  }, [energy, time]);

  function openProgram(prog: Program) {
    if (!user) { router.push('/auth'); return; }
    if (prog.badge === 'PREMIUM' && !isPremium) { router.push('/upgrade'); return; }
    const q = energy || time ? `?energy=${energy ?? ''}&time=${time ?? ''}` : '';
    router.push(`/wizard/${prog.id}${q}`);
  }

  function findWorkout() {
    scrollRef.current?.scrollTo({ y: programsY.current - 24, animated: true });
  }

  const ready    = energy !== null && time !== null;
  const adapting = ready;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>{greeting}</Text>
            <Text style={s.name}>
              {user ? user.name.split(' ')[0] : 'Athlete'} 👋
            </Text>
          </View>
          <TouchableOpacity
            style={s.avatar}
            onPress={() => router.push(user ? '/(tabs)/profile' : '/auth')}
            activeOpacity={0.8}
          >
            <Text style={s.avatarText}>
              {user ? user.name.charAt(0).toUpperCase() : '?'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Command card ─────────────────────────────────────────────────── */}
        <View style={s.commandCard}>
          {/* Accent line top */}
          <View style={s.commandAccentBar} />

          <Text style={s.commandTitle}>What's today's plan?</Text>
          <Text style={s.commandSub}>
            Set your energy and time — we'll surface your best match.
          </Text>

          {/* Energy picker */}
          <Text style={s.inputLabel}>Energy level</Text>
          <View style={s.energyRow}>
            {ENERGY_LEVELS.map((e, i) => {
              const sel = energy === e.id;
              return (
                <TouchableOpacity
                  key={e.id}
                  onPress={() => selectEnergy(e.id)}
                  activeOpacity={0.75}
                  style={s.energyWrap}
                >
                  <Animated.View style={[
                    s.energyBubble,
                    sel && s.energyBubbleSel,
                    { transform: [{ scale: scales[i] }] },
                  ]}>
                    <Text style={s.energyEmoji}>{e.emoji}</Text>
                  </Animated.View>
                  <Text style={[s.energyLabel, sel && { color: INDIGO }]}>
                    {e.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Time picker */}
          <Text style={[s.inputLabel, { marginTop: spacing[5] }]}>Time available</Text>
          <View style={s.timeRow}>
            {TIME_OPTIONS.map(t => (
              <TouchableOpacity
                key={t.mins}
                style={[s.timePill, time === t.mins && s.timePillSel]}
                onPress={() => setTime(t.mins)}
                activeOpacity={0.75}
              >
                <Text style={[s.timePillText, time === t.mins && s.timePillTextSel]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.cta, ready && s.ctaReady]}
            onPress={findWorkout}
            disabled={!ready}
            activeOpacity={0.87}
          >
            <Text style={[s.ctaText, ready && s.ctaTextReady]}>
              {ready ? 'Find My Workout →' : 'Select energy + time to continue'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Banners ───────────────────────────────────────────────────────── */}
        {user && !isPremium && !user.is_admin && (
          <TouchableOpacity
            style={s.upgradeBanner}
            onPress={() => router.push('/upgrade')}
            activeOpacity={0.85}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.upgradeTitle}>🔓 Unlock all 12 programs</Text>
              <Text style={s.upgradeSub}>Premium · €6/mo or €72/yr</Text>
            </View>
            <Text style={s.upgradeArrow}>Upgrade →</Text>
          </TouchableOpacity>
        )}

        {user && isPremium && !user.is_admin && (() => {
          const used      = user.usage?.used      ?? 0;
          const limit     = user.usage?.limit     ?? 5;
          const remaining = user.usage?.remaining ?? Math.max(0, limit - used);
          const pct       = Math.min((used / limit) * 100, 100);
          const warn      = remaining <= 1;
          return (
            <View style={s.usageBanner}>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={s.usageTop}>
                  <Text style={[s.usageLabel, warn && s.usageWarn]}>
                    {remaining === 0
                      ? 'No plans left this month'
                      : `${remaining} of ${limit} plans remaining`}
                  </Text>
                  <Text style={s.usageReset}>resets monthly</Text>
                </View>
                <View style={s.usageBar}>
                  <View style={[s.usageBarFill, { width: `${pct}%` as any }, warn && s.usageBarWarn]} />
                </View>
              </View>
            </View>
          );
        })()}

        {isPremium && liveCount > 0 && (
          <TouchableOpacity
            style={s.liveBanner}
            onPress={() => router.push('/(tabs)/community')}
            activeOpacity={0.8}
          >
            <View style={s.liveDot} />
            <Text style={s.liveText}>
              {liveCount === 1 ? '1 athlete training now' : `${liveCount} athletes training now`}
            </Text>
            <Text style={s.liveArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* ── Programs ──────────────────────────────────────────────────────── */}
        <View
          onLayout={e => { programsY.current = e.nativeEvent.layout.y; }}
          style={s.programsSection}
        >

          {/* Recommended (when adapting) */}
          {adapting && adapted.recommended.length > 0 && (
            <>
              <View style={s.sectionHead}>
                <View>
                  <Text style={s.sectionTitle}>Best match</Text>
                  <Text style={s.sectionSub}>Matched to your energy + time</Text>
                </View>
                <View style={s.matchPill}>
                  <Text style={s.matchPillText}>
                    {adapted.recommended.length} of {PROGRAMS.length}
                  </Text>
                </View>
              </View>
              {adapted.recommended.map((prog, i) => (
                <ProgramRow
                  key={prog.id}
                  prog={prog}
                  palette={PALETTES[i % PALETTES.length]}
                  locked={prog.badge === 'PREMIUM' && !isPremium}
                  onPress={() => openProgram(prog)}
                  recommended
                />
              ))}

              {adapted.rest.length > 0 && (
                <Text style={s.restLabel}>More programs</Text>
              )}
              {adapted.rest.map((prog, i) => (
                <ProgramRow
                  key={prog.id}
                  prog={prog}
                  palette={PALETTES[(adapted.recommended.length + i) % PALETTES.length]}
                  locked={prog.badge === 'PREMIUM' && !isPremium}
                  onPress={() => openProgram(prog)}
                />
              ))}
            </>
          )}

          {/* Default list */}
          {!adapting && (
            <>
              <Text style={s.sectionTitle}>All Programs</Text>
              {PROGRAMS.map((prog, i) => (
                <ProgramRow
                  key={prog.id}
                  prog={prog}
                  palette={PALETTES[i % PALETTES.length]}
                  locked={prog.badge === 'PREMIUM' && !isPremium}
                  onPress={() => openProgram(prog)}
                />
              ))}
            </>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Program row card ───────────────────────────────────────────────────────────
function ProgramRow({
  prog, palette, locked, onPress, recommended,
}: {
  prog: Program;
  palette: { bg: string; accent: string };
  locked: boolean;
  onPress: () => void;
  recommended?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        row.card,
        { backgroundColor: palette.bg },
        recommended && { borderColor: INDIGO + '60', borderWidth: 1 },
      ]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={[row.icon, { backgroundColor: palette.accent + '25' }]}>
        <Text style={row.iconText}>{prog.icon}</Text>
      </View>

      <View style={row.body}>
        <View style={row.topRow}>
          <Text style={row.name}>{prog.name}</Text>
          {recommended && (
            <View style={row.matchBadge}>
              <Text style={row.matchBadgeText}>✦ Match</Text>
            </View>
          )}
          {!recommended && (prog.badge === 'FREE'
            ? <View style={row.badgeFree}><Text style={row.badgeFreeText}>FREE</Text></View>
            : <View style={[row.badgePro, { borderColor: palette.accent + '50' }]}>
                <Text style={[row.badgeProText, { color: palette.accent }]}>PRO</Text>
              </View>
          )}
        </View>
        <Text style={row.desc} numberOfLines={2}>{prog.description}</Text>
        <View style={row.footer}>
          <Text style={[row.tagline, { color: palette.accent }]}>{prog.tagline}</Text>
          {locked && <Text style={row.lock}>🔒</Text>}
        </View>
      </View>

      <Text style={[row.arrow, { color: palette.accent }]}>›</Text>
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  scroll: { paddingBottom: spacing[12] },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[4],
  },
  greeting: {
    fontFamily: font.mono, fontSize: 11, color: MUTED,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4,
  },
  name:     { fontFamily: font.sansBd, fontSize: 30, color: TEXT, lineHeight: 36 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1A1A3A', borderWidth: 1, borderColor: INDIGO + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: font.sansBd, fontSize: 17, color: TEXT },

  // Command card
  commandCard: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    backgroundColor: SURFACE,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: BORDER,
    padding: spacing[5],
    overflow: 'hidden',
  },
  commandAccentBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 3,
    backgroundColor: INDIGO,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  commandTitle: {
    fontFamily: font.sansBd, fontSize: 20, color: TEXT,
    marginTop: spacing[2], marginBottom: 6,
  },
  commandSub: { fontFamily: font.sans, fontSize: 13, color: MUTED, lineHeight: 19, marginBottom: spacing[5] },
  inputLabel: { fontFamily: font.mono, fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing[3] },

  // Energy
  energyRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  energyWrap:   { alignItems: 'center', gap: 6, flex: 1 },
  energyBubble: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: DIM, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  energyBubbleSel: {
    backgroundColor: INDIGO + '22',
    borderColor: INDIGO,
    borderWidth: 2,
  },
  energyEmoji:  { fontSize: 22 },
  energyLabel:  { fontFamily: font.mono, fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.3 },

  // Time
  timeRow:         { flexDirection: 'row', gap: spacing[2] },
  timePill: {
    flex: 1, height: 38, borderRadius: radius.full,
    backgroundColor: DIM, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  timePillSel:     { backgroundColor: INDIGO, borderColor: INDIGO },
  timePillText:    { fontFamily: font.mono, fontSize: 11, color: MUTED, letterSpacing: 0.3 },
  timePillTextSel: { color: TEXT },

  // CTA
  cta: {
    marginTop: spacing[5], height: 52, borderRadius: radius.full,
    backgroundColor: DIM, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaReady: { backgroundColor: INDIGO, borderColor: INDIGO },
  ctaText: {
    fontFamily: font.mono, fontSize: 12, color: MUTED,
    letterSpacing: 0.4, textTransform: 'uppercase',
  },
  ctaTextReady: { color: TEXT },

  // Upgrade banner
  upgradeBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing[5], marginBottom: spacing[3],
    backgroundColor: SURFACE, borderRadius: radius.md,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3],
  },
  upgradeTitle: { fontFamily: font.mono, fontSize: 11, color: '#888', letterSpacing: 0.3 },
  upgradeSub:   { fontFamily: font.mono, fontSize: 10, color: MUTED, letterSpacing: 0.3 },
  upgradeArrow: { fontFamily: font.mono, fontSize: 11, color: GREEN, letterSpacing: 0.3, flexShrink: 0 },

  // Usage banner
  usageBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing[5], marginBottom: spacing[3],
    backgroundColor: SURFACE, borderRadius: radius.md,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3],
  },
  usageTop:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  usageLabel:   { fontFamily: font.mono, fontSize: 11, color: '#888', letterSpacing: 0.3 },
  usageWarn:    { color: '#C06848' },
  usageReset:   { fontFamily: font.mono, fontSize: 10, color: MUTED, letterSpacing: 0.3 },
  usageBar:     { height: 3, backgroundColor: DIM, borderRadius: 2, overflow: 'hidden', marginTop: 2 },
  usageBarFill: { height: '100%', backgroundColor: GREEN, borderRadius: 2 },
  usageBarWarn: { backgroundColor: '#C06848' },

  // Live banner
  liveBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing[5], marginBottom: spacing[3],
    backgroundColor: '#0A1A12', borderRadius: radius.full,
    borderWidth: 1, borderColor: GREEN + '40',
    paddingHorizontal: spacing[4], paddingVertical: 7,
    gap: spacing[2], alignSelf: 'stretch',
  },
  liveDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  liveText: { fontFamily: font.mono, fontSize: 11, color: '#6DBF8A', letterSpacing: 0.4, flex: 1 },
  liveArrow:{ fontFamily: font.mono, fontSize: 11, color: GREEN, opacity: 0.5 },

  // Programs section
  programsSection: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    gap: spacing[3],
  },
  sectionHead: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[1],
    marginBottom: spacing[1],
  },
  sectionTitle: {
    fontFamily: font.sansBd, fontSize: 16, color: TEXT,
    paddingHorizontal: spacing[1], marginBottom: spacing[1],
  },
  sectionSub: { fontFamily: font.mono, fontSize: 10, color: MUTED, letterSpacing: 0.3 },
  matchPill: {
    backgroundColor: INDIGO + '20', borderRadius: radius.full,
    borderWidth: 1, borderColor: INDIGO + '50',
    paddingHorizontal: spacing[3], paddingVertical: 4,
  },
  matchPillText: { fontFamily: font.mono, fontSize: 10, color: INDIGO, letterSpacing: 0.3 },
  restLabel: {
    fontFamily: font.mono, fontSize: 10, color: MUTED,
    textTransform: 'uppercase', letterSpacing: 0.6,
    paddingHorizontal: spacing[1], marginTop: spacing[2],
  },
});

const row = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing[4], borderRadius: radius.lg, gap: spacing[4],
  },
  icon: {
    width: 54, height: 54, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconText: { fontSize: 26 },
  body:     { flex: 1, gap: 6 },
  topRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  name:     { fontFamily: font.sansBd, fontSize: 15, color: TEXT, flex: 1 },
  matchBadge: {
    backgroundColor: INDIGO + '25', borderRadius: radius.full,
    borderWidth: 1, borderColor: INDIGO + '60',
    paddingHorizontal: 8, paddingVertical: 3,
  },
  matchBadgeText: { fontFamily: font.mono, fontSize: 9, color: INDIGO, letterSpacing: 0.5 },
  badgeFree: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full,
    backgroundColor: GREEN + '30', borderWidth: 1, borderColor: GREEN + '50',
  },
  badgeFreeText:  { fontFamily: font.mono, fontSize: 9, color: '#6DBF8A', letterSpacing: 0.5 },
  badgePro:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, backgroundColor: 'transparent' },
  badgeProText:   { fontFamily: font.mono, fontSize: 9, letterSpacing: 0.5 },
  desc:           { fontFamily: font.sans, fontSize: 13, color: '#666', lineHeight: 18 },
  footer:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  tagline:        { fontFamily: font.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  lock:           { fontSize: 12 },
  arrow:          { fontSize: 28, flexShrink: 0, opacity: 0.5 },
});
