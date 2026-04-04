import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, Platform, ActivityIndicator, TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { spacing, radius, font } from '../src/lib/theme';
import { apiFetch } from '../src/lib/api';

type Plan = {
  id: number;
  program_id: string;
  program_name: string;
  program_icon: string;
  content: string;
  created_at: string;
  effort_rating?: number | null;
  feedback_notes?: string | null;
};

// ── Fitness glossary ──────────────────────────────────────────────────────────
const GLOSSARY: { term: string; short: string; def: string }[] = [
  { term: 'LISS',                 short: 'Cardio type',      def: 'Low Intensity Steady State — steady-paced cardio at ~60% effort (e.g. brisk walk, easy jog).' },
  { term: 'HIIT',                 short: 'Cardio type',      def: 'High Intensity Interval Training — short bursts of max effort followed by rest.' },
  { term: 'RPE',                  short: 'Effort scale',     def: 'Rate of Perceived Exertion — how hard it feels on a 1–10 scale. RPE 7 = hard but manageable.' },
  { term: 'AMRAP',                short: 'Format',           def: 'As Many Reps (or Rounds) As Possible — do as many as you can in the set time.' },
  { term: 'EMOM',                 short: 'Format',           def: 'Every Minute on the Minute — start a new set at the top of every minute.' },
  { term: 'TDEE',                 short: 'Nutrition',        def: 'Total Daily Energy Expenditure — all the calories your body burns in a day, including at rest.' },
  { term: '1RM',                  short: 'Strength',         def: 'One Rep Max — the most weight you can lift exactly once with good form.' },
  { term: 'PR',                   short: 'Achievement',      def: 'Personal Record — your best-ever performance for a given exercise or distance.' },
  { term: 'WOD',                  short: 'CrossFit',         def: 'Workout of the Day — the daily CrossFit workout written on the whiteboard.' },
  { term: 'Deload',               short: 'Recovery week',    def: 'A planned easy week (lighter weight, fewer sets) so your body recovers and comes back stronger.' },
  { term: 'Superset',             short: 'Training method',  def: 'Two exercises done back-to-back with no rest between them, then rest after both.' },
  { term: 'Tempo',                short: 'Rep speed',        def: 'The speed of each rep — e.g. 3-0-1 means 3 seconds down, no pause, 1 second up.' },
  { term: 'DOMS',                 short: 'Soreness',         def: 'Delayed Onset Muscle Soreness — the ache that peaks 24–48 hours after a hard session. Normal and healthy.' },
  { term: 'Compound',             short: 'Exercise type',    def: 'A movement using multiple joints at once (e.g. squat, deadlift). Works more muscle, gives more results.' },
  { term: 'Hypertrophy',          short: 'Muscle growth',    def: 'The process of muscle fibres growing larger in response to training. The goal of muscle-building programs.' },
  { term: 'MetCon',               short: 'CrossFit term',    def: 'Metabolic Conditioning — high-effort training designed to push cardiovascular fitness and burn energy.' },
  { term: 'MHR',                  short: 'Heart rate',       def: 'Maximum Heart Rate — your upper cardiovascular limit. Roughly 220 minus your age.' },
  { term: 'Taper',                short: 'Race prep',        def: 'Reducing training volume in the final weeks before a race so your body is fresh on race day.' },
  { term: 'Progressive Overload', short: 'Core principle',   def: 'Gradually making training harder over time (more weight, reps, or sets). This is what forces your body to improve.' },
  { term: 'Lactate Threshold',    short: 'Running',          def: 'The pace where lactic acid builds faster than your body can clear it. Training this raises your speed ceiling.' },
  { term: 'Isolation',            short: 'Exercise type',    def: 'A single-joint exercise targeting one muscle (e.g. bicep curl). Good for finishing off a specific muscle.' },
  { term: 'Rx',                   short: 'CrossFit',         def: 'Prescribed weight / standard — the "as written" version of a WOD without scaling.' },
  { term: 'Tabata',               short: 'Format',           def: '20 seconds all-out effort, 10 seconds rest, repeated 8 rounds (4 minutes total per exercise).' },
];

function detectTerms(content: string) {
  return GLOSSARY.filter(({ term }) => {
    // Match the main word of multi-word terms too
    const keyword = term.split(' ')[0];
    return content.includes(keyword);
  });
}

// ── Markdown parser: split content into sections by ## headings ───────────────
type Section = { title: string; icon: string; color: string; content: string };

function sectionIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('phase') || t.includes('block') || t.includes('day'))     return '📅';
  if (t.includes('nutrition') || t.includes('calorie') || t.includes('macro') || t.includes('eating') || t.includes('food')) return '🥗';
  if (t.includes('recover') || t.includes('sleep') || t.includes('rest'))  return '😴';
  if (t.includes('training') || t.includes('split') || t.includes('workout') || t.includes('session') || t.includes('schedule')) return '🏋️';
  if (t.includes('strategy') || t.includes('science'))                     return '🧠';
  if (t.includes('contract') || t.includes('rule'))                        return '📌';
  if (t.includes('movement') || t.includes('exercise') || t.includes('technique') || t.includes('master')) return '🎯';
  if (t.includes('cardio') || t.includes('run'))                           return '❤️';
  if (t.includes('check') || t.includes('track') || t.includes('milestone') || t.includes('test')) return '✅';
  if (t.includes('mistake') || t.includes('avoid') || t.includes('not to do') || t.includes('miss')) return '⚠️';
  if (t.includes('promise') || t.includes('welcome') || t.includes('personal') || t.includes('vision')) return '💬';
  if (t.includes('progress') || t.includes('system') || t.includes('progression')) return '📈';
  if (t.includes('pool') || t.includes('swim') || t.includes('drill'))     return '🏊';
  if (t.includes('race') || t.includes('marathon') || t.includes('pace') || t.includes('taper')) return '🏃';
  if (t.includes('station') || t.includes('hyrox'))                        return '🏟️';
  if (t.includes('space') || t.includes('home') || t.includes('equipment')) return '🏠';
  if (t.includes('challenge'))                                              return '🔥';
  return '📋';
}

function sectionColor(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('phase') || t.includes('block') || t.includes('week') || t.includes('day')) return '#4A8FAA';
  if (t.includes('nutrition') || t.includes('calorie') || t.includes('macro') || t.includes('food') || t.includes('eating')) return '#B07840';
  if (t.includes('recover') || t.includes('sleep') || t.includes('rest'))  return '#7A6AAE';
  if (t.includes('mistake') || t.includes('avoid') || t.includes('not to do') || t.includes('miss')) return '#A06858';
  if (t.includes('check') || t.includes('track') || t.includes('milestone') || t.includes('promise') || t.includes('test')) return '#8A9A3A';
  if (t.includes('cardio'))                                                 return '#AA6A3A';
  return '#3D9E6A';
}

function parsePlan(content: string): { meta: string; sections: Section[] } {
  const lines = content.split('\n');
  const sections: Section[] = [];
  let metaLines: string[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (line.startsWith('# ')) {
      // H1 — skip (it's just the plan title we already have)
      continue;
    }
    if (line.startsWith('## ')) {
      if (inSection) {
        const t = currentTitle;
        sections.push({ title: t, icon: sectionIcon(t), color: sectionColor(t), content: currentLines.join('\n').trim() });
      } else if (currentLines.some(l => l.trim())) {
        metaLines = currentLines;
      }
      currentTitle = line.replace(/^## /, '').trim();
      currentLines = [];
      inSection = true;
    } else {
      currentLines.push(line);
    }
  }
  if (inSection && currentTitle) {
    const t = currentTitle;
    sections.push({ title: t, icon: sectionIcon(t), color: sectionColor(t), content: currentLines.join('\n').trim() });
  }

  const meta = metaLines.filter(l => l.trim()).join('\n').trim();
  return { meta, sections };
}

// ── Post-workout feedback ─────────────────────────────────────────────────────
const EFFORT_LEVELS = [
  { value: 1, emoji: '😴', label: 'Easy' },
  { value: 2, emoji: '🙂', label: 'Moderate' },
  { value: 3, emoji: '💪', label: 'Good' },
  { value: 4, emoji: '🔥', label: 'Hard' },
  { value: 5, emoji: '⚡', label: 'All Out' },
];

function FeedbackSection({
  planId, initialRating, initialNotes,
}: {
  planId: number;
  initialRating?: number | null;
  initialNotes?: string | null;
}) {
  const [rating,  setRating]  = useState<number | null>(initialRating ?? null);
  const [notes,   setNotes]   = useState(initialNotes ?? '');
  const [saved,   setSaved]   = useState(!!initialRating);
  const [saving,  setSaving]  = useState(false);

  async function save() {
    if (!rating) return;
    setSaving(true);
    try {
      await apiFetch(`/api/plans/${planId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ effort_rating: rating, feedback_notes: notes.trim() || null }),
      });
      setSaved(true);
    } catch {}
    setSaving(false);
  }

  return (
    <View style={fb.card}>
      <View style={fb.accentBar} />
      <Text style={fb.title}>How was this workout?</Text>
      <Text style={fb.sub}>Rate your effort level</Text>
      <View style={fb.pills}>
        {EFFORT_LEVELS.map((e) => (
          <TouchableOpacity
            key={e.value}
            style={[fb.pill, rating === e.value && fb.pillActive]}
            onPress={() => { setRating(e.value); setSaved(false); }}
            activeOpacity={0.8}
          >
            <Text style={fb.pillEmoji}>{e.emoji}</Text>
            <Text style={[fb.pillLabel, rating === e.value && fb.pillLabelActive]}>{e.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={fb.notesInput}
        placeholder="Add a note... (optional)"
        placeholderTextColor="#40405A"
        value={notes}
        onChangeText={(t) => { setNotes(t); setSaved(false); }}
        multiline
        numberOfLines={3}
        fontSize={16}
      />
      <TouchableOpacity
        style={[fb.saveBtn, (!rating || saved) && fb.saveBtnDisabled]}
        onPress={save}
        disabled={!rating || saved || saving}
        activeOpacity={0.8}
      >
        {saving
          ? <ActivityIndicator size="small" color="#FFF" />
          : <Text style={fb.saveBtnText}>{saved ? '✓  Feedback saved' : 'Save feedback'}</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PlansScreen() {
  const router = useRouter();
  const [plans, setPlans]       = useState<Plan[]>([]);
  const [loading, setLoading]   = useState(true);
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

  // ── Plan detail view ────────────────────────────────────────────────────────
  if (selected) return <PlanDetail plan={selected} onBack={() => setSelected(null)} onDelete={() => confirmDelete(selected)} />;

  // ── Plans list ──────────────────────────────────────────────────────────────
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
            {plans.map((plan) => (
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

// ── Plan detail component ─────────────────────────────────────────────────────
function PlanDetail({ plan, onBack, onDelete }: { plan: Plan; onBack: () => void; onDelete: () => void }) {
  const { meta, sections } = parsePlan(plan.content);
  const glossaryTerms = detectTerms(plan.content);

  // First section open by default
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]));
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  function toggleSection(i: number) {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header bar */}
      <View style={s.detailHeader}>
        <TouchableOpacity style={s.detailBack} onPress={onBack} activeOpacity={0.7}>
          <Text style={s.detailBackText}>‹  My Plans</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} activeOpacity={0.7}>
          <Text style={s.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.detailScroll} showsVerticalScrollIndicator={false}>

        {/* Plan hero card */}
        <View style={s.heroCard}>
          <Text style={s.heroIcon}>{plan.program_icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.heroName}>{plan.program_name}</Text>
            <Text style={s.heroDate}>{formatDate(plan.created_at)}</Text>
          </View>
        </View>

        {/* Meta line (Designed for: ...) */}
        {!!meta && (
          <View style={s.metaCard}>
            <Text style={s.metaText}>{meta}</Text>
          </View>
        )}

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statPill}>
            <Text style={s.statNum}>{sections.length}</Text>
            <Text style={s.statLabel}>sections</Text>
          </View>
          {glossaryTerms.length > 0 && (
            <View style={[s.statPill, { backgroundColor: '#0F1D12' }]}>
              <Text style={[s.statNum, { color: '#3D9E6A' }]}>{glossaryTerms.length}</Text>
              <Text style={[s.statLabel, { color: '#3D9E6A' }]}>terms defined</Text>
            </View>
          )}
          <View style={[s.statPill, { flex: 1 }]}>
            <View style={s.aiBadgeDot} />
            <Text style={s.aiBadgeText}>AI-generated</Text>
          </View>
        </View>

        {/* Glossary card */}
        {glossaryTerms.length > 0 && (
          <View style={[s.sectionCard, { borderLeftColor: '#4A4A8A' }]}>
            <TouchableOpacity style={s.sectionHeader} onPress={() => setGlossaryOpen(v => !v)} activeOpacity={0.75}>
              <Text style={s.sectionHeaderIcon}>📖</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionTitle}>Glossary</Text>
                <Text style={s.sectionSubtitle}>{glossaryTerms.length} fitness terms explained</Text>
              </View>
              <Text style={[s.chevron, glossaryOpen && s.chevronOpen]}>›</Text>
            </TouchableOpacity>
            {glossaryOpen && (
              <View style={s.glossaryBody}>
                {glossaryTerms.map(({ term, short, def }) => (
                  <View key={term} style={s.glossaryRow}>
                    <View style={s.glossaryLeft}>
                      <Text style={s.glossaryTerm}>{term}</Text>
                      <Text style={s.glossaryShort}>{short}</Text>
                    </View>
                    <Text style={s.glossaryDef}>{def}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Section cards */}
        {sections.map((sec, i) => {
          const isOpen = openSections.has(i);
          return (
            <View key={i} style={[s.sectionCard, { borderLeftColor: sec.color }]}>
              <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection(i)} activeOpacity={0.75}>
                <Text style={s.sectionHeaderIcon}>{sec.icon}</Text>
                <Text style={[s.sectionTitle, { flex: 1 }]}>{sec.title}</Text>
                <Text style={[s.chevron, isOpen && s.chevronOpen]}>›</Text>
              </TouchableOpacity>
              {isOpen && (
                <View style={s.sectionBody}>
                  <Markdown style={mdStyles(sec.color)}>{sec.content}</Markdown>
                </View>
              )}
            </View>
          );
        })}

        {/* Post-workout feedback */}
        <FeedbackSection
          planId={plan.id}
          initialRating={plan.effort_rating}
          initialNotes={plan.feedback_notes}
        />

        <View style={{ height: spacing[12] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Styles ────────────────────────────────────────────────────────────────────
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

  empty:        { alignItems: 'center', paddingVertical: spacing[12], gap: spacing[3] },
  emptyIcon:    { fontSize: 40 },
  emptyTitle:   { fontFamily: font.sansBd, fontSize: 18, color: '#555' },
  emptySub:     { fontFamily: font.sans, fontSize: 14, color: '#444', textAlign: 'center' },
  emptyBtn:     { marginTop: spacing[4], backgroundColor: '#3D9E6A', height: 48, paddingHorizontal: spacing[8], borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  emptyBtnText: { fontFamily: font.sansBd, fontSize: 14, color: '#F5F5F2' },

  // Detail
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    borderBottomWidth: 1, borderBottomColor: '#1C1C18',
  },
  detailBack:     { flex: 1 },
  detailBackText: { fontFamily: font.sans, fontSize: 16, color: '#3D9E6A' },
  deleteText:     { fontFamily: font.sans, fontSize: 14, color: '#C06848' },
  detailScroll:   { padding: spacing[4], paddingBottom: spacing[12] },

  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[4],
    backgroundColor: '#181816', borderRadius: radius.lg,
    borderWidth: 1, borderColor: '#252520',
    padding: spacing[5], marginBottom: spacing[3],
  },
  heroIcon: { fontSize: 38 },
  heroName: { fontFamily: font.sansBd, fontSize: 20, color: '#F5F5F2', marginBottom: 3 },
  heroDate: { fontFamily: font.mono, fontSize: 11, color: '#444', textTransform: 'uppercase', letterSpacing: 0.4 },

  metaCard: {
    backgroundColor: '#0F1D12', borderRadius: radius.md,
    borderWidth: 1, borderColor: '#1A3020',
    padding: spacing[4], marginBottom: spacing[3],
  },
  metaText: { fontFamily: font.mono, fontSize: 12, color: '#4A8A5A', lineHeight: 18 },

  statsRow:     { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  statPill:     {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#181816', borderRadius: radius.full,
    borderWidth: 1, borderColor: '#252520',
    paddingHorizontal: spacing[4], paddingVertical: 8,
  },
  statNum:      { fontFamily: font.sansBd, fontSize: 14, color: '#F5F5F2' },
  statLabel:    { fontFamily: font.mono, fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 0.3 },
  aiBadgeDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3D9E6A' },
  aiBadgeText:  { fontFamily: font.mono, fontSize: 10, color: '#3D9E6A', textTransform: 'uppercase', letterSpacing: 0.4 },

  // Section accordion
  sectionCard: {
    backgroundColor: '#181816', borderRadius: radius.lg,
    borderWidth: 1, borderColor: '#252520',
    borderLeftWidth: 3,
    marginBottom: spacing[3], overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing[4], gap: spacing[3],
  },
  sectionHeaderIcon: { fontSize: 18 },
  sectionTitle:      { fontFamily: font.sansBd, fontSize: 14, color: '#F5F5F2', letterSpacing: 0.1 },
  sectionSubtitle:   { fontFamily: font.mono, fontSize: 10, color: '#555', letterSpacing: 0.3, marginTop: 2 },
  chevron: {
    fontSize: 20, color: '#444',
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
    color: '#888',
  },
  sectionBody: {
    borderTopWidth: 1, borderTopColor: '#252520',
    paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[2],
  },

  // Glossary
  glossaryBody:  { borderTopWidth: 1, borderTopColor: '#252520', padding: spacing[4], gap: spacing[3] },
  glossaryRow:   { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' },
  glossaryLeft:  { width: 110, flexShrink: 0 },
  glossaryTerm:  { fontFamily: font.monoMd, fontSize: 12, color: '#F5F5F2', marginBottom: 2 },
  glossaryShort: { fontFamily: font.mono, fontSize: 10, color: '#4A8A5A', textTransform: 'uppercase', letterSpacing: 0.3 },
  glossaryDef:   { fontFamily: font.sans, fontSize: 13, color: '#888', lineHeight: 19, flex: 1 },
});

// ── Feedback styles ───────────────────────────────────────────────────────────
const fb = StyleSheet.create({
  card: {
    backgroundColor: '#10101E', borderRadius: radius.lg,
    borderWidth: 1, borderColor: '#18183A',
    padding: spacing[5], marginBottom: spacing[4],
    overflow: 'hidden', position: 'relative',
  },
  accentBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 3, backgroundColor: '#5B5EF4',
  },
  title:   { fontFamily: font.sansBd, fontSize: 16, color: '#E8E8F0', marginBottom: 4, marginTop: spacing[1] },
  sub:     { fontFamily: font.mono, fontSize: 11, color: '#40405A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[4] },
  pills:   { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  pill: {
    flex: 1, alignItems: 'center', paddingVertical: spacing[3],
    backgroundColor: '#0C0C1A', borderRadius: radius.md,
    borderWidth: 1, borderColor: '#18183A', gap: 4,
  },
  pillActive:      { borderColor: '#5B5EF4', backgroundColor: '#0D0D1E' },
  pillEmoji:       { fontSize: 20 },
  pillLabel:       { fontFamily: font.mono, fontSize: 9, color: '#40405A', textTransform: 'uppercase', letterSpacing: 0.3 },
  pillLabelActive: { color: '#5B5EF4' },
  notesInput: {
    backgroundColor: '#0C0C1A', borderRadius: radius.md,
    borderWidth: 1, borderColor: '#18183A',
    color: '#E8E8F0', fontFamily: font.sans,
    padding: spacing[3], marginBottom: spacing[4],
    minHeight: 72, textAlignVertical: 'top',
  },
  saveBtn: {
    height: 48, borderRadius: radius.md,
    backgroundColor: '#5B5EF4', alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#1A1A2E' },
  saveBtnText:     { fontFamily: font.sansBd, fontSize: 14, color: '#FFF' },
});

// ── Per-section markdown styles (accent color varies) ─────────────────────────
const mdStyles = (accent: string) => ({
  body:         { color: '#CCCCC8' },
  heading3:     {
    fontFamily: font.sansBd, fontSize: 13, color: accent,
    marginTop: spacing[5], marginBottom: spacing[2],
    textTransform: 'uppercase' as const, letterSpacing: 0.5,
    borderBottomWidth: 1, borderBottomColor: '#252520', paddingBottom: spacing[1],
  },
  heading4:     { fontFamily: font.sansBd, fontSize: 13, color: '#F5F5F2', marginTop: spacing[3], marginBottom: spacing[1] },
  paragraph:    { fontFamily: font.sans, fontSize: 14, color: '#999', lineHeight: 23, marginBottom: spacing[3] },
  strong:       { fontFamily: font.sansBd, color: '#F5F5F2' },
  em:           { fontStyle: 'italic' as const, color: '#777' },
  bullet_list:  { marginBottom: spacing[3] },
  ordered_list: { marginBottom: spacing[3] },
  list_item:    { fontFamily: font.sans, fontSize: 14, color: '#999', lineHeight: 23, marginBottom: spacing[1] },
  code_inline:  {
    fontFamily: font.mono, fontSize: 12, color: accent,
    backgroundColor: '#0F1A0F', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  fence:        {
    fontFamily: font.mono, fontSize: 12, color: '#CCCCC8',
    backgroundColor: '#181816', padding: spacing[3],
    borderRadius: radius.sm, borderWidth: 1, borderColor: '#252520',
    marginBottom: spacing[3],
  },
  blockquote:   {
    backgroundColor: '#0F1A0F', borderLeftWidth: 3, borderLeftColor: accent,
    paddingLeft: spacing[3], paddingVertical: spacing[3],
    marginBottom: spacing[3], borderRadius: 4,
  },
  hr:           { backgroundColor: '#252520', height: 1, marginVertical: spacing[4] },
  table:        { borderWidth: 1, borderColor: '#252520', borderRadius: radius.sm, marginBottom: spacing[3] },
  thead:        { backgroundColor: '#1C1C18' },
  th:           { fontFamily: font.sansBd, fontSize: 12, color: '#F5F5F2', padding: spacing[2] },
  td:           { fontFamily: font.sans, fontSize: 13, color: '#888', padding: spacing[2], borderTopWidth: 1, borderTopColor: '#252520' },
});
