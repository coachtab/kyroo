import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Linking, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, font } from '../src/lib/theme';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch } from '../src/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Plan = 'monthly' | 'yearly';

const PLANS = {
  monthly: {
    label: 'Monthly',
    price: '€6',
    period: '/month',
    sub: 'Billed monthly, cancel anytime.',
    badge: null,
  },
  yearly: {
    label: 'Yearly',
    price: '€72',
    period: '/year',
    sub: 'That\'s €6/month — 2 months free.',
    badge: 'BEST VALUE',
  },
} as const;

const FEATURES = [
  { icon: '⚡', text: 'All AI-powered fitness programs' },
  { icon: '🧬', text: 'Fully personalised plans built around you' },
  { icon: '📄', text: 'Download your plan as PDF' },
  { icon: '🔄', text: 'Regenerate anytime' },
  { icon: '🧮', text: 'Advanced nutrition & macro calculator' },
  { icon: '📅', text: 'Unlimited monthly generations' },
];

export default function UpgradeScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [selected, setSelected] = useState<Plan>('yearly');
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    if (!user) {
      router.push('/auth');
      return;
    }
    setLoading(true);
    try {
      // Create PaymentIntent on the backend
      const res = await apiFetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        body: JSON.stringify({ plan: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment setup failed');

      // Save intent details for confirmation after web payment
      await AsyncStorage.setItem('kyroo_pending_plan', selected);
      await AsyncStorage.setItem('kyroo_pending_intent', data.clientSecret.split('_secret_')[0]);

      // Open Stripe payment in browser (web checkout at kyroo.de)
      const url = `https://kyroo.de/checkout?plan=${selected}&intent=${encodeURIComponent(data.clientSecret)}`;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        throw new Error('Could not open payment page');
      }
    } catch (err: any) {
      Alert.alert('Payment error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestorePurchase() {
    setLoading(true);
    try {
      // Step 1: re-check the server — covers web payments and already-active accounts
      const meRes = await apiFetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        const serverUser = meData.user;
        const alreadyPremium =
          serverUser?.is_admin ||
          serverUser?.is_premium ||
          serverUser?.plan === 'pro' ||
          serverUser?.plan === 'basic';

        if (alreadyPremium) {
          await refresh();
          Alert.alert('Subscription restored! 🎉', 'Your Premium access is active.', [
            { text: "Let's go", onPress: () => router.back() },
          ]);
          return;
        }
      }

      // Step 2: try confirming a pending Stripe intent from a previous in-app session
      const intentId = await AsyncStorage.getItem('kyroo_pending_intent');
      const plan = await AsyncStorage.getItem('kyroo_pending_plan') as Plan | null;

      if (intentId && plan) {
        const confirmRes = await apiFetch('/api/stripe/confirm-payment', {
          method: 'POST',
          body: JSON.stringify({ payment_intent_id: intentId, plan }),
        });
        const confirmData = await confirmRes.json();
        if (confirmRes.ok) {
          if (confirmData.token) await AsyncStorage.setItem('kyroo_token', confirmData.token);
          await AsyncStorage.removeItem('kyroo_pending_plan');
          await AsyncStorage.removeItem('kyroo_pending_intent');
          await refresh();
          Alert.alert('Welcome to Premium! 🎉', confirmData.message || 'Your account has been upgraded.', [
            { text: "Let's go", onPress: () => router.back() },
          ]);
          return;
        }
      }

      // Step 3: nothing found
      Alert.alert(
        'No active subscription found',
        'We could not find a completed payment linked to your account.\n\nIf you paid recently, please wait a few minutes and try again. Contact support if the issue persists.',
        [{ text: 'OK' }]
      );
    } catch {
      Alert.alert('Restore failed', 'Could not connect to the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Close */}
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>⚡</Text>
          <Text style={styles.eyebrow}>// KYROO PREMIUM</Text>
          <Text style={styles.title}>Unlock your full{'\n'}potential.</Text>
          <Text style={styles.sub}>
            Get AI-powered fitness programs personalised to your goals, schedule, and body.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featureList}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Plan picker */}
        <View style={styles.plans}>
          {(Object.keys(PLANS) as Plan[]).map(key => {
            const plan = PLANS[key];
            const active = selected === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.plan, active && styles.planActive]}
                onPress={() => setSelected(key)}
                activeOpacity={0.8}
              >
                {plan.badge && (
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>{plan.badge}</Text>
                  </View>
                )}
                <View style={styles.planRow}>
                  <View style={[styles.planRadio, active && styles.planRadioActive]}>
                    {active && <View style={styles.planRadioDot} />}
                  </View>
                  <View style={styles.planInfo}>
                    <Text style={[styles.planLabel, active && styles.planLabelActive]}>{plan.label}</Text>
                    <Text style={styles.planSub}>{plan.sub}</Text>
                  </View>
                  <View style={styles.planPriceWrap}>
                    <Text style={[styles.planPrice, active && styles.planPriceActive]}>{plan.price}</Text>
                    <Text style={styles.planPeriod}>{plan.period}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, loading && styles.ctaBtnDisabled]}
          onPress={handleUpgrade}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.ctaBtnText}>
                Upgrade to Premium — {PLANS[selected].price}{PLANS[selected].period}
              </Text>
          }
        </TouchableOpacity>

        <Text style={styles.legal}>
          Secure payment via Stripe. Cancel anytime. By upgrading you agree to our Terms of Service.
        </Text>

        {/* Restore */}
        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestorePurchase} disabled={loading}>
          <Text style={styles.restoreBtnText}>Already paid? Tap to restore</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.parchment },
  container: { padding: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[12] },

  closeBtn: { alignSelf: 'flex-end', padding: spacing[2], marginBottom: spacing[3] },
  closeBtnText: { fontSize: 18, color: colors.ink3 },

  hero: { alignItems: 'center', marginBottom: spacing[7] },
  heroIcon: { fontSize: 40, marginBottom: spacing[3] },
  eyebrow: { fontFamily: font.mono, fontSize: 11, color: colors.ink3, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[3] },
  title: { fontFamily: font.sansBd, fontSize: 34, color: colors.ink, lineHeight: 40, textAlign: 'center', marginBottom: spacing[3] },
  sub: { fontFamily: font.sans, fontSize: 15, color: colors.ink2, lineHeight: 22, textAlign: 'center', maxWidth: 300 },

  featureList: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing[4],
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  featureIcon: { fontSize: 18, width: 26 },
  featureText: { fontFamily: font.sans, fontSize: 14, color: colors.ink, flex: 1 },

  plans: { gap: spacing[3], marginBottom: spacing[6] },
  plan: {
    borderWidth: 1.5, borderColor: colors.line2,
    borderRadius: radius.md,
    padding: spacing[4],
    backgroundColor: colors.surface,
    position: 'relative',
    overflow: 'hidden',
  },
  planActive: { borderColor: colors.forest, backgroundColor: colors.forestLight },
  planBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: colors.forest,
    paddingHorizontal: spacing[3], paddingVertical: 4,
    borderBottomLeftRadius: radius.sm,
  },
  planBadgeText: { fontFamily: font.mono, fontSize: 10, color: colors.white, textTransform: 'uppercase', letterSpacing: 0.5 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  planRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.line2,
    alignItems: 'center', justifyContent: 'center',
  },
  planRadioActive: { borderColor: colors.forest },
  planRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.forest },
  planInfo: { flex: 1 },
  planLabel: { fontFamily: font.sansBd, fontSize: 15, color: colors.ink2 },
  planLabelActive: { color: colors.forest },
  planSub: { fontFamily: font.sans, fontSize: 12, color: colors.ink3, marginTop: 2 },
  planPriceWrap: { alignItems: 'flex-end' },
  planPrice: { fontFamily: font.sansBd, fontSize: 22, color: colors.ink2 },
  planPriceActive: { color: colors.forest },
  planPeriod: { fontFamily: font.mono, fontSize: 11, color: colors.ink3 },

  ctaBtn: {
    backgroundColor: colors.forest,
    height: 54, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[4],
  },
  ctaBtnDisabled: { opacity: 0.6 },
  ctaBtnText: { fontFamily: font.sansBd, fontSize: 16, color: colors.white },

  legal: { fontFamily: font.sans, fontSize: 12, color: colors.ink4, textAlign: 'center', lineHeight: 17, marginBottom: spacing[5] },

  restoreBtn: { alignItems: 'center', paddingVertical: spacing[2] },
  restoreBtnText: { fontFamily: font.sans, fontSize: 13, color: colors.forest },
});
