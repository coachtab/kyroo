import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, font } from '../../src/lib/theme';
import { PROGRAMS, FILTER_OPTIONS, Program } from '../../src/lib/programs';
import { useAuth } from '../../src/context/AuthContext';

const CARD_PALETTES = [
  { bg: '#0F2318', accent: '#3D9E6A' },
  { bg: '#1A1200', accent: '#D4923F' },
  { bg: '#0E1A2B', accent: '#4A8FC4' },
  { bg: '#1E0F0A', accent: '#C06848' },
  { bg: '#12180A', accent: '#74A84E' },
  { bg: '#160A1E', accent: '#9A6AC8' },
];

export default function ProgramsScreen() {
  const router = useRouter();
  const { user, isPremium } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return PROGRAMS.filter(p => {
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      const matchFilter = filter === 'all' || p.filters.includes(filter);
      return matchSearch && matchFilter;
    });
  }, [search, filter]);

  function openProgram(prog: Program) {
    if (!user) { router.push('/auth'); return; }
    if (prog.badge === 'PREMIUM' && !isPremium) { router.push('/upgrade'); return; }
    router.push(`/wizard/${prog.id}`);
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{greeting}</Text>
              <Text style={styles.headerTitle}>
                {user ? user.name.split(' ')[0] : 'Athlete'} 👋
              </Text>
            </View>
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => router.push(user ? '/(tabs)/profile' : '/auth')}
              activeOpacity={0.8}
            >
              {user ? (
                <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
              ) : (
                <Text style={styles.avatarText}>?</Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSub}>
            Pick a program · answer a few questions · get your plan.
          </Text>
        </View>

        {/* ── Sticky toolbar ── */}
        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search programs…"
              placeholderTextColor="#555"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                <Text style={styles.searchClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
            {FILTER_OPTIONS.map(f => (
              <TouchableOpacity
                key={f.value}
                style={[styles.chip, filter === f.value && styles.chipActive]}
                onPress={() => setFilter(f.value)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, filter === f.value && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Cards ── */}
        <View style={styles.list}>
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptySub}>Try a different search or filter.</Text>
            </View>
          ) : (
            filtered.map((prog, i) => {
              const p = CARD_PALETTES[i % CARD_PALETTES.length];
              const locked = prog.badge === 'PREMIUM' && !isPremium;
              return (
                <TouchableOpacity
                  key={prog.id}
                  style={[styles.card, { backgroundColor: p.bg }]}
                  onPress={() => openProgram(prog)}
                  activeOpacity={0.82}
                >
                  <View style={[styles.iconWrap, { backgroundColor: p.accent + '25' }]}>
                    <Text style={styles.iconText}>{prog.icon}</Text>
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardName}>{prog.name}</Text>
                      {prog.badge === 'FREE'
                        ? <View style={styles.badgeFree}><Text style={styles.badgeFreeText}>FREE</Text></View>
                        : <View style={[styles.badgePro, { borderColor: p.accent + '50' }]}>
                            <Text style={[styles.badgeProText, { color: p.accent }]}>PRO</Text>
                          </View>
                      }
                    </View>
                    <Text style={styles.cardDesc} numberOfLines={2}>{prog.description}</Text>
                    <View style={styles.cardFooter}>
                      <Text style={[styles.cardTagline, { color: p.accent }]}>{prog.tagline}</Text>
                      {locked && <Text style={styles.lockIcon}>🔒</Text>}
                    </View>
                  </View>

                  <Text style={[styles.arrow, { color: p.accent }]}>›</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0D0D0B' },
  container: { paddingBottom: spacing[12] },

  // Header
  header: {
    backgroundColor: '#0D0D0B',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[5],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  greeting: {
    fontFamily: font.mono,
    fontSize: 11,
    color: '#555',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle:  { fontFamily: font.sansBd, fontSize: 30, color: '#F5F5F2', lineHeight: 36 },
  headerSub:    { fontFamily: font.sans, fontSize: 13, color: '#555', lineHeight: 20 },
  avatarBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.forest,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: font.sansBd, fontSize: 17, color: '#F5F5F2' },

  // Toolbar
  toolbar: {
    backgroundColor: '#0D0D0B',
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
    gap: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C18',
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#181816', borderRadius: radius.full,
    paddingHorizontal: spacing[4], height: 44, gap: spacing[2],
    borderWidth: 1, borderColor: '#252520',
  },
  searchIcon:  { fontSize: 16, color: '#444' },
  searchInput: {
    flex: 1, fontFamily: font.sans, fontSize: 14, color: '#F5F5F2',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },
  searchClear: { fontSize: 13, color: '#444' },
  filtersRow:  { gap: spacing[2], paddingRight: spacing[2] },
  chip: {
    paddingHorizontal: spacing[4], paddingVertical: 8,
    borderRadius: radius.full, backgroundColor: '#181816',
    borderWidth: 1, borderColor: '#252520',
  },
  chipActive:      { backgroundColor: colors.forest, borderColor: colors.forest },
  chipText:        { fontFamily: font.mono, fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipTextActive:  { color: '#F5F5F2' },

  // List
  list: { padding: spacing[4], gap: spacing[3] },

  // Empty
  empty: { alignItems: 'center', paddingVertical: spacing[12], gap: spacing[3] },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontFamily: font.sansBd, fontSize: 18, color: '#555' },
  emptySub:   { fontFamily: font.sans, fontSize: 14, color: '#444' },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing[4], borderRadius: radius.lg,
    gap: spacing[4],
  },
  iconWrap: {
    width: 54, height: 54, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconText:    { fontSize: 26 },
  cardBody:    { flex: 1, gap: 6 },
  cardTopRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardName:    { fontFamily: font.sansBd, fontSize: 15, color: '#F5F5F2', flex: 1 },
  badgeFree: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.forest + '30',
    borderWidth: 1, borderColor: colors.forest + '50',
  },
  badgeFreeText: { fontFamily: font.mono, fontSize: 9, color: '#6DBF8A', letterSpacing: 0.5 },
  badgePro: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full, borderWidth: 1,
    backgroundColor: 'transparent',
  },
  badgeProText:   { fontFamily: font.mono, fontSize: 9, letterSpacing: 0.5 },
  cardDesc:       { fontFamily: font.sans, fontSize: 13, color: '#666', lineHeight: 18 },
  cardFooter:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  cardTagline:    { fontFamily: font.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  lockIcon:       { fontSize: 12 },
  arrow:          { fontSize: 28, flexShrink: 0, opacity: 0.5 },
});
