import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, radius, font } from '../../src/lib/theme';
import { PROGRAMS } from '../../src/lib/programs';
import { apiFetch } from '../../src/lib/api';

const TOTAL_STEPS = 8;

type FormData = Record<string, any>;

export default function WizardScreen() {
  const { programId } = useLocalSearchParams<{ programId: string }>();
  const router = useRouter();
  const prog = PROGRAMS.find(p => p.id === programId);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({});
  const [reaction, setReaction] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!prog) return null;

  const progress = ((step - 1) / TOTAL_STEPS) * 100;

  function goTo(n: number) {
    setStep(n);
    setReaction('');
    setError('');
  }

  function selectOpt(key: string, value: string, reactionText: string, autoNext?: number) {
    setFormData(prev => ({ ...prev, [key]: value }));
    setReaction(reactionText);
    if (autoNext) setTimeout(() => goTo(autoNext), 820);
  }

  async function generate() {
    const injuries = formData.injuries || '';
    setGenerating(true);
    setError('');
    try {
      const res = await apiFetch('/api/generate', {
        method: 'POST',
        body: JSON.stringify({ ...formData, programId: prog.id, injuries }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Generation failed.'); setGenerating(false); return; }
      setResult(data.plan || data.content || JSON.stringify(data));
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  if (generating) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.genScreen}>
          <Text style={styles.genIcon}>{prog.icon}</Text>
          <Text style={styles.genTitle}>Crafting your plan</Text>
          <Text style={styles.genSub}>Analyzing your profile…</Text>
          <ActivityIndicator color={colors.forest} style={{ marginTop: spacing[6] }} />
        </View>
      </SafeAreaView>
    );
  }

  if (result) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.resultContainer}>
          <View style={styles.resultTop}>
            <View style={styles.resultCheck}><Text style={styles.resultCheckIcon}>✓</Text></View>
            <Text style={styles.resultTitle}>Your {prog.name}</Text>
            <Text style={styles.resultSub}>Built around your goals, schedule, and preferences.</Text>
          </View>
          <View style={styles.planBody}>
            <Text style={styles.planText}>{result}</Text>
          </View>
          <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
            <Text style={styles.btnText}>Close</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const steps = buildSteps(prog.id, formData, selectOpt, step, goTo, generate, error, setFormData);
  const activeStep = steps[step - 1];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => step > 1 ? goTo(step - 1) : router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.progLabel}>{prog.icon} {prog.name}</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Progress stripe */}
      <View style={styles.stripe}>
        <View style={[styles.stripeFill, { width: `${progress}%` }]} />
      </View>

      {/* Active step */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.counter}>{step} / {TOTAL_STEPS}</Text>
          {activeStep}
          {reaction ? <Text style={styles.reaction}>{reaction}</Text> : null}
        </ScrollView>
        {/* Pinned Generate button on last step so it's always visible */}
        {step === TOTAL_STEPS && (
          <View style={styles.pinnedBar}>
            {!!error && <Text style={styles.pinnedError}>{error}</Text>}
            <TouchableOpacity style={styles.pinnedBtn} onPress={generate}>
              <Text style={styles.pinnedBtnText}>Generate my plan →</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Step builder ────────────────────────────────────────────
function buildSteps(
  progId: string,
  formData: FormData,
  selectOpt: (key: string, value: string, reaction: string, autoNext?: number) => void,
  step: number,
  goTo: (n: number) => void,
  generate: () => void,
  error: string,
  setFormData: (fn: (prev: FormData) => FormData) => void,
) {
  const sel = (key: string) => formData[key];

  return [
    // Step 1 — Goal
    <StepWrap key="1" q="What's your main goal?" hint="This shapes everything about your program.">
      <Opts options={[
        { icon: '🔥', label: 'Lose weight', desc: 'Burn fat, feel lighter', value: 'lose weight and reduce body fat' },
        { icon: '💪', label: 'Build muscle', desc: 'Gain size and strength', value: 'build muscle and increase strength' },
        { icon: '⚡', label: 'Get fitter', desc: 'Energy, endurance, health', value: 'improve overall fitness and conditioning' },
        { icon: '❤️', label: 'Feel better', desc: 'Health and longevity', value: 'improve health, mobility, and wellbeing' },
      ]} selected={sel('goals')} onSelect={v => selectOpt('goals', v, 'Smart choice. Your program will be built around this.', 2)} />
      <Actions onNext={() => sel('goals') && goTo(2)} nextLabel="Continue" />
    </StepWrap>,

    // Step 2 — Level
    <StepWrap key="2" q="Your experience level?" hint="How long have you been training consistently?">
      <Opts options={[
        { icon: '🌱', label: 'Beginner', desc: 'Under 1 year', value: 'beginner' },
        { icon: '💫', label: 'Intermediate', desc: '1–4 years', value: 'intermediate' },
        { icon: '🏆', label: 'Advanced', desc: '5+ years', value: 'advanced' },
      ]} selected={sel('level')} onSelect={v => selectOpt('level', v, 'Got it. Your plan will match your level.', 3)} cols={3} />
      <Actions onBack={() => goTo(1)} onNext={() => sel('level') && goTo(3)} nextLabel="Continue" />
    </StepWrap>,

    // Step 3 — Body stats
    <StepWrap key="3" q="Your body stats?" hint="Used to personalize intensity and nutrition.">
      <NumericRow
        fields={[
          { label: 'Age', key: 'age', placeholder: '28', decimal: false },
          { label: 'Weight (kg)', key: 'weight', placeholder: '75', decimal: true },
          { label: 'Height (cm)', key: 'height', placeholder: '175', decimal: false },
        ]}
        formData={formData}
        setFormData={setFormData}
      />
      <SexSelector selected={sel('sex')} onSelect={v => setFormData(prev => ({ ...prev, sex: v }))} />
      <Actions onBack={() => goTo(2)} onNext={() => {
        const a = parseInt(formData.age, 10), w = parseFloat(formData.weight), h = parseFloat(formData.height);
        if (!a || a < 10 || a > 100) return;
        if (!w || w < 20 || w > 300) return;
        if (!h || h < 100 || h > 250) return;
        goTo(4);
      }} nextLabel="Continue" />
    </StepWrap>,

    // Step 4 — Schedule
    <StepWrap key="4" q="How many days a week?" hint="Be realistic — consistency beats ambition.">
      <Opts options={[
        { icon: '2', label: '2 days', desc: 'Light week', value: '2' },
        { icon: '3', label: '3 days', desc: 'Balanced', value: '3' },
        { icon: '4', label: '4 days', desc: 'Committed', value: '4' },
        { icon: '5', label: '5 days', desc: 'Serious', value: '5' },
        { icon: '6', label: '6 days', desc: 'Intense', value: '6' },
      ]} selected={sel('schedule')} onSelect={v => selectOpt('schedule', v, 'Perfect. Your plan will fit that schedule.', 5)} cols={3} monoKey />
      <Actions onBack={() => goTo(3)} onNext={() => sel('schedule') && goTo(5)} nextLabel="Continue" />
    </StepWrap>,

    // Step 5 — Location
    <StepWrap key="5" q="Where will you train?" hint="This determines the exercises in your plan.">
      <Opts options={[
        { icon: '🏋️', label: 'Gym', desc: 'Full equipment', value: 'gym' },
        { icon: '🏠', label: 'Home', desc: 'Bodyweight / minimal', value: 'home' },
        { icon: '🔀', label: 'Both', desc: 'Mix it up', value: 'both' },
      ]} selected={sel('location')} onSelect={v => selectOpt('location', v, 'Good. Exercises will be tailored to that setting.', 6)} cols={3} />
      <Actions onBack={() => goTo(4)} onNext={() => sel('location') && goTo(6)} nextLabel="Continue" />
    </StepWrap>,

    // Step 6 — Nutrition
    <StepWrap key="6" q="Nutrition focus?" hint="How much do you want nutrition guidance?">
      <Opts options={[
        { icon: '📊', label: 'Full guidance', desc: 'Macros, meals, timing', value: 'full nutrition guidance with macros and meal ideas' },
        { icon: '📋', label: 'Basic principles', desc: 'Simple rules only', value: 'basic nutrition principles' },
        { icon: '🏋️', label: 'Training only', desc: 'Skip nutrition', value: 'training only, skip nutrition advice' },
      ]} selected={sel('nutrition')} onSelect={v => selectOpt('nutrition', v, 'Noted. Your plan will include that level of nutrition detail.', 7)} />
      <Actions onBack={() => goTo(5)} onNext={() => sel('nutrition') && goTo(7)} nextLabel="Continue" />
    </StepWrap>,

    // Step 7 — Commitment
    <StepWrap key="7" q="Your biggest challenge?" hint="Your plan will address this directly.">
      <Opts options={[
        { icon: '⏰', label: 'Staying consistent', desc: 'Life gets in the way', value: 'staying consistent' },
        { icon: '😤', label: 'Staying motivated', desc: 'Hard to keep going', value: 'staying motivated' },
        { icon: '🍕', label: 'Diet and nutrition', desc: 'Hard to eat right', value: 'diet and nutrition' },
        { icon: '😴', label: 'Recovery', desc: 'Sleep and soreness', value: 'recovery and sleep' },
      ]} selected={sel('motivation')} onSelect={v => selectOpt('motivation', v, 'Your plan will include strategies to tackle exactly that.', 8)} />
      <Actions onBack={() => goTo(6)} onNext={() => sel('motivation') && goTo(8)} nextLabel="Continue" />
    </StepWrap>,

    // Step 8 — Injuries + generate
    <StepWrap key="8" q="Any injuries or limitations?" hint={'Type "None" if you\'re injury-free.'}>
      <TextInput
        style={stepStyles.textarea}
        multiline
        numberOfLines={3}
        placeholder="e.g. Bad lower back, avoid heavy deadlifts. Or: None."
        placeholderTextColor={colors.ink4}
        value={formData.injuries || ''}
        onChangeText={v => setFormData(prev => ({ ...prev, injuries: v }))}
      />
      <Actions onBack={() => goTo(7)} />
    </StepWrap>,
  ];
}

// ── Sub-components ───────────────────────────────────────────
function StepWrap({ q, hint, children }: { q: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={stepStyles.wrap}>
      <Text style={stepStyles.q}>{q}</Text>
      {hint && <Text style={stepStyles.hint}>{hint}</Text>}
      {children}
    </View>
  );
}

function Opts({ options, selected, onSelect, cols = 2, monoKey = false }: {
  options: { icon: string; label: string; desc: string; value: string }[];
  selected?: string; onSelect: (v: string) => void; cols?: number; monoKey?: boolean;
}) {
  return (
    <View style={[stepStyles.opts, cols === 3 && stepStyles.opts3]}>
      {options.map(o => (
        <TouchableOpacity
          key={o.value}
          style={[stepStyles.opt, selected === o.value && stepStyles.optActive]}
          onPress={() => onSelect(o.value)}
          activeOpacity={0.75}
        >
          <Text style={[stepStyles.optKey, monoKey && stepStyles.optKeyMono]}>{o.icon}</Text>
          <Text style={[stepStyles.optLabel, selected === o.value && stepStyles.optLabelActive]}>{o.label}</Text>
          <Text style={stepStyles.optDesc}>{o.desc}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SexSelector({ selected, onSelect }: { selected?: string; onSelect: (v: string) => void }) {
  return (
    <View style={stepStyles.sexRow}>
      {['male', 'female', 'other'].map(s => (
        <TouchableOpacity key={s} style={[stepStyles.sexBtn, selected === s && stepStyles.sexBtnActive]} onPress={() => onSelect(s)}>
          <Text style={[stepStyles.sexText, selected === s && stepStyles.sexTextActive]}>{s[0].toUpperCase() + s.slice(1)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function NumericRow({ fields, formData, setFormData }: {
  fields: { label: string; key: string; placeholder: string; decimal: boolean }[];
  formData: FormData;
  setFormData: (fn: (prev: FormData) => FormData) => void;
}) {
  return (
    <View style={stepStyles.numRow}>
      {fields.map(f => (
        <View key={f.key} style={stepStyles.numField}>
          <Text style={stepStyles.numLabel}>{f.label}</Text>
          <TextInput
            style={stepStyles.numInput}
            value={formData[f.key] || ''}
            onChangeText={v => {
              const clean = f.decimal ? v.replace(/[^0-9.]/g, '') : v.replace(/[^0-9]/g, '');
              setFormData(prev => ({ ...prev, [f.key]: clean }));
            }}
            keyboardType={f.decimal ? 'decimal-pad' : 'number-pad'}
            placeholder={f.placeholder}
            placeholderTextColor={colors.ink4}
            maxLength={f.decimal ? 6 : 3}
          />
        </View>
      ))}
    </View>
  );
}

function Actions({ onBack, onNext, nextLabel = 'Continue', nextForest = false }: {
  onBack?: () => void; onNext?: () => void; nextLabel?: string; nextForest?: boolean;
}) {
  return (
    <View style={stepStyles.actions}>
      {onBack && (
        <TouchableOpacity style={stepStyles.backAction} onPress={onBack}>
          <Text style={stepStyles.backActionText}>← Back</Text>
        </TouchableOpacity>
      )}
      {onNext && (
        <TouchableOpacity style={[stepStyles.nextBtn, nextForest && stepStyles.nextBtnForest]} onPress={onNext}>
          <Text style={stepStyles.nextBtnText}>{nextLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  wrap: { paddingBottom: spacing[8] },
  q: { fontFamily: font.sansBd, fontSize: 26, color: colors.ink, lineHeight: 32, marginBottom: spacing[2] },
  hint: { fontFamily: font.sans, fontSize: 14, color: colors.ink3, marginBottom: spacing[5] },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[5] },
  opts3: {},
  opt: {
    flex: 1, minWidth: '45%', padding: spacing[3], borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.surface,
    alignItems: 'flex-start',
  },
  optActive: { borderColor: colors.forest, backgroundColor: colors.forestLight },
  optKey: { fontSize: 22, marginBottom: spacing[1] },
  optKeyMono: { fontFamily: font.mono, fontSize: 20, color: colors.ink },
  optLabel: { fontFamily: font.sansMd, fontSize: 14, color: colors.ink, marginBottom: 2 },
  optLabelActive: { color: colors.forest },
  optDesc: { fontFamily: font.sans, fontSize: 12, color: colors.ink3 },
  sexRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3], marginBottom: spacing[5] },
  sexBtn: { flex: 1, paddingVertical: spacing[3], borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.surface, alignItems: 'center' },
  sexBtnActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  sexText: { fontFamily: font.mono, fontSize: 12, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.4 },
  sexTextActive: { color: colors.white },
  numRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[4] },
  numField: { flex: 1 },
  numLabel: { fontFamily: font.mono, fontSize: 11, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[2] },
  numInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line2, borderRadius: radius.sm, height: 44, paddingHorizontal: spacing[3], fontFamily: font.sans, fontSize: 15, color: colors.ink },
  textarea: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line2, borderRadius: radius.sm, padding: spacing[3], fontFamily: font.sans, fontSize: 14, color: colors.ink, minHeight: 100, textAlignVertical: 'top', marginBottom: spacing[4] },
  error: { fontFamily: font.sans, fontSize: 13, color: colors.error, marginBottom: spacing[3] },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[3], paddingTop: spacing[5], borderTopWidth: 1, borderTopColor: colors.line, marginTop: spacing[4] },
  backAction: { paddingVertical: 12, paddingHorizontal: spacing[3] },
  backActionText: { fontFamily: font.sans, fontSize: 14, color: colors.ink3 },
  nextBtn: { paddingVertical: 12, paddingHorizontal: spacing[5], borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.surface },
  nextBtnForest: { backgroundColor: colors.forest, borderColor: colors.forest },
  nextBtnText: { fontFamily: font.sansBd, fontSize: 14, color: colors.forest },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.parchment },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface },
  backBtn: { flex: 1 },
  backText: { fontFamily: font.mono, fontSize: 12, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.4 },
  progLabel: { fontFamily: font.sansMd, fontSize: 14, color: colors.ink },
  closeBtn: { flex: 1, alignItems: 'flex-end' },
  closeText: { fontSize: 18, color: colors.ink3 },
  stripe: { height: 3, backgroundColor: colors.line },
  stripeFill: { height: '100%', backgroundColor: colors.forest },
  stepContent: { padding: spacing[5], paddingTop: spacing[6], minHeight: 500 },
  pinnedBar: { borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.parchment, padding: spacing[4], gap: spacing[2] },
  pinnedError: { fontFamily: font.sans, fontSize: 13, color: colors.error, textAlign: 'center' },
  pinnedBtn: { backgroundColor: colors.forest, height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  pinnedBtnText: { fontFamily: font.sansBd, fontSize: 15, color: colors.white },
  counter: { fontFamily: font.mono, fontSize: 11, color: colors.ink4, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing[4] },
  reaction: { fontFamily: font.sans, fontSize: 13, color: colors.forest, fontStyle: 'italic', marginTop: spacing[3], lineHeight: 18 },
  genScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
  genIcon: { fontSize: 48, marginBottom: spacing[4] },
  genTitle: { fontFamily: font.sansBd, fontSize: 26, color: colors.ink, marginBottom: spacing[2] },
  genSub: { fontFamily: font.mono, fontSize: 13, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.4 },
  resultContainer: { padding: spacing[5], paddingTop: spacing[8] },
  resultTop: { alignItems: 'center', marginBottom: spacing[6] },
  resultCheck: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.forestLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[4] },
  resultCheckIcon: { fontSize: 22, color: colors.forest },
  resultTitle: { fontFamily: font.sansBd, fontSize: 26, color: colors.ink, marginBottom: spacing[2] },
  resultSub: { fontFamily: font.sans, fontSize: 14, color: colors.ink2, textAlign: 'center' },
  planBody: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing[4], marginBottom: spacing[6] },
  planText: { fontFamily: font.sans, fontSize: 13, color: colors.ink, lineHeight: 20 },
  btn: { backgroundColor: colors.forest, height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: font.sansBd, fontSize: 15, color: colors.white },
});
