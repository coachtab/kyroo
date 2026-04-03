import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, spacing, radius, font } from '../../src/lib/theme';

type Sex = 'male' | 'female';
type Activity = { label: string; sub: string; value: number };

const ACTIVITY_LEVELS: Activity[] = [
  { label: 'Sedentary',  sub: 'Little or no exercise',      value: 1.2   },
  { label: 'Light',      sub: '1–2× per week',              value: 1.375 },
  { label: 'Moderate',   sub: '3–5× per week',              value: 1.55  },
  { label: 'Active',     sub: '6–7× per week',              value: 1.725 },
  { label: 'Very active',sub: 'Athlete / twice daily',      value: 1.9   },
];

export default function CalculatorScreen() {
  const [age, setAge]       = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [sex, setSex]       = useState<Sex>('male');
  const [activity, setActivity] = useState(1.55);
  const [result, setResult] = useState<null | {
    bmr: number; tdee: number; bf: number; lean: number;
    protein: number; carbs: number; fat: number;
  }>(null);
  const [error, setError] = useState('');

  function calculate() {
    const a = parseInt(age, 10);
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (!a || a < 10 || a > 100) { setError('Age must be between 10 and 100.'); return; }
    if (!w || w < 20 || w > 300) { setError('Weight must be between 20 and 300 kg.'); return; }
    if (!h || h < 100 || h > 250) { setError('Height must be between 100 and 250 cm.'); return; }
    setError('');
    const bmr = sex === 'female'
      ? 10 * w + 6.25 * h - 5 * a - 161
      : 10 * w + 6.25 * h - 5 * a + 5;
    const tdee = bmr * activity;
    const bmi  = w / Math.pow(h / 100, 2);
    const bf   = Math.max(3, Math.min(60,
      sex === 'female' ? (1.20 * bmi + 0.23 * a - 5.4) : (1.20 * bmi + 0.23 * a - 16.2)
    ));
    const lean    = w * (1 - bf / 100);
    const protein = Math.round(w * 2.0);
    const fat     = Math.round((tdee * 0.25) / 9);
    const carbs   = Math.round((tdee - protein * 4 - fat * 9) / 4);
    setResult({ bmr: Math.round(bmr), tdee: Math.round(tdee), bf: Math.round(bf), lean: Math.round(lean * 10) / 10, protein, carbs, fat });
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Header ── */}
          <Text style={s.eyebrow}>// FREE TOOL</Text>
          <Text style={s.title}>Your numbers.</Text>
          <Text style={s.sub}>BMR · TDEE · body fat · macros — calculated instantly.</Text>

          {/* ── Inputs ── */}
          <View style={s.inputRow}>
            <NumInput label="Age" placeholder="28" value={age} onChangeText={v => setAge(v.replace(/[^0-9]/g, ''))} maxLength={3} />
            <NumInput label="Weight (kg)" placeholder="75" value={weight} onChangeText={v => setWeight(v.replace(/[^0-9.]/g, ''))} decimal maxLength={6} />
            <NumInput label="Height (cm)" placeholder="175" value={height} onChangeText={v => setHeight(v.replace(/[^0-9]/g, ''))} maxLength={3} />
          </View>

          {/* ── Sex ── */}
          <Text style={s.fieldLabel}>Biological sex</Text>
          <View style={s.sexRow}>
            {(['male', 'female'] as Sex[]).map(sv => (
              <TouchableOpacity key={sv} style={[s.sexBtn, sex === sv && s.sexBtnActive]} onPress={() => setSex(sv)} activeOpacity={0.75}>
                <Text style={[s.sexBtnText, sex === sv && s.sexBtnTextActive]}>
                  {sv === 'male' ? '♂  Male' : '♀  Female'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Activity ── */}
          <Text style={[s.fieldLabel, { marginTop: spacing[5] }]}>Activity level</Text>
          <View style={s.activityList}>
            {ACTIVITY_LEVELS.map(al => (
              <TouchableOpacity key={al.value} style={[s.activityItem, activity === al.value && s.activityItemActive]} onPress={() => setActivity(al.value)} activeOpacity={0.75}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.activityLabel, activity === al.value && s.activityLabelActive]}>{al.label}</Text>
                  <Text style={s.activitySub}>{al.sub}</Text>
                </View>
                <View style={[s.radio, activity === al.value && s.radioActive]}>
                  {activity === al.value && <View style={s.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {!!error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity style={s.calcBtn} onPress={calculate} activeOpacity={0.85}>
            <Text style={s.calcBtnText}>Calculate</Text>
          </TouchableOpacity>

          {/* ── Results ── */}
          {result && (
            <View style={s.results}>
              <Text style={s.resultsHead}>Your results</Text>

              <View style={s.statsGrid}>
                <BigStat label="BMR" value={result.bmr.toLocaleString()} unit="kcal/day" color="#4A8FC4" />
                <BigStat label="TDEE" value={result.tdee.toLocaleString()} unit="kcal/day" color="#3D9E6A" />
              </View>
              <View style={[s.statsGrid, { marginTop: spacing[3] }]}>
                <SmallStat label="Body fat" value={`${result.bf}%`} note="estimate" />
                <SmallStat label="Lean mass" value={`${result.lean}kg`} note="estimate" />
              </View>

              <View style={s.divider} />

              <Text style={s.macroHead}>Macros · maintenance</Text>
              <MacroRow label="Protein" grams={result.protein} color="#3D9E6A" pct={Math.round(result.protein * 4 / result.tdee * 100)} />
              <MacroRow label="Carbs"   grams={result.carbs}   color="#D4923F" pct={Math.round(result.carbs   * 4 / result.tdee * 100)} />
              <MacroRow label="Fat"     grams={result.fat}     color="#9A6AC8" pct={Math.round(result.fat     * 9 / result.tdee * 100)} />

              <Text style={s.disclaimer}>
                Estimates based on Mifflin-St Jeor (BMR) and Deurenberg (body fat). Individual variation applies.
              </Text>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ─── Sub-components ─── */

function NumInput({ label, placeholder, value, onChangeText, decimal, maxLength }: {
  label: string; placeholder: string; value: string;
  onChangeText: (v: string) => void; decimal?: boolean; maxLength?: number;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={ni.label}>{label}</Text>
      <TextInput
        style={ni.input}
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
const ni = StyleSheet.create({
  label: { fontFamily: font.mono, fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[2] },
  input: { backgroundColor: '#181816', borderWidth: 1, borderColor: '#252520', borderRadius: radius.sm, height: 48, paddingHorizontal: spacing[3], fontFamily: font.sans, fontSize: 16, color: '#F5F5F2', textAlign: 'center' },
});

function BigStat({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <View style={[bs.wrap, { borderColor: color + '30' }]}>
      <Text style={[bs.value, { color }]}>{value}</Text>
      <Text style={bs.label}>{label}</Text>
      <Text style={bs.unit}>{unit}</Text>
    </View>
  );
}
const bs = StyleSheet.create({
  wrap:  { flex: 1, backgroundColor: '#181816', borderRadius: radius.md, padding: spacing[4], alignItems: 'center', gap: 4, borderWidth: 1 },
  value: { fontFamily: font.sansBd, fontSize: 28 },
  label: { fontFamily: font.mono, fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 },
  unit:  { fontFamily: font.mono, fontSize: 9, color: '#444', textTransform: 'uppercase' },
});

function SmallStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <View style={ss.wrap}>
      <Text style={ss.value}>{value}</Text>
      <Text style={ss.label}>{label}</Text>
      <Text style={ss.note}>{note}</Text>
    </View>
  );
}
const ss = StyleSheet.create({
  wrap:  { flex: 1, backgroundColor: '#181816', borderRadius: radius.md, padding: spacing[4], alignItems: 'center', gap: 3, borderWidth: 1, borderColor: '#252520' },
  value: { fontFamily: font.sansBd, fontSize: 20, color: '#CCCCC8' },
  label: { fontFamily: font.mono, fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 },
  note:  { fontFamily: font.mono, fontSize: 9, color: '#333', textTransform: 'uppercase' },
});

function MacroRow({ label, grams, color, pct }: { label: string; grams: number; color: string; pct: number }) {
  return (
    <View style={mr.wrap}>
      <View style={mr.row}>
        <View style={[mr.dot, { backgroundColor: color }]} />
        <Text style={mr.label}>{label}</Text>
        <Text style={mr.grams}>{grams}g</Text>
        <Text style={mr.pct}>{pct}%</Text>
      </View>
      <View style={mr.track}>
        <View style={[mr.fill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}
const mr = StyleSheet.create({
  wrap:   { marginBottom: spacing[4] },
  row:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: 8 },
  dot:    { width: 8, height: 8, borderRadius: 4 },
  label:  { fontFamily: font.sans, fontSize: 14, color: '#CCCCC8', flex: 1 },
  grams:  { fontFamily: font.sansBd, fontSize: 14, color: '#F5F5F2' },
  pct:    { fontFamily: font.mono, fontSize: 11, color: '#555', width: 36, textAlign: 'right' },
  track:  { height: 4, backgroundColor: '#1C1C18', borderRadius: 2, overflow: 'hidden' },
  fill:   { height: '100%', borderRadius: 2 },
});

/* ─── Main styles ─── */
const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0D0D0B' },
  container: { padding: spacing[5], paddingTop: spacing[8], paddingBottom: spacing[12] },

  eyebrow: { fontFamily: font.mono, fontSize: 11, color: '#555', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[3] },
  title:   { fontFamily: font.sansBd, fontSize: 34, color: '#F5F5F2', marginBottom: spacing[2] },
  sub:     { fontFamily: font.sans, fontSize: 14, color: '#555', lineHeight: 21, marginBottom: spacing[6] },

  inputRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] },

  fieldLabel: { fontFamily: font.mono, fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[3] },

  sexRow: { flexDirection: 'row', gap: spacing[3] },
  sexBtn: {
    flex: 1, height: 48, borderRadius: radius.sm,
    backgroundColor: '#181816', borderWidth: 1, borderColor: '#252520',
    alignItems: 'center', justifyContent: 'center',
  },
  sexBtnActive:     { backgroundColor: colors.forest, borderColor: colors.forest },
  sexBtnText:       { fontFamily: font.mono, fontSize: 12, color: '#555', letterSpacing: 0.3 },
  sexBtnTextActive: { color: '#F5F5F2' },

  activityList: { gap: spacing[2] },
  activityItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#181816', borderRadius: radius.sm,
    borderWidth: 1, borderColor: '#252520',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    gap: spacing[3],
  },
  activityItemActive: { borderColor: colors.forest + '60', backgroundColor: colors.forest + '12' },
  activityLabel:       { fontFamily: font.sans, fontSize: 14, color: '#888', marginBottom: 2 },
  activityLabelActive: { color: '#F5F5F2' },
  activitySub:         { fontFamily: font.mono, fontSize: 10, color: '#444' },
  radio:       { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.forest },
  radioDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.forest },

  error:      { fontFamily: font.sans, fontSize: 13, color: '#C06848', marginTop: spacing[4], marginBottom: spacing[2] },

  calcBtn:     { marginTop: spacing[5], backgroundColor: colors.forest, height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  calcBtnText: { fontFamily: font.sansBd, fontSize: 15, color: '#F5F5F2', letterSpacing: 0.3 },

  results:      { marginTop: spacing[7], backgroundColor: '#0F0F0D', borderWidth: 1, borderColor: '#1C1C18', borderRadius: radius.lg, padding: spacing[5] },
  resultsHead:  { fontFamily: font.sansBd, fontSize: 18, color: '#F5F5F2', marginBottom: spacing[5] },
  statsGrid:    { flexDirection: 'row', gap: spacing[3] },
  divider:      { height: 1, backgroundColor: '#1C1C18', marginVertical: spacing[5] },
  macroHead:    { fontFamily: font.mono, fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[4] },
  disclaimer:   { fontFamily: font.mono, fontSize: 10, color: '#333', lineHeight: 15, marginTop: spacing[3], textAlign: 'center' },
});
