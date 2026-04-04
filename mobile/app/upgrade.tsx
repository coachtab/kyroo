import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Linking, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, font } from '../src/lib/theme';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch } from '../src/lib/api';

type Plan = 'monthly' | 'yearly';

const PLANS: Record<Plan, { label: string; price: string; per: string; sub: string; badge: string | null; savings: string | null }> = {
  yearly: {
    label: 'Annual',
    price: '€72',
    per: '/year',
    sub: '€6 per month',
    badge: 'BEST VALUE',
    savings: 'Save 2 months',
  },
  monthly: {
    label: 'Monthly',
    price: '€6',
    per: '/month',
    sub: 'Billed monthly',
    badge: null,
    savings: null,
  },
};

const FEATURES = [
  { icon: '⚡', label: 'All programs', desc: 'Every AI fitness program unlocked' },
  { icon: '🧬', label: 'Personalised plans', desc: 'Built around your body and goals' },
  { icon: '⚡', label: '5 AI plans per month', desc: 'Generate up to 5 personalised plans monthly' },
  { icon: '📋', label: 'Saved plan history', desc: 'Every plan stored in your profile' },
  { icon: '🧮', label: 'Full calculator', desc: 'BMR, TDEE, macros and more' },
  { icon: '🎯', label: 'Priority AI', desc: 'Faster, more detailed responses' },
];

export default function UpgradeScreen() {
  const router    = useRouter();
  const { user, isPremium, refresh } = useAuth();
  const [selected, setSelected] = useState<Plan>('yearly');
  const [loading, setLoading]   = useState(false);

  async function handleUpgrade() {
    if (!user) { router.push('/auth'); return; }
    setLoading(true);
    try {
      const res  = await apiFetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ plan: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start checkout.');
      await Linking.openURL(data.url);
    } catch (err: any) {
      Alert.alert('Payment error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    setLoading(true);
    try {
      await refresh();
      if (isPremium) {
        Alert.alert('Active subscription found', 'Your Pro access is already active.', [
          { text: "Let's go", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(
          'No active subscription',
          'We could not find a completed payment. If you paid recently, wait a minute and try again. Contact support@kyroo.de if the problem persists.',
          [{ text: 'OK' }]
        );
      }
    } catch {
      Alert.alert('Error', 'Could not reach the server. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  // Already premium — show active state
  if (isPremium) {
    return (
      <SafeAreaView style={s.safe}>
        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()} hitSlop={12}>
          <Text style={s.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={s.activeWrap}>
          <View style={s.activeIcon}><Text style={{ fontSize: 36 }}>✦</Text></View>
          <Text style={s.activeTitle}>You're on Premium</Text>
          <Text style={s.activeSub}>You have full access to every program. Up to 5 AI-generated plans per month.</Text>
          <TouchableOpacity style={s.activeBtn} onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={s.activeBtnText}>Back to app</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()} hitSlop={12}>
          <Text style={s.closeBtnText}>✕</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroMark}><Text style={s.heroMarkText}>✦</Text></View>
          <Text style={s.eyebrow}>// KYROO PREMIUM</Text>
          <Text style={s.title}>Unlock your full{'\n'}potential.</Text>
          <Text style={s.sub}>AI-powered programs personalised to your goals, body, and schedule.</Text>
        </View>

        {/* Feature list */}
        <View style={s.featureCard}>
          {FEATURES.map((f, i) => (
            <View key={i} style={[s.featureRow, i < FEATURES.length - 1 && s.featureRowBorder]}>
              <View style={s.featureIconWrap}>
                <Text style={s.featureIcon}>{f.icon}</Text>
              </View>
              <View style={s.featureBody}>
                <Text style={s.featureLabel}>{f.label}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </View>
              <Text style={s.featureCheck}>✓</Text>
            </View>
          ))}
        </View>

        {/* Plan picker */}
        <View style={s.plans}>
          {(Object.keys(PLANS) as Plan[]).map(key => {
            const plan   = PLANS[key];
            const active = selected === key;
            return (
              <TouchableOpacity
                key={key}
                style={[s.plan, active && s.planActive]}
                onPress={() => setSelected(key)}
                activeOpacity={0.8}
              >
                {plan.badge && (
                  <View style={s.planBadge}>
                    <Text style={s.planBadgeText}>{plan.badge}</Text>
                  </View>
                )}
                <View style={s.planRow}>
                  <View style={[s.radio, active && s.radioActive]}>
                    {active && <View style={s.radioDot} />}
                  </View>
                  <View style={s.planInfo}>
                    <Text style={[s.planLabel, active && s.planLabelActive]}>{plan.label}</Text>
                    <Text style={s.planSub}>{plan.sub}</Text>
                    {plan.savings && <Text style={s.planSavings}>{plan.savings}</Text>}
                  </View>
                  <View style={s.planPriceWrap}>
                    <Text style={[s.planPrice, active && s.planPriceActive]}>{plan.price}</Text>
                    <Text style={s.planPer}>{plan.per}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* CTA */}
        <TouchableOpacity style={[s.cta, loading && s.ctaDisabled]} onPress={handleUpgrade} disabled={loading} activeOpacity={0.85}>
          {loading
            ? <ActivityIndicator color="#F5F5F2" />
            : <Text style={s.ctaText}>
                Continue to payment — {PLANS[selected].price}{PLANS[selected].per}
              </Text>
          }
        </TouchableOpacity>

        <Text style={s.legal}>
          Secure payment via Stripe · SSL encrypted · Cancel anytime
        </Text>

        <TouchableOpacity style={s.restoreBtn} onPress={handleRestore} disabled={loading} activeOpacity={0.7}>
          <Text style={s.restoreText}>Already paid? Restore access</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0D0D0B' },
  container: { padding: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[14] },

  closeBtn:     { alignSelf: 'flex-end', padding: spacing[2], marginBottom: spacing[3] },
  closeBtnText: { fontSize: 18, color: '#444' },

  // Hero
  hero:         { alignItems: 'center', marginBottom: spacing[7] },
  heroMark:     { width: 64, height: 64, borderRadius: 32, backgroundColor: '#0F2318', borderWidth: 1, borderColor: '#3D9E6A', alignItems: 'center', justifyContent: 'center', marginBottom: spacing[5] },
  heroMarkText: { fontSize: 28, color: '#3D9E6A' },
  eyebrow:      { fontFamily: font.mono, fontSize: 11, color: '#3D9E6A', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[3] },
  title:        { fontFamily: font.sansBd, fontSize: 34, color: '#F5F5F2', lineHeight: 40, textAlign: 'center', marginBottom: spacing[3] },
  sub:          { fontFamily: font.sans, fontSize: 15, color: '#555', lineHeight: 22, textAlign: 'center', maxWidth: 300 },

  // Features
  featureCard: { backgroundColor: '#181816', borderWidth: 1, borderColor: '#252520', borderRadius: radius.lg, marginBottom: spacing[6] },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[4] },
  featureRowBorder: { borderBottomWidth: 1, borderBottomColor: '#1C1C18' },
  featureIconWrap: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: '#0F2318', alignItems: 'center', justifyContent: 'center' },
  featureIcon:  { fontSize: 16 },
  featureBody:  { flex: 1 },
  featureLabel: { fontFamily: font.sansBd, fontSize: 14, color: '#F5F5F2', marginBottom: 2 },
  featureDesc:  { fontFamily: font.sans, fontSize: 12, color: '#555' },
  featureCheck: { fontFamily: font.sansBd, fontSize: 14, color: '#3D9E6A' },

  // Plans
  plans:    { gap: spacing[3], marginBottom: spacing[6] },
  plan: {
    borderWidth: 1.5, borderColor: '#252520',
    borderRadius: radius.md, padding: spacing[4],
    backgroundColor: '#181816', position: 'relative', overflow: 'hidden',
  },
  planActive:   { borderColor: '#3D9E6A', backgroundColor: '#0F2318' },
  planBadge:    { position: 'absolute', top: 0, right: 0, backgroundColor: '#3D9E6A', paddingHorizontal: spacing[3], paddingVertical: 4, borderBottomLeftRadius: radius.sm },
  planBadgeText:{ fontFamily: font.mono, fontSize: 10, color: '#F5F5F2', textTransform: 'uppercase', letterSpacing: 0.5 },
  planRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  radio:        { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  radioActive:  { borderColor: '#3D9E6A' },
  radioDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3D9E6A' },
  planInfo:     { flex: 1 },
  planLabel:    { fontFamily: font.sansBd, fontSize: 15, color: '#555' },
  planLabelActive: { color: '#F5F5F2' },
  planSub:      { fontFamily: font.sans, fontSize: 12, color: '#444', marginTop: 2 },
  planSavings:  { fontFamily: font.mono, fontSize: 11, color: '#3D9E6A', marginTop: 3 },
  planPriceWrap:{ alignItems: 'flex-end' },
  planPrice:    { fontFamily: font.sansBd, fontSize: 24, color: '#555' },
  planPriceActive: { color: '#F5F5F2' },
  planPer:      { fontFamily: font.mono, fontSize: 11, color: '#444' },

  // CTA
  cta:        { backgroundColor: '#3D9E6A', height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[4] },
  ctaDisabled:{ opacity: 0.6 },
  ctaText:    { fontFamily: font.sansBd, fontSize: 16, color: '#F5F5F2' },

  legal:       { fontFamily: font.mono, fontSize: 11, color: '#333', textAlign: 'center', lineHeight: 17, marginBottom: spacing[5], letterSpacing: 0.3 },
  restoreBtn:  { alignItems: 'center', paddingVertical: spacing[3] },
  restoreText: { fontFamily: font.sans, fontSize: 13, color: '#444' },

  // Already premium state
  activeWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
  activeIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: '#0F2318', borderWidth: 1, borderColor: '#3D9E6A', alignItems: 'center', justifyContent: 'center', marginBottom: spacing[5] },
  activeTitle: { fontFamily: font.sansBd, fontSize: 28, color: '#F5F5F2', marginBottom: spacing[3], textAlign: 'center' },
  activeSub:   { fontFamily: font.sans, fontSize: 15, color: '#555', lineHeight: 22, textAlign: 'center', marginBottom: spacing[8] },
  activeBtn:   { backgroundColor: '#3D9E6A', height: 52, paddingHorizontal: spacing[10], borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  activeBtnText:{ fontFamily: font.sansBd, fontSize: 15, color: '#F5F5F2' },
});
