import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { spacing, radius, font, colors } from '../../src/lib/theme';

// ── Tool registry ─────────────────────────────────────────────────────────────
const TOOLS = [
  { id: 'calories', icon: '🔥', title: 'Calorie & Macro Calculator', desc: 'BMR · TDEE · protein, carbs, fat targets for your goal' },
  { id: 'oneRM',    icon: '💪', title: '1RM Estimator',              desc: 'Find your one-rep max from any set you already did' },
  { id: 'pace',     icon: '🏃', title: 'Pace & Race Calculator',     desc: 'Distance → pace → finish time — for any race' },
  { id: 'hydration',icon: '💧', title: 'Hydration Guide',            desc: 'Daily water target based on your body and activity' },
  { id: 'timer',    icon: '⏱️', title: 'Rest Timer',                 desc: 'Countdown between sets — tap and go' },
];

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ToolsScreen() {
  const [open, setOpen] = useState<string | null>(null);

  function toggle(id: string) {
    setOpen(prev => prev === id ? null : id);
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.eyebrow}>// FREE · NO ACCOUNT NEEDED</Text>
          <Text style={s.title}>Tools</Text>
          <Text style={s.sub}>Five free fitness calculators, always available.</Text>

          {TOOLS.map(tool => (
            <ToolCard
              key={tool.id}
              tool={tool}
              isOpen={open === tool.id}
              onToggle={() => toggle(tool.id)}
            />
          ))}

          <View style={{ height: spacing[8] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Expandable tool card ──────────────────────────────────────────────────────
function ToolCard({ tool, isOpen, onToggle }: {
  tool: typeof TOOLS[0]; isOpen: boolean; onToggle: () => void;
}) {
  return (
    <View style={tc.card}>
      <TouchableOpacity style={tc.header} onPress={onToggle} activeOpacity={0.78}>
        <View style={tc.iconWrap}>
          <Text style={tc.icon}>{tool.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={tc.title}>{tool.title}</Text>
          <Text style={tc.desc}>{tool.desc}</Text>
        </View>
        <Text style={[tc.chevron, isOpen && tc.chevronOpen]}>›</Text>
      </TouchableOpacity>

      {isOpen && (
        <View style={tc.body}>
          {tool.id === 'calories'  && <CalorieTool />}
          {tool.id === 'oneRM'     && <OneRMTool />}
          {tool.id === 'pace'      && <PaceTool />}
          {tool.id === 'hydration' && <HydrationTool />}
          {tool.id === 'timer'     && <RestTimer />}
        </View>
      )}
    </View>
  );
}

const tc = StyleSheet.create({
  card:    { backgroundColor: '#181816', borderRadius: radius.lg, borderWidth: 1, borderColor: '#252520', marginBottom: spacing[3], overflow: 'hidden' },
  header:  { flexDirection: 'row', alignItems: 'center', padding: spacing[4], gap: spacing[3] },
  iconWrap:{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: '#0F2318', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icon:    { fontSize: 20 },
  title:   { fontFamily: font.sansBd, fontSize: 14, color: '#F5F5F2', marginBottom: 2 },
  desc:    { fontFamily: font.sans, fontSize: 12, color: '#555', lineHeight: 16 },
  chevron: { fontSize: 22, color: '#444', transform: [{ rotate: '0deg' }] },
  chevronOpen: { transform: [{ rotate: '90deg' }], color: '#888' },
  body:    { borderTopWidth: 1, borderTopColor: '#1C1C18', padding: spacing[4] },
});

// ══════════════════════════════════════════════════════════════════════════════
// Tool 1: Calorie & Macro Calculator
// ══════════════════════════════════════════════════════════════════════════════
type Sex = 'male' | 'female';
type Goal = 'lose' | 'maintain' | 'gain';

const ACTIVITY = [
  { label: 'Sedentary',   sub: 'Desk job, little movement',  value: 1.2   },
  { label: 'Light',       sub: '1–2 workouts/week',          value: 1.375 },
  { label: 'Moderate',    sub: '3–5 workouts/week',          value: 1.55  },
  { label: 'Active',      sub: '6–7 workouts/week',          value: 1.725 },
  { label: 'Very active', sub: 'Athlete / twice daily',      value: 1.9   },
];
const GOALS: { id: Goal; label: string; adj: number; color: string }[] = [
  { id: 'lose',     label: '🔥 Lose fat',     adj: -400, color: '#C06848' },
  { id: 'maintain', label: '⚖️ Maintain',     adj: 0,    color: '#3D9E6A' },
  { id: 'gain',     label: '💪 Build muscle', adj: +300, color: '#4A8FAA' },
];

function CalorieTool() {
  const [age, setAge]       = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [sex, setSex]       = useState<Sex>('male');
  const [activity, setActivity] = useState(1.55);
  const [goal, setGoal]     = useState<Goal>('maintain');
  const [result, setResult] = useState<null | { bmr: number; tdee: number; target: number; protein: number; carbs: number; fat: number }>(null);
  const [error, setError]   = useState('');

  function calc() {
    const a = parseInt(age); const w = parseFloat(weight); const h = parseFloat(height);
    if (!a || a < 10 || a > 100) { setError('Age: 10–100'); return; }
    if (!w || w < 20 || w > 300) { setError('Weight: 20–300 kg'); return; }
    if (!h || h < 100 || h > 250) { setError('Height: 100–250 cm'); return; }
    setError('');
    const bmr = sex === 'female'
      ? 10 * w + 6.25 * h - 5 * a - 161
      : 10 * w + 6.25 * h - 5 * a + 5;
    const tdee   = Math.round(bmr * activity);
    const adj    = GOALS.find(g => g.id === goal)!.adj;
    const target = tdee + adj;
    const protein = Math.round(w * 2.0);
    const fat     = Math.round((target * 0.25) / 9);
    const carbs   = Math.round((target - protein * 4 - fat * 9) / 4);
    setResult({ bmr: Math.round(bmr), tdee, target, protein, carbs: Math.max(0, carbs), fat });
  }

  const goalColor = GOALS.find(g => g.id === goal)!.color;

  return (
    <View style={{ gap: spacing[4] }}>
      {/* Inputs row */}
      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        <InlineInput label="Age" placeholder="28" value={age} onChangeText={v => setAge(v.replace(/\D/g, ''))} maxLength={3} />
        <InlineInput label="Weight kg" placeholder="75" value={weight} onChangeText={v => setWeight(v.replace(/[^0-9.]/g, ''))} decimal maxLength={5} />
        <InlineInput label="Height cm" placeholder="175" value={height} onChangeText={v => setHeight(v.replace(/\D/g, ''))} maxLength={3} />
      </View>

      {/* Sex */}
      <SegmentRow>
        {(['male', 'female'] as Sex[]).map(sv => (
          <SegBtn key={sv} label={sv === 'male' ? '♂ Male' : '♀ Female'} active={sex === sv} onPress={() => setSex(sv)} />
        ))}
      </SegmentRow>

      {/* Goal */}
      <SegmentRow>
        {GOALS.map(g => (
          <SegBtn key={g.id} label={g.label} active={goal === g.id} onPress={() => setGoal(g.id)} activeColor={g.color} />
        ))}
      </SegmentRow>

      {/* Activity */}
      <View style={{ gap: spacing[2] }}>
        <Text style={t.fieldLabel}>Activity level</Text>
        {ACTIVITY.map(a => (
          <TouchableOpacity key={a.value} style={[t.actRow, activity === a.value && t.actRowActive]} onPress={() => setActivity(a.value)} activeOpacity={0.75}>
            <View style={{ flex: 1 }}>
              <Text style={[t.actLabel, activity === a.value && { color: '#F5F5F2' }]}>{a.label}</Text>
              <Text style={t.actSub}>{a.sub}</Text>
            </View>
            <View style={[t.radio, activity === a.value && t.radioActive]}>
              {activity === a.value && <View style={t.radioDot} />}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {!!error && <Text style={t.error}>{error}</Text>}
      <CalcButton onPress={calc} />

      {result && (
        <View style={t.resultCard}>
          <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[4] }}>
            <StatBox label="BMR" value={result.bmr.toLocaleString()} unit="kcal" note="at rest" color="#4A8FAA" />
            <StatBox label="TDEE" value={result.tdee.toLocaleString()} unit="kcal" note="with activity" color="#888" />
            <StatBox label="Target" value={result.target.toLocaleString()} unit="kcal" note={goal === 'lose' ? '-400 deficit' : goal === 'gain' ? '+300 surplus' : 'maintenance'} color={goalColor} />
          </View>

          <Text style={t.macroHead}>Daily macros</Text>
          <MacroBar label="Protein" grams={result.protein} pct={Math.round(result.protein * 4 / result.target * 100)} color="#3D9E6A" note="~2g per kg bodyweight" />
          <MacroBar label="Carbs"   grams={result.carbs}   pct={Math.round(result.carbs * 4 / result.target * 100)}   color="#D4923F" note="energy + performance" />
          <MacroBar label="Fat"     grams={result.fat}     pct={Math.round(result.fat * 9 / result.target * 100)}     color="#9A6AC8" note="hormones + recovery" />

          <Text style={t.disclaimer}>Mifflin-St Jeor formula. Adjust by ±100 kcal based on real results over 2 weeks.</Text>
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tool 2: 1RM Estimator
// ══════════════════════════════════════════════════════════════════════════════
const LIFTS = ['Squat', 'Bench press', 'Deadlift', 'Overhead press', 'Other'];

function OneRMTool() {
  const [lift, setLift]     = useState('Squat');
  const [weight, setWeight] = useState('');
  const [reps, setReps]     = useState('');
  const [result, setResult] = useState<null | { epley: number; percentages: { pct: number; weight: number }[] }>(null);
  const [error, setError]   = useState('');

  function calc() {
    const w = parseFloat(weight); const r = parseInt(reps);
    if (!w || w <= 0)           { setError('Enter a weight greater than 0.'); return; }
    if (!r || r < 1 || r > 30) { setError('Enter reps between 1 and 30.'); return; }
    setError('');
    const epley = r === 1 ? w : Math.round(w * (1 + r / 30));
    const percentages = [100, 95, 90, 85, 80, 75, 70].map(pct => ({
      pct,
      weight: Math.round(epley * pct / 100),
    }));
    setResult({ epley, percentages });
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <Text style={t.fieldLabel}>Exercise</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
        {LIFTS.map(l => (
          <TouchableOpacity key={l} style={[t.chip, lift === l && t.chipActive]} onPress={() => setLift(l)} activeOpacity={0.75}>
            <Text style={[t.chipText, lift === l && t.chipTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        <InlineInput label="Weight lifted (kg)" placeholder="100" value={weight} onChangeText={v => setWeight(v.replace(/[^0-9.]/g, ''))} decimal maxLength={6} />
        <InlineInput label="Reps completed" placeholder="5" value={reps} onChangeText={v => setReps(v.replace(/\D/g, ''))} maxLength={2} />
      </View>

      {!!error && <Text style={t.error}>{error}</Text>}
      <CalcButton label="Estimate 1RM" onPress={calc} />

      {result && (
        <View style={t.resultCard}>
          <Text style={[t.bigResult, { color: '#3D9E6A' }]}>{result.epley} kg</Text>
          <Text style={t.bigResultSub}>estimated 1 rep max — {lift}</Text>

          <Text style={[t.macroHead, { marginTop: spacing[4] }]}>Training weights</Text>
          <View style={{ gap: spacing[2] }}>
            {result.percentages.map(({ pct, weight: w }) => (
              <View key={pct} style={t.pctRow}>
                <View style={[t.pctBar, { width: `${pct}%` as any, backgroundColor: pct >= 90 ? '#3D9E6A' : pct >= 80 ? '#4A8FAA' : '#444' }]} />
                <Text style={t.pctLabel}>{pct}%</Text>
                <Text style={t.pctWeight}>{w} kg</Text>
                <Text style={t.pctNote}>{pct === 100 ? '1 rep' : pct === 95 ? '2–3 reps' : pct === 90 ? '3–4 reps' : pct === 85 ? '4–6 reps' : pct === 80 ? '6–8 reps' : pct === 75 ? '8–10 reps' : '10–12 reps'}</Text>
              </View>
            ))}
          </View>
          <Text style={t.disclaimer}>Epley formula. Use for planning — always warm up properly before attempting heavy singles.</Text>
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tool 3: Pace & Race Calculator
// ══════════════════════════════════════════════════════════════════════════════
const DISTANCES = [
  { label: '1 km',        km: 1 },
  { label: '5 km',        km: 5 },
  { label: '10 km',       km: 10 },
  { label: 'Half (21km)', km: 21.0975 },
  { label: 'Full (42km)', km: 42.195 },
  { label: 'Custom',      km: 0 },
];

type PaceMode = 'pace→time' | 'time→pace';

function PaceTool() {
  const [mode, setMode]         = useState<PaceMode>('pace→time');
  const [distIdx, setDistIdx]   = useState(1); // 5 km
  const [customKm, setCustomKm] = useState('');
  const [paceMin, setPaceMin]   = useState('');
  const [paceSec, setPaceSec]   = useState('');
  const [timeH, setTimeH]       = useState('');
  const [timeMin, setTimeMin]   = useState('');
  const [timeSec, setTimeSec]   = useState('');
  const [result, setResult]     = useState<null | string[]>(null);
  const [error, setError]       = useState('');

  const dist = DISTANCES[distIdx].km || parseFloat(customKm) || 0;

  function calc() {
    setError('');
    if (!dist || dist <= 0) { setError('Enter a valid distance.'); return; }

    if (mode === 'pace→time') {
      const pm = parseInt(paceMin) || 0; const ps = parseInt(paceSec) || 0;
      if (!pm && !ps) { setError('Enter your pace (min:sec per km).'); return; }
      const paceSecs = pm * 60 + ps;
      const totalSecs = paceSecs * dist;
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = Math.round(totalSecs % 60);
      setResult([
        `Finish time: ${h > 0 ? h + 'h ' : ''}${m}m ${s}s`,
        `Pace: ${pm}:${String(ps).padStart(2, '0')} /km`,
        `Distance: ${dist % 1 === 0 ? dist : dist.toFixed(2)} km`,
        `Avg speed: ${(dist / (totalSecs / 3600)).toFixed(1)} km/h`,
      ]);
    } else {
      const th = parseInt(timeH) || 0; const tm = parseInt(timeMin) || 0; const ts = parseInt(timeSec) || 0;
      const totalSecs = th * 3600 + tm * 60 + ts;
      if (!totalSecs) { setError('Enter your finish time.'); return; }
      const paceSecs = totalSecs / dist;
      const pm = Math.floor(paceSecs / 60);
      const ps = Math.round(paceSecs % 60);
      setResult([
        `Pace: ${pm}:${String(ps).padStart(2, '0')} /km`,
        `Distance: ${dist % 1 === 0 ? dist : dist.toFixed(2)} km`,
        `Finish time: ${th > 0 ? th + 'h ' : ''}${tm}m ${ts}s`,
        `Avg speed: ${(dist / (totalSecs / 3600)).toFixed(1)} km/h`,
      ]);
    }
  }

  return (
    <View style={{ gap: spacing[4] }}>
      {/* Mode toggle */}
      <SegmentRow>
        <SegBtn label="Pace → Time" active={mode === 'pace→time'} onPress={() => { setMode('pace→time'); setResult(null); }} />
        <SegBtn label="Time → Pace" active={mode === 'time→pace'} onPress={() => { setMode('time→pace'); setResult(null); }} />
      </SegmentRow>

      {/* Distance chips */}
      <Text style={t.fieldLabel}>Distance</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
        {DISTANCES.map((d, i) => (
          <TouchableOpacity key={d.label} style={[t.chip, distIdx === i && t.chipActive]} onPress={() => setDistIdx(i)} activeOpacity={0.75}>
            <Text style={[t.chipText, distIdx === i && t.chipTextActive]}>{d.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {distIdx === DISTANCES.length - 1 && (
        <InlineInput label="Distance (km)" placeholder="15" value={customKm} onChangeText={v => setCustomKm(v.replace(/[^0-9.]/g, ''))} decimal maxLength={6} />
      )}

      {mode === 'pace→time' ? (
        <View>
          <Text style={t.fieldLabel}>Your pace (per km)</Text>
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <InlineInput label="Minutes" placeholder="5" value={paceMin} onChangeText={v => setPaceMin(v.replace(/\D/g, ''))} maxLength={2} />
            <InlineInput label="Seconds" placeholder="30" value={paceSec} onChangeText={v => setPaceSec(v.replace(/\D/g, ''))} maxLength={2} />
          </View>
        </View>
      ) : (
        <View>
          <Text style={t.fieldLabel}>Your finish time</Text>
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <InlineInput label="Hours" placeholder="0" value={timeH} onChangeText={v => setTimeH(v.replace(/\D/g, ''))} maxLength={2} />
            <InlineInput label="Minutes" placeholder="25" value={timeMin} onChangeText={v => setTimeMin(v.replace(/\D/g, ''))} maxLength={2} />
            <InlineInput label="Seconds" placeholder="00" value={timeSec} onChangeText={v => setTimeSec(v.replace(/\D/g, ''))} maxLength={2} />
          </View>
        </View>
      )}

      {!!error && <Text style={t.error}>{error}</Text>}
      <CalcButton label="Calculate" onPress={calc} />

      {result && (
        <View style={t.resultCard}>
          {result.map((line, i) => (
            <View key={i} style={[t.resultRow, i < result.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#1C1C18' }]}>
              <Text style={[t.resultRowText, i === 0 && { color: '#3D9E6A', fontFamily: font.sansBd, fontSize: 18 }]}>{line}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tool 4: Hydration Guide
// ══════════════════════════════════════════════════════════════════════════════
const HEAT = [
  { label: 'Cool / indoors', factor: 0 },
  { label: 'Warm / outdoors', factor: 0.3 },
  { label: 'Hot / humid',    factor: 0.6 },
];
const SWEAT = [
  { label: "I don't sweat much",   factor: 0 },
  { label: 'Average sweater',       factor: 0.3 },
  { label: 'Heavy sweater',         factor: 0.6 },
];

function HydrationTool() {
  const [weight, setWeight]   = useState('');
  const [activity, setActivity] = useState(1.55);
  const [heat, setHeat]       = useState(0);
  const [sweat, setSweat]     = useState(0);
  const [result, setResult]   = useState<null | { base: number; total: number; training: number; tips: string[] }>(null);
  const [error, setError]     = useState('');

  function calc() {
    const w = parseFloat(weight);
    if (!w || w < 20 || w > 300) { setError('Enter weight between 20 and 300 kg.'); return; }
    setError('');
    const base     = w * 0.033; // 33 ml per kg baseline
    const actAdj   = activity >= 1.725 ? 0.8 : activity >= 1.55 ? 0.5 : activity >= 1.375 ? 0.3 : 0;
    const total    = +(base + actAdj + heat + sweat).toFixed(1);
    const training = +(actAdj + heat * 0.5 + sweat * 0.5).toFixed(1);
    const tips = [
      `Drink ${Math.round(total * 1000 / 8)} ml per glass (8 glasses spread evenly)`,
      'Sip 500 ml in the 2 hours before training',
      `Drink ${Math.round(training * 1000 / (activity >= 1.55 ? 5 : 3))} ml every 15 min during training`,
      'Weigh yourself before and after — replace each 1 kg lost with 1.5 L',
      'If urine is pale yellow, you\'re hydrated. Dark yellow = drink more',
    ];
    setResult({ base: +base.toFixed(1), total, training: Math.max(0, training), tips });
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <InlineInput label="Your weight (kg)" placeholder="75" value={weight} onChangeText={v => setWeight(v.replace(/[^0-9.]/g, ''))} decimal maxLength={5} />

      <Text style={t.fieldLabel}>Activity level</Text>
      {ACTIVITY.map(a => (
        <TouchableOpacity key={a.value} style={[t.actRow, activity === a.value && t.actRowActive]} onPress={() => setActivity(a.value)} activeOpacity={0.75}>
          <View style={{ flex: 1 }}>
            <Text style={[t.actLabel, activity === a.value && { color: '#F5F5F2' }]}>{a.label}</Text>
            <Text style={t.actSub}>{a.sub}</Text>
          </View>
          <View style={[t.radio, activity === a.value && t.radioActive]}>
            {activity === a.value && <View style={t.radioDot} />}
          </View>
        </TouchableOpacity>
      ))}

      <Text style={t.fieldLabel}>Environment</Text>
      <SegmentRow>
        {HEAT.map(h => (
          <SegBtn key={h.label} label={h.label} active={heat === h.factor} onPress={() => setHeat(h.factor)} />
        ))}
      </SegmentRow>

      <Text style={t.fieldLabel}>How much do you sweat?</Text>
      <SegmentRow>
        {SWEAT.map(sw => (
          <SegBtn key={sw.label} label={sw.label} active={sweat === sw.factor} onPress={() => setSweat(sw.factor)} />
        ))}
      </SegmentRow>

      {!!error && <Text style={t.error}>{error}</Text>}
      <CalcButton label="Calculate water intake" onPress={calc} />

      {result && (
        <View style={t.resultCard}>
          <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[4] }}>
            <StatBox label="Daily total" value={`${result.total}L`} unit="litres" note="throughout day" color="#4A8FAA" />
            <StatBox label="During training" value={`${result.training}L`} unit="extra" note="on workout days" color="#3D9E6A" />
          </View>
          <Text style={t.macroHead}>Hydration tips for you</Text>
          {result.tips.map((tip, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2] }}>
              <Text style={{ color: '#3D9E6A', fontFamily: font.sansBd }}>·</Text>
              <Text style={{ fontFamily: font.sans, fontSize: 13, color: '#888', lineHeight: 20, flex: 1 }}>{tip}</Text>
            </View>
          ))}
          <Text style={t.disclaimer}>Based on 33 ml/kg baseline with activity, heat, and sweat rate adjustments.</Text>
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tool 5: Rest Timer
// ══════════════════════════════════════════════════════════════════════════════
const PRESETS = [
  { label: '30s', secs: 30 },
  { label: '60s', secs: 60 },
  { label: '90s', secs: 90 },
  { label: '2m',  secs: 120 },
  { label: '3m',  secs: 180 },
  { label: '5m',  secs: 300 },
];

function RestTimer() {
  const [preset, setPreset]     = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [running, setRunning]   = useState(false);
  const [done, setDone]         = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setRemaining(preset);
    setDone(false);
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    progress.setValue(1);
  }, [preset]);

  useEffect(() => {
    if (running) {
      Animated.timing(progress, { toValue: 0, duration: remaining * 1000, useNativeDriver: false }).start();
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            setDone(true);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      progress.stopAnimation();
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  function reset() {
    setRunning(false);
    setDone(false);
    setRemaining(preset);
    progress.setValue(1);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  const m = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const barColor = done ? '#3D9E6A' : remaining <= 10 ? '#C06848' : '#3D9E6A';

  return (
    <View style={{ gap: spacing[4], alignItems: 'center' }}>
      {/* Preset chips */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], alignSelf: 'stretch' }}>
        {PRESETS.map(p => (
          <TouchableOpacity key={p.secs} style={[t.chip, preset === p.secs && t.chipActive]} onPress={() => setPreset(p.secs)} activeOpacity={0.75} disabled={running}>
            <Text style={[t.chipText, preset === p.secs && t.chipTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Timer display */}
      <View style={tm.face}>
        <Text style={[tm.digits, done && { color: '#3D9E6A' }]}>
          {done ? '✓' : `${m}:${String(ss).padStart(2, '0')}`}
        </Text>
        <Text style={tm.label}>{done ? 'Rest complete' : running ? 'resting…' : 'ready'}</Text>
      </View>

      {/* Progress bar */}
      <View style={tm.track}>
        <Animated.View style={[tm.fill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: barColor }]} />
      </View>

      {/* Controls */}
      <View style={{ flexDirection: 'row', gap: spacing[3], alignSelf: 'stretch' }}>
        <TouchableOpacity
          style={[tm.btn, { flex: 2, backgroundColor: done ? '#0F2318' : running ? '#1C0C0C' : '#0F2318', borderColor: done ? '#3D9E6A' : running ? '#C06848' : '#3D9E6A' }]}
          onPress={() => done ? reset() : setRunning(r => !r)}
          activeOpacity={0.8}
        >
          <Text style={[tm.btnText, { color: done ? '#3D9E6A' : running ? '#C06848' : '#3D9E6A' }]}>
            {done ? 'Reset' : running ? '⏸ Pause' : '▶ Start'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[tm.btn, { flex: 1 }]} onPress={reset} activeOpacity={0.8}>
          <Text style={tm.btnText}>↺ Reset</Text>
        </TouchableOpacity>
      </View>

      <Text style={t.disclaimer}>Tap a preset to change duration. Timer runs in the foreground only.</Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Shared sub-components
// ══════════════════════════════════════════════════════════════════════════════
function InlineInput({ label, placeholder, value, onChangeText, decimal, maxLength }: {
  label: string; placeholder: string; value: string;
  onChangeText: (v: string) => void; decimal?: boolean; maxLength?: number;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={t.fieldLabel}>{label}</Text>
      <TextInput
        style={t.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        placeholder={placeholder}
        placeholderTextColor="#333"
        maxLength={maxLength}
      />
    </View>
  );
}

function SegmentRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: spacing[2] }}>{children}</View>;
}

function SegBtn({ label, active, onPress, activeColor }: {
  label: string; active: boolean; onPress: () => void; activeColor?: string;
}) {
  return (
    <TouchableOpacity
      style={[t.segBtn, active && { backgroundColor: (activeColor || colors.forest) + '22', borderColor: activeColor || colors.forest }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[t.segText, active && { color: '#F5F5F2' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function CalcButton({ onPress, label = 'Calculate' }: { onPress: () => void; label?: string }) {
  return (
    <TouchableOpacity style={t.calcBtn} onPress={onPress} activeOpacity={0.85}>
      <Text style={t.calcBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatBox({ label, value, unit, note, color }: { label: string; value: string; unit: string; note: string; color: string }) {
  return (
    <View style={[t.statBox, { borderColor: color + '30' }]}>
      <Text style={[t.statValue, { color }]}>{value}</Text>
      <Text style={t.statLabel}>{label}</Text>
      <Text style={t.statUnit}>{unit}</Text>
      <Text style={t.statNote}>{note}</Text>
    </View>
  );
}

function MacroBar({ label, grams, pct, color, note }: { label: string; grams: number; pct: number; color: string; note: string }) {
  return (
    <View style={{ marginBottom: spacing[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: spacing[2] }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ fontFamily: font.sans, fontSize: 14, color: '#CCCCC8', flex: 1 }}>{label}</Text>
        <Text style={{ fontFamily: font.sansBd, fontSize: 14, color: '#F5F5F2' }}>{grams}g</Text>
        <Text style={{ fontFamily: font.mono, fontSize: 11, color: '#555', width: 36, textAlign: 'right' }}>{pct}%</Text>
      </View>
      <View style={{ height: 4, backgroundColor: '#1C1C18', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
        <View style={{ height: '100%', width: `${Math.min(pct, 100)}%` as any, backgroundColor: color, borderRadius: 2 }} />
      </View>
      <Text style={{ fontFamily: font.mono, fontSize: 10, color: '#444' }}>{note}</Text>
    </View>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const t = StyleSheet.create({
  fieldLabel: { fontFamily: font.mono, fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[2] },
  input:      { backgroundColor: '#0D0D0B', borderWidth: 1, borderColor: '#252520', borderRadius: radius.sm, height: 46, paddingHorizontal: spacing[3], fontFamily: font.sans, fontSize: 16, color: '#F5F5F2', textAlign: 'center' },
  segBtn:     { flex: 1, height: 42, borderRadius: radius.sm, backgroundColor: '#0D0D0B', borderWidth: 1, borderColor: '#252520', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[2] },
  segText:    { fontFamily: font.mono, fontSize: 11, color: '#555', textAlign: 'center' },
  chip:       { paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.full, backgroundColor: '#0D0D0B', borderWidth: 1, borderColor: '#252520' },
  chipActive: { backgroundColor: colors.forest + '22', borderColor: colors.forest },
  chipText:   { fontFamily: font.mono, fontSize: 11, color: '#555' },
  chipTextActive: { color: '#F5F5F2' },
  actRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D0D0B', borderRadius: radius.sm, borderWidth: 1, borderColor: '#252520', paddingHorizontal: spacing[3], paddingVertical: spacing[3], gap: spacing[3], marginBottom: spacing[2] },
  actRowActive: { borderColor: colors.forest + '60', backgroundColor: colors.forest + '10' },
  actLabel:   { fontFamily: font.sans, fontSize: 13, color: '#888', marginBottom: 2 },
  actSub:     { fontFamily: font.mono, fontSize: 10, color: '#444' },
  radio:      { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  radioActive:{ borderColor: colors.forest },
  radioDot:   { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.forest },
  error:      { fontFamily: font.sans, fontSize: 13, color: '#C06848' },
  calcBtn:    { backgroundColor: colors.forest, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  calcBtnText:{ fontFamily: font.sansBd, fontSize: 15, color: '#F5F5F2', letterSpacing: 0.2 },
  resultCard: { backgroundColor: '#0D0D0B', borderRadius: radius.md, borderWidth: 1, borderColor: '#1C1C18', padding: spacing[4] },
  bigResult:  { fontFamily: font.sansBd, fontSize: 36, textAlign: 'center' },
  bigResultSub: { fontFamily: font.mono, fontSize: 11, color: '#555', textAlign: 'center', marginBottom: spacing[2] },
  macroHead:  { fontFamily: font.mono, fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[3] },
  statBox:    { flex: 1, backgroundColor: '#181816', borderRadius: radius.md, padding: spacing[3], alignItems: 'center', gap: 3, borderWidth: 1 },
  statValue:  { fontFamily: font.sansBd, fontSize: 20 },
  statLabel:  { fontFamily: font.mono, fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 0.4 },
  statUnit:   { fontFamily: font.mono, fontSize: 9, color: '#444', textTransform: 'uppercase' },
  statNote:   { fontFamily: font.mono, fontSize: 9, color: '#3D3D3D', textAlign: 'center' },
  pctRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: '#1C1C18' },
  pctBar:     { height: 3, borderRadius: 2, minWidth: 20 },
  pctLabel:   { fontFamily: font.mono, fontSize: 11, color: '#555', width: 36 },
  pctWeight:  { fontFamily: font.sansBd, fontSize: 14, color: '#F5F5F2', flex: 1 },
  pctNote:    { fontFamily: font.mono, fontSize: 10, color: '#444' },
  resultRow:  { paddingVertical: spacing[3] },
  resultRowText: { fontFamily: font.sans, fontSize: 14, color: '#CCCCC8' },
  disclaimer: { fontFamily: font.mono, fontSize: 10, color: '#333', lineHeight: 15, marginTop: spacing[3], textAlign: 'center' },
});

// Timer styles
const tm = StyleSheet.create({
  face:    { backgroundColor: '#0D0D0B', borderRadius: radius.lg, borderWidth: 1, borderColor: '#252520', width: '100%', alignItems: 'center', paddingVertical: spacing[7] },
  digits:  { fontFamily: font.sansBd, fontSize: 56, color: '#F5F5F2', letterSpacing: -2 },
  label:   { fontFamily: font.mono, fontSize: 11, color: '#444', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing[2] },
  track:   { height: 5, width: '100%', backgroundColor: '#1C1C18', borderRadius: 3, overflow: 'hidden' },
  fill:    { height: '100%', borderRadius: 3 },
  btn:     { flex: 1, height: 48, borderRadius: radius.sm, backgroundColor: '#0F1D12', borderWidth: 1, borderColor: '#3D9E6A', alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: font.sansBd, fontSize: 14, color: '#3D9E6A' },
});

// Main screen styles
const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0D0D0B' },
  container: { padding: spacing[4], paddingTop: spacing[8], paddingBottom: spacing[12] },
  eyebrow:   { fontFamily: font.mono, fontSize: 11, color: '#555', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[3] },
  title:     { fontFamily: font.sansBd, fontSize: 34, color: '#F5F5F2', marginBottom: spacing[2] },
  sub:       { fontFamily: font.sans, fontSize: 14, color: '#555', lineHeight: 21, marginBottom: spacing[5] },
});
