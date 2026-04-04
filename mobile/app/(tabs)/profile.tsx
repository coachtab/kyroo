import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert, Platform, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, font } from '../../src/lib/theme';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/lib/api';

export default function ProfileScreen() {
  const { user, loading, isPremium, logout } = useAuth();
  const router = useRouter();
  const [portalLoading, setPortalLoading] = useState(false);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res  = await apiFetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open portal.');
      await Linking.openURL(data.url);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setPortalLoading(false);
    }
  }

  if (loading) return null;

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.guestContainer}>
          <View style={styles.guestIcon}>
            <Text style={styles.guestIconText}>K</Text>
          </View>
          <Text style={styles.guestTitle}>Welcome to Kyroo</Text>
          <Text style={styles.guestSub}>
            Sign in to access your programs, track progress, and build your plan.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/auth')}>
            <Text style={styles.primaryBtnText}>Sign in</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => router.push('/auth?tab=signup')}>
            <Text style={styles.ghostBtnText}>Create account — it's free</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.legalLink} onPress={() => router.push('/legal')}>
            <Text style={styles.legalLinkText}>Imprint · Terms · Privacy & GDPR</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  function handleLogout() {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) logout();
    } else {
      Alert.alert('Sign out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: logout },
      ]);
    }
  }

  const initials = user.name
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Avatar + name ── */}
        <View style={styles.heroSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.heroName}>{user.name}</Text>
          <Text style={styles.heroEmail}>{user.email}</Text>
          {isPremium ? (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>✦ PREMIUM</Text>
            </View>
          ) : (
            <View style={styles.freeBadge}>
              <Text style={styles.freeBadgeText}>FREE PLAN</Text>
            </View>
          )}
        </View>

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <StatCard label="Plan" value={user.is_admin ? 'Admin' : isPremium ? 'Premium' : 'Free'} accent={user.is_admin ? '#D4923F' : isPremium ? '#3D9E6A' : '#666'} />
          <StatCard label="Plans/month" value={user.is_admin ? '∞' : isPremium ? '5' : '0'} accent={isPremium || user.is_admin ? '#3D9E6A' : '#666'} />
          <StatCard label="Programs" value={user.is_admin ? 'All' : isPremium ? 'All' : '1'} accent={isPremium || user.is_admin ? '#3D9E6A' : '#666'} />
        </View>

        {/* ── Upgrade banner (free users) ── */}
        {!isPremium && !user.is_admin && (
          <TouchableOpacity style={styles.upgradeBanner} onPress={() => router.push('/upgrade')} activeOpacity={0.85}>
            <View>
              <Text style={styles.upgradeBannerTitle}>Unlock Premium</Text>
              <Text style={styles.upgradeBannerSub}>All 12 programs · 5 AI plans/month · €6/mo</Text>
            </View>
            <View style={styles.upgradeBannerBtn}>
              <Text style={styles.upgradeBannerBtnText}>Upgrade ›</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Subscription management (premium users) ── */}
        {isPremium && !user.is_admin && (
          <TouchableOpacity
            style={styles.portalCard}
            onPress={openPortal}
            activeOpacity={0.85}
            disabled={portalLoading}
          >
            <View style={styles.portalCardLeft}>
              <Text style={styles.portalCardIcon}>✦</Text>
              <View>
                <Text style={styles.portalCardTitle}>Premium · Active</Text>
                <Text style={styles.portalCardSub}>Manage, pause or cancel your subscription</Text>
              </View>
            </View>
            {portalLoading
              ? <ActivityIndicator color="#3D9E6A" size="small" />
              : <Text style={styles.portalCardArrow}>›</Text>
            }
          </TouchableOpacity>
        )}

        {/* ── Menu items ── */}
        <View style={styles.menu}>
          <MenuItem icon="⚡" label="My Plans" onPress={() => router.push('/plans')} />
          <MenuItem icon="⚙️" label="Account Settings" onPress={() => router.push('/settings')} />
          <MenuItem icon="💬" label="Support" onPress={() => Linking.openURL('mailto:support@kyroo.de')} />
          <MenuItem icon="📄" label="Legal & Privacy" onPress={() => router.push('/legal')} />
        </View>

        {/* ── Sign out ── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Kyroo · v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={statStyles.card}>
      <Text style={[statStyles.value, { color: accent }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

function MenuItem({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={menuStyles.item} onPress={onPress} activeOpacity={0.7}>
      <View style={menuStyles.iconWrap}>
        <Text style={menuStyles.icon}>{icon}</Text>
      </View>
      <Text style={menuStyles.label}>{label}</Text>
      <Text style={menuStyles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: '#181816',
    borderRadius: radius.md, padding: spacing[4],
    alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: '#252520',
  },
  value: { fontFamily: font.sansBd, fontSize: 16 },
  label: { fontFamily: font.mono, fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 },
});

const menuStyles = StyleSheet.create({
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[4], gap: spacing[3],
    borderBottomWidth: 1, borderBottomColor: '#1C1C18',
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: radius.sm,
    backgroundColor: '#181816', alignItems: 'center', justifyContent: 'center',
  },
  icon:  { fontSize: 16 },
  label: { flex: 1, fontFamily: font.sans, fontSize: 15, color: '#CCCCC8' },
  arrow: { fontSize: 20, color: '#444' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0B' },

  // Guest
  guestContainer: {
    flex: 1, alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[16],
  },
  guestIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.forest,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[5],
  },
  guestIconText: { fontFamily: font.sansBd, fontSize: 36, color: '#F5F5F2' },
  guestTitle:    { fontFamily: font.sansBd, fontSize: 26, color: '#F5F5F2', marginBottom: spacing[3], textAlign: 'center' },
  guestSub:      { fontFamily: font.sans, fontSize: 15, color: '#666', lineHeight: 22, textAlign: 'center', marginBottom: spacing[8] },
  primaryBtn: {
    backgroundColor: colors.forest, height: 50,
    borderRadius: radius.full, width: '100%',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[3],
  },
  primaryBtnText: { fontFamily: font.sansBd, fontSize: 15, color: '#F5F5F2' },
  ghostBtn: {
    height: 50, borderRadius: radius.full, width: '100%',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#252520',
  },
  ghostBtnText: { fontFamily: font.sans, fontSize: 15, color: '#888' },
  legalLink:     { marginTop: spacing[6] },
  legalLinkText: { fontFamily: font.mono, fontSize: 11, color: '#333', textAlign: 'center', letterSpacing: 0.4 },

  // Logged in
  container: { padding: spacing[5], paddingBottom: spacing[12] },

  heroSection: { alignItems: 'center', paddingVertical: spacing[8] },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.forest,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[4],
  },
  avatarText:  { fontFamily: font.sansBd, fontSize: 32, color: '#F5F5F2' },
  heroName:    { fontFamily: font.sansBd, fontSize: 24, color: '#F5F5F2', marginBottom: 4 },
  heroEmail:   { fontFamily: font.sans, fontSize: 14, color: '#555', marginBottom: spacing[4] },
  premiumBadge: {
    paddingHorizontal: spacing[4], paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.forest + '30',
    borderWidth: 1, borderColor: colors.forest + '50',
  },
  premiumBadgeText: { fontFamily: font.mono, fontSize: 11, color: '#6DBF8A', letterSpacing: 1 },
  freeBadge: {
    paddingHorizontal: spacing[4], paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: '#1C1C18',
    borderWidth: 1, borderColor: '#252520',
  },
  freeBadgeText: { fontFamily: font.mono, fontSize: 11, color: '#555', letterSpacing: 1 },

  statsRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] },

  upgradeBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.forest,
    borderRadius: radius.lg, padding: spacing[4],
    marginBottom: spacing[5],
  },
  upgradeBannerTitle: { fontFamily: font.sansBd, fontSize: 16, color: '#F5F5F2', marginBottom: 2 },
  upgradeBannerSub:   { fontFamily: font.sans, fontSize: 12, color: '#A8D4B8' },
  upgradeBannerBtn: {
    backgroundColor: '#F5F5F2', borderRadius: radius.full,
    paddingHorizontal: spacing[4], paddingVertical: 8,
  },
  upgradeBannerBtnText: { fontFamily: font.sansBd, fontSize: 13, color: colors.forest },

  portalCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0F2318', borderRadius: radius.lg,
    borderWidth: 1, borderColor: '#3D9E6A40',
    padding: spacing[4], marginBottom: spacing[5],
  },
  portalCardLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1 },
  portalCardIcon:  { fontSize: 22, color: '#3D9E6A' },
  portalCardTitle: { fontFamily: font.sansBd, fontSize: 14, color: '#F5F5F2', marginBottom: 2 },
  portalCardSub:   { fontFamily: font.sans, fontSize: 12, color: '#4A8A5A' },
  portalCardArrow: { fontSize: 22, color: '#3D9E6A' },

  menu: { backgroundColor: '#0D0D0B', marginBottom: spacing[6] },

  signOutBtn: {
    borderWidth: 1, borderColor: '#252520',
    borderRadius: radius.full, height: 48,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[5],
  },
  signOutText: { fontFamily: font.sans, fontSize: 15, color: '#555' },

  version: {
    fontFamily: font.mono, fontSize: 11, color: '#333',
    textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5,
  },
});
