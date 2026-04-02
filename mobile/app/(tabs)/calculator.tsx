import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, spacing, radius, font } from '../../src/lib/theme';

type Sex = 'male' | 'female';
type Activity = { label: string; value: number };

const ACTIVITY_LEVELS: Activity[] = [
  { label: 'Sedentary', value: 1.2 },
  { label: 'Light (1–2×/wk)', value: 1.375 },
  { label: 'Moderate (3–5×/wk)', value: 1.55 },
  { label: 'Active (6–7×/wk)', value: 1.725 },
  { label: 'Very active', value: 1.9 },
];

export default function CalculatorScreen() {
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [activity, setActivity] = useState(1.55);
  const [result, setResult] = useState<null | { bmr: number; tdee: number; bf: number; lean: number; protein: number; carbs: number; fat: number }>(null);
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
    const bmi = w / Math.pow(h / 100, 2);
    const bf = Math.max(3, Math.min(60, sex === 'female' ? (1.20 * bmi + 0.23 * a - 5.4) : (1.20 * bmi + 0.23 * a - 16.2)));
    const lean = w * (1 - bf / 100);
    const protein = Math.round(w * 2.0);
    const fat = Math.round((tdee * 0.25) / 9);
    const carbs = Math.round((tdee - protein * 4 - fat * 9) / 4);
    setResult({ bmr: Math.round(bmr), tdee: Math.round(tdee), bf: Math.round(bf), lean: Math.round(lean), protein, carbs, fat });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>// FREE TOOL</Text>
          <Text style={styles.title}>Your numbers.</Text>
          <Text style={styles.sub}>BMR, TDEE, body fat estimate, and macros — instantly.</Text>

          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Age</Text>
              <TextInput style={styles.input} value={age} onChangeText={v => setAge(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="28" placeholderTextColor={colors.ink4} maxLength={3} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput style={styles.input} value={weight} onChangeText={v => setWeight(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="75" placeholderTextColor={colors.ink4} maxLength={6} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput style={styles.input} value={height} onChangeText={v => setHeight(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="175" placeholderTextColor={colors.ink4} maxLength={3} />
            </View>
          </View>

          <Text style={styles.label}>Sex</Text>
          <View style={styles.chips}>
            {(['male', 'female'] as Sex[]).map(s => (
              <TouchableOpacity key={s} style={[styles.chip, sex === s && styles.chipActive]} onPress={() => setSex(s)}>
                <Text style={[styles.chipText, sex === s && styles.chipTextActive]}>{s === 'male' ? 'Male' : 'Female'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: spacing[4] }]}>Activity level</Text>
          <View style={styles.chips}>
            {ACTIVITY_LEVELS.map(al => (
              <TouchableOpacity key={al.value} style={[styles.chip, activity === al.value && styles.chipActive]} onPress={() => setActivity(al.value)}>
                <Text style={[styles.chipText, activity === al.value && styles.chipTextActive]}>{al.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.btn} onPress={calculate}>
            <Text style={styles.btnText}>Calculate</Text>
          </TouchableOpacity>

          {result && (
            <View style={styles.results}>
              <View style={styles.statsGrid}>
                <Stat label="BMR" value={`${result.bmr}`} unit="kcal/day" />
                <Stat label="TDEE" value={`${result.tdee}`} unit="kcal/day" />
                <Stat label="Body fat" value={`${result.bf}%`} unit="estimate" />
                <Stat label="Lean mass" value={`${result.lean}kg`} unit="" />
              </View>
              <Text style={styles.macroHead}>Macros for maintenance</Text>
              <MacroBar label="Protein" grams={result.protein} total={result.tdee} color={colors.forest} calsPerG={4} />
              <MacroBar label="Carbs" grams={result.carbs} total={result.tdee} color={colors.amber} calsPerG={4} />
              <MacroBar label="Fat" grams={result.fat} total={result.tdee} color={colors.ink3} calsPerG={9} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={statStyles.wrap}>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
      {!!unit && <Text style={statStyles.unit}>{unit}</Text>}
    </View>
  );
}
const statStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', padding: spacing[3] },
  value: { fontFamily: font.sansBd, fontSize: 22, color: colors.ink },
  label: { fontFamily: font.mono, fontSize: 10, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  unit: { fontFamily: font.mono, fontSize: 9, color: colors.ink4, textTransform: 'uppercase' },
});

function MacroBar({ label, grams, total, color, calsPerG }: { label: string; grams: number; total: number; color: string; calsPerG: number }) {
  const pct = Math.round(grams * calsPerG / total * 100);
  return (
    <View style={mbStyles.wrap}>
      <View style={mbStyles.row}>
        <Text style={mbStyles.label}>{label}</Text>
        <Text style={mbStyles.grams}>{grams}g · {pct}%</Text>
      </View>
      <View style={mbStyles.track}>
        <View style={[mbStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}
const mbStyles = StyleSheet.create({
  wrap: { marginBottom: spacing[3] },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontFamily: font.sans, fontSize: 13, color: colors.ink },
  grams: { fontFamily: font.mono, fontSize: 12, color: colors.ink3 },
  track: { height: 4, backgroundColor: colors.line, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.parchment },
  container: { padding: spacing[5], paddingTop: spacing[8], paddingBottom: spacing[12] },
  eyebrow: { fontFamily: font.mono, fontSize: 11, color: colors.ink3, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[3] },
  title: { fontFamily: font.sansBd, fontSize: 34, color: colors.ink, marginBottom: spacing[2] },
  sub: { fontFamily: font.sans, fontSize: 15, color: colors.ink2, lineHeight: 22, marginBottom: spacing[6] },
  row: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[4] },
  field: { flex: 1 },
  label: { fontFamily: font.mono, fontSize: 11, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[2] },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line2, borderRadius: radius.sm, height: 44, paddingHorizontal: spacing[3], fontFamily: font.sans, fontSize: 15, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[2] },
  chip: { paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  chipText: { fontFamily: font.mono, fontSize: 11, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.4 },
  chipTextActive: { color: colors.white },
  error: { fontFamily: font.sans, fontSize: 13, color: colors.error, marginBottom: spacing[3] },
  btn: { marginTop: spacing[5], backgroundColor: colors.forest, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: font.sansBd, fontSize: 15, color: colors.white },
  results: { marginTop: spacing[6], backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing[4] },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing[5] },
  macroHead: { fontFamily: font.mono, fontSize: 11, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[3] },
});
