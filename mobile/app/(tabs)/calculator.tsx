import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
  Animated,
} from 'react-native';
import { spacing, radius, font, colors } from '../../src/lib/theme';

// ── Tool registry ─────────────────────────────────────────────────────────────
const TOOLS = [
  {
    id: 'calories',
    icon: '🔥',
    title: 'Calories\n& Macros',
    label: 'Calorie & Macro Calculator',
    desc: 'Your daily calorie target + exact protein, carbs and fat split',
    tagline: 'Eat with precision',
    accent: '#C06848',
    bg: '#1A0F09',
  },
  {
    id: 'oneRM',
    icon: '💪',
    title: '1RM Estimator',
    label: '1-Rep Max Estimator',
    desc: 'Turn any set you did into your estimated one-rep max',
    tagline: 'Know your true max',
    accent: '#3D9E6A',
    bg: '#091A0F',
  },
  {
    id: 'pace',
    icon: '🏃',
    title: 'Pace & Race',
    label: 'Pace & Race Calculator',
    desc: 'Convert between pace and finish time for any race distance',
    tagline: 'Run your race',
    accent: '#4A8FAA',
    bg: '#091218',
  },
  {
    id: 'hydration',
    icon: '💧',
    title: 'Hydration Guide',
    label: 'Hydration Guide',
    desc: 'How much water you actually need today',
    tagline: 'Stay dialled in',
    accent: '#5A9FCC',
    bg: '#091318',
  },
  {
    id: 'timer',
    icon: '⏱️',
    title: 'Rest Timer',
    label: 'Rest Timer',
    desc: 'Countdown between sets — tap once, rest, go again',
    tagline: 'Rest smarter',
    accent: '#9A6AC8',
    bg: '#120918',
  },
] as const;

type ToolId = typeof TOOLS[number]['id'];

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ToolsScreen() {
  const [active, setActive] = useState<ToolId | null>(null);

  const tool = TOOLS.find(t => t.id === active);

  if (active && tool) {
    return (
      <ToolScreen
        tool={tool}
        onBack={() => setActive(null)}
      />
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.eyebrow}>FREE · NO ACCOUNT NEEDED</Text>
          <Text style={s.title}>Tools 🛠️</Text>
          <Text style={s.sub}>Fitness calculators built for athletes. No sign-up required.</Text>
        </View>

        {/* ── Cards ── */}
        <View style={s.list}>
          {TOOLS.map(tool => (
            <TouchableOpacity
              key={tool.id}
              style={[s.card, { backgroundColor: tool.bg }]}
              onPress={() => setActive(tool.id)}
              activeOpacity={0.82}
            >
              <View style={[s.iconWrap, { backgroundColor: tool.accent + '25' }]}>
                <Text style={s.iconText}>{tool.icon}</Text>
              </View>

              <View style={s.cardBody}>
                <View style={s.cardTopRow}>
                  <Text style={s.cardName}>{tool.title}</Text>
                  <View style={[s.badge, { borderColor: tool.accent + '50', backgroundColor: tool.accent + '15' }]}>
                    <Text style={[s.badgeText, { color: tool.accent }]}>FREE</Text>
                  </View>
                </View>
                <Text style={s.cardDesc} numberOfLines={2}>{tool.desc}</Text>
                <Text style={[s.cardTagline, { color: tool.accent }]}>{tool.tagline}</Text>
              </View>

              <Text style={[s.arrow, { color: tool.accent }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Full-screen tool shell ────────────────────────────────────────────────────
function ToolScreen({ tool, onBack }: { tool: typeof TOOLS[number]; onBack: () => void }) {
  return (
    <SafeAreaView style={[ts.safe, { backgroundColor: '#0D0D0B' }]}>
      {/* Nav bar */}
      <View style={ts.nav}>
        <TouchableOpacity style={ts.backBtn} onPress={onBack} activeOpacity={0.7} hitSlop={12}>
          <Text style={[ts.backArrow, { color: tool.accent }]}>‹</Text>
          <Text style={[ts.backLabel, { color: tool.accent }]}>Tools</Text>
        </TouchableOpacity>
        <View style={[ts.navBadge, { backgroundColor: tool.accent + '18', borderColor: tool.accent + '40' }]}>
          <Text style={ts.navBadgeIcon}>{tool.icon}</Text>
          <Text style={[ts.navBadgeText, { color: tool.accent }]}>Free tool</Text>
        </View>
      </View>

      {/* Tool header */}
      <View style={[ts.heroBar, { borderBottomColor: tool.accent + '30' }]}>
        <Text style={ts.heroTitle}>{tool.label}</Text>
        <Text style={ts.heroDesc}>{tool.desc}</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={ts.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {tool.id === 'calories'  && <CalorieTool accent={tool.accent} />}
          {tool.id === 'oneRM'     && <OneRMTool accent={tool.accent} />}
          {tool.id === 'pace'      && <PaceTool accent={tool.accent} />}
          {tool.id === 'hydration' && <HydrationTool accent={tool.accent} />}
          {tool.id === 'timer'     && <RestTimer accent={tool.accent} />}
          <View style={{ height: spacing[12] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tool 1: Calorie & Macro Calculator
// ══════════════════════════════════════════════════════════════════════════════
type Sex  = 'male' | 'female';
type Goal = 'lose' | 'maintain' | 'gain';

const ACTIVITY_OPTS = [
  { label: 'Sedentary',    sub: 'Desk job, little movement', value: 1.2   },
  { label: 'Light',        sub: '1–2 workouts / week',       value: 1.375 },
  { label: 'Moderate',     sub: '3–5 workouts / week',       value: 1.55  },
  { label: 'Active',       sub: '6–7 workouts / week',       value: 1.725 },
  { label: 'Athlete',      sub: 'Twice-a-day / elite',       value: 1.9   },
];

const GOAL_OPTS: { id: Goal; label: string; emoji: string; adj: number; color: string }[] = [
  { id: 'lose',     label: 'Lose fat',     emoji: '🔥', adj: -400, color: '#C06848' },
  { id: 'maintain', label: 'Maintain',     emoji: '⚖️', adj: 0,    color: '#3D9E6A' },
  { id: 'gain',     label: 'Build muscle', emoji: '💪', adj: +300, color: '#4A8FAA' },
];

function CalorieTool({ accent }: { accent: string }) {
  const [age, setAge]     = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [sex, setSex]     = useState<Sex>('male');
  const [activity, setActivity] = useState(1.55);
  const [goal, setGoal]   = useState<Goal>('maintain');
  const [result, setResult] = useState<null | { bmr: number; tdee: number; target: number; protein: number; carbs: number; fat: number }>(null);
  const [error, setError] = useState('');

  function calc() {
    const a = parseInt(age); const w = parseFloat(weight); const h = parseFloat(height);
    if (!a || a < 10 || a > 100) { setError('Age must be 10–100'); return; }
    if (!w || w < 20 || w > 300) { setError('Weight must be 20–300 kg'); return; }
    if (!h || h < 100 || h > 250) { setError('Height must be 100–250 cm'); return; }
    setError('');
    const bmr    = sex === 'female' ? (10 * w + 6.25 * h - 5 * a - 161) : (10 * w + 6.25 * h - 5 * a + 5);
    const tdee   = Math.round(bmr * activity);
    const adj    = GOAL_OPTS.find(g => g.id === goal)!.adj;
    const target = tdee + adj;
    const protein = Math.round(w * 2.0);
    const fat     = Math.round((target * 0.25) / 9);
    const carbs   = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4));
    setResult({ bmr: Math.round(bmr), tdee, target, protein, carbs, fat });
  }

  const goalColor = GOAL_OPTS.find(g => g.id === goal)!.color;

  return (
    <View style={f.wrap}>
      {/* Step 1 */}
      <StepLabel n={1} label="Your stats" />
      <View style={f.row3}>
        <Field label="Age" placeholder="28" value={age} onChangeText={v => setAge(v.replace(/\D/g,''))} maxLength={3} />
        <Field label="Weight (kg)" placeholder="75" value={weight} onChangeText={v => setWeight(v.replace(/[^0-9.]/g,''))} decimal maxLength={5} />
        <Field label="Height (cm)" placeholder="175" value={height} onChangeText={v => setHeight(v.replace(/\D/g,''))} maxLength={3} />
      </View>

      {/* Sex */}
      <View style={f.segRow}>
        {(['male','female'] as Sex[]).map(sv => (
          <SegPill key={sv} label={sv === 'male' ? '♂  Male' : '♀  Female'} active={sex === sv} onPress={() => setSex(sv)} accent={accent} />
        ))}
      </View>

      {/* Step 2: Goal */}
      <StepLabel n={2} label="Your goal" />
      <View style={f.goalRow}>
        {GOAL_OPTS.map(g => (
          <TouchableOpacity
            key={g.id}
            style={[f.goalCard, goal === g.id && { borderColor: g.color, backgroundColor: g.color + '15' }]}
            onPress={() => setGoal(g.id)} activeOpacity={0.78}
          >
            <Text style={f.goalEmoji}>{g.emoji}</Text>
            <Text style={[f.goalLabel, goal === g.id && { color: '#F5F5F2' }]}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Step 3: Activity */}
      <StepLabel n={3} label="Activity level" />
      <View style={f.actList}>
        {ACTIVITY_OPTS.map(a => (
          <TouchableOpacity key={a.value} style={[f.actRow, activity === a.value && { borderColor: accent + '60', backgroundColor: accent + '10' }]} onPress={() => setActivity(a.value)} activeOpacity={0.78}>
            <View style={{ flex: 1 }}>
              <Text style={[f.actLabel, activity === a.value && { color: '#F5F5F2' }]}>{a.label}</Text>
              <Text style={f.actSub}>{a.sub}</Text>
            </View>
            <RadioDot active={activity === a.value} accent={accent} />
          </TouchableOpacity>
        ))}
      </View>

      {!!error && <ErrorText>{error}</ErrorText>}

      <BigButton label="Calculate" onPress={calc} accent={accent} />

      {result && (
        <ResultCard>
          {/* Numbers row */}
          <View style={f.statsRow}>
            <NumStat label="BMR" value={result.bmr.toLocaleString()} unit="kcal" color="#888" note="at rest" />
            <NumStat label="TDEE" value={result.tdee.toLocaleString()} unit="kcal" color="#CCCCC8" note="with activity" />
            <NumStat label="Target" value={result.target.toLocaleString()} unit="kcal" color={goalColor} note={goal === 'lose' ? '−400 deficit' : goal === 'gain' ? '+300 surplus' : 'maintenance'} />
          </View>

          <Divider />

          <Label>Daily macros</Label>
          <MacroBar label="Protein" grams={result.protein} pct={Math.round(result.protein * 4 / result.target * 100)} color="#3D9E6A" note="~2g per kg · builds & preserves muscle" />
          <MacroBar label="Carbs"   grams={result.carbs}   pct={Math.round(result.carbs   * 4 / result.target * 100)} color="#D4923F" note="energy · performance · brain fuel" />
          <MacroBar label="Fat"     grams={result.fat}     pct={Math.round(result.fat     * 9 / result.target * 100)} color="#9A6AC8" note="hormones · joint health · recovery" />

          <Hint>Mifflin-St Jeor formula. Adjust by ±100 kcal after 2 weeks of tracking.</Hint>
        </ResultCard>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tool 2: 1RM Estimator
// ══════════════════════════════════════════════════════════════════════════════
const LIFTS = ['Squat', 'Bench', 'Deadlift', 'OHP', 'Row', 'Other'];

function OneRMTool({ accent }: { accent: string }) {
  const [lift, setLift]     = useState('Squat');
  const [weight, setWeight] = useState('');
  const [reps, setReps]     = useState('');
  const [result, setResult] = useState<null | { max: number; table: { pct: number; kg: number; reps: string }[] }>(null);
  const [error, setError]   = useState('');

  function calc() {
    const w = parseFloat(weight); const r = parseInt(reps);
    if (!w || w <= 0)           { setError('Enter a weight greater than 0 kg'); return; }
    if (!r || r < 1 || r > 30) { setError('Enter reps between 1 and 30'); return; }
    setError('');
    const max = r === 1 ? w : Math.round(w * (1 + r / 30));
    const table = [
      { pct: 100, reps: '1 rep' },
      { pct: 95,  reps: '2–3 reps' },
      { pct: 90,  reps: '3–4 reps' },
      { pct: 85,  reps: '4–6 reps' },
      { pct: 80,  reps: '6–8 reps' },
      { pct: 75,  reps: '8–10 reps' },
      { pct: 70,  reps: '10–12 reps' },
      { pct: 65,  reps: '12–15 reps' },
    ].map(row => ({ ...row, kg: Math.round(max * row.pct / 100) }));
    setResult({ max, table });
  }

  return (
    <View style={f.wrap}>
      <StepLabel n={1} label="Choose your exercise" />
      <View style={f.chipRow}>
        {LIFTS.map(l => (
          <Chip key={l} label={l} active={lift === l} onPress={() => setLift(l)} accent={accent} />
        ))}
      </View>

      <StepLabel n={2} label="The set you did" />
      <View style={f.row2}>
        <Field label="Weight lifted (kg)" placeholder="100" value={weight} onChangeText={v => setWeight(v.replace(/[^0-9.]/g,''))} decimal maxLength={6} />
        <Field label="Reps completed" placeholder="5" value={reps} onChangeText={v => setReps(v.replace(/\D/g,''))} maxLength={2} />
      </View>

      {!!error && <ErrorText>{error}</ErrorText>}
      <BigButton label={`Estimate ${lift} 1RM`} onPress={calc} accent={accent} />

      {result && (
        <ResultCard>
          <View style={f.rmHero}>
            <Text style={[f.rmBig, { color: accent }]}>{result.max}</Text>
            <Text style={f.rmUnit}>kg</Text>
          </View>
          <Text style={f.rmSub}>estimated 1-rep max · {lift}</Text>

          <Divider />
          <Label>Training weights</Label>

          {result.table.map(({ pct, kg, reps: r }) => {
            const highlight = pct >= 90;
            return (
              <View key={pct} style={[f.pctRow, highlight && { backgroundColor: accent + '0C' }]}>
                <View style={[f.pctDot, { backgroundColor: highlight ? accent : '#333' }]} />
                <Text style={f.pctPct}>{pct}%</Text>
                <Text style={[f.pctKg, highlight && { color: '#F5F5F2' }]}>{kg} kg</Text>
                <Text style={f.pctReps}>{r}</Text>
              </View>
            );
          })}
          <Hint>Epley formula. Always warm up before attempting heavy singles.</Hint>
        </ResultCard>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tool 3: Pace & Race Calculator
// ══════════════════════════════════════════════════════════════════════════════
const DIST_OPTS = [
  { label: '1 km',   km: 1 },
  { label: '5 km',   km: 5 },
  { label: '10 km',  km: 10 },
  { label: '½ Mar',  km: 21.0975 },
  { label: 'Full',   km: 42.195 },
  { label: 'Custom', km: 0 },
];

type PaceMode = 'pace→time' | 'time→pace';

function PaceTool({ accent }: { accent: string }) {
  const [mode, setMode]       = useState<PaceMode>('pace→time');
  const [distIdx, setDistIdx] = useState(1);
  const [customKm, setCustomKm] = useState('');
  const [pm, setPm]           = useState('');
  const [ps, setPs]           = useState('');
  const [th, setTh]           = useState('');
  const [tm, setTm]           = useState('');
  const [tsec, setTsec]       = useState('');
  const [result, setResult]   = useState<null | { headline: string; lines: string[] }>(null);
  const [error, setError]     = useState('');

  const dist = DIST_OPTS[distIdx].km || parseFloat(customKm) || 0;

  function calc() {
    setError('');
    if (!dist || dist <= 0) { setError('Choose or enter a valid distance'); return; }
    if (mode === 'pace→time') {
      const pMin = parseInt(pm) || 0; const pSec = parseInt(ps) || 0;
      if (!pMin && !pSec) { setError('Enter your pace — e.g. 5 min 30 sec per km'); return; }
      const paceS = pMin * 60 + pSec;
      const total = paceS * dist;
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = Math.round(total % 60);
      setResult({
        headline: h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`,
        lines: [
          `Distance  ${dist % 1 === 0 ? dist : dist.toFixed(2)} km`,
          `Pace      ${pMin}:${String(pSec).padStart(2,'0')} /km`,
          `Speed     ${(dist / (total / 3600)).toFixed(1)} km/h`,
        ],
      });
    } else {
      const tH = parseInt(th) || 0; const tM = parseInt(tm) || 0; const tS = parseInt(tsec) || 0;
      const total = tH * 3600 + tM * 60 + tS;
      if (!total) { setError('Enter your finish time'); return; }
      const paceS = total / dist;
      const pMin  = Math.floor(paceS / 60);
      const pSec  = Math.round(paceS % 60);
      setResult({
        headline: `${pMin}:${String(pSec).padStart(2,'0')} /km`,
        lines: [
          `Distance  ${dist % 1 === 0 ? dist : dist.toFixed(2)} km`,
          `Time      ${tH > 0 ? tH + 'h ' : ''}${tM}m ${tS}s`,
          `Speed     ${(dist / (total / 3600)).toFixed(1)} km/h`,
        ],
      });
    }
  }

  return (
    <View style={f.wrap}>
      {/* Mode */}
      <StepLabel n={1} label="What do you want to calculate?" />
      <View style={f.row2}>
        <SegPill label="Finish time" active={mode === 'pace→time'} onPress={() => { setMode('pace→time'); setResult(null); }} accent={accent} />
        <SegPill label="My pace" active={mode === 'time→pace'} onPress={() => { setMode('time→pace'); setResult(null); }} accent={accent} />
      </View>

      {/* Distance */}
      <StepLabel n={2} label="Race distance" />
      <View style={f.chipRow}>
        {DIST_OPTS.map((d, i) => (
          <Chip key={d.label} label={d.label} active={distIdx === i} onPress={() => setDistIdx(i)} accent={accent} />
        ))}
      </View>
      {distIdx === DIST_OPTS.length - 1 && (
        <Field label="Distance (km)" placeholder="15" value={customKm} onChangeText={v => setCustomKm(v.replace(/[^0-9.]/g,''))} decimal maxLength={6} />
      )}

      {/* Inputs */}
      <StepLabel n={3} label={mode === 'pace→time' ? 'Your pace per km' : 'Your finish time'} />
      {mode === 'pace→time' ? (
        <View style={f.row2}>
          <Field label="Minutes" placeholder="5" value={pm} onChangeText={v => setPm(v.replace(/\D/g,''))} maxLength={2} />
          <Field label="Seconds" placeholder="30" value={ps} onChangeText={v => setPs(v.replace(/\D/g,''))} maxLength={2} />
        </View>
      ) : (
        <View style={f.row3}>
          <Field label="Hours" placeholder="0" value={th} onChangeText={v => setTh(v.replace(/\D/g,''))} maxLength={2} />
          <Field label="Minutes" placeholder="25" value={tm} onChangeText={v => setTm(v.replace(/\D/g,''))} maxLength={2} />
          <Field label="Seconds" placeholder="00" value={tsec} onChangeText={v => setTsec(v.replace(/\D/g,''))} maxLength={2} />
        </View>
      )}

      {!!error && <ErrorText>{error}</ErrorText>}
      <BigButton label="Calculate" onPress={calc} accent={accent} />

      {result && (
        <ResultCard>
          <Text style={[f.paceHeadline, { color: accent }]}>{result.headline}</Text>
          <Text style={f.paceSub}>{mode === 'pace→time' ? 'estimated finish time' : 'required pace'}</Text>
          <Divider />
          {result.lines.map((line, i) => (
            <View key={i} style={f.paceRow}>
              <Text style={f.paceRowText}>{line}</Text>
            </View>
          ))}
        </ResultCard>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tool 4: Hydration Guide
// ══════════════════════════════════════════════════════════════════════════════
const HEAT_OPTS  = [
  { label: '❄️ Cool / indoors', factor: 0 },
  { label: '🌤 Warm outdoors',  factor: 0.3 },
  { label: '🌡 Hot & humid',    factor: 0.6 },
];
const SWEAT_OPTS = [
  { label: "Barely sweat",    factor: 0 },
  { label: 'Average sweater', factor: 0.3 },
  { label: 'Heavy sweater',   factor: 0.6 },
];

function HydrationTool({ accent }: { accent: string }) {
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState(1.55);
  const [heat, setHeat]     = useState(0);
  const [sweat, setSweat]   = useState(0);
  const [result, setResult] = useState<null | { total: number; training: number; tips: string[] }>(null);
  const [error, setError]   = useState('');

  function calc() {
    const w = parseFloat(weight);
    if (!w || w < 20 || w > 300) { setError('Enter weight between 20 and 300 kg'); return; }
    setError('');
    const base   = w * 0.033;
    const actAdj = activity >= 1.725 ? 0.8 : activity >= 1.55 ? 0.5 : activity >= 1.375 ? 0.3 : 0;
    const total  = +(base + actAdj + heat + sweat).toFixed(1);
    const training = Math.max(0, +(actAdj + heat * 0.5 + sweat * 0.5).toFixed(1));
    const glassML = Math.round(total * 1000 / 8);
    const tips = [
      `${glassML} ml per glass · spread across 8 drinks through the day`,
      `Drink 400–500 ml in the 2 hours before any workout`,
      `Sip ${Math.round(training * 1000 / 4)} ml every 15 min during training`,
      `After training: for every 1 kg lost in sweat, drink 1.5 L to rehydrate`,
      `Check your urine — pale yellow = hydrated · dark yellow = drink more now`,
    ];
    setResult({ total, training, tips });
  }

  return (
    <View style={f.wrap}>
      <StepLabel n={1} label="Your weight" />
      <Field label="Weight (kg)" placeholder="75" value={weight} onChangeText={v => setWeight(v.replace(/[^0-9.]/g,''))} decimal maxLength={5} />

      <StepLabel n={2} label="Activity level" />
      <View style={f.actList}>
        {ACTIVITY_OPTS.map(a => (
          <TouchableOpacity key={a.value} style={[f.actRow, activity === a.value && { borderColor: accent + '60', backgroundColor: accent + '10' }]} onPress={() => setActivity(a.value)} activeOpacity={0.78}>
            <View style={{ flex: 1 }}>
              <Text style={[f.actLabel, activity === a.value && { color: '#F5F5F2' }]}>{a.label}</Text>
              <Text style={f.actSub}>{a.sub}</Text>
            </View>
            <RadioDot active={activity === a.value} accent={accent} />
          </TouchableOpacity>
        ))}
      </View>

      <StepLabel n={3} label="Your environment today" />
      <View style={f.actList}>
        {HEAT_OPTS.map(h => (
          <TouchableOpacity key={h.label} style={[f.actRow, heat === h.factor && { borderColor: accent + '60', backgroundColor: accent + '10' }]} onPress={() => setHeat(h.factor)} activeOpacity={0.78}>
            <Text style={[f.actLabel, heat === h.factor && { color: '#F5F5F2' }]}>{h.label}</Text>
            <RadioDot active={heat === h.factor} accent={accent} />
          </TouchableOpacity>
        ))}
      </View>

      <StepLabel n={4} label="How much do you sweat?" />
      <View style={f.actList}>
        {SWEAT_OPTS.map(sw => (
          <TouchableOpacity key={sw.label} style={[f.actRow, sweat === sw.factor && { borderColor: accent + '60', backgroundColor: accent + '10' }]} onPress={() => setSweat(sw.factor)} activeOpacity={0.78}>
            <Text style={[f.actLabel, sweat === sw.factor && { color: '#F5F5F2' }]}>{sw.label}</Text>
            <RadioDot active={sweat === sw.factor} accent={accent} />
          </TouchableOpacity>
        ))}
      </View>

      {!!error && <ErrorText>{error}</ErrorText>}
      <BigButton label="Calculate water intake" onPress={calc} accent={accent} />

      {result && (
        <ResultCard>
          <View style={f.hydRow}>
            <View style={f.hydStat}>
              <Text style={[f.hydBig, { color: accent }]}>{result.total}L</Text>
              <Text style={f.hydLabel}>daily total</Text>
            </View>
            {result.training > 0 && (
              <View style={f.hydStat}>
                <Text style={[f.hydBig, { color: '#3D9E6A' }]}>+{result.training}L</Text>
                <Text style={f.hydLabel}>extra on training days</Text>
              </View>
            )}
          </View>
          <Divider />
          <Label>Your hydration guide</Label>
          {result.tips.map((tip, i) => (
            <View key={i} style={f.tipRow}>
              <Text style={[f.tipDot, { color: accent }]}>·</Text>
              <Text style={f.tipText}>{tip}</Text>
            </View>
          ))}
          <Hint>Based on 33 ml/kg with activity, heat and sweat adjustments.</Hint>
        </ResultCard>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tool 5: Rest Timer
// ══════════════════════════════════════════════════════════════════════════════
const TIMER_PRESETS = [
  { label: '30 sec', secs: 30 },
  { label: '45 sec', secs: 45 },
  { label: '1 min',  secs: 60 },
  { label: '90 sec', secs: 90 },
  { label: '2 min',  secs: 120 },
  { label: '3 min',  secs: 180 },
  { label: '5 min',  secs: 300 },
];

function RestTimer({ accent }: { accent: string }) {
  const [preset, setPreset]       = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [running, setRunning]     = useState(false);
  const [done, setDone]           = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringAnim    = useRef(new Animated.Value(1)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;

  // Pulse when done
  useEffect(() => {
    if (done) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [done]);

  useEffect(() => {
    reset(preset);
  }, [preset]);

  function reset(p = preset) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false); setDone(false); setRemaining(p);
    ringAnim.setValue(1);
  }

  function start() {
    setDone(false); setRunning(true);
    Animated.timing(ringAnim, { toValue: 0, duration: remaining * 1000, useNativeDriver: false }).start();
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false); setDone(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }

  function pause() {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    ringAnim.stopAnimation();
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const m  = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const ringColor = done ? '#3D9E6A' : remaining <= 10 && running ? '#C06848' : accent;
  const bgColor   = done ? '#0A1A0F' : '#0D0D0B';
  const pct = remaining / preset;

  return (
    <View style={f.wrap}>
      {/* Preset pills */}
      <StepLabel n={1} label="Rest duration" />
      <View style={f.chipRow}>
        {TIMER_PRESETS.map(p => (
          <Chip key={p.secs} label={p.label} active={preset === p.secs} onPress={() => !running && setPreset(p.secs)} accent={accent} />
        ))}
      </View>

      {/* Timer face */}
      <Animated.View style={[tm.face, { backgroundColor: bgColor, transform: [{ scale: pulseAnim }] }]}>
        <View style={tm.ringWrap}>
          {/* Background ring */}
          <View style={[tm.ring, { borderColor: '#1C1C18' }]} />
          {/* Progress arc via conic-style fill (simplified as border) */}
          <Animated.View style={[tm.ring, {
            borderColor: ringAnim.interpolate({ inputRange: [0, 1], outputRange: ['#1C1C18', ringColor] }),
            borderTopColor: ringColor,
            borderRightColor: ringColor,
            opacity: ringAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.8, 1] }),
          }]} />
        </View>
        <Text style={[tm.digits, { color: done ? '#3D9E6A' : '#F5F5F2' }]}>
          {done ? '✓' : `${m}:${String(ss).padStart(2, '0')}`}
        </Text>
        <Text style={[tm.state, { color: done ? '#3D9E6A' : running ? ringColor : '#444' }]}>
          {done ? 'Rest complete — go!' : running ? 'resting…' : 'tap to start'}
        </Text>
      </Animated.View>

      {/* Bar */}
      <View style={tm.track}>
        <Animated.View style={[tm.fill, {
          width: ringAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: ringColor,
        }]} />
      </View>

      {/* Buttons */}
      <View style={tm.btnRow}>
        <TouchableOpacity
          style={[tm.btn, tm.btnPrimary, { borderColor: running ? '#C06848' : accent, backgroundColor: running ? '#C0684815' : accent + '18' }]}
          onPress={() => done ? reset() : running ? pause() : start()}
          activeOpacity={0.82}
        >
          <Text style={[tm.btnLabel, { color: running ? '#C06848' : done ? '#3D9E6A' : accent }]}>
            {done ? '↺  Reset' : running ? '⏸  Pause' : '▶  Start'}
          </Text>
        </TouchableOpacity>
        {!done && (
          <TouchableOpacity style={[tm.btn, tm.btnSecondary]} onPress={() => reset()} activeOpacity={0.8}>
            <Text style={tm.btnSecLabel}>↺</Text>
          </TouchableOpacity>
        )}
      </View>

      <Hint>Timer runs while this screen is open. Preset changes reset the timer.</Hint>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Shared sub-components
// ══════════════════════════════════════════════════════════════════════════════
function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <View style={sh.stepWrap}>
      <View style={sh.stepNum}><Text style={sh.stepNumText}>{n}</Text></View>
      <Text style={sh.stepLabel}>{label}</Text>
    </View>
  );
}

function Field({ label, placeholder, value, onChangeText, decimal, maxLength }: {
  label: string; placeholder: string; value: string;
  onChangeText: (v: string) => void; decimal?: boolean; maxLength?: number;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={sh.fieldLabel}>{label}</Text>
      <TextInput
        style={sh.input}
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

function SegPill({ label, active, onPress, accent }: { label: string; active: boolean; onPress: () => void; accent: string }) {
  return (
    <TouchableOpacity
      style={[sh.segPill, active && { backgroundColor: accent + '18', borderColor: accent }]}
      onPress={onPress} activeOpacity={0.78}
    >
      <Text style={[sh.segPillText, active && { color: '#F5F5F2' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Chip({ label, active, onPress, accent }: { label: string; active: boolean; onPress: () => void; accent: string }) {
  return (
    <TouchableOpacity
      style={[sh.chip, active && { backgroundColor: accent + '18', borderColor: accent }]}
      onPress={onPress} activeOpacity={0.78}
    >
      <Text style={[sh.chipText, active && { color: '#F5F5F2' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function RadioDot({ active, accent }: { active: boolean; accent: string }) {
  return (
    <View style={[sh.radio, active && { borderColor: accent }]}>
      {active && <View style={[sh.radioDot, { backgroundColor: accent }]} />}
    </View>
  );
}

function BigButton({ label, onPress, accent }: { label: string; onPress: () => void; accent: string }) {
  return (
    <TouchableOpacity style={[sh.bigBtn, { backgroundColor: accent }]} onPress={onPress} activeOpacity={0.85}>
      <Text style={sh.bigBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function ResultCard({ children }: { children: React.ReactNode }) {
  return <View style={sh.resultCard}>{children}</View>;
}

function Divider() {
  return <View style={sh.divider} />;
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={sh.label}>{children as string}</Text>;
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <Text style={sh.error}>{children as string}</Text>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <Text style={sh.hint}>{children as string}</Text>;
}

function NumStat({ label, value, unit, color, note }: { label: string; value: string; unit: string; color: string; note: string }) {
  return (
    <View style={sh.numStat}>
      <Text style={[sh.numStatVal, { color }]}>{value}</Text>
      <Text style={sh.numStatLabel}>{label}</Text>
      <Text style={sh.numStatUnit}>{unit}</Text>
      <Text style={sh.numStatNote}>{note}</Text>
    </View>
  );
}

function MacroBar({ label, grams, pct, color, note }: { label: string; grams: number; pct: number; color: string; note: string }) {
  return (
    <View style={{ marginBottom: spacing[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: 5 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ fontFamily: font.sans, fontSize: 14, color: '#CCCCC8', flex: 1 }}>{label}</Text>
        <Text style={{ fontFamily: font.sansBd, fontSize: 15, color: '#F5F5F2' }}>{grams}g</Text>
        <Text style={{ fontFamily: font.mono, fontSize: 11, color: '#555', width: 34, textAlign: 'right' }}>{pct}%</Text>
      </View>
      <View style={{ height: 5, backgroundColor: '#1C1C18', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
        <View style={{ height: '100%', width: `${Math.min(pct, 100)}%` as any, backgroundColor: color, borderRadius: 3 }} />
      </View>
      <Text style={{ fontFamily: font.mono, fontSize: 10, color: '#444' }}>{note}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// Grid screen
const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0D0D0B' },
  container: { paddingBottom: spacing[12] },

  header: {
    backgroundColor: '#0D0D0B',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[5],
  },
  eyebrow:  { fontFamily: font.mono, fontSize: 11, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing[2] },
  title:    { fontFamily: font.sansBd, fontSize: 30, color: '#F5F5F2', lineHeight: 36, marginBottom: spacing[2] },
  sub:      { fontFamily: font.sans, fontSize: 13, color: '#555', lineHeight: 20 },

  list: { padding: spacing[4], gap: spacing[3] },

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
  badge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full, borderWidth: 1,
  },
  badgeText:   { fontFamily: font.mono, fontSize: 9, letterSpacing: 0.5 },
  cardDesc:    { fontFamily: font.sans, fontSize: 13, color: '#666', lineHeight: 18 },
  cardTagline: { fontFamily: font.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  arrow:       { fontSize: 28, flexShrink: 0, opacity: 0.5 },
});

// Tool shell
const ts = StyleSheet.create({
  safe:     { flex: 1 },
  nav:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: '#1C1C18' },
  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backArrow:{ fontFamily: font.sansBd, fontSize: 22 },
  backLabel:{ fontFamily: font.sans, fontSize: 16 },
  navBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: spacing[3], paddingVertical: 5 },
  navBadgeIcon: { fontSize: 13 },
  navBadgeText: { fontFamily: font.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroBar:  { paddingHorizontal: spacing[5], paddingVertical: spacing[4], borderBottomWidth: 1 },
  heroTitle:{ fontFamily: font.sansBd, fontSize: 22, color: '#F5F5F2', marginBottom: 4 },
  heroDesc: { fontFamily: font.sans, fontSize: 13, color: '#555', lineHeight: 18 },
  scroll:   { padding: spacing[4] },
});

// Field form
const f = StyleSheet.create({
  wrap:     { gap: spacing[5] },
  row2:     { flexDirection: 'row', gap: spacing[3] },
  row3:     { flexDirection: 'row', gap: spacing[2] },
  segRow:   { flexDirection: 'row', gap: spacing[3] },
  chipRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  goalRow:  { flexDirection: 'row', gap: spacing[3] },
  goalCard: { flex: 1, backgroundColor: '#181816', borderRadius: radius.md, borderWidth: 1.5, borderColor: '#252520', padding: spacing[3], alignItems: 'center', gap: spacing[2] },
  goalEmoji:{ fontSize: 22 },
  goalLabel:{ fontFamily: font.mono, fontSize: 11, color: '#555', textAlign: 'center' },
  actList:  { gap: spacing[2] },
  actRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#181816', borderRadius: radius.md, borderWidth: 1, borderColor: '#252520', paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3] },
  actLabel: { fontFamily: font.sans, fontSize: 14, color: '#888', marginBottom: 2 },
  actSub:   { fontFamily: font.mono, fontSize: 10, color: '#444' },
  statsRow: { flexDirection: 'row', gap: spacing[2] },

  // 1RM
  rmHero:   { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[4] },
  rmBig:    { fontFamily: font.sansBd, fontSize: 60, lineHeight: 64 },
  rmUnit:   { fontFamily: font.mono, fontSize: 18, color: '#555', alignSelf: 'flex-end', marginBottom: spacing[3] },
  rmSub:    { fontFamily: font.mono, fontSize: 11, color: '#444', textAlign: 'center', marginTop: -spacing[2], marginBottom: spacing[2] },
  pctRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: '#1C1C18', borderRadius: 4, paddingHorizontal: spacing[2] },
  pctDot:   { width: 8, height: 8, borderRadius: 4 },
  pctPct:   { fontFamily: font.mono, fontSize: 11, color: '#444', width: 40 },
  pctKg:    { fontFamily: font.sansBd, fontSize: 16, color: '#888', flex: 1 },
  pctReps:  { fontFamily: font.mono, fontSize: 11, color: '#444' },

  // Pace
  paceHeadline: { fontFamily: font.sansBd, fontSize: 42, textAlign: 'center', marginTop: spacing[2] },
  paceSub:      { fontFamily: font.mono, fontSize: 11, color: '#444', textAlign: 'center', marginBottom: spacing[2] },
  paceRow:      { paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: '#1C1C18' },
  paceRowText:  { fontFamily: font.mono, fontSize: 13, color: '#888' },

  // Hydration
  hydRow:   { flexDirection: 'row', gap: spacing[4], paddingVertical: spacing[3] },
  hydStat:  { flex: 1, alignItems: 'center' },
  hydBig:   { fontFamily: font.sansBd, fontSize: 40 },
  hydLabel: { fontFamily: font.mono, fontSize: 10, color: '#444', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.4 },
  tipRow:   { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2] },
  tipDot:   { fontFamily: font.sansBd, fontSize: 18, lineHeight: 22 },
  tipText:  { fontFamily: font.sans, fontSize: 13, color: '#888', lineHeight: 20, flex: 1 },
});

// Shared components
const sh = StyleSheet.create({
  stepWrap:     { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: -spacing[2] },
  stepNum:      { width: 22, height: 22, borderRadius: 11, backgroundColor: '#252520', alignItems: 'center', justifyContent: 'center' },
  stepNumText:  { fontFamily: font.monoMd, fontSize: 11, color: '#888' },
  stepLabel:    { fontFamily: font.sansBd, fontSize: 13, color: '#CCCCC8' },

  fieldLabel:   { fontFamily: font.mono, fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[2] },
  input:        { backgroundColor: '#181816', borderWidth: 1, borderColor: '#252520', borderRadius: radius.md, height: 52, paddingHorizontal: spacing[3], fontFamily: font.sans, fontSize: 18, color: '#F5F5F2', textAlign: 'center' },

  segPill:      { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: '#181816', borderWidth: 1.5, borderColor: '#252520', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[2] },
  segPillText:  { fontFamily: font.mono, fontSize: 12, color: '#555', textAlign: 'center' },

  chip:         { paddingHorizontal: spacing[3], paddingVertical: 9, borderRadius: radius.full, backgroundColor: '#181816', borderWidth: 1, borderColor: '#252520' },
  chipText:     { fontFamily: font.mono, fontSize: 11, color: '#555' },

  radio:        { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  radioDot:     { width: 10, height: 10, borderRadius: 5 },

  bigBtn:       { height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing[2] },
  bigBtnText:   { fontFamily: font.sansBd, fontSize: 16, color: '#F5F5F2', letterSpacing: 0.2 },

  resultCard:   { backgroundColor: '#0F0F0D', borderRadius: radius.lg, borderWidth: 1, borderColor: '#1C1C18', padding: spacing[4], gap: spacing[1] },
  divider:      { height: 1, backgroundColor: '#1C1C18', marginVertical: spacing[3] },
  label:        { fontFamily: font.mono, fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing[2] },
  error:        { fontFamily: font.sans, fontSize: 13, color: '#C06848' },
  hint:         { fontFamily: font.mono, fontSize: 10, color: '#2A2A28', lineHeight: 15, textAlign: 'center', marginTop: spacing[2] },

  numStat:      { flex: 1, alignItems: 'center', gap: 3 },
  numStatVal:   { fontFamily: font.sansBd, fontSize: 22 },
  numStatLabel: { fontFamily: font.mono, fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: 0.5 },
  numStatUnit:  { fontFamily: font.mono, fontSize: 9, color: '#333', textTransform: 'uppercase' },
  numStatNote:  { fontFamily: font.mono, fontSize: 9, color: '#2A2A28', textAlign: 'center' },
});

// Timer
const tm = StyleSheet.create({
  face:    { borderRadius: radius.lg, borderWidth: 1, borderColor: '#1C1C18', alignItems: 'center', paddingVertical: spacing[10], paddingHorizontal: spacing[4], position: 'relative' },
  ringWrap:{ position: 'absolute', top: 16, right: 16, width: 48, height: 48 },
  ring:    { position: 'absolute', width: 48, height: 48, borderRadius: 24, borderWidth: 3 },
  digits:  { fontFamily: font.sansBd, fontSize: 64, letterSpacing: -2 },
  state:   { fontFamily: font.mono, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing[2] },
  track:   { height: 5, backgroundColor: '#1C1C18', borderRadius: 3, overflow: 'hidden', marginTop: spacing[3] },
  fill:    { height: '100%', borderRadius: 3 },
  btnRow:  { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  btn:     { height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  btnPrimary:  { flex: 3 },
  btnSecondary:{ flex: 1, backgroundColor: '#181816', borderColor: '#252520' },
  btnLabel:    { fontFamily: font.sansBd, fontSize: 16 },
  btnSecLabel: { fontFamily: font.sansBd, fontSize: 18, color: '#555' },
});
