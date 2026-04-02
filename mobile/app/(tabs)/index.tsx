import { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, font } from '../../src/lib/theme';
import { PROGRAMS, FILTER_OPTIONS, Program } from '../../src/lib/programs';
import { useAuth } from '../../src/context/AuthContext';

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
    if (!user) {
      router.push('/auth');
      return;
    }
    if (prog.badge === 'PREMIUM' && !isPremium) {
      router.push('/upgrade');
      return;
    }
    router.push(`/wizard/${prog.id}`);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} stickyHeaderIndices={[1]}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>// PROGRAMS</Text>
          <Text style={styles.title}>Choose your{'\n'}program.</Text>
          <Text style={styles.sub}>Pick a program, answer a few questions, and get your personalized fitness plan.</Text>
        </View>

        {/* Toolbar — sticky */}
        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search programs…"
              placeholderTextColor={colors.ink4}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersInner}>
            {FILTER_OPTIONS.map(f => (
              <TouchableOpacity
                key={f.value}
                style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
                onPress={() => setFilter(f.value)}
              >
                <Text style={[styles.filterChipText, filter === f.value && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Program list */}
        <View style={styles.list}>
          {filtered.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No programs match your search.</Text>
            </View>
          )}
          {filtered.map((prog, i) => (
            <TouchableOpacity
              key={prog.id}
              style={[styles.card, i < filtered.length - 1 && styles.cardBorder]}
              onPress={() => openProgram(prog)}
              activeOpacity={0.7}
            >
              <View style={styles.cardIcon}>
                <Text style={styles.cardIconText}>{prog.icon}</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardName}>{prog.name}</Text>
                  <View style={[styles.badge, prog.badge === 'FREE' ? styles.badgeFree : styles.badgePremium]}>
                    <Text style={[styles.badgeText, prog.badge === 'FREE' ? styles.badgeTextFree : styles.badgeTextPremium]}>
                      {prog.badge}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardDesc} numberOfLines={2}>{prog.description}</Text>
                <View style={styles.tagRow}>
                  {prog.filters.slice(0, 3).map(tag => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag.replace('-', ' ')}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.cardDuration}>{prog.tagline}</Text>
                <Text style={styles.cardChevron}>
                  {prog.badge === 'PREMIUM' && !isPremium ? '🔒' : '›'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.parchment },
  container: { paddingBottom: spacing[10] },

  header: { paddingHorizontal: spacing[5], paddingTop: spacing[8], paddingBottom: spacing[6] },
  eyebrow: { fontFamily: font.mono, fontSize: 11, color: colors.ink3, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[3] },
  title: { fontFamily: font.sansBd, fontSize: 36, color: colors.ink, lineHeight: 42, marginBottom: spacing[3] },
  sub: { fontFamily: font.sans, fontSize: 15, color: colors.ink2, lineHeight: 22 },

  toolbar: { backgroundColor: colors.parchment, paddingHorizontal: spacing[5], paddingBottom: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.line },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line2, borderRadius: radius.sm, paddingHorizontal: spacing[3], height: 42, marginBottom: spacing[3] },
  searchIcon: { fontSize: 16, color: colors.ink4, marginRight: spacing[2] },
  searchInput: { flex: 1, fontFamily: font.sans, fontSize: 14, color: colors.ink },
  filters: { flexGrow: 0 },
  filtersInner: { gap: spacing[2], flexDirection: 'row' },
  filterChip: { paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.surface },
  filterChipActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  filterChipText: { fontFamily: font.mono, fontSize: 11, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  filterChipTextActive: { color: colors.white },

  list: { marginHorizontal: spacing[5], borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface },
  empty: { padding: spacing[8], alignItems: 'center' },
  emptyText: { fontFamily: font.sans, fontSize: 14, color: colors.ink3 },

  card: { flexDirection: 'row', alignItems: 'center', padding: spacing[4], gap: spacing[3] },
  cardBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  cardIcon: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.parchment, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardIconText: { fontSize: 22 },
  cardBody: { flex: 1, gap: spacing[1] },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardName: { fontFamily: font.sansBd, fontSize: 15, color: colors.ink, flex: 1 },
  cardDesc: { fontFamily: font.sans, fontSize: 13, color: colors.ink2, lineHeight: 18 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[1] },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.parchment },
  tagText: { fontFamily: font.mono, fontSize: 10, color: colors.ink3, textTransform: 'uppercase' },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  badgeFree: { backgroundColor: colors.forestLight },
  badgePremium: { backgroundColor: '#FEF3E2' },
  badgeText: { fontFamily: font.mono, fontSize: 10, letterSpacing: 0.4 },
  badgeTextFree: { color: colors.forest },
  badgeTextPremium: { color: colors.amber },

  cardRight: { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  cardDuration: { fontFamily: font.mono, fontSize: 11, color: colors.ink3 },
  cardChevron: { fontSize: 22, color: colors.ink3 },
});
