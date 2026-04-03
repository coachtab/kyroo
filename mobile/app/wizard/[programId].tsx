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
  if (['weightloss', 'muscle', 'challenge90', 'beginner', 'home', 'swim', 'hyrox', 'marathon', 'crossfit', 'hiit'].includes(progId)) return 9;
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
        beginner_vision:   formData.timeframe,
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
    hyrox: {
      title: 'Building your Hyrox race plan',
      sub:   'Mapping your station training…',
      subtle:'Calculating your run-station splits…',
    },
    marathon: {
      title: 'Writing your marathon plan',
      sub:   'Calculating your training paces…',
      subtle:'Scheduling your long run progression…',
    },
    crossfit: {
      title: 'Building your CrossFit program',
      sub:   'Programming your WODs…',
      subtle:'Selecting your skill work and scaling…',
    },
    hiit: {
      title: 'Designing your HIIT program',
      sub:   'Calculating your work-to-rest ratios…',
      subtle:'Structuring your interval formats…',
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
  const isHyrox      = progId === 'hyrox';
  const isMarathon   = progId === 'marathon';
  const isCrossfit   = progId === 'crossfit';
  const isHIIT       = progId === 'hiit';

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

  // ── BEGINNER PROGRAM — fully dedicated steps ──────────────────
  if (isBeginner) {
    const step1bg = (
      <StepWrap key="1" q="Why are you starting now?" hint="Understanding your reason is the first step. Your program will speak to it.">
        <Opts options={[
          { icon: '🔑', label: 'Finally decided',   desc: 'Made the decision, ready to go',        value: 'finally decided to make fitness a priority and commit to starting' },
          { icon: '❤️', label: 'Health wake-up',    desc: 'Doctor advised it or feeling unwell',   value: 'health reasons — doctor advice or feeling the impact of inactivity' },
          { icon: '⚡', label: 'More energy',        desc: 'Tired, sluggish, want to feel alive',   value: 'want more daily energy, less tiredness, and to feel physically better' },
          { icon: '👥', label: 'Inspired by others',desc: 'Friends, family, or someone motivated me',value: 'inspired by someone around me — want what they have' },
        ]} selected={sel('goals')} onSelect={v => selectOpt('goals', v, 'That\'s exactly the right reason to start.', 2)} />
        <Actions onNext={() => sel('goals') && goTo(2)} nextLabel="Continue" />
      </StepWrap>
    );

    const step2bg = (
      <StepWrap key="2" q="What's held you back until now?" hint="No judgement — this shapes how your plan is introduced and paced.">
        <Opts options={[
          { icon: '❓', label: 'Didn\'t know how',  desc: 'No idea where to begin',                value: 'never knew where to start — no guidance on what to do or how' },
          { icon: '😰', label: 'Gym feels scary',   desc: 'Intimidated by the gym environment',    value: 'the gym feels intimidating — worried about looking lost or judged' },
          { icon: '🕐', label: 'No time',           desc: 'Life always got in the way',            value: 'always too busy — never found time to make fitness fit into my life' },
          { icon: '🔁', label: 'Tried and quit',    desc: 'Started before but stopped',            value: 'started before but lost momentum — need a plan that actually sticks' },
        ]} selected={sel('level')} onSelect={v => selectOpt('level', v, 'Understood. Your program will be paced to remove exactly that barrier.', 3)} />
        <Actions onBack={() => goTo(1)} onNext={() => sel('level') && goTo(3)} nextLabel="Continue" />
      </StepWrap>
    );

    const step4bg = (
      <StepWrap key="4" q="How many days per week can you train?" hint="Start manageable — consistency beats intensity for beginners.">
        <Opts options={[
          { icon: '2', label: '2 days', desc: 'Easing in — gentle start',         value: '2' },
          { icon: '3', label: '3 days', desc: 'Ideal — proven for beginners',     value: '3' },
          { icon: '4', label: '4 days', desc: 'Motivated — ready for more',       value: '4' },
        ]} selected={sel('schedule')} onSelect={v => selectOpt('schedule', v, 'Perfect. Your sessions will be spaced for proper recovery.', 5)} cols={3} monoKey />
        <Actions onBack={() => goTo(3)} onNext={() => sel('schedule') && goTo(5)} nextLabel="Continue" />
      </StepWrap>
    );

    const step5bg = (
      <StepWrap key="5" q="Where will you train?" hint="Every exercise will be chosen for exactly your setup — no guessing.">
        <Opts options={[
          { icon: '🏋️', label: 'Gym',             desc: 'First time or rarely been',             value: 'commercial gym — new to the environment and equipment' },
          { icon: '🏠', label: 'Home (no kit)',    desc: 'Bodyweight only, no equipment',         value: 'home with no equipment — bodyweight only' },
          { icon: '🎽', label: 'Home + basics',    desc: 'Dumbbells, bands, or a mat',            value: 'home with basic equipment — dumbbells, resistance bands, or a mat' },
          { icon: '🔀', label: 'Mix',              desc: 'Some gym, some home',                   value: 'mix of gym and home training' },
        ]} selected={sel('location')} onSelect={v => selectOpt('location', v, 'Every exercise will suit that setup perfectly.', 6)} />
        <Actions onBack={() => goTo(4)} onNext={() => sel('location') && goTo(6)} nextLabel="Continue" />
      </StepWrap>
    );

    const step6bg = (
      <StepWrap key="6" q="What's your main goal beyond just getting started?" hint="Your sessions will lean in this direction while keeping everything beginner-safe.">
        <Opts options={[
          { icon: '🏃', label: 'Get fit & healthy', desc: 'Feel better, move better',             value: 'improve general fitness, health, and daily energy levels' },
          { icon: '⚖️', label: 'Lose some weight',  desc: 'Lighter, leaner over time',            value: 'gradually lose weight and improve body composition' },
          { icon: '💪', label: 'Build muscle',       desc: 'Get stronger, look more toned',        value: 'build lean muscle and get stronger progressively' },
          { icon: '🧘', label: 'Feel better daily',  desc: 'Energy, posture, stress relief',       value: 'improve daily energy, posture, and overall quality of life' },
        ]} selected={sel('nutrition')} onSelect={v => selectOpt('nutrition', v, 'Got it. Your sessions will reflect that direction.', 7)} />
        <Actions onBack={() => goTo(5)} onNext={() => sel('nutrition') && goTo(7)} nextLabel="Continue" />
      </StepWrap>
    );

    const step7bg = (
      <StepWrap key="7" q="What worries you most about starting?" hint="Your plan will directly address this — no one should feel lost in week one.">
        <Opts options={[
          { icon: '👀', label: 'Looking foolish',    desc: 'Making mistakes, being judged',         value: 'looking like I don\'t know what I\'m doing in the gym' },
          { icon: '🦴', label: 'Getting injured',    desc: 'Doing something wrong and hurting myself',value: 'getting injured from incorrect form or going too hard too fast' },
          { icon: '📋', label: 'Not knowing what to do', desc: 'Guessing, no structure',           value: 'not knowing what to do — winging it and wasting time' },
          { icon: '😔', label: 'Giving up again',    desc: 'Losing motivation after week 1',       value: 'quitting again — losing motivation before the habit forms' },
        ]} selected={sel('motivation')} onSelect={v => selectOpt('motivation', v, 'Your plan will handle that from day one.', 8)} />
        <Actions onBack={() => goTo(6)} onNext={() => sel('motivation') && goTo(8)} nextLabel="Continue" />
      </StepWrap>
    );

    const step8bg = (
      <StepWrap key="8" q="Any injuries or health conditions to know about?" hint="Your coach needs to know before writing your first session.">
        <TextInput
          style={stepStyles.textarea}
          multiline
          numberOfLines={3}
          placeholder="e.g. Bad knees — stairs are painful. Or: None."
          placeholderTextColor="#555"
          value={formData.injuries || ''}
          onChangeText={v => setFormData(prev => ({ ...prev, injuries: v }))}
        />
        <Actions onBack={() => goTo(7)} onNext={() => goTo(9)} nextLabel="Continue" />
      </StepWrap>
    );

    const step9bg = (
      <StepWrap key="9" q="How long do you want your program to be?" hint="Your phases, session volume, and progression will be scaled to fit.">
        <Opts options={[
          { icon: '⚡', label: '4 weeks',  desc: 'Taste it — learn the basics fast',    value: '4 weeks'  },
          { icon: '🌱', label: '6 weeks',  desc: 'Steady — build real confidence',      value: '6 weeks'  },
          { icon: '💪', label: '8 weeks',  desc: 'The full program — most popular',     value: '8 weeks'  },
          { icon: '🏆', label: '12 weeks', desc: 'Take your time — deep foundations',   value: '12 weeks' },
        ]} selected={sel('timeframe')} onSelect={v => selectOpt('timeframe', v, 'Perfect. Your program will be paced exactly for that.')} cols={2} />
        <Actions onBack={() => goTo(8)} />
      </StepWrap>
    );

    return [step1bg, step2bg,
      <StepWrap key="3" q="Your current stats?" hint={hasSavedStats ? 'Saved from your profile — update anytime.' : 'Helps us choose the right starting exercises and intensity for your body.'}>
        <NumericRow
          fields={[
            { label: 'Age', key: 'age', placeholder: '30', decimal: false },
            { label: 'Weight (kg)', key: 'weight', placeholder: '75', decimal: true },
            { label: 'Height (cm)', key: 'height', placeholder: '170', decimal: false },
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
      step4bg, step5bg, step6bg, step7bg, step8bg, step9bg,
    ];
  }

  // ── HOME WORKOUT PLAN — fully dedicated steps ─────────────────
  if (isHome) {
    const step1hw = (
      <StepWrap key="1" q="Why are you training at home?" hint="This shapes your program's tone, structure, and daily session length.">
        <Opts options={[
          { icon: '🏠', label: 'Pure convenience',  desc: 'No commute, train any time',           value: 'training at home for maximum convenience — no commute, total flexibility' },
          { icon: '💰', label: 'No gym fees',       desc: 'Zero membership, same results',        value: 'avoiding gym costs — want real results with no equipment spend' },
          { icon: '⏰', label: 'Time is tight',     desc: 'Busy schedule, need efficiency',       value: 'very busy schedule — need short, efficient sessions that fit around life' },
          { icon: '😌', label: 'Prefer privacy',    desc: 'Train alone, no judgement',            value: 'prefer training alone at home — no gym environment or social pressure' },
        ]} selected={sel('goals')} onSelect={v => selectOpt('goals', v, 'Got it. Your plan will be built for exactly that.', 2)} />
        <Actions onNext={() => sel('goals') && goTo(2)} nextLabel="Continue" />
      </StepWrap>
    );

    const step2hw = (
      <StepWrap key="2" q="What equipment do you have?" hint="Your exercises will use only what you actually have — nothing else.">
        <Opts options={[
          { icon: '🤸', label: 'Nothing',           desc: 'Pure bodyweight only',                 value: 'bodyweight only — no equipment at all' },
          { icon: '🎗️', label: 'Resistance bands',  desc: 'Bands and bodyweight',                 value: 'resistance bands and bodyweight' },
          { icon: '🏋️', label: 'Dumbbells',         desc: 'Fixed or adjustable dumbbells',        value: 'dumbbells (fixed or adjustable) and bodyweight' },
          { icon: '💪', label: 'Well equipped',     desc: 'Dumbbells + bands + pull-up bar',      value: 'dumbbells, resistance bands, and a pull-up bar' },
        ]} selected={sel('location')} onSelect={v => selectOpt('location', v, 'Perfect. Every exercise will suit your setup exactly.', 3)} />
        <Actions onBack={() => goTo(1)} onNext={() => sel('location') && goTo(3)} nextLabel="Continue" />
      </StepWrap>
    );

    const step4hw = (
      <StepWrap key="4" q="How many days per week can you train?" hint="Home sessions are shorter — you can afford more frequency.">
        <Opts options={[
          { icon: '3', label: '3 days', desc: 'Solid foundation',           value: '3' },
          { icon: '4', label: '4 days', desc: 'Great for faster progress',  value: '4' },
          { icon: '5', label: '5 days', desc: 'Maximum home results',       value: '5' },
        ]} selected={sel('schedule')} onSelect={v => selectOpt('schedule', v, 'Your weekly plan will be built around that.', 5)} cols={3} monoKey />
        <Actions onBack={() => goTo(3)} onNext={() => sel('schedule') && goTo(5)} nextLabel="Continue" />
      </StepWrap>
    );

    const step5hw = (
      <StepWrap key="5" q="What's your main goal?" hint="Your sessions will be designed around this — every exercise earns its place.">
        <Opts options={[
          { icon: '🔥', label: 'Burn fat',          desc: 'Lose weight, leaner body',             value: 'burn fat and lose weight through home cardio and circuit training' },
          { icon: '💪', label: 'Build muscle',      desc: 'Stronger, more defined at home',       value: 'build muscle and strength using bodyweight progressions' },
          { icon: '🏃', label: 'Get fit',           desc: 'Cardio + strength combined',           value: 'improve overall fitness — cardio endurance and functional strength' },
          { icon: '🧘', label: 'Move better',       desc: 'Posture, energy, daily mobility',      value: 'improve daily movement, posture, flexibility, and energy levels' },
        ]} selected={sel('nutrition')} onSelect={v => selectOpt('nutrition', v, 'Your sessions will drive exactly that.', 6)} />
        <Actions onBack={() => goTo(4)} onNext={() => sel('nutrition') && goTo(6)} nextLabel="Continue" />
      </StepWrap>
    );

    const step6hw = (
      <StepWrap key="6" q="How experienced are you with bodyweight training?" hint="Sets your starting exercises, rep ranges, and progression speed.">
        <Opts options={[
          { icon: '🌱', label: 'Never done it',     desc: 'Starting from zero',                   value: 'complete beginner — never followed a bodyweight training program' },
          { icon: '📖', label: 'Know the basics',   desc: 'Push-ups, squats, lunges',             value: 'familiar with basics — can do push-ups, squats, and lunges with decent form' },
          { icon: '💪', label: 'Comfortable',       desc: 'Multiple sets, controlled form',       value: 'comfortable — can complete multiple sets with good control and form' },
          { icon: '🏆', label: 'Experienced',       desc: 'Want harder progressions',             value: 'experienced — looking for challenging progressions like pistol squats and pike push-ups' },
        ]} selected={sel('level')} onSelect={v => selectOpt('level', v, 'Understood. Your program will match exactly that level.', 7)} />
        <Actions onBack={() => goTo(5)} onNext={() => sel('level') && goTo(7)} nextLabel="Continue" />
      </StepWrap>
    );

    const step7hw = (
      <StepWrap key="7" q="What's your biggest challenge training at home?" hint="Your plan will have specific strategies to beat this.">
        <Opts options={[
          { icon: '😴', label: 'Motivation drops',  desc: 'Easy to skip without a gym routine',   value: 'lacking motivation at home — too easy to skip without a gym environment' },
          { icon: '📺', label: 'Distractions',      desc: 'TV, phone, family, the couch',         value: 'too many distractions at home — hard to focus and stay in training mode' },
          { icon: '📉', label: 'Can\'t progress',  desc: 'No way to get harder without weights',  value: 'not knowing how to progress — feels impossible to get harder without adding weight' },
          { icon: '📋', label: 'No structure',      desc: 'Wing it, waste time, quit early',      value: 'no clear plan — winging sessions leads to wasted time and quitting early' },
        ]} selected={sel('motivation')} onSelect={v => selectOpt('motivation', v, 'Your plan will tackle that directly.', 8)} />
        <Actions onBack={() => goTo(6)} onNext={() => sel('motivation') && goTo(8)} nextLabel="Continue" />
      </StepWrap>
    );

    const step8hw = (
      <StepWrap key="8" q="Any injuries or physical limitations?" hint="Your exercises will be chosen and modified around anything that needs protecting.">
        <TextInput
          style={stepStyles.textarea}
          multiline
          numberOfLines={3}
          placeholder="e.g. Shoulder injury — no overhead pressing. Or: None."
          placeholderTextColor="#555"
          value={formData.injuries || ''}
          onChangeText={v => setFormData(prev => ({ ...prev, injuries: v }))}
        />
        <Actions onBack={() => goTo(7)} onNext={() => goTo(9)} nextLabel="Continue" />
      </StepWrap>
    );

    const step9hw = (
      <StepWrap key="9" q="How long do you want the program to run?" hint="Your phases and exercise progressions will be scaled to fit.">
        <Opts options={[
          { icon: '⚡', label: '4 weeks',   desc: 'Quick intensive block',               value: '4 weeks'  },
          { icon: '🔥', label: '8 weeks',   desc: 'Solid transformation',                value: '8 weeks'  },
          { icon: '💪', label: '10 weeks',  desc: 'Three full phases of progression',    value: '10 weeks' },
          { icon: '🏆', label: '16 weeks',  desc: 'Deep bodyweight mastery',             value: '16 weeks' },
        ]} selected={sel('timeframe')} onSelect={v => selectOpt('timeframe', v, 'Perfect. Your program will be phased exactly for that.')} cols={2} />
        <Actions onBack={() => goTo(8)} />
      </StepWrap>
    );

    return [step1hw, step2hw,
      <StepWrap key="3" q="Your current stats?" hint={hasSavedStats ? 'Saved from your profile — update anytime.' : 'Used to calibrate your bodyweight progressions and session intensity.'}>
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
      step4hw, step5hw, step6hw, step7hw, step8hw, step9hw,
    ];
  }

  // ── SWIM TRAINING — fully dedicated steps ────────────────────
  if (isSwim) {
    const step1sw = (
      <StepWrap key="1" q="What's your swim goal?" hint="Your sessions, sets, and focus will all be built around this.">
        <Opts options={[
          { icon: '❤️', label: 'Fitness & health',  desc: 'Swim for fitness, not competition',   value: 'improve overall fitness, health, and endurance through swimming' },
          { icon: '🎯', label: 'Technique',          desc: 'Fix my stroke, swim efficiently',      value: 'improve stroke technique, efficiency, and body position in the water' },
          { icon: '🏁', label: 'Race prep',          desc: 'Training for a competition or event',  value: 'prepare for a swim race, triathlon, or open water event' },
          { icon: '🌊', label: 'Open water',         desc: 'Lake, sea, or triathlon training',     value: 'open water swimming — lake, sea, or triathlon-specific training' },
        ]} selected={sel('goals')} onSelect={v => selectOpt('goals', v, 'Every session will be built around that goal.', 2)} />
        <Actions onNext={() => sel('goals') && goTo(2)} nextLabel="Continue" />
      </StepWrap>
    );

    const step2sw = (
      <StepWrap key="2" q="What's your current swim level?" hint="Sets your starting volume, rest intervals, and drill complexity.">
        <Opts options={[
          { icon: '🌱', label: 'Beginner',          desc: 'Can swim, but no real technique',       value: 'beginner — can swim a length but has no structured technique or training' },
          { icon: '🏊', label: 'Recreational',      desc: 'Comfortable, casual lane swimmer',      value: 'recreational — comfortable in the pool, casual lane swimmer' },
          { icon: '💪', label: 'Intermediate',      desc: 'Train regularly, know basic drills',    value: 'intermediate — trains regularly, familiar with sets and basic drills' },
          { icon: '🏆', label: 'Competitive',       desc: 'Club level or racing background',       value: 'competitive — club level swimmer or has racing background' },
        ]} selected={sel('level')} onSelect={v => selectOpt('level', v, 'Got it. Your sessions will be calibrated for that level.', 3)} />
        <Actions onBack={() => goTo(1)} onNext={() => sel('level') && goTo(3)} nextLabel="Continue" />
      </StepWrap>
    );

    const step4sw = (
      <StepWrap key="4" q="How many sessions per week?" hint="Pool sessions — each one structured with warm-up, drills, main set, and cool-down.">
        <Opts options={[
          { icon: '2', label: '2 sessions', desc: 'Maintenance — stay in the water', value: '2' },
          { icon: '3', label: '3 sessions', desc: 'Progress — standard improvement',  value: '3' },
          { icon: '4', label: '4 sessions', desc: 'Development — faster gains',       value: '4' },
          { icon: '5', label: '5 sessions', desc: 'Performance — serious training',   value: '5' },
        ]} selected={sel('schedule')} onSelect={v => selectOpt('schedule', v, 'Your weekly session structure will be built around that.', 5)} cols={2} monoKey />
        <Actions onBack={() => goTo(3)} onNext={() => sel('schedule') && goTo(5)} nextLabel="Continue" />
      </StepWrap>
    );

    const step5sw = (
      <StepWrap key="5" q="Which stroke do you want to focus on?" hint="Your drills and technique sets will prioritise this stroke.">
        <Opts options={[
          { icon: '🔵', label: 'Freestyle',          desc: 'Front crawl — fastest, most used',     value: 'freestyle (front crawl) — the primary stroke for fitness and racing' },
          { icon: '🟢', label: 'Breaststroke',       desc: 'Most popular recreational stroke',      value: 'breaststroke — the most common recreational stroke, technique-focused' },
          { icon: '🟡', label: 'Backstroke',         desc: 'Back position, great for posture',      value: 'backstroke — back position swimming, rhythm and rotation focus' },
          { icon: '🌈', label: 'All strokes (IM)',   desc: 'Individual medley training',            value: 'all four strokes (IM) — individual medley with butterfly, backstroke, breaststroke, freestyle' },
        ]} selected={sel('nutrition')} onSelect={v => selectOpt('nutrition', v, 'Your drills and technique work will focus there.', 6)} />
        <Actions onBack={() => goTo(4)} onNext={() => sel('nutrition') && goTo(6)} nextLabel="Continue" />
      </StepWrap>
    );

    const step6sw = (
      <StepWrap key="6" q="Where do you swim?" hint="Your session distances, formats, and turn work depend on your pool.">
        <Opts options={[
          { icon: '🏊', label: '25m pool',           desc: 'Short course — standard club pool',    value: '25-metre short course pool' },
          { icon: '🏟️', label: '50m pool',           desc: 'Long course — Olympic standard',       value: '50-metre long course pool' },
          { icon: '🌊', label: 'Open water',         desc: 'Lake, sea, or river — no walls',       value: 'open water — lake, sea, or river (no lane or turn walls)' },
          { icon: '🔀', label: 'Mix',                desc: 'Pool + open water sessions',           value: 'mix of pool and open water training' },
        ]} selected={sel('location')} onSelect={v => selectOpt('location', v, 'Your sets and distances will be written for that environment.', 7)} />
        <Actions onBack={() => goTo(5)} onNext={() => sel('location') && goTo(7)} nextLabel="Continue" />
      </StepWrap>
    );

    const step7sw = (
      <StepWrap key="7" q="What do you struggle most with in the water?" hint="Your plan will include targeted drills and sets to fix exactly this.">
        <Opts options={[
          { icon: '💨', label: 'Breathing',          desc: 'Out of breath, can\'t find a rhythm',  value: 'breathing — getting out of breath quickly and struggling to find a breathing rhythm' },
          { icon: '🏃', label: 'Endurance',          desc: 'Can\'t hold my pace for long',         value: 'endurance — unable to sustain pace over longer distances' },
          { icon: '⚡', label: 'Speed',              desc: 'Fit but slow in the water',            value: 'speed — fit enough but not fast — poor propulsion or too much drag' },
          { icon: '🎯', label: 'Technique',          desc: 'Inefficient stroke, wasted energy',    value: 'stroke technique — inefficient movement that wastes energy and kills pace' },
        ]} selected={sel('motivation')} onSelect={v => selectOpt('motivation', v, 'Your plan will target that with specific drills.', 8)} />
        <Actions onBack={() => goTo(6)} onNext={() => sel('motivation') && goTo(8)} nextLabel="Continue" />
      </StepWrap>
    );

    const step8sw = (
      <StepWrap key="8" q="Any injuries or physical limitations?" hint="Common swimmer issues — shoulder, neck, or knee — we'll programme around them.">
        <TextInput
          style={stepStyles.textarea}
          multiline
          numberOfLines={3}
          placeholder="e.g. Shoulder impingement — no butterfly. Or: None."
          placeholderTextColor="#555"
          value={formData.injuries || ''}
          onChangeText={v => setFormData(prev => ({ ...prev, injuries: v }))}
        />
        <Actions onBack={() => goTo(7)} onNext={() => goTo(9)} nextLabel="Continue" />
      </StepWrap>
    );

    const step9sw = (
      <StepWrap key="9" q="How long is your training block?" hint="Your phase structure and total volume will be built around this.">
        <Opts options={[
          { icon: '⚡', label: '4 weeks',    desc: 'Short intensive block',               value: '4 weeks'  },
          { icon: '🔥', label: '8 weeks',    desc: 'Solid development cycle',             value: '8 weeks'  },
          { icon: '💪', label: '12 weeks',   desc: 'Full base-to-race build',             value: '12 weeks' },
          { icon: '🏆', label: '20 weeks',   desc: 'Season-long periodised plan',         value: '20 weeks' },
        ]} selected={sel('timeframe')} onSelect={v => selectOpt('timeframe', v, 'Your training block is set. Let\'s build your plan.')} cols={2} />
        <Actions onBack={() => goTo(8)} />
      </StepWrap>
    );

    return [step1sw, step2sw,
      <StepWrap key="3" q="Your current stats?" hint={hasSavedStats ? 'Saved from your profile — update anytime.' : 'Sets your training zones and aerobic capacity baseline.'}>
        <NumericRow
          fields={[
            { label: 'Age', key: 'age', placeholder: '28', decimal: false },
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
      step4sw, step5sw, step6sw, step7sw, step8sw, step9sw,
    ];
  }

  // ── HYROX — fully dedicated steps ────────────────────────────
  if (isHyrox) {
    const step1hx = (
      <StepWrap key="1" q="What's your Hyrox goal?" hint="Your training structure and race simulation work will be built around this.">
        <Opts options={[
          { icon: '🏁', label: 'Finish my first',   desc: 'Just cross that finish line',           value: 'complete my first Hyrox race and finish strong' },
          { icon: '⏱️', label: 'Beat my time',       desc: 'Improve on a previous result',          value: 'improve my Hyrox race time — I have a previous result to beat' },
          { icon: '🏆', label: 'Compete seriously',  desc: 'Podium, age group, or elite wave',      value: 'compete at a high level — targeting age group podium or elite wave' },
          { icon: '🔥', label: 'Hyrox fitness',      desc: 'No race planned — get race ready',      value: 'build Hyrox-level fitness without a specific race target' },
        ]} selected={sel('goals')} onSelect={v => selectOpt('goals', v, 'Your entire plan is built towards that.', 2)} />
        <Actions onNext={() => sel('goals') && goTo(2)} nextLabel="Continue" />
      </StepWrap>
    );

    const step2hx = (
      <StepWrap key="2" q="Have you done a Hyrox race before?" hint="Sets your starting volume, station technique focus, and run-station transitions.">
        <Opts options={[
          { icon: '🌱', label: 'Never done one',     desc: 'First race — excited and nervous',      value: 'complete beginner — never done a Hyrox race' },
          { icon: '✅', label: 'One race',           desc: 'Done it once, know what to expect',     value: 'one Hyrox race completed — know what to expect' },
          { icon: '💪', label: 'A few races',        desc: 'Some experience, improving each time',  value: 'completed several Hyrox races, improving with each one' },
          { icon: '🏆', label: 'Competitive racer',  desc: 'Regular, targeting serious times',      value: 'competitive Hyrox racer — regularly competing and chasing fast times' },
        ]} selected={sel('level')} onSelect={v => selectOpt('level', v, 'Got it. Your training load and focus will match that.', 3)} />
        <Actions onBack={() => goTo(1)} onNext={() => sel('level') && goTo(3)} nextLabel="Continue" />
      </StepWrap>
    );

    const step4hx = (
      <StepWrap key="4" q="How many days per week can you train?" hint="Hyrox needs a mix of running and functional work — more days = better event-specific preparation.">
        <Opts options={[
          { icon: '3', label: '3 days', desc: 'Minimum — cover the essentials',    value: '3' },
          { icon: '4', label: '4 days', desc: 'Recommended — balanced build',      value: '4' },
          { icon: '5', label: '5 days', desc: 'Serious — race-ready conditioning', value: '5' },
        ]} selected={sel('schedule')} onSelect={v => selectOpt('schedule', v, 'Your weekly structure will be built around that.', 5)} cols={3} monoKey />
        <Actions onBack={() => goTo(3)} onNext={() => sel('schedule') && goTo(5)} nextLabel="Continue" />
      </StepWrap>
    );

    const step5hx = (
      <StepWrap key="5" q="What does your training setup look like?" hint="Your station exercises will match exactly what you have access to.">
        <Opts options={[
          { icon: '🏟️', label: 'Full Hyrox gym',    desc: 'SkiErg, sleds, rowers, sandbags',      value: 'full Hyrox-equipped gym — SkiErg, sled push/pull, rowers, sandbags, wall balls' },
          { icon: '🏋️', label: 'Standard gym',      desc: 'No sleds — using substitutes',          value: 'standard commercial gym — no sleds or SkiErg, using exercise substitutes' },
          { icon: '🔀', label: 'Mix of both',       desc: 'Occasional Hyrox gym access',           value: 'mix — regular gym plus occasional Hyrox facility access' },
          { icon: '🏠', label: 'Home + outdoors',   desc: 'Minimal kit, running outside',          value: 'home and outdoor training with minimal equipment' },
        ]} selected={sel('location')} onSelect={v => selectOpt('location', v, 'Every station exercise will use only what you have.', 6)} />
        <Actions onBack={() => goTo(4)} onNext={() => sel('location') && goTo(6)} nextLabel="Continue" />
      </StepWrap>
    );

    const step6hx = (
      <StepWrap key="6" q="What's your weakest area in a Hyrox race?" hint="Your training will overweight this zone to fix it before race day.">
        <Opts options={[
          { icon: '🏃', label: 'The running',        desc: '8km of 1km splits destroy me',          value: 'the running — maintaining pace across 8 × 1km splits between stations' },
          { icon: '🏋️', label: 'The stations',       desc: 'Specific exercises blow me up',         value: 'the functional stations — specific exercises like wall balls or sled push drain me' },
          { icon: '💪', label: 'Strength endurance', desc: 'Legs and lungs fail together',          value: 'strength endurance — legs and lungs failing when running after heavy stations' },
          { icon: '🧠', label: 'Race pacing',        desc: 'Go too hard early, die later',          value: 'race pacing — going out too fast and falling apart in the second half' },
        ]} selected={sel('nutrition')} onSelect={v => selectOpt('nutrition', v, 'That zone will get specific attention in your program.', 7)} />
        <Actions onBack={() => goTo(5)} onNext={() => sel('nutrition') && goTo(7)} nextLabel="Continue" />
      </StepWrap>
    );

    const step7hx = (
      <StepWrap key="7" q="What worries you most about race day?" hint="Your plan will have specific preparation and strategies for this.">
        <Opts options={[
          { icon: '🔋', label: 'Running out of gas', desc: 'Fading badly in the back half',         value: 'running out of energy — fading badly in stations 5-8 and the final runs' },
          { icon: '🎯', label: 'Station technique',  desc: 'Wasting energy on poor form',           value: 'poor station technique — wasting energy on inefficient movement patterns' },
          { icon: '🤕', label: 'Injury on race day', desc: 'Something going wrong under pressure',  value: 'picking up an injury under race pressure — overexertion or poor movement' },
          { icon: '🕐', label: 'Missing my time',    desc: 'Not hitting my target result',          value: 'not hitting my target time — underperforming on race day despite good training' },
        ]} selected={sel('motivation')} onSelect={v => selectOpt('motivation', v, 'Your plan will tackle that head on.', 8)} />
        <Actions onBack={() => goTo(6)} onNext={() => sel('motivation') && goTo(8)} nextLabel="Continue" />
      </StepWrap>
    );

    const step8hx = (
      <StepWrap key="8" q="Any injuries or physical limitations?" hint="Common Hyrox injuries: lower back, knees, shoulders — we'll programme around them.">
        <TextInput
          style={stepStyles.textarea}
          multiline
          numberOfLines={3}
          placeholder="e.g. Lower back — avoid heavy sled load. Or: None."
          placeholderTextColor="#555"
          value={formData.injuries || ''}
          onChangeText={v => setFormData(prev => ({ ...prev, injuries: v }))}
        />
        <Actions onBack={() => goTo(7)} onNext={() => goTo(9)} nextLabel="Continue" />
      </StepWrap>
    );

    const step9hx = (
      <StepWrap key="9" q="How many weeks until your race?" hint="Your periodisation, taper, and race simulation timing are all built from this.">
        <Opts options={[
          { icon: '⚡', label: '4 weeks',    desc: 'Last-minute race prep',                value: '4 weeks'  },
          { icon: '🔥', label: '8 weeks',    desc: 'Standard race build',                  value: '8 weeks'  },
          { icon: '💪', label: '12 weeks',   desc: 'Full build with base + peak phases',   value: '12 weeks' },
          { icon: '🏆', label: '16 weeks',   desc: 'Complete Hyrox periodisation cycle',   value: '16 weeks' },
        ]} selected={sel('timeframe')} onSelect={v => selectOpt('timeframe', v, 'Race day is locked in. Let\'s build your plan.')} cols={2} />
        <Actions onBack={() => goTo(8)} />
      </StepWrap>
    );

    return [step1hx, step2hx,
      <StepWrap key="3" q="Your current stats?" hint={hasSavedStats ? 'Saved from your profile — update anytime.' : 'Used to calculate your running paces and station loading targets.'}>
        <NumericRow
          fields={[
            { label: 'Age', key: 'age', placeholder: '30', decimal: false },
            { label: 'Weight (kg)', key: 'weight', placeholder: '78', decimal: true },
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
      step4hx, step5hx, step6hx, step7hx, step8hx, step9hx,
    ];
  }

  // ── MARATHON — fully dedicated steps ─────────────────────────
  if (isMarathon) {
    // Detect chosen race distance to drive adaptive steps 6 + 9
    const isHalf = (sel('goals') || '').toLowerCase().includes('half');

    const step1mr = (
      <StepWrap key="1" q="Which race are you training for?" hint="Your long run distances, training paces, and race strategy all depend on this.">
        <Opts options={[
          { icon: '🥈', label: 'Half — first finish', desc: 'Complete 21.1km for the first time',  value: 'complete my first half marathon (21.1km)' },
          { icon: '🥈', label: 'Half — time goal',    desc: 'Hit a specific time over 21.1km',     value: 'run a half marathon in a target time (21.1km)' },
          { icon: '🥇', label: 'Full — first finish', desc: 'Complete 42.2km for the first time',  value: 'complete my first full marathon (42.2km)' },
          { icon: '🥇', label: 'Full — time goal',    desc: 'Hit a specific time over 42.2km',     value: 'run a full marathon in a target time (42.2km)' },
        ]} selected={sel('goals')} onSelect={v => selectOpt('goals', v, 'Your training distances and paces are locked to that race.', 2)} />
        <Actions onNext={() => sel('goals') && goTo(2)} nextLabel="Continue" />
      </StepWrap>
    );

    const step2mr = (
      <StepWrap key="2" q="What's your running background?" hint="Sets your starting mileage, long run distance, and volume build rate.">
        <Opts options={[
          { icon: '🌱', label: 'New to running',    desc: 'Run occasionally, no race history',      value: 'new to distance running — run occasionally but have no race history' },
          { icon: '🏃', label: '5k–10k racer',     desc: 'Short race experience, building up',     value: 'completed 5k and 10k races — now stepping up to longer distances' },
          { icon: '✅', label: 'Half/full done',    desc: 'Completed a longer race before',         value: 'have completed a half or full marathon — looking to improve' },
          { icon: '🏆', label: 'Regular racer',    desc: 'Consistent mileage, structured training', value: 'experienced distance runner with structured training background' },
        ]} selected={sel('level')} onSelect={v => selectOpt('level', v, 'Your program will match that base exactly.', 3)} />
        <Actions onBack={() => goTo(1)} onNext={() => sel('level') && goTo(3)} nextLabel="Continue" />
      </StepWrap>
    );

    const step4mr = (
      <StepWrap key="4" q="How many days per week can you run?" hint={isHalf ? 'Half marathon training works well on 3-5 days — one must be a long run day.' : 'Full marathon training works best with at least 4 days — one must be a long run day.'}>
        <Opts options={[
          { icon: '3', label: '3 days', desc: 'Minimum — one long, two quality',    value: '3' },
          { icon: '4', label: '4 days', desc: 'Standard — proven race base',        value: '4' },
          { icon: '5', label: '5 days', desc: 'Higher volume — faster improvement', value: '5' },
          { icon: '6', label: '6 days', desc: 'Competitive — full training load',   value: '6' },
        ]} selected={sel('schedule')} onSelect={v => selectOpt('schedule', v, 'Your weekly run structure will be built around that.', 5)} cols={2} monoKey />
        <Actions onBack={() => goTo(3)} onNext={() => sel('schedule') && goTo(5)} nextLabel="Continue" />
      </StepWrap>
    );

    const step5mr = (
      <StepWrap key="5" q="How much are you running per week right now?" hint="Your starting long run and total weekly volume are built from this.">
        <Opts options={[
          { icon: '🐢', label: 'Under 20km',  desc: 'Early base — building from scratch',   value: 'currently running under 20km per week' },
          { icon: '🏃', label: '20–40km',     desc: 'Solid base — ready to build on',       value: 'currently running 20-40km per week' },
          { icon: '💪', label: '40–60km',     desc: 'Strong base — ready for real volume',  value: 'currently running 40-60km per week' },
          { icon: '🔥', label: '60km+',       desc: 'High mileage — already race-fit',      value: 'currently running 60km or more per week' },
        ]} selected={sel('location')} onSelect={v => selectOpt('location', v, 'Your long run and total volume will build from that base.', 6)} />
        <Actions onBack={() => goTo(4)} onNext={() => sel('location') && goTo(6)} nextLabel="Continue" />
      </StepWrap>
    );

    const step6mr = (
      <StepWrap key="6" q="What's your target finish time?" hint="Every training pace — easy, tempo, intervals — will be calculated from this.">
        <Opts options={isHalf ? [
          { icon: '🏅', label: 'Just finish',  desc: 'Crossing the line is the win',       value: 'just finish — no time goal, completion is the priority' },
          { icon: '🕑', label: 'Sub-2:30',     desc: '~7:05 min/km pace',                  value: 'sub-2:30 half marathon (approx 7:05 per km)' },
          { icon: '🕐', label: 'Sub-2:00',     desc: '~5:41 min/km pace',                  value: 'sub-2:00 half marathon (approx 5:41 per km)' },
          { icon: '⚡', label: 'Sub-1:45',     desc: '~4:58 min/km pace',                  value: 'sub-1:45 half marathon (approx 4:58 per km)' },
        ] : [
          { icon: '🏅', label: 'Just finish',  desc: 'Crossing the line is the win',       value: 'just finish — no time goal, completion is the priority' },
          { icon: '5️⃣', label: 'Sub-5 hours',  desc: '~7:05 min/km pace',                  value: 'sub-5 hours full marathon (approx 7:05 per km)' },
          { icon: '4️⃣', label: 'Sub-4 hours',  desc: '~5:41 min/km pace',                  value: 'sub-4 hours full marathon (approx 5:41 per km)' },
          { icon: '3️⃣', label: 'Sub-3:30',     desc: '~4:58 min/km pace',                  value: 'sub-3:30 full marathon (approx 4:58 per km)' },
        ]} selected={sel('nutrition')} onSelect={v => selectOpt('nutrition', v, 'All your training paces will be calculated around that.', 7)} />
        <Actions onBack={() => goTo(5)} onNext={() => sel('nutrition') && goTo(7)} nextLabel="Continue" />
      </StepWrap>
    );

    const step7mr = (
      <StepWrap key="7" q="What's your biggest race challenge?" hint="Your plan will include specific workouts and strategies to tackle this directly.">
        <Opts options={isHalf ? [
          { icon: '⏱️', label: 'Pacing',           desc: 'Going out too fast, dying late',         value: 'pacing — starting too fast and suffering badly in the second half' },
          { icon: '🏃', label: 'Holding pace',     desc: 'Can\'t maintain goal pace late on',      value: 'holding race pace — struggling to maintain target pace in the final 5km' },
          { icon: '🍌', label: 'Race nutrition',   desc: 'Stomach issues or energy crashes',       value: 'race day nutrition — timing gels and hydration correctly during a half marathon' },
          { icon: '🦵', label: 'Injury risk',      desc: 'Knees, IT band, shins flare up',        value: 'injury risk — knee pain, IT band, or shin splints flaring up during training' },
        ] : [
          { icon: '🧱', label: 'The wall',         desc: 'Hitting the wall at km 30–35',          value: 'hitting the wall — glycogen depletion and collapse after km 30' },
          { icon: '⏱️', label: 'Pacing',           desc: 'Going out too fast, dying late',         value: 'pacing — starting too fast and suffering badly in the second half' },
          { icon: '🍌', label: 'Race nutrition',   desc: 'Stomach issues or energy crashes',       value: 'race day nutrition — GI issues, gels, and energy management during the race' },
          { icon: '🦵', label: 'Injury risk',      desc: 'Knees, IT band, shins, or fatigue',     value: 'injury risk — knee pain, IT band, shin splints, or overtraining during build' },
        ]} selected={sel('motivation')} onSelect={v => selectOpt('motivation', v, 'Your plan will tackle that directly.', 8)} />
        <Actions onBack={() => goTo(6)} onNext={() => sel('motivation') && goTo(8)} nextLabel="Continue" />
      </StepWrap>
    );

    const step8mr = (
      <StepWrap key="8" q="Any injuries or physical limitations?" hint="Knees, IT band, shins, plantar fasciitis — we'll programme around them.">
        <TextInput
          style={stepStyles.textarea}
          multiline
          numberOfLines={3}
          placeholder="e.g. IT band issues on long runs. Or: None."
          placeholderTextColor="#555"
          value={formData.injuries || ''}
          onChangeText={v => setFormData(prev => ({ ...prev, injuries: v }))}
        />
        <Actions onBack={() => goTo(7)} onNext={() => goTo(9)} nextLabel="Continue" />
      </StepWrap>
    );

    const step9mr = (
      <StepWrap key="9" q="How many weeks until your race?" hint="Your long run progression, taper, and race-week plan are all built from this.">
        <Opts options={isHalf ? [
          { icon: '⚡', label: '8 weeks',    desc: 'Focused half marathon block',          value: '8 weeks'  },
          { icon: '🔥', label: '10 weeks',   desc: 'Standard half marathon build',         value: '10 weeks' },
          { icon: '💪', label: '12 weeks',   desc: 'Full base-to-race preparation',        value: '12 weeks' },
          { icon: '🏆', label: '16 weeks',   desc: 'Extended build with strong base',      value: '16 weeks' },
        ] : [
          { icon: '🔥', label: '12 weeks',   desc: 'Standard full marathon block',         value: '12 weeks' },
          { icon: '💪', label: '16 weeks',   desc: 'Full build — most popular',            value: '16 weeks' },
          { icon: '🏆', label: '20 weeks',   desc: 'Extended base + full race build',      value: '20 weeks' },
          { icon: '🗓️', label: '24 weeks',   desc: 'Complete periodised marathon cycle',   value: '24 weeks' },
        ]} selected={sel('timeframe')} onSelect={v => selectOpt('timeframe', v, 'Race day is set. Every run builds towards it.')} cols={2} />
        <Actions onBack={() => goTo(8)} />
      </StepWrap>
    );

    return [step1mr, step2mr,
      <StepWrap key="3" q="Your current stats?" hint={hasSavedStats ? 'Saved from your profile — update anytime.' : 'Used to estimate your training paces and race-day fuelling needs.'}>
        <NumericRow
          fields={[
            { label: 'Age', key: 'age', placeholder: '32', decimal: false },
            { label: 'Weight (kg)', key: 'weight', placeholder: '72', decimal: true },
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
      step4mr, step5mr, step6mr, step7mr, step8mr, step9mr,
    ];
  }

  // ── CROSSFIT — fully dedicated steps ─────────────────────────
  if (isCrossfit) {
    const step1cf = (
      <StepWrap key="1" q="What's your CrossFit goal?" hint="Your WOD programming, skill work, and training structure will all point towards this.">
        <Opts options={[
          { icon: '💪', label: 'Get fit & strong',    desc: 'Fitter, stronger, healthier overall',    value: 'improve overall fitness, strength, and conditioning through CrossFit' },
          { icon: '🏆', label: 'Compete',             desc: 'Open, regionals, or local competition',  value: 'compete in CrossFit competitions — Open, local throwdowns, or regionals' },
          { icon: '🎯', label: 'Master the skills',   desc: 'Pull-ups, muscle-ups, Olympic lifting',  value: 'develop CrossFit skills — gymnastics, Olympic lifting, and benchmark WODs' },
          { icon: '🌱', label: 'Start CrossFit',      desc: 'Learn movements, build a base',          value: 'start CrossFit properly — learn the movements and build a functional base' },
        ]} selected={sel('goals')} onSelect={v => selectOpt('goals', v, 'Your programming will be built around that.', 2)} />
        <Actions onNext={() => sel('goals') && goTo(2)} nextLabel="Continue" />
      </StepWrap>
    );

    const step2cf = (
      <StepWrap key="2" q="What's your CrossFit experience?" hint="Sets your exercise complexity, loading, and how much technique coaching is included.">
        <Opts options={[
          { icon: '🌱', label: 'Never done CF',       desc: 'First time, complete beginner',          value: 'complete beginner — never done CrossFit or functional fitness training' },
          { icon: '📖', label: 'Tried a few classes', desc: 'Know the basics, still learning',        value: 'some CrossFit experience — attended classes but still learning movements' },
          { icon: '💪', label: 'Regular member',      desc: 'Training 3+ months consistently',        value: 'regular CrossFit member — training consistently for several months' },
          { icon: '🏆', label: 'Competitive athlete', desc: 'RX capable, chasing performance',        value: 'experienced CrossFit athlete — RX capable and chasing competitive performance' },
        ]} selected={sel('level')} onSelect={v => selectOpt('level', v, 'Got it. Your scaling, loading, and skill work will match that exactly.', 3)} />
        <Actions onBack={() => goTo(1)} onNext={() => sel('level') && goTo(3)} nextLabel="Continue" />
      </StepWrap>
    );

    const step4cf = (
      <StepWrap key="4" q="How many days per week can you train?" hint="CrossFit programming works best with at least 3 days and built-in rest days.">
        <Opts options={[
          { icon: '3', label: '3 days', desc: 'Solid — classic 3-on, rest pattern', value: '3' },
          { icon: '4', label: '4 days', desc: 'Strong — balanced volume',           value: '4' },
          { icon: '5', label: '5 days', desc: 'High — serious training load',       value: '5' },
        ]} selected={sel('schedule')} onSelect={v => selectOpt('schedule', v, 'Your weekly programming will be structured around that.', 5)} cols={3} monoKey />
        <Actions onBack={() => goTo(3)} onNext={() => sel('schedule') && goTo(5)} nextLabel="Continue" />
      </StepWrap>
    );

    const step5cf = (
      <StepWrap key="5" q="What's your training setup?" hint="Your exercise selection will use only what you actually have access to.">
        <Opts options={[
          { icon: '🏟️', label: 'CrossFit box',        desc: 'Full equipment — rigs, barbells, rings', value: 'full CrossFit box — rig, barbells, rings, pull-up bar, rowers, assault bike' },
          { icon: '🏋️', label: 'Commercial gym',      desc: 'Barbells + pull-up bar, no rings/erg',   value: 'commercial gym — barbells, dumbbells, pull-up bar, no rings or rowing machine' },
          { icon: '🔀', label: 'Mix',                 desc: 'CrossFit box occasionally + gym',        value: 'mix — CrossFit box occasionally with regular gym access' },
          { icon: '🏠', label: 'Home / minimal kit',  desc: 'Dumbbells, bar, bodyweight only',        value: 'home or minimal equipment — dumbbells, a barbell, and bodyweight movements' },
        ]} selected={sel('location')} onSelect={v => selectOpt('location', v, 'Every WOD will be built for your setup.', 6)} />
        <Actions onBack={() => goTo(4)} onNext={() => sel('location') && goTo(6)} nextLabel="Continue" />
      </StepWrap>
    );

    const step6cf = (
      <StepWrap key="6" q="What's your weakest CrossFit domain?" hint="Your program will include targeted skill work and accessory training to fix this.">
        <Opts options={[
          { icon: '🏋️', label: 'Olympic lifting',     desc: 'Snatch, clean & jerk — technique',       value: 'Olympic lifting — snatch and clean & jerk technique and efficiency' },
          { icon: '🤸', label: 'Gymnastics skills',   desc: 'Pull-ups, muscle-ups, handstands',        value: 'gymnastics — pull-ups, muscle-ups, handstand push-ups, and ring work' },
          { icon: '🔥', label: 'Conditioning',        desc: 'MetCons blow me up early',               value: 'conditioning — MetCons and high-rep work drain me too fast' },
          { icon: '💪', label: 'Strength',            desc: 'Squat, deadlift, press — need more load', value: 'strength — squat, deadlift, and press numbers need to be higher' },
        ]} selected={sel('nutrition')} onSelect={v => selectOpt('nutrition', v, 'That domain gets targeted skill work every week.', 7)} />
        <Actions onBack={() => goTo(5)} onNext={() => sel('nutrition') && goTo(7)} nextLabel="Continue" />
      </StepWrap>
    );

    const step7cf = (
      <StepWrap key="7" q="What's your biggest CrossFit challenge?" hint="Your plan will have direct strategies and programming to overcome this.">
        <Opts options={[
          { icon: '📉', label: 'Intensity fades',     desc: 'Start hard, fall apart mid-WOD',         value: 'losing intensity mid-WOD — start too fast and break down badly' },
          { icon: '🎯', label: 'Skill gaps',          desc: 'Specific movements hold me back',        value: 'skill gaps — specific movements I can\'t do yet limit my WOD performance' },
          { icon: '😴', label: 'Recovery',            desc: 'Too sore, too tired between sessions',   value: 'recovery — too sore or fatigued to train at full intensity session to session' },
          { icon: '📋', label: 'No structure',        desc: 'Random WODs, no progression',            value: 'no structured progression — random WODs without a clear improvement plan' },
        ]} selected={sel('motivation')} onSelect={v => selectOpt('motivation', v, 'Your program will address that directly.', 8)} />
        <Actions onBack={() => goTo(6)} onNext={() => sel('motivation') && goTo(8)} nextLabel="Continue" />
      </StepWrap>
    );

    const step8cf = (
      <StepWrap key="8" q="Any injuries or physical limitations?" hint="Common CrossFit issues: shoulders, wrists, lower back — we'll programme around them.">
        <TextInput
          style={stepStyles.textarea}
          multiline
          numberOfLines={3}
          placeholder="e.g. Shoulder impingement — no overhead pressing. Or: None."
          placeholderTextColor="#555"
          value={formData.injuries || ''}
          onChangeText={v => setFormData(prev => ({ ...prev, injuries: v }))}
        />
        <Actions onBack={() => goTo(7)} onNext={() => goTo(9)} nextLabel="Continue" />
      </StepWrap>
    );

    const step9cf = (
      <StepWrap key="9" q="How long do you want this program to run?" hint="Your skill progressions, strength cycles, and WOD difficulty are all scaled to this.">
        <Opts options={[
          { icon: '⚡', label: '4 weeks',    desc: 'Intensive skill + conditioning block',  value: '4 weeks'  },
          { icon: '🔥', label: '8 weeks',    desc: 'Solid CrossFit development cycle',      value: '8 weeks'  },
          { icon: '💪', label: '12 weeks',   desc: 'Full strength + skill + metcon build',  value: '12 weeks' },
          { icon: '🏆', label: '16 weeks',   desc: 'Complete CrossFit periodisation',       value: '16 weeks' },
        ]} selected={sel('timeframe')} onSelect={v => selectOpt('timeframe', v, 'Your program is set. Let\'s build it.')} cols={2} />
        <Actions onBack={() => goTo(8)} />
      </StepWrap>
    );

    return [step1cf, step2cf,
      <StepWrap key="3" q="Your current stats?" hint={hasSavedStats ? 'Saved from your profile — update anytime.' : 'Used to set your barbell loading targets and WOD scaling.'}>
        <NumericRow
          fields={[
            { label: 'Age', key: 'age', placeholder: '28', decimal: false },
            { label: 'Weight (kg)', key: 'weight', placeholder: '78', decimal: true },
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
      step4cf, step5cf, step6cf, step7cf, step8cf, step9cf,
    ];
  }

  // ── HIIT — fully dedicated steps ─────────────────────────────
  if (isHIIT) {
    const step1hi = (
      <StepWrap key="1" q="What do you want from HIIT?" hint="Your interval format, exercise selection, and intensity will all be built around this.">
        <Opts options={[
          { icon: '🔥', label: 'Burn fat',           desc: 'Maximum calorie burn, lean out',          value: 'burn fat and lose weight through high-intensity interval training' },
          { icon: '❤️', label: 'Cardio fitness',      desc: 'Improve VO2max, endurance, stamina',      value: 'improve cardiovascular fitness, VO2max, and aerobic capacity' },
          { icon: '💪', label: 'Full body conditioning', desc: 'Strength + cardio combined',           value: 'full body conditioning — strength and cardio combined in every session' },
          { icon: '⚡', label: 'Athletic performance', desc: 'Speed, power, explosive fitness',        value: 'athletic performance — speed, explosive power, and sport-specific conditioning' },
        ]} selected={sel('goals')} onSelect={v => selectOpt('goals', v, 'Every interval will drive towards that.', 2)} />
        <Actions onNext={() => sel('goals') && goTo(2)} nextLabel="Continue" />
      </StepWrap>
    );

    const step2hi = (
      <StepWrap key="2" q="What's your current fitness level?" hint="Sets your starting work-to-rest ratios, exercise intensity, and session volume.">
        <Opts options={[
          { icon: '🌱', label: 'Beginner',            desc: 'New to intense training',                value: 'beginner — new to high-intensity training, get out of breath quickly' },
          { icon: '🏃', label: 'Some fitness',        desc: 'Occasional workouts, getting started',   value: 'some fitness — exercise occasionally but not consistently' },
          { icon: '💪', label: 'Moderately fit',      desc: 'Train regularly, handle intensity',      value: 'moderately fit — train regularly and can handle hard intervals' },
          { icon: '🔥', label: 'Very fit',            desc: 'High capacity, need real challenge',     value: 'very fit — high aerobic capacity, need genuinely challenging intervals' },
        ]} selected={sel('level')} onSelect={v => selectOpt('level', v, 'Your intervals will be calibrated for exactly that level.', 3)} />
        <Actions onBack={() => goTo(1)} onNext={() => sel('level') && goTo(3)} nextLabel="Continue" />
      </StepWrap>
    );

    const step4hi = (
      <StepWrap key="4" q="How many HIIT sessions per week?" hint="HIIT is high-stress — recovery matters as much as the sessions.">
        <Opts options={[
          { icon: '2', label: '2 sessions', desc: 'Ideal for beginners — recover well',  value: '2' },
          { icon: '3', label: '3 sessions', desc: 'Sweet spot — proven results',         value: '3' },
          { icon: '4', label: '4 sessions', desc: 'High frequency — need good recovery', value: '4' },
          { icon: '5', label: '5 sessions', desc: 'Maximum — only for the very fit',     value: '5' },
        ]} selected={sel('schedule')} onSelect={v => selectOpt('schedule', v, 'Your weekly schedule will be structured around that.', 5)} cols={2} monoKey />
        <Actions onBack={() => goTo(3)} onNext={() => sel('schedule') && goTo(5)} nextLabel="Continue" />
      </StepWrap>
    );

    const step5hi = (
      <StepWrap key="5" q="Where will you train?" hint="Your exercises will use only what you have available.">
        <Opts options={[
          { icon: '🏋️', label: 'Gym',                 desc: 'Machines, weights, cardio equipment',    value: 'commercial gym with weights, machines, and cardio equipment' },
          { icon: '🏠', label: 'Home',                 desc: 'Bodyweight or minimal equipment',        value: 'home with bodyweight or minimal equipment' },
          { icon: '🌳', label: 'Outdoors',             desc: 'Parks, tracks, open space',              value: 'outdoors — parks, running tracks, and open spaces' },
          { icon: '🔀', label: 'Anywhere',             desc: 'No fixed location — keep it flexible',   value: 'anywhere — flexible location, no fixed equipment' },
        ]} selected={sel('location')} onSelect={v => selectOpt('location', v, 'Every session will be designed for that environment.', 6)} />
        <Actions onBack={() => goTo(4)} onNext={() => sel('location') && goTo(6)} nextLabel="Continue" />
      </StepWrap>
    );

    const step6hi = (
      <StepWrap key="6" q="How long should each session be?" hint="Your intervals, rounds, and rest periods will all be designed to fit this window.">
        <Opts options={[
          { icon: '⚡', label: '20 minutes',   desc: 'No excuses — maximum efficiency',      value: '20 minutes' },
          { icon: '🔥', label: '30 minutes',   desc: 'Sweet spot — complete and effective',  value: '30 minutes' },
          { icon: '💪', label: '45 minutes',   desc: 'Full session — warm-up to cool-down',  value: '45 minutes' },
          { icon: '🏆', label: '60 minutes',   desc: 'Extended — strength + HIIT combined',  value: '60 minutes' },
        ]} selected={sel('nutrition')} onSelect={v => selectOpt('nutrition', v, 'Every session will fit exactly within that.', 7)} />
        <Actions onBack={() => goTo(5)} onNext={() => sel('nutrition') && goTo(7)} nextLabel="Continue" />
      </StepWrap>
    );

    const step7hi = (
      <StepWrap key="7" q="What's your biggest HIIT challenge?" hint="Your plan will include direct strategies and programming to overcome this.">
        <Opts options={[
          { icon: '😮‍💨', label: 'Intensity drops',   desc: 'Can\'t maintain effort through rounds',  value: 'losing intensity — effort drops badly in later rounds' },
          { icon: '🔁', label: 'Consistency',         desc: 'Miss sessions, lose momentum',           value: 'consistency — missing sessions and losing momentum between workouts' },
          { icon: '😴', label: 'Recovery',            desc: 'Too sore or tired for the next session', value: 'recovery — too sore or fatigued to perform well in the next session' },
          { icon: '📋', label: 'No structure',        desc: 'Random workouts, no clear progress',     value: 'no structure — doing random workouts without a clear progression plan' },
        ]} selected={sel('motivation')} onSelect={v => selectOpt('motivation', v, 'Your plan will tackle that directly.', 8)} />
        <Actions onBack={() => goTo(6)} onNext={() => sel('motivation') && goTo(8)} nextLabel="Continue" />
      </StepWrap>
    );

    const step8hi = (
      <StepWrap key="8" q="Any injuries or physical limitations?" hint="We'll choose exercises and formats that protect anything that needs it.">
        <TextInput
          style={stepStyles.textarea}
          multiline
          numberOfLines={3}
          placeholder="e.g. Knee pain — no jumping. Or: None."
          placeholderTextColor="#555"
          value={formData.injuries || ''}
          onChangeText={v => setFormData(prev => ({ ...prev, injuries: v }))}
        />
        <Actions onBack={() => goTo(7)} onNext={() => goTo(9)} nextLabel="Continue" />
      </StepWrap>
    );

    const step9hi = (
      <StepWrap key="9" q="How long do you want the program to run?" hint="Your interval progressions and session formats will be scaled to fit.">
        <Opts options={[
          { icon: '⚡', label: '4 weeks',    desc: 'Intensive conditioning block',          value: '4 weeks'  },
          { icon: '🔥', label: '6 weeks',    desc: 'Solid HIIT development cycle',          value: '6 weeks'  },
          { icon: '💪', label: '8 weeks',    desc: 'Full progressive HIIT program',         value: '8 weeks'  },
          { icon: '🏆', label: '12 weeks',   desc: 'Complete periodised HIIT plan',         value: '12 weeks' },
        ]} selected={sel('timeframe')} onSelect={v => selectOpt('timeframe', v, 'Perfect. Your program will be paced exactly for that.')} cols={2} />
        <Actions onBack={() => goTo(8)} />
      </StepWrap>
    );

    return [step1hi, step2hi,
      <StepWrap key="3" q="Your current stats?" hint={hasSavedStats ? 'Saved from your profile — update anytime.' : 'Used to set your starting intensity and recovery needs.'}>
        <NumericRow
          fields={[
            { label: 'Age', key: 'age', placeholder: '28', decimal: false },
            { label: 'Weight (kg)', key: 'weight', placeholder: '72', decimal: true },
            { label: 'Height (cm)', key: 'height', placeholder: '170', decimal: false },
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
      step4hi, step5hi, step6hi, step7hi, step8hi, step9hi,
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
