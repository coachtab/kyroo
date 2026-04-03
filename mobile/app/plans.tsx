import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { colors, spacing, radius, font } from '../src/lib/theme';
import { apiFetch } from '../src/lib/api';

type Plan = {
  id: number;
  program_id: string;
  program_name: string;
  program_icon: string;
  content: string;
  created_at: string;
};

export default function PlansScreen() {
  const router = useRouter();
  const [plans, setPlans]     = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Plan | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    apiFetch('/api/plans')
      .then(r => r.json())
      .then(d => { if (active) setPlans(d.plans || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  function confirmDelete(plan: Plan) {
    const del = async () => {
      await apiFetch(`/api/plans/${plan.id}`, { method: 'DELETE' });
      setPlans(prev => prev.filter(p => p.id !== plan.id));
      if (selected?.id === plan.id) setSelected(null);
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this plan?')) del();
    } else {
      Alert.alert('Delete plan', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: del },
      ]);
    }
  }

  // ── Plan detail view ──────────────────────────────────────
  if (selected) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.detailHeader}>
          <TouchableOpacity style={s.detailBack} onPress={() => setSelected(null)} activeOpacity={0.7}>
            <Text style={s.detailBackText}>‹  My Plans</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => confirmDelete(selected)} activeOpacity={0.7}>
            <Text style={s.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.detailScroll} showsVerticalScrollIndicator={false}>
          <View style={s.detailMeta}>
            <Text style={s.detailIcon}>{selected.program_icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.detailName}>{selected.program_name}</Text>
              <Text style={s.detailDate}>{formatDate(selected.created_at)}</Text>
            </View>
          </View>

          <View style={s.detailBadge}>
            <View style={s.badgeDot} />
            <Text style={s.badgeText}>Generated plan</Text>
          </View>

          <Markdown style={mdStyles}>{selected.content}</Markdown>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Plans list ────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backText}>‹  Profile</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <Text style={s.eyebrow}>// YOUR HISTORY</Text>
        <Text style={s.title}>My Plans</Text>
        <Text style={s.sub}>Every plan you've generated is saved here automatically.</Text>

        {loading ? (
          <ActivityIndicator color="#3D9E6A" style={{ marginTop: spacing[10] }} />
        ) : plans.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📋</Text>
            <Text style={s.emptyTitle}>No plans yet</Text>
            <Text style={s.emptySub}>Generate your first plan from the Programs tab.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/')} activeOpacity={0.85}>
              <Text style={s.emptyBtnText}>Browse programs</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.list}>
            {plans.map((plan, i) => (
              <TouchableOpacity key={plan.id} style={s.card} onPress={() => setSelected(plan)} activeOpacity={0.8}>
                <View style={s.cardIconWrap}>
                  <Text style={s.cardIcon}>{plan.program_icon || '⚡'}</Text>
                </View>
                <View style={s.cardBody}>
                  <Text style={s.cardName}>{plan.program_name}</Text>
                  <Text style={s.cardDate}>{formatDate(plan.created_at)}</Text>
                  <Text style={s.cardPreview} numberOfLines={2}>
                    {plan.content.replace(/[#*_`]/g, '').trim()}
                  </Text>
                </View>
                <Text style={s.cardArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0D0D0B' },
  header:    { paddingHorizontal: spacing[5], paddingVertical: spacing[4], borderBottomWidth: 1, borderBottomColor: '#1C1C18' },
  backText:  { fontFamily: font.sans, fontSize: 16, color: '#3D9E6A' },
  container: { padding: spacing[5], paddingBottom: spacing[12] },

  eyebrow: { fontFamily: font.mono, fontSize: 11, color: '#555', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[2] },
  title:   { fontFamily: font.sansBd, fontSize: 30, color: '#F5F5F2', marginBottom: spacing[2] },
  sub:     { fontFamily: font.sans, fontSize: 14, color: '#555', lineHeight: 21, marginBottom: spacing[6] },

  list: { gap: spacing[3] },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#181816', borderRadius: radius.lg,
    borderWidth: 1, borderColor: '#252520',
    padding: spacing[4], gap: spacing[3],
  },
  cardIconWrap: {
    width: 48, height: 48, borderRadius: radius.md,
    backgroundColor: '#0F2318', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardIcon:    { fontSize: 22 },
  cardBody:    { flex: 1, gap: 3 },
  cardName:    { fontFamily: font.sansBd, fontSize: 14, color: '#F5F5F2' },
  cardDate:    { fontFamily: font.mono, fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 0.4 },
  cardPreview: { fontFamily: font.sans, fontSize: 12, color: '#555', lineHeight: 17 },
  cardArrow:   { fontSize: 22, color: '#333' },

  empty:      { alignItems: 'center', paddingVertical: spacing[12], gap: spacing[3] },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { fontFamily: font.sansBd, fontSize: 18, color: '#555' },
  emptySub:   { fontFamily: font.sans, fontSize: 14, color: '#444', textAlign: 'center' },
  emptyBtn:   { marginTop: spacing[4], backgroundColor: '#3D9E6A', height: 48, paddingHorizontal: spacing[8], borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  emptyBtnText: { fontFamily: font.sansBd, fontSize: 14, color: '#F5F5F2' },

  // Detail view
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    borderBottomWidth: 1, borderBottomColor: '#1C1C18',
  },
  detailBack:     { flex: 1 },
  detailBackText: { fontFamily: font.sans, fontSize: 16, color: '#3D9E6A' },
  deleteText:     { fontFamily: font.sans, fontSize: 14, color: '#C06848' },
  detailScroll:   { padding: spacing[5], paddingBottom: spacing[12] },
  detailMeta:     { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[5] },
  detailIcon:     { fontSize: 36 },
  detailName:     { fontFamily: font.sansBd, fontSize: 20, color: '#F5F5F2', marginBottom: 2 },
  detailDate:     { fontFamily: font.mono, fontSize: 11, color: '#444', textTransform: 'uppercase', letterSpacing: 0.4 },
  detailBadge:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[5] },
  badgeDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3D9E6A' },
  badgeText:      { fontFamily: font.mono, fontSize: 11, color: '#3D9E6A', textTransform: 'uppercase', letterSpacing: 0.6 },
});

const mdStyles = {
  body:        { fontFamily: font.sans, fontSize: 14, color: '#CCCCC8', lineHeight: 22 },
  heading1:    { fontFamily: font.sansBd, fontSize: 22, color: '#F5F5F2', marginTop: spacing[6], marginBottom: spacing[3], lineHeight: 28, borderBottomWidth: 2, borderBottomColor: '#3D9E6A', paddingBottom: spacing[2] },
  heading2:    { fontFamily: font.sansBd, fontSize: 18, color: '#F5F5F2', marginTop: spacing[5], marginBottom: spacing[2], lineHeight: 24 },
  heading3:    { fontFamily: font.sansBd, fontSize: 15, color: '#3D9E6A', marginTop: spacing[4], marginBottom: spacing[2], lineHeight: 20, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  paragraph:   { fontFamily: font.sans, fontSize: 14, color: '#888', lineHeight: 22, marginBottom: spacing[3] },
  strong:      { fontFamily: font.sansBd, color: '#F5F5F2' },
  em:          { fontStyle: 'italic' as const, color: '#888' },
  bullet_list: { marginBottom: spacing[3] },
  ordered_list:{ marginBottom: spacing[3] },
  list_item:   { fontFamily: font.sans, fontSize: 14, color: '#888', lineHeight: 22, marginBottom: spacing[1] },
  code_inline: { fontFamily: font.mono, fontSize: 12, color: '#3D9E6A', backgroundColor: '#0F2318', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  fence:       { fontFamily: font.mono, fontSize: 12, color: '#CCCCC8', backgroundColor: '#181816', padding: spacing[3], borderRadius: radius.sm, borderWidth: 1, borderColor: '#252520', marginBottom: spacing[3] },
  blockquote:  { backgroundColor: '#0F2318', borderLeftWidth: 3, borderLeftColor: '#3D9E6A', paddingLeft: spacing[3], paddingVertical: spacing[2], marginBottom: spacing[3], borderRadius: 4 },
  hr:          { backgroundColor: '#1C1C18', marginVertical: spacing[4] },
};
