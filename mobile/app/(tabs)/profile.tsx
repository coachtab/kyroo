import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, font } from '../../src/lib/theme';
import { useAuth } from '../../src/context/AuthContext';

export default function ProfileScreen() {
  const { user, loading, isPremium, logout } = useAuth();
  const router = useRouter();

  if (loading) return null;

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.title}>Your profile.</Text>
          <Text style={styles.sub}>Sign in to access your programs and track your progress.</Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.push('/auth')}>
            <Text style={styles.btnText}>Sign in</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnGhost} onPress={() => router.push('/auth?tab=signup')}>
            <Text style={styles.btnGhostText}>Create account</Text>
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>// PROFILE</Text>
        <Text style={styles.title}>Hi, {user.name.split(' ')[0]}.</Text>

        <View style={styles.card}>
          <Row label="Email" value={user.email} />
          <Row label="Plan" value={isPremium ? 'Premium ✓' : 'Free'} valueColor={isPremium ? colors.forest : colors.ink3} />
          {user.is_admin && <Row label="Role" value="Admin" valueColor={colors.amber} />}
        </View>

        {!isPremium && (
          <TouchableOpacity style={styles.upgradeBtn} onPress={() => router.push('/upgrade')}>
            <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[3] },
  label: { fontFamily: font.mono, fontSize: 12, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontFamily: font.sans, fontSize: 14, color: colors.ink },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.parchment },
  container: { flex: 1, padding: spacing[5], paddingTop: spacing[8] },
  center: { flex: 1, padding: spacing[5], paddingTop: spacing[16], alignItems: 'center' },
  eyebrow: { fontFamily: font.mono, fontSize: 11, color: colors.ink3, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[3] },
  title: { fontFamily: font.sansBd, fontSize: 34, color: colors.ink, marginBottom: spacing[3] },
  sub: { fontFamily: font.sans, fontSize: 15, color: colors.ink2, lineHeight: 22, textAlign: 'center', marginBottom: spacing[8] },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing[4], marginTop: spacing[6] },
  btn: { backgroundColor: colors.forest, paddingVertical: spacing[3], paddingHorizontal: spacing[8], borderRadius: radius.sm, marginBottom: spacing[3], width: '100%', alignItems: 'center' },
  btnText: { fontFamily: font.sansBd, fontSize: 15, color: colors.white },
  btnGhost: { borderWidth: 1, borderColor: colors.line2, paddingVertical: spacing[3], paddingHorizontal: spacing[8], borderRadius: radius.sm, width: '100%', alignItems: 'center' },
  btnGhostText: { fontFamily: font.sans, fontSize: 15, color: colors.ink },
  upgradeBtn: { marginTop: spacing[5], backgroundColor: colors.amber, paddingVertical: spacing[3], borderRadius: radius.sm, alignItems: 'center' },
  upgradeBtnText: { fontFamily: font.sansBd, fontSize: 15, color: colors.white },
  logoutBtn: { marginTop: 'auto', paddingVertical: spacing[3], alignItems: 'center' },
  logoutText: { fontFamily: font.sans, fontSize: 14, color: colors.ink3 },
});
