import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { colors, spacing, radius, font } from '../../src/lib/theme';
import { PROGRAMS } from '../../src/lib/programs';
import { apiFetch } from '../../src/lib/api';
import { useAuth } from '../../src/context/AuthContext';

function getTotalSteps(progId: string) {
  if (progId === 'weightloss' || progId === 'muscle' || progId === 'challenge90') return 9;
  return 8;
}

type FormData = Record<string, any>;

export default function WizardScreen() {
  const { programId } = useLocalSearchParams<{ programId: string }>();
  const router = useRouter();
  const { user, isPremium, refresh } = useAuth();
  const prog = PROGRAMS.find(p => p.id === programId);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({ sex: 'male' });
  const statsApplied = useRef(false);

  // Sync saved body stats once — as soon as user is loaded.
  // We use a ref so we never overwrite values the user has already started editing.
  useEffect(() => {
    if (!user || statsApplied.current) return;
    // Only apply if we actually have at least one saved stat
    if (!user.body_age && !user.body_weight && !user.body_height && !user.body_sex) return;
    statsApplied.current = true;
    setFormData(prev => ({
      ...prev,
      age:    user.body_age    ? String(user.body_age)    : prev.age    ?? '',
      weight: user.body_weight ? String(user.body_weight) : prev.weight ?? '',
      height: user.body_height ? String(user.body_height) : prev.height ?? '',
      sex:    user.body_sex    ? user.body_sex             : prev.sex    ?? 'male',
    }));
  }, [user]); // eslint-disable-line

  // For the hint text on step 3
  const hasSavedStats = !!(user?.body_age && user?.body_weight && user?.body_height);
  const [reaction, setReaction] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!prog) return null;

  const TOTAL_STEPS = getTotalSteps(prog.id);
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
    setGenerating(true);
    setError('');
    try {
      const payload = {
        programId:         prog.id,
        level:             formData.level,
        age:               formData.age,
        weight:            formData.weight,
        height:            formData.height,
        sex:               formData.sex,
        days_per_week:     formData.schedule,
        session_minutes:   '60',
        equipment:         formData.location || 'full commercial gym',
        primary_goal:      formData.goals,
        nutrition:         formData.nutrition,
        biggest_challenge: formData.motivation,
        injuries:          formData.injuries || 'None',
        timeframe:         formData.timeframe,
        muscle_focus:      formData.muscle_focus,
        challenge_vision:  formData.challenge_vision,
      };
      const res = await apiFetch('/api/program/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Generation failed.'); setGenerating(false); return; }
      const planContent = data.program || data.plan || data.content || '';
      setResult(planContent);
      // Auto-save to user's profile (fire-and-forget)
      apiFetch('/api/plans', {
        method: 'POST',
        body: JSON.stringify({
          program_id:   prog.id,
          program_name: prog.name,
          program_icon: prog.icon,
          content:      planContent,
        }),
      }).catch(() => {/* silent — plan still shown even if save fails */});
    } catch (err: any) {
      setError(err?.message || 'Network error. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  const genMessages: Record<string, { title: string; sub: string; subtle: string }> = {
    weightloss: {
      title: 'Crafting your weight loss plan',
      sub:   'Calculating your calorie deficit…',
      subtle:'Building your fat-loss training schedule…',
    },
    muscle: {
      title: 'Building your muscle program',
      sub:   'Designing your hypertrophy splits…',
      subtle:'Programming your progressive overload…',
    },
    challenge90: {
      title: 'Designing your 90-day challenge',
      sub:   'Mapping your transformation phases…',
      subtle:'Setting your weekly milestones…',
    },
    beginner: {
      title: 'Creating your beginner program',
      sub:   'Selecting your foundational movements…',
      subtle:'Writing step-by-step instructions…',
    },
    home: {
      title: 'Building your home workout plan',
      sub:   'Choosing your bodyweight progressions…',
      subtle:'Structuring your at-home sessions…',
    },
    swim: {
      title: 'Writing your swim training plan',
      sub:   'Structuring your pool sessions…',
      subtle:'Planning your technique drills…',
    },
  };
  const gm = genMessages[prog.id] ?? {
    title: 'Crafting your plan',
    sub:   'Analyzing your profile…',
    subtle:'Working on your plan…',
  };

  if (generating) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.genScreen}>
          <Text style={styles.genIcon}>{prog.icon}</Text>
          <Text style={styles.genTitle}>{gm.title}</Text>
          <Text style={styles.genSub}>{gm.sub}</Text>
          <ActivityIndicator color="#3D9E6A" style={{ marginTop: spacing[6] }} />
          <Text style={styles.genSubtle}>{gm.subtle}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (result) {
    return (
      <SafeAreaView style={styles.safe}>
        {/* Sticky result header */}
        <View style={styles.resultHeader}>
          <View style={styles.resultHeaderLeft}>
            <Text style={styles.resultHeaderIcon}>{prog.icon}</Text>
            <View>
              <Text style={styles.resultHeaderEyebrow}>// YOUR PLAN</Text>
              <Text style={styles.resultHeaderTitle}>{prog.name}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.resultCloseBtn} onPress={() => router.back()}>
            <Text style={styles.resultCloseBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
          {/* Success badge */}
          <View style={styles.resultBadge}>
            <View style={styles.resultBadgeDot} />
            <Text style={styles.resultBadgeText}>Plan generated</Text>
          </View>

          {/* Markdown plan */}
          <View style={styles.resultMarkdown}>
            <Markdown style={markdownStyles}>{result}</Markdown>
          </View>

          {/* Bottom CTA */}
          <View style={styles.resultActions}>
            <TouchableOpacity style={styles.resultDoneBtn} onPress={() => router.back()}>
              <Text style={styles.resultDoneBtnText}>Done</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resultNewBtn} onPress={() => {
              setResult(null);
              setStep(1);
              setFormData({});
            }}>
              <Text style={styles.resultNewBtnText}>Start over</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const steps = buildSteps(prog.id, formData, selectOpt, step, goTo, generate, error, setFormData, hasSavedStats, refresh);
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
            {!isPremium && (() => {
              const remaining = user?.usage?.remaining ?? (user?.usage ? 0 : 5);
              const limit     = user?.usage?.limit ?? 5;
              const warn      = remaining <= 1;
              return (
                <View style={styles.pinnedUsage}>
                  <Text style={[styles.pinnedUsageText, warn && styles.pinnedUsageWarn]}>
                    {remaining === 0
                      ? '⚠ No plans left this month — upgrade for unlimited'
                      : `${remaining} of ${limit} plans remaining this month`}
                  </Text>
                </View>
              );
            })()}
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
  hasSavedStats: boolean,
  refresh: () => Promise<void>,
) {
  const sel = (key: string) => formData[key];

  const isSwim       = progId === 'swim';
  const isHome       = progId === 'home';
  const isBeginner   = progId === 'beginner';
  const isWeightLoss = progId === 'weightloss';
  const isMuscle     = progId === 'muscle';
  const isChallenge  = progId === 'challenge90';

  // ── WEIGHT LOSS — fully dedicated steps ──────────────────────
  if (isWeightLoss) {
    const step1wl = (
      <StepWrap key="1" q="What's driving you to lose weight?" hint="Be honest — your plan will be built around your real reason.">
        <Opts options={[
          { icon: '❤️', label: 'Health first', desc: 'Doctor advised it, or feeling unwell', value: 'improve health and reduce health risks related to excess weight' },
          { icon: '🪞', label: 'Feel confident', desc: 'Look and feel better in my body', value: 'feel more confident and comfortable in my body' },
          { icon: '⚡', label: 'More energy', desc: 'Tired of feeling sluggish', value: 'have more energy and feel lighter every day' },
          { icon: '🎯', label: 'Specific event', desc: 'Wedding, holiday, deadline', value: 'lose weight for a specific event or deadline' },
        ]} selected={sel('goals')} onSelect={v => selectOpt('goals', v, 'That\'s a powerful reason. Your plan will reflect it.', 2)} />
        <Actions onNext={() => sel('goals') && goTo(2)} nextLabel="Continue" />
      </StepWrap>
    );

    const step2wl = (
      <StepWrap key="2" q="How long have you been trying to lose weight?" hint="No judgement — this tells us what approach will actually work for you.">
        <Opts options={[
          { icon: '🌱', label: 'Just starting', desc: 'First real attempt', value: 'this is my first serious attempt at losing weight' },
          { icon: '🔄', label: 'Tried before', desc: 'Lost and regained weight', value: 'I have tried before but struggled to keep the weight off' },
          { icon: '📅', label: 'Years of trying', desc: 'Tried many diets and plans', value: 'I have been trying for years with mixed results' },
          { icon: '📉', label: 'Making progress', desc: 'Already losing, want a plan', value: 'I am already losing weight but want a structured program' },
        ]} selected={sel('level')} onSelect={v => selectOpt('level', v, 'Understood. Your plan will be designed for your situation.', 3)} />
        <Actions onBack={() => goTo(1)} onNext={() => sel('level') && goTo(3)} nextLabel="Continue" />
      </StepWrap>
    );

    const step4wl = (
      <StepWrap key="4" q="How many days can you train?" hint="Cardio + resistance — be realistic about your week.">
        <Opts options={[
          { icon: '2', label: '2 days', desc: 'Minimum effective dose', value: '2' },
          { icon: '3', label: '3 days', desc: 'Ideal for fat loss', value: '3' },
          { icon: '4', label: '4 days', desc: 'Accelerated results', value: '4' },
          { icon: '5', label: '5 days', desc: 'Maximum fat burn', value: '5' },
        ]} selected={sel('schedule')} onSelect={v => selectOpt('schedule', v, 'Good. Your weekly plan will be structured around that.', 5)} cols={2} monoKey />
        <Actions onBack={() => goTo(3)} onNext={() => sel('schedule') && goTo(5)} nextLabel="Continue" />
      </StepWrap>
    );

    const step5wl = (
      <StepWrap key="5" q="Where will you train?" hint="This decides whether your cardio is treadmill, outdoor, or bodyweight circuits.">
        <Opts options={[
          { icon: '🏋️', label: 'Gym', desc: 'Cardio machines + weights', value: 'full commercial gym with cardio machines and weights' },
          { icon: '🏠', label: 'Home', desc: 'Bodyweight + outdoor cardio', value: 'home with bodyweight exercises and outdoor cardio' },
          { icon: '🔀', label: 'Both', desc: 'Mix of gym and home', value: 'mix of gym and home training' },
        ]} selected={sel('location')} onSelect={v => selectOpt('location', v, 'Got it. Your cardio and training will be matched to that.', 6)} cols={3} />
        <Actions onBack={() => goTo(4)} onNext={() => sel('location') && goTo(6)} nextLabel="Continue" />
      </StepWrap>
    );

    const step6wl = (
      <StepWrap key="6" q="How do you want to handle nutrition?" hint="Fat loss is 80% what you eat. Choose how detailed you want the guidance.">
        <Opts options={[
          { icon: '📊', label: 'Full macros', desc: 'Exact calories, protein, carbs, fat', value: 'full macro and calorie tracking with daily targets and meal ideas' },
          { icon: '🍽️', label: 'Meal examples', desc: 'Real meals, no calorie counting', value: 'practical meal plan examples without strict calorie counting' },
          { icon: '📋', label: 'Simple rules', desc: '5 fat-loss rules, nothing else', value: 'simple fat-loss eating rules only' },
        ]} selected={sel('nutrition')} onSelect={v => selectOpt('nutrition', v, 'Perfect. Your plan will include exactly that.', 7)} />
        <Actions onBack={() => goTo(5)} onNext={() => sel('nutrition') && goTo(7)} nextLabel="Continue" />
      </StepWrap>
    );

    const step7wl = (
      <StepWrap key="7" q="What's your biggest weight loss obstacle?" hint="Your plan will include specific strategies for this.">
        <Opts options={[
          { icon: '🍕', label: 'Food cravings', desc: 'Hard to resist junk food', value: 'food cravings and emotional eating' },
          { icon: '⏰', label: 'No consistency', desc: 'Start well, fall off track', value: 'staying consistent — starting strong but losing momentum' },
          { icon: '😴', label: 'Slow results', desc: 'Give up when scales don\'t move', value: 'losing motivation when results are slow or the scale doesn\'t move' },
          { icon: '🍷', label: 'Social eating', desc: 'Restaurants, drinks, events', value: 'social situations — eating out, alcohol, and social pressure' },
        ]} selected={sel('motivation')} onSelect={v => selectOpt('motivation', v, 'Your plan will tackle that directly.', 8)} />
        <Actions onBack={() => goTo(6)} onNext={() => sel('motivation') && goTo(8)} nextLabel="Continue" />
      </StepWrap>
    );

    const step8wl = (
      <StepWrap key="8" q="Any injuries or food restrictions?" hint="We'll avoid anything that doesn't work for your body.">
        <TextInput
          style={stepStyles.textarea}
          multiline
          numberOfLines={3}
          placeholder="e.g. Bad knees — no running. Vegetarian. Or: None."
          placeholderTextColor="#555"
          value={formData.injuries || ''}
          onChangeText={v => setFormData(prev => ({ ...prev, injuries: v }))}
        />
        <Actions onBack={() => goTo(7)} onNext={() => goTo(9)} nextLabel="Continue" />
      </StepWrap>
    );

    const step9wl = (
      <StepWrap key="9" q="What's your target timeframe?" hint="Your plan length, phases, and pace will be built around this.">
        <Opts options={[
          { icon: '⚡', label: '4 weeks',    desc: 'Kickstart — fast results',          value: '4 weeks'  },
          { icon: '🔥', label: '8 weeks',    desc: 'Strong foundation, visible change',  value: '8 weeks'  },
          { icon: '💪', label: '12 weeks',   desc: 'Full transformation',                value: '12 weeks' },
          { icon: '🏆', label: '16 weeks +', desc: 'Long-term lifestyle change',         value: '16+ weeks'},
        ]} selected={sel('timeframe')} onSelect={v => selectOpt('timeframe', v, 'Perfect. Your plan will be paced exactly for that.')} cols={2} />
        <Actions onBack={() => goTo(8)} />
      </StepWrap>
    );

    return [step1wl, step2wl,
      <StepWrap key="3" q="Your current stats?" hint={hasSavedStats ? 'Saved from your profile — update anytime.' : 'Used to calculate your calorie deficit and training intensity.'}>
        <NumericRow
          fields={[
            { label: 'Age', key: 'age', placeholder: '28', decimal: false },
            { label: 'Weight (kg)', key: 'weight', placeholder: '85', decimal: true },
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
          apiFetch('/api/auth/body-stats', {
            method: 'PATCH',
            body: JSON.stringify({ age: formData.age, weight: formData.weight, height: formData.height, sex: formData.sex }),
          }).then(() => refresh()).catch(() => {});
          goTo(4);
        }} nextLabel="Continue" />
      </StepWrap>,
      step4wl, step5wl, step6wl, step7wl, step8wl, step9wl,
    ];
  }

  // ── MUSCLE BUILDING — fully dedicated steps ───────────────────
  if (isMuscle) {
    const step1mb = (
      <StepWrap key="1" q="What's your muscle building goal?" hint="Everything — your split, volume, and nutrition — will be built around this.">
        <Opts options={[
          { icon: '🪞', label: 'Size & aesthetics', desc: 'Look bigger, more defined', value: 'build visible muscle mass and improve body composition' },
          { icon: '🏋️', label: 'Raw strength',      desc: 'Move heavier weight',        value: 'increase strength and lift heavier across all compound movements' },
          { icon: '⚽',  label: 'Athletic muscle',   desc: 'Functional power for sport', value: 'build functional muscle mass to improve athletic performance' },
          { icon: '🔄',  label: 'Recomposition',    desc: 'Build muscle, lose fat',     value: 'body recomposition — build muscle while reducing body fat simultaneously' },
        ]} selected={sel('goals')} onSelect={v => selectOpt('goals', v, 'Locked in. Every session will be built around that.', 2)} />
        <Actions onNext={() => sel('goals') && goTo(2)} nextLabel="Continue" />
      </StepWrap>
    );

    const step2mb = (
      <StepWrap key="2" q="How long have you been lifting seriously?" hint="This sets your starting volume, exercise complexity, and progression speed.">
        <Opts options={[
          { icon: '🌱', label: 'Never lifted',    desc: 'First time in the gym',           value: 'complete beginner — never followed a structured lifting program' },
          { icon: '📖', label: 'Under 1 year',   desc: 'Know the basics, building habits', value: 'beginner — less than 1 year of consistent training' },
          { icon: '💪', label: '1–3 years',      desc: 'Consistent, past newbie gains',    value: 'intermediate — 1 to 3 years of serious training' },
          { icon: '🏆', label: '3+ years',       desc: 'Chasing advanced gains',           value: 'advanced — 3 or more years of structured training' },
        ]} selected={sel('level')} onSelect={v => selectOpt('level', v, 'Got it. Your program will match your experience exactly.', 3)} />
        <Actions onBack={() => goTo(1)} onNext={() => sel('level') && goTo(3)} nextLabel="Continue" />
      </StepWrap>
    );

    const step4mb = (
      <StepWrap key="4" q="How many days can you train per week?" hint="More days = more volume per muscle group = more growth.">
        <Opts options={[
          { icon: '3', label: '3 days', desc: 'Full body — high frequency',   value: '3' },
          { icon: '4', label: '4 days', desc: 'Upper / lower split',          value: '4' },
          { icon: '5', label: '5 days', desc: 'Push / pull / legs',           value: '5' },
          { icon: '6', label: '6 days', desc: 'High frequency, max volume',   value: '6' },
        ]} selected={sel('schedule')} onSelect={v => selectOpt('schedule', v, 'Perfect. Your split will be designed around that.', 5)} cols={2} monoKey />
        <Actions onBack={() => goTo(3)} onNext={() => sel('schedule') && goTo(5)} nextLabel="Continue" />
      </StepWrap>
    );

    const step5mb = (
      <StepWrap key="5" q="Where do you train?" hint="This determines your exercises — barbells, machines, cables, or bodyweight.">
        <Opts options={[
          { icon: '🏋️', label: 'Full gym',      desc: 'Barbells, cables, machines',       value: 'full commercial gym with barbells, cables, and machines' },
          { icon: '🤖', label: 'Machines only', desc: 'No free weights or barbells',       value: 'gym with machines and dumbbells only — no barbells' },
          { icon: '🏠', label: 'Home + dumbbells', desc: 'Dumbbells and a pull-up bar',    value: 'home gym with dumbbells and pull-up bar' },
          { icon: '🤸', label: 'Bodyweight',    desc: 'No equipment, calisthenics focus',  value: 'bodyweight only — no equipment' },
        ]} selected={sel('location')} onSelect={v => selectOpt('location', v, 'Noted. Every exercise will fit your setup.', 6)} />
        <Actions onBack={() => goTo(4)} onNext={() => sel('location') && goTo(6)} nextLabel="Continue" />
      </StepWrap>
    );

    const step6mb = (
      <StepWrap key="6" q="Any muscle groups to prioritise?" hint="Your program will still train everything — but these get extra volume.">
        <Opts options={[
          { icon: '⚖️', label: 'Full body balance', desc: 'Even development everywhere',  value: 'full body — balanced development across all muscle groups' },
          { icon: '💪', label: 'Chest & arms',      desc: 'Pecs, biceps, triceps',        value: 'chest, biceps, and triceps — upper body push emphasis' },
          { icon: '🔙', label: 'Back & shoulders',  desc: 'Width, thickness, delts',      value: 'back, shoulders, and rear delts — pulling and width emphasis' },
          { icon: '🦵', label: 'Legs & glutes',     desc: 'Quads, hamstrings, glutes',    value: 'legs and glutes — lower body strength and mass' },
        ]} selected={sel('muscle_focus')} onSelect={v => selectOpt('muscle_focus', v, 'Extra volume goes there. The rest stays balanced.', 7)} />
        <Actions onBack={() => goTo(5)} onNext={() => sel('muscle_focus') && goTo(7)} nextLabel="Continue" />
      </StepWrap>
    );

    const step7mb = (
      <StepWrap key="7" q="How do you want nutrition handled?" hint="Muscle is built in the kitchen. Choose how detailed your guidance should be.">
        <Opts options={[
          { icon: '📊', label: 'Full surplus plan', desc: 'Exact kcal, protein, carbs, fat', value: 'full calorie surplus with exact macro targets and meal timing' },
          { icon: '🍗', label: 'High-protein meals', desc: 'Real meals, no calorie counting', value: 'high-protein meal examples and food swaps — no macro counting' },
          { icon: '📋', label: 'Simple rules',       desc: '5 muscle-gain rules, nothing else', value: 'simple muscle-building nutrition rules only' },
        ]} selected={sel('nutrition')} onSelect={v => selectOpt('nutrition', v, 'Your plan will include exactly that level of detail.', 8)} />
        <Actions onBack={() => goTo(6)} onNext={() => sel('nutrition') && goTo(8)} nextLabel="Continue" />
      </StepWrap>
    );

    const step8mb = (
      <StepWrap key="8" q="What's your biggest muscle building obstacle?" hint="Your plan will include direct strategies to overcome this.">
        <Opts options={[
          { icon: '📉', label: 'Hitting plateaus',   desc: 'Progress stalls, gains stop',        value: 'hitting strength and size plateaus — progress has stalled' },
          { icon: '🍽️', label: 'Eating enough',      desc: 'Hard to eat in a surplus',           value: 'struggling to eat enough calories to support muscle growth' },
          { icon: '😴', label: 'Poor recovery',      desc: 'Always sore, never fresh',           value: 'poor recovery — always sore and fatigued between sessions' },
          { icon: '❓', label: 'No clear direction', desc: 'Unsure what exercises actually work', value: 'no structured plan — unsure which exercises and rep ranges to use' },
        ]} selected={sel('motivation')} onSelect={v => selectOpt('motivation', v, 'Your plan will tackle that head on.', 9)} />
        <Actions onBack={() => goTo(7)} onNext={() => sel('motivation') && goTo(9)} nextLabel="Continue" />
      </StepWrap>
    );

    const step9mb = (
      <StepWrap key="9" q="What's your target timeframe?" hint="Your phases, volume progression, and deload weeks will be scaled to this.">
        <Opts options={[
          { icon: '🔥', label: '8 weeks',    desc: 'Intensive block, fast strength gains', value: '8 weeks'   },
          { icon: '💪', label: '12 weeks',   desc: 'Volume + intensity phases',            value: '12 weeks'  },
          { icon: '🏆', label: '16 weeks',   desc: 'Full hypertrophy cycle with deload',   value: '16 weeks'  },
          { icon: '🗓️', label: '6 months+',  desc: 'Long-term periodised program',         value: '6 months+' },
        ]} selected={sel('timeframe')} onSelect={v => selectOpt('timeframe', v, 'Perfect. Your program will be phased exactly for that.')} cols={2} />
        <Actions onBack={() => goTo(8)} />
      </StepWrap>
    );

    return [step1mb, step2mb,
      <StepWrap key="3" q="Your current stats?" hint={hasSavedStats ? 'Saved from your profile — update anytime.' : 'Used to calculate your calorie surplus and daily protein target.'}>
        <NumericRow
          fields={[
            { label: 'Age', key: 'age', placeholder: '25', decimal: false },
            { label: 'Weight (kg)', key: 'weight', placeholder: '75', decimal: true },
            { label: 'Height (cm)', key: 'height', placeholder: '178', decimal: false },
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
          apiFetch('/api/auth/body-stats', {
            method: 'PATCH',
            body: JSON.stringify({ age: formData.age, weight: formData.weight, height: formData.height, sex: formData.sex }),
          }).then(() => refresh()).catch(() => {});
          goTo(4);
        }} nextLabel="Continue" />
      </StepWrap>,
      step4mb, step5mb, step6mb, step7mb, step8mb, step9mb,
    ];
  }

  // ── 90-DAY CHALLENGE — fully dedicated steps ──────────────────
  if (isChallenge) {
    const step1ch = (
      <StepWrap key="1" q="What transformation are you chasing?" hint="Your 90 days will be built around this. Be specific — vague goals produce vague results.">
        <Opts options={[
          { icon: '🪞', label: 'Body first',       desc: 'Lose fat, build muscle, look different', value: 'visible body transformation — lose fat and build lean muscle' },
          { icon: '🏃', label: 'Performance',      desc: 'Get fitter, faster, stronger',           value: 'major fitness improvement — strength, endurance, and athletic performance' },
          { icon: '🧠', label: 'New habits',       desc: 'Make exercise and nutrition automatic',  value: 'build unbreakable fitness and nutrition habits that last beyond 90 days' },
          { icon: '🔥', label: 'Full overhaul',    desc: 'Body + performance + mindset',           value: 'complete transformation — body, fitness, habits, and mindset' },
        ]} selected={sel('goals')} onSelect={v => selectOpt('goals', v, 'That\'s your mission for the next 90 days.', 2)} />
        <Actions onNext={() => sel('goals') && goTo(2)} nextLabel="Continue" />
      </StepWrap>
    );

    const step2ch = (
      <StepWrap key="2" q="Where are you starting from?" hint="Honest answer only — your Day 1 training load depends on this.">
        <Opts options={[
          { icon: '🛋️', label: 'Inactive',        desc: 'Little to no exercise right now',       value: 'currently inactive — little to no regular exercise' },
          { icon: '🚶', label: 'Lightly active',  desc: 'Walk, occasional workout',               value: 'lightly active — occasional walks or workouts, no consistent routine' },
          { icon: '🏃', label: 'Somewhat fit',    desc: 'Train 1–2× a week',                     value: 'somewhat fit — training 1-2 times per week but no structured program' },
          { icon: '💪', label: 'Already training',desc: 'Consistent 3+ days/week',                value: 'already training consistently 3 or more days per week' },
        ]} selected={sel('level')} onSelect={v => selectOpt('level', v, 'Got it. Your starting intensity and volume will match that.', 3)} />
        <Actions onBack={() => goTo(1)} onNext={() => sel('level') && goTo(3)} nextLabel="Continue" />
      </StepWrap>
    );

    const step4ch = (
      <StepWrap key="4" q="How many days per week can you commit?" hint="This is a challenge — minimum 4 days. More days = faster transformation.">
        <Opts options={[
          { icon: '4', label: '4 days', desc: 'Minimum commitment, maximum focus', value: '4' },
          { icon: '5', label: '5 days', desc: 'Recommended — balanced intensity',  value: '5' },
          { icon: '6', label: '6 days', desc: 'All in — maximum transformation',   value: '6' },
        ]} selected={sel('schedule')} onSelect={v => selectOpt('schedule', v, 'Locked in. Your 90 days starts now.', 5)} cols={3} monoKey />
        <Actions onBack={() => goTo(3)} onNext={() => sel('schedule') && goTo(5)} nextLabel="Continue" />
      </StepWrap>
    );

    const step5ch = (
      <StepWrap key="5" q="Where will you train?" hint="Your sessions will be designed specifically for this setup.">
        <Opts options={[
          { icon: '🏋️', label: 'Gym',          desc: 'Full equipment available',             value: 'full commercial gym' },
          { icon: '🏠', label: 'Home',          desc: 'Bodyweight or minimal equipment',      value: 'home with bodyweight and minimal equipment' },
          { icon: '🌳', label: 'Outdoors',      desc: 'Parks, tracks, open space',            value: 'outdoors — parks, running tracks, and open spaces' },
          { icon: '🔀', label: 'Mix',           desc: 'Gym + home + outdoor',                 value: 'mix of gym, home, and outdoor training' },
        ]} selected={sel('location')} onSelect={v => selectOpt('location', v, 'Every session will be built for that environment.', 6)} />
        <Actions onBack={() => goTo(4)} onNext={() => sel('location') && goTo(6)} nextLabel="Continue" />
      </StepWrap>
    );

    const step6ch = (
      <StepWrap key="6" q="How committed are you to nutrition?" hint="90-day transformations are decided in the kitchen as much as the gym.">
        <Opts options={[
          { icon: '📋', label: 'Strict daily plan', desc: 'Exact meals laid out per phase',       value: 'strict daily nutrition plan with phase-by-phase meal structure' },
          { icon: '🥗', label: 'Clean eating rules', desc: 'Clear rules, no calorie counting',    value: 'clean eating rules — what to eat, what to avoid, no obsessive tracking' },
          { icon: '📊', label: 'Track macros',       desc: 'Calories + protein targets daily',    value: 'macro tracking — daily calorie and protein targets with food flexibility' },
        ]} selected={sel('nutrition')} onSelect={v => selectOpt('nutrition', v, 'Your 90-day nutrition strategy is set.', 7)} />
        <Actions onBack={() => goTo(5)} onNext={() => sel('nutrition') && goTo(7)} nextLabel="Continue" />
      </StepWrap>
    );

    const step7ch = (
      <StepWrap key="7" q="What's your biggest threat to finishing?" hint="Most people quit between Day 20 and Day 40. Your plan will have direct countermeasures.">
        <Opts options={[
          { icon: '📉', label: 'Motivation drops',    desc: 'Start strong, fade after week 2',     value: 'motivation dropping after the initial excitement wears off' },
          { icon: '🕐', label: 'Life gets busy',      desc: 'Work, family, schedule chaos',        value: 'life getting in the way — work, family, and schedule disruptions' },
          { icon: '🔍', label: 'Slow early results',  desc: 'Give up if nothing happens fast',     value: 'not seeing results fast enough and losing belief in the process' },
          { icon: '🔁', label: 'Past failures',       desc: 'Started challenges before, quit',     value: 'history of starting and quitting — need to break the pattern this time' },
        ]} selected={sel('motivation')} onSelect={v => selectOpt('motivation', v, 'Your plan will have a direct strategy for exactly that.', 8)} />
        <Actions onBack={() => goTo(6)} onNext={() => sel('motivation') && goTo(8)} nextLabel="Continue" />
      </StepWrap>
    );

    const step8ch = (
      <StepWrap key="8" q="Any injuries or physical limitations?" hint="We'll program around anything that needs protecting.">
        <TextInput
          style={stepStyles.textarea}
          multiline
          numberOfLines={3}
          placeholder="e.g. Lower back issues — no heavy deadlifts. Or: None."
          placeholderTextColor="#555"
          value={formData.injuries || ''}
          onChangeText={v => setFormData(prev => ({ ...prev, injuries: v }))}
        />
        <Actions onBack={() => goTo(7)} onNext={() => goTo(9)} nextLabel="Continue" />
      </StepWrap>
    );

    const step9ch = (
      <StepWrap key="9" q="What does Day 90 success look like?" hint="This becomes your challenge contract. Every session will work towards it.">
        <Opts options={[
          { icon: '🪞', label: 'Look different',     desc: 'Visible body change, new photos',     value: 'a visibly transformed body — new progress photos prove the change' },
          { icon: '🏅', label: 'Hit a milestone',    desc: 'Specific performance goal achieved',  value: 'a specific performance milestone — a lift PR, run time, or fitness test' },
          { icon: '♾️', label: 'Built for life',     desc: 'Habits that stick beyond Day 90',     value: 'permanent habits — fitness and nutrition feel natural and automatic' },
          { icon: '🏆', label: 'I finished',         desc: 'Prove I can complete a full challenge',value: 'the proof that I can commit to and finish something hard — no excuses' },
        ]} selected={sel('challenge_vision')} onSelect={v => selectOpt('challenge_vision', v, 'That\'s your Day 90 contract. Let\'s build your plan.')} cols={2} />
        <Actions onBack={() => goTo(8)} />
      </StepWrap>
    );

    return [step1ch, step2ch,
      <StepWrap key="3" q="Your current stats?" hint={hasSavedStats ? 'Saved from your profile — update anytime.' : 'Sets your Day 1 baseline — we\'ll reference this to track your transformation.'}>
        <NumericRow
          fields={[
            { label: 'Age', key: 'age', placeholder: '28', decimal: false },
            { label: 'Weight (kg)', key: 'weight', placeholder: '80', decimal: true },
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
          apiFetch('/api/auth/body-stats', {
            method: 'PATCH',
            body: JSON.stringify({ age: formData.age, weight: formData.weight, height: formData.height, sex: formData.sex }),
          }).then(() => refresh()).catch(() => {});
          goTo(4);
        }} nextLabel="Continue" />
      </StepWrap>,
      step4ch, step5ch, step6ch, step7ch, step8ch, step9ch,
    ];
  }

  // ── ALL OTHER PROGRAMS ────────────────────────────────────────

  // Step 1 — Goal
  const step1 = isSwim ? (
    <StepWrap key="1" q="What's your swim goal?" hint="This shapes every session in your plan.">
      <Opts options={[
        { icon: '🏁', label: 'Race prep', desc: 'Competition or event', value: 'prepare for a swim race or competition' },
        { icon: '💪', label: 'Get stronger', desc: 'Power and endurance', value: 'build swim strength and endurance' },
        { icon: '🌊', label: 'Learn technique', desc: 'Fix my stroke', value: 'improve stroke technique and efficiency' },
        { icon: '❤️', label: 'Fitness & health', desc: 'Stay active in the pool', value: 'improve general fitness through swimming' },
      ]} selected={sel('goals')} onSelect={v => selectOpt('goals', v, 'Perfect. Every session will target that.', 2)} />
      <Actions onNext={() => sel('goals') && goTo(2)} nextLabel="Continue" />
    </StepWrap>
  ) : isBeginner ? (
    <StepWrap key="1" q="Why are you starting now?" hint="Be honest — your plan will work around your real life.">
      <Opts options={[
        { icon: '⚡', label: 'Lose some weight', desc: 'Feel better in my body', value: 'lose weight and build confidence' },
        { icon: '💪', label: 'Get stronger', desc: 'Build a base of strength', value: 'build basic strength and fitness' },
        { icon: '❤️', label: 'Health & energy', desc: 'More energy, less stress', value: 'improve health, energy, and wellbeing' },
        { icon: '🏃', label: 'Just get moving', desc: 'Break a sedentary habit', value: 'establish a consistent exercise habit' },
      ]} selected={sel('goals')} onSelect={v => selectOpt('goals', v, 'Great reason. Your program will build around that.', 2)} />
      <Actions onNext={() => sel('goals') && goTo(2)} nextLabel="Continue" />
    </StepWrap>
  ) : (
    <StepWrap key="1" q="What's your main goal?" hint="This shapes everything about your program.">
      <Opts options={[
        { icon: '🔥', label: 'Lose weight', desc: 'Burn fat, feel lighter', value: 'lose weight and reduce body fat' },
        { icon: '💪', label: 'Build muscle', desc: 'Gain size and strength', value: 'build muscle and increase strength' },
        { icon: '⚡', label: 'Get fitter', desc: 'Energy, endurance, health', value: 'improve overall fitness and conditioning' },
        { icon: '❤️', label: 'Feel better', desc: 'Health and longevity', value: 'improve health, mobility, and wellbeing' },
      ]} selected={sel('goals')} onSelect={v => selectOpt('goals', v, 'Smart choice. Your program will be built around this.', 2)} />
      <Actions onNext={() => sel('goals') && goTo(2)} nextLabel="Continue" />
    </StepWrap>
  );

  // Step 2 — Level
  const step2 = isSwim ? (
    <StepWrap key="2" q="Your swim level?" hint="Be honest — this calibrates every session.">
      <Opts options={[
        { icon: '🌱', label: 'Beginner', desc: 'Can swim 1–2 lengths', value: 'beginner' },
        { icon: '💫', label: 'Intermediate', desc: 'Comfortable in the pool', value: 'intermediate' },
        { icon: '🏆', label: 'Advanced', desc: 'Regular competitive swimmer', value: 'advanced' },
      ]} selected={sel('level')} onSelect={v => selectOpt('level', v, 'Got it. Sessions will match your level.', 3)} cols={3} />
      <Actions onBack={() => goTo(1)} onNext={() => sel('level') && goTo(3)} nextLabel="Continue" />
    </StepWrap>
  ) : (
    <StepWrap key="2" q="Your experience level?" hint="How long have you been training consistently?">
      <Opts options={[
        { icon: '🌱', label: 'Beginner', desc: 'Under 1 year', value: 'beginner' },
        { icon: '💫', label: 'Intermediate', desc: '1–4 years', value: 'intermediate' },
        { icon: '🏆', label: 'Advanced', desc: '5+ years', value: 'advanced' },
      ]} selected={sel('level')} onSelect={v => selectOpt('level', v, 'Got it. Your plan will match your level.', 3)} cols={3} />
      <Actions onBack={() => goTo(1)} onNext={() => sel('level') && goTo(3)} nextLabel="Continue" />
    </StepWrap>
  );

  // Step 4 — Schedule
  const step4 = isSwim ? (
    <StepWrap key="4" q="Pool sessions per week?" hint="Include only sessions you can realistically commit to.">
      <Opts options={[
        { icon: '2', label: '2 sessions', desc: 'Steady progress', value: '2' },
        { icon: '3', label: '3 sessions', desc: 'Solid base', value: '3' },
        { icon: '4', label: '4 sessions', desc: 'Committed swimmer', value: '4' },
        { icon: '5', label: '5 sessions', desc: 'Serious training', value: '5' },
      ]} selected={sel('schedule')} onSelect={v => selectOpt('schedule', v, 'Perfect. Each session will be fully planned.', 5)} cols={2} monoKey />
      <Actions onBack={() => goTo(3)} onNext={() => sel('schedule') && goTo(5)} nextLabel="Continue" />
    </StepWrap>
  ) : (
    <StepWrap key="4" q="How many days a week?" hint="Be realistic — consistency beats ambition.">
      <Opts options={[
        { icon: '2', label: '2 days', desc: 'Light week', value: '2' },
        { icon: '3', label: '3 days', desc: 'Balanced', value: '3' },
        { icon: '4', label: '4 days', desc: 'Committed', value: '4' },
        { icon: '5', label: '5 days', desc: 'Serious', value: '5' },
        { icon: '6', label: '6 days', desc: 'Intense', value: '6' },
      ]} selected={sel('schedule')} onSelect={v => selectOpt('schedule', v, 'Perfect. Your plan will fit that schedule.', 5)} cols={3} monoKey />
      <Actions onBack={() => goTo(3)} onNext={() => sel('schedule') && goTo(5)} nextLabel="Continue" />
    </StepWrap>
  );

  // Step 5 — Location
  const step5 = isSwim ? (
    <StepWrap key="5" q="Pool access?" hint="This affects session length and structure.">
      <Opts options={[
        { icon: '🏊', label: 'Public pool', desc: 'Shared lanes, time limits', value: 'public pool (shared lanes, 25m or 50m)' },
        { icon: '🏅', label: 'Club / private', desc: 'Dedicated lane time', value: 'private or club pool (dedicated lane access)' },
        { icon: '🔀', label: 'Both', desc: 'Varies by day', value: 'mix of public and private pool' },
      ]} selected={sel('location')} onSelect={v => selectOpt('location', v, 'Noted. Sessions will be structured for that pool.', 6)} cols={3} />
      <Actions onBack={() => goTo(4)} onNext={() => sel('location') && goTo(6)} nextLabel="Continue" />
    </StepWrap>
  ) : isHome ? (
    <StepWrap key="5" q="What equipment do you have?" hint="Be honest — your plan uses only what you list.">
      <Opts options={[
        { icon: '🤲', label: 'Nothing', desc: 'Pure bodyweight only', value: 'bodyweight only, no equipment' },
        { icon: '🎗️', label: 'Resistance bands', desc: 'Bands and bodyweight', value: 'bodyweight and resistance bands' },
        { icon: '🔩', label: 'Pull-up bar', desc: 'Bar and bodyweight', value: 'bodyweight and pull-up bar' },
        { icon: '💪', label: 'Bands + bar', desc: 'Full home setup', value: 'bodyweight, resistance bands, and pull-up bar' },
      ]} selected={sel('location')} onSelect={v => selectOpt('location', v, 'Got it. Every exercise will work with that.', 6)} />
      <Actions onBack={() => goTo(4)} onNext={() => sel('location') && goTo(6)} nextLabel="Continue" />
    </StepWrap>
  ) : (
    <StepWrap key="5" q="Where will you train?" hint="This determines the exercises in your plan.">
      <Opts options={[
        { icon: '🏋️', label: 'Gym', desc: 'Full equipment', value: 'full commercial gym' },
        { icon: '🏠', label: 'Home', desc: 'Bodyweight / minimal', value: 'home with bodyweight and minimal equipment' },
        { icon: '🔀', label: 'Both', desc: 'Mix it up', value: 'mix of gym and home' },
      ]} selected={sel('location')} onSelect={v => selectOpt('location', v, 'Good. Exercises will be tailored to that setting.', 6)} cols={3} />
      <Actions onBack={() => goTo(4)} onNext={() => sel('location') && goTo(6)} nextLabel="Continue" />
    </StepWrap>
  );

  // Step 6 — Nutrition
  const step6 = isSwim ? (
    <StepWrap key="6" q="Nutrition for swimmers?" hint="Fuelling right makes a real difference in the pool.">
      <Opts options={[
        { icon: '🍽️', label: 'Full plan', desc: 'Pre/post swim meals, macros', value: 'full swimmer nutrition plan with pre/post session meals and hydration' },
        { icon: '📋', label: 'Key principles', desc: 'Simple fuelling rules', value: 'basic swimmer nutrition principles and hydration tips' },
        { icon: '🏊', label: 'Training only', desc: 'Skip nutrition', value: 'training only, skip nutrition' },
      ]} selected={sel('nutrition')} onSelect={v => selectOpt('nutrition', v, 'Noted. Your plan will cover that.', 7)} />
      <Actions onBack={() => goTo(5)} onNext={() => sel('nutrition') && goTo(7)} nextLabel="Continue" />
    </StepWrap>
  ) : (
    <StepWrap key="6" q="Nutrition focus?" hint="How much do you want nutrition guidance?">
      <Opts options={[
        { icon: '📊', label: 'Full guidance', desc: 'Macros, meals, timing', value: 'full nutrition guidance with macros and meal ideas' },
        { icon: '📋', label: 'Basic principles', desc: 'Simple rules only', value: 'basic nutrition principles' },
        { icon: '🏋️', label: 'Training only', desc: 'Skip nutrition', value: 'training only, skip nutrition advice' },
      ]} selected={sel('nutrition')} onSelect={v => selectOpt('nutrition', v, 'Noted. Your plan will include that level of nutrition detail.', 7)} />
      <Actions onBack={() => goTo(5)} onNext={() => sel('nutrition') && goTo(7)} nextLabel="Continue" />
    </StepWrap>
  );

  // Step 7 — Biggest challenge
  const step7 = isSwim ? (
    <StepWrap key="7" q="Biggest swim challenge?" hint="Your plan will address this directly.">
      <Opts options={[
        { icon: '💨', label: 'Running out of breath', desc: 'Fitness and pacing', value: 'running out of breath and pacing' },
        { icon: '🌊', label: 'Stroke technique', desc: 'Form breaks down when tired', value: 'maintaining good stroke technique when fatigued' },
        { icon: '⏰', label: 'Consistency', desc: 'Hard to get to the pool', value: 'staying consistent and getting to the pool regularly' },
        { icon: '🏁', label: 'Race nerves', desc: 'Anxiety before competing', value: 'managing nerves and race-day performance' },
      ]} selected={sel('motivation')} onSelect={v => selectOpt('motivation', v, 'Your plan will tackle that head-on.', 8)} />
      <Actions onBack={() => goTo(6)} onNext={() => sel('motivation') && goTo(8)} nextLabel="Continue" />
    </StepWrap>
  ) : isBeginner ? (
    <StepWrap key="7" q="What's stopped you before?" hint="Your plan will be designed around this.">
      <Opts options={[
        { icon: '⏰', label: 'No time', desc: 'Life is too busy', value: 'finding time to train consistently' },
        { icon: '😕', label: 'Not knowing what to do', desc: 'Feel lost in the gym', value: 'not knowing what exercises to do or how to do them' },
        { icon: '😴', label: 'Losing motivation', desc: 'Start strong, fade fast', value: 'staying motivated after the first few weeks' },
        { icon: '😟', label: 'Feeling self-conscious', desc: 'Intimidated by gyms', value: 'feeling self-conscious or intimidated in a gym environment' },
      ]} selected={sel('motivation')} onSelect={v => selectOpt('motivation', v, 'Your plan will specifically address that.', 8)} />
      <Actions onBack={() => goTo(6)} onNext={() => sel('motivation') && goTo(8)} nextLabel="Continue" />
    </StepWrap>
  ) : (
    <StepWrap key="7" q="Your biggest challenge?" hint="Your plan will address this directly.">
      <Opts options={[
        { icon: '⏰', label: 'Staying consistent', desc: 'Life gets in the way', value: 'staying consistent' },
        { icon: '😤', label: 'Staying motivated', desc: 'Hard to keep going', value: 'staying motivated' },
        { icon: '🍕', label: 'Diet and nutrition', desc: 'Hard to eat right', value: 'diet and nutrition' },
        { icon: '😴', label: 'Recovery', desc: 'Sleep and soreness', value: 'recovery and sleep' },
      ]} selected={sel('motivation')} onSelect={v => selectOpt('motivation', v, 'Your plan will include strategies to tackle exactly that.', 8)} />
      <Actions onBack={() => goTo(6)} onNext={() => sel('motivation') && goTo(8)} nextLabel="Continue" />
    </StepWrap>
  );

  // Step 8 — Injuries
  const step8 = (
    <StepWrap key="8" q={isSwim ? 'Any injuries or physical limitations?' : 'Any injuries or limitations?'} hint={isSwim ? 'Shoulder, knee, back issues? Type "None" if injury-free.' : 'Type "None" if you\'re injury-free.'}>
      <TextInput
        style={stepStyles.textarea}
        multiline
        numberOfLines={3}
        placeholder={isSwim ? 'e.g. Shoulder impingement, avoid butterfly. Or: None.' : 'e.g. Bad lower back, avoid heavy deadlifts. Or: None.'}
        placeholderTextColor="#555"
        value={formData.injuries || ''}
        onChangeText={v => setFormData(prev => ({ ...prev, injuries: v }))}
      />
      <Actions onBack={() => goTo(7)} />
    </StepWrap>
  );

  return [step1, step2,
    // Step 3 — Body stats (same for all)
    <StepWrap key="3" q="Your body stats?" hint={hasSavedStats ? 'Saved from your profile — update anytime.' : 'Used to personalize intensity and nutrition.'}>
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
        apiFetch('/api/auth/body-stats', {
          method: 'PATCH',
          body: JSON.stringify({ age: formData.age, weight: formData.weight, height: formData.height, sex: formData.sex }),
        }).then(() => refresh()).catch(() => {});
        goTo(4);
      }} nextLabel="Continue" />
    </StepWrap>,
    step4, step5, step6, step7, step8,
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
      {options.map(o => {
        const isActive = selected === o.value;
        return (
          <TouchableOpacity
            key={o.value}
            style={[stepStyles.opt, isActive && stepStyles.optActive]}
            onPress={() => onSelect(o.value)}
            activeOpacity={0.75}
          >
            <Text style={[
              stepStyles.optKey,
              monoKey && stepStyles.optKeyMono,
              monoKey && (isActive ? stepStyles.optKeyMonoActive : stepStyles.optKeyMonoInactive),
            ]}>{o.icon}</Text>
            <Text style={[stepStyles.optLabel, isActive && stepStyles.optLabelActive]}>{o.label}</Text>
            <Text style={stepStyles.optDesc}>{o.desc}</Text>
          </TouchableOpacity>
        );
      })}
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
            placeholderTextColor="#555"
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
  wrap: { width: '100%' },
  q: { fontFamily: font.sansBd, fontSize: 28, color: '#F5F5F2', lineHeight: 34, marginBottom: spacing[2], textAlign: 'center' },
  hint: { fontFamily: font.sans, fontSize: 14, color: '#555', marginBottom: spacing[6], textAlign: 'center' },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[5] },
  opts3: {},
  opt: {
    flex: 1, minWidth: '45%', padding: spacing[3], borderRadius: radius.md,
    borderWidth: 1, borderColor: '#252520', backgroundColor: '#181816',
    alignItems: 'flex-start',
  },
  optActive: { borderColor: '#3D9E6A', backgroundColor: '#0F2318' },
  optKey: { fontSize: 22, marginBottom: spacing[1] },
  optKeyMono: { fontSize: 20, marginBottom: spacing[1] },
  optKeyMonoActive: { fontFamily: font.mono, color: '#3D9E6A' },
  optKeyMonoInactive: { fontFamily: font.mono, color: '#555' },
  optLabel: { fontFamily: font.sansBd, fontSize: 14, color: '#888', marginBottom: 2 },
  optLabelActive: { color: '#F5F5F2' },
  optDesc: { fontFamily: font.mono, fontSize: 11, color: '#444' },
  sexRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3], marginBottom: spacing[5] },
  sexBtn: { flex: 1, paddingVertical: spacing[3], borderRadius: radius.sm, borderWidth: 1, borderColor: '#252520', backgroundColor: '#181816', alignItems: 'center' },
  sexBtnActive: { backgroundColor: '#3D9E6A', borderColor: '#3D9E6A' },
  sexText: { fontFamily: font.mono, fontSize: 12, color: '#555', textTransform: 'uppercase', letterSpacing: 0.4 },
  sexTextActive: { color: '#F5F5F2' },
  numRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[4] },
  numField: { flex: 1 },
  numLabel: { fontFamily: font.mono, fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[2] },
  numInput: {
    backgroundColor: '#181816', borderWidth: 1, borderColor: '#252520',
    borderRadius: radius.sm, height: 48,
    fontFamily: font.sans, fontSize: 15, color: '#F5F5F2',
    textAlign: 'center',
  },
  textarea: {
    backgroundColor: '#181816', borderWidth: 1, borderColor: '#252520',
    borderRadius: radius.sm, padding: spacing[3],
    fontFamily: font.sans, fontSize: 14, color: '#F5F5F2',
    minHeight: 100, textAlignVertical: 'top', marginBottom: spacing[4],
  },
  error: { fontFamily: font.sans, fontSize: 13, color: '#C06848', marginBottom: spacing[3] },
  actions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[3],
    paddingTop: spacing[5], borderTopWidth: 1, borderTopColor: '#1C1C18', marginTop: spacing[4],
  },
  backAction: { paddingVertical: 12, paddingHorizontal: spacing[3] },
  backActionText: { fontFamily: font.sans, fontSize: 14, color: '#555' },
  nextBtn: {
    paddingVertical: 12, paddingHorizontal: spacing[5],
    borderRadius: radius.sm, borderWidth: 1, borderColor: '#252520', backgroundColor: '#181816',
  },
  nextBtnForest: { backgroundColor: '#3D9E6A', borderColor: '#3D9E6A' },
  nextBtnText: { fontFamily: font.sansBd, fontSize: 14, color: '#3D9E6A' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0B' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: '#1C1C18',
    backgroundColor: '#0D0D0B',
  },
  backBtn: { flex: 1 },
  backText: { fontFamily: font.mono, fontSize: 12, color: '#3D9E6A', textTransform: 'uppercase', letterSpacing: 0.4 },
  progLabel: { fontFamily: font.sansBd, fontSize: 14, color: '#F5F5F2' },
  closeBtn: { flex: 1, alignItems: 'flex-end' },
  closeText: { fontSize: 18, color: '#444' },
  stripe: { height: 3, backgroundColor: '#1C1C18' },
  stripeFill: { height: '100%', backgroundColor: '#3D9E6A' },
  stepContent: { flexGrow: 1, justifyContent: 'center', padding: spacing[5], paddingVertical: spacing[8] },
  pinnedBar: {
    borderTopWidth: 1, borderTopColor: '#1C1C18',
    backgroundColor: '#0D0D0B', padding: spacing[4], gap: spacing[2],
  },
  pinnedUsage:     { backgroundColor: '#181816', borderRadius: radius.sm, paddingVertical: spacing[2], paddingHorizontal: spacing[3] },
  pinnedUsageText: { fontFamily: font.mono, fontSize: 11, color: '#555', textAlign: 'center', letterSpacing: 0.3 },
  pinnedUsageWarn: { color: '#C06848' },
  pinnedError: { fontFamily: font.sans, fontSize: 13, color: '#C06848', textAlign: 'center' },
  pinnedBtn: { backgroundColor: '#3D9E6A', height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  pinnedBtnText: { fontFamily: font.sansBd, fontSize: 15, color: '#F5F5F2' },
  counter: { fontFamily: font.mono, fontSize: 11, color: '#444', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing[4], textAlign: 'center' },
  reaction: { fontFamily: font.sans, fontSize: 13, color: '#3D9E6A', fontStyle: 'italic', marginTop: spacing[3], lineHeight: 18 },
  genScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8], backgroundColor: '#0D0D0B' },
  genIcon: { fontSize: 48, marginBottom: spacing[4] },
  genTitle: { fontFamily: font.sansBd, fontSize: 26, color: '#F5F5F2', marginBottom: spacing[2] },
  genSub: { fontFamily: font.mono, fontSize: 13, color: '#555', textTransform: 'uppercase', letterSpacing: 0.4 },
  genSubtle: { fontFamily: font.mono, fontSize: 12, color: '#333', marginTop: spacing[3], letterSpacing: 0.3 },
  // Result screen
  resultHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: '#1C1C18',
    backgroundColor: '#0D0D0B',
  },
  resultHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  resultHeaderIcon: { fontSize: 28 },
  resultHeaderEyebrow: { fontFamily: font.mono, fontSize: 10, color: '#444', letterSpacing: 1, textTransform: 'uppercase' },
  resultHeaderTitle: { fontFamily: font.sansBd, fontSize: 16, color: '#F5F5F2' },
  resultCloseBtn: { padding: spacing[2] },
  resultCloseBtnText: { fontSize: 18, color: '#444' },
  resultScroll: { padding: spacing[5], paddingBottom: spacing[12] },
  resultBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[5] },
  resultBadgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3D9E6A' },
  resultBadgeText: { fontFamily: font.mono, fontSize: 11, color: '#3D9E6A', textTransform: 'uppercase', letterSpacing: 0.6 },
  resultMarkdown: { marginBottom: spacing[8] },
  resultActions: { gap: spacing[3] },
  resultDoneBtn: { backgroundColor: '#3D9E6A', height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  resultDoneBtnText: { fontFamily: font.sansBd, fontSize: 15, color: '#F5F5F2' },
  resultNewBtn: { height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#252520' },
  resultNewBtnText: { fontFamily: font.sans, fontSize: 14, color: '#555' },
});

const markdownStyles = {
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
