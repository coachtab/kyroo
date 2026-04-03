import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, spacing, radius, font } from '../src/lib/theme';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch } from '../src/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Payment = { id: number; amount: number; currency: string; description: string; status: string; created_at: string };

export default function SettingsScreen() {
  const { user, isPremium, refresh, logout } = useAuth();
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useFocusEffect(useCallback(() => {
    apiFetch('/api/payments').then(r => r.json()).then(d => setPayments(d.payments || [])).catch(() => {});
  }, []));

  async function handleCancel() {
    const doCancel = async () => {
      setCancelLoading(true);
      try {
        const res  = await apiFetch('/api/premium/cancel', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (data.token) await AsyncStorage.setItem('kyroo_token', data.token);
        await refresh();
        Alert.alert('Subscription cancelled', 'Your Pro access has been removed.');
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Could not cancel subscription.');
      } finally {
        setCancelLoading(false);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Cancel your Pro subscription? You will lose access immediately.')) doCancel();
    } else {
      Alert.alert('Cancel subscription', 'You will lose Pro access immediately.', [
        { text: 'Keep Pro', style: 'cancel' },
        { text: 'Cancel subscription', style: 'destructive', onPress: doCancel },
      ]);
    }
  }

  async function handleDeleteAccount() {
    const doDelete = async () => {
      setDeleteLoading(true);
      try {
        const res = await apiFetch('/api/account', { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Deletion failed.');
        }
        await logout();
        router.replace('/(tabs)/profile');
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Could not delete account. Please try again.');
      } finally {
        setDeleteLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Permanently delete your account? This cannot be undone. All your data, plans, and subscription will be erased.')) doDelete();
    } else {
      Alert.alert(
        'Delete account',
        'This will permanently erase your account, all saved plans, and cancel any active subscription. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete my account', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  }

  const [name, setName]             = useState(user?.name ?? '');
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [saving, setSaving]         = useState(false);
  const [pwSaving, setPwSaving]     = useState(false);
  const [nameMsg, setNameMsg]       = useState('');
  const [pwMsg, setPwMsg]           = useState('');
  const [nameErr, setNameErr]       = useState('');
  const [pwErr, setPwErr]           = useState('');

  async function saveName() {
    if (!name.trim() || name.trim() === user?.name) return;
    setSaving(true); setNameMsg(''); setNameErr('');
    try {
      const res  = await apiFetch('/api/auth/update-profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setNameErr(data.error || 'Failed to update name.'); return; }
      await refresh();
      setNameMsg('Name updated.');
    } catch {
      setNameErr('Network error.');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!currentPw || !newPw || !confirmPw) { setPwErr('All fields are required.'); return; }
    if (newPw !== confirmPw) { setPwErr('New passwords do not match.'); return; }
    if (newPw.length < 8)   { setPwErr('Password must be at least 8 characters.'); return; }
    setPwSaving(true); setPwMsg(''); setPwErr('');
    try {
      const res  = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setPwErr(data.error || 'Failed to change password.'); return; }
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setPwMsg('Password changed successfully.');
    } catch {
      setPwErr('Network error.');
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Back ── */}
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backText}>‹  Account Settings</Text>
        </TouchableOpacity>

        {/* ── Profile ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Profile</Text>

          <Text style={s.fieldLabel}>Display name</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={v => { setName(v); setNameMsg(''); setNameErr(''); }}
            placeholder="Your name"
            placeholderTextColor="#333"
            autoCapitalize="words"
          />
          {!!nameErr && <Text style={s.errText}>{nameErr}</Text>}
          {!!nameMsg && <Text style={s.okText}>{nameMsg}</Text>}
          <TouchableOpacity
            style={[s.btn, (saving || name.trim() === user?.name) && s.btnDisabled]}
            onPress={saveName}
            disabled={saving || name.trim() === user?.name}
            activeOpacity={0.85}
          >
            <Text style={s.btnText}>{saving ? 'Saving…' : 'Save name'}</Text>
          </TouchableOpacity>

          <Text style={[s.fieldLabel, { marginTop: spacing[5] }]}>Email address</Text>
          <View style={s.readOnly}>
            <Text style={s.readOnlyText}>{user?.email}</Text>
            <Text style={s.readOnlyNote}>Cannot be changed</Text>
          </View>
        </View>

        {/* ── Password ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Password</Text>

          <Text style={s.fieldLabel}>Current password</Text>
          <TextInput style={s.input} value={currentPw} onChangeText={v => { setCurrentPw(v); setPwErr(''); setPwMsg(''); }} secureTextEntry placeholder="••••••••" placeholderTextColor="#333" />

          <Text style={[s.fieldLabel, { marginTop: spacing[4] }]}>New password</Text>
          <TextInput style={s.input} value={newPw} onChangeText={v => { setNewPw(v); setPwErr(''); setPwMsg(''); }} secureTextEntry placeholder="Min. 8 characters" placeholderTextColor="#333" />

          <Text style={[s.fieldLabel, { marginTop: spacing[4] }]}>Confirm new password</Text>
          <TextInput style={s.input} value={confirmPw} onChangeText={v => { setConfirmPw(v); setPwErr(''); setPwMsg(''); }} secureTextEntry placeholder="Repeat new password" placeholderTextColor="#333" />

          {!!pwErr && <Text style={s.errText}>{pwErr}</Text>}
          {!!pwMsg && <Text style={s.okText}>{pwMsg}</Text>}
          <TouchableOpacity style={[s.btn, pwSaving && s.btnDisabled]} onPress={changePassword} disabled={pwSaving} activeOpacity={0.85}>
            <Text style={s.btnText}>{pwSaving ? 'Changing…' : 'Change password'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Subscription ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Subscription</Text>

          <View style={s.subRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.subPlan}>{isPremium ? 'KYROO Pro' : 'Free plan'}</Text>
              {user?.plan && <Text style={s.subDetail}>{user.plan === 'pro' ? 'Full access · all programs' : 'Limited access'}</Text>}
            </View>
            <View style={[s.subBadge, isPremium && s.subBadgePro]}>
              <Text style={[s.subBadgeText, isPremium && s.subBadgeTextPro]}>{isPremium ? 'PRO' : 'FREE'}</Text>
            </View>
          </View>

          {isPremium ? (
            <TouchableOpacity
              style={[s.cancelBtn, cancelLoading && s.btnDisabled]}
              onPress={handleCancel}
              disabled={cancelLoading}
              activeOpacity={0.8}
            >
              <Text style={s.cancelBtnText}>{cancelLoading ? 'Cancelling…' : 'Cancel subscription'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.upgradeBtn} onPress={() => router.push('/upgrade')} activeOpacity={0.85}>
              <Text style={s.upgradeBtnText}>Upgrade to Pro →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Payment history ── */}
        {payments.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Payment history</Text>
            {payments.map((p, i) => (
              <View key={p.id} style={[s.payRow, i < payments.length - 1 && s.payRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.payDesc}>{p.description}</Text>
                  <Text style={s.payDate}>{new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.payAmount}>€{Number(p.amount).toFixed(2)}</Text>
                  <Text style={s.payStatus}>{p.status}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Danger zone ── */}
        <View style={s.dangerSection}>
          <Text style={s.dangerTitle}>Danger zone</Text>
          <Text style={s.dangerSub}>
            Permanently deletes your account, all saved plans, and cancels any active subscription. This action cannot be undone.
          </Text>
          <TouchableOpacity
            style={[s.deleteBtn, deleteLoading && s.btnDisabled]}
            onPress={handleDeleteAccount}
            disabled={deleteLoading}
            activeOpacity={0.8}
          >
            <Text style={s.deleteBtnText}>{deleteLoading ? 'Deleting…' : 'Delete my account'}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0D0D0B' },
  container: { padding: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[12] },

  backBtn:  { marginBottom: spacing[6] },
  backText: { fontFamily: font.sans, fontSize: 16, color: '#3D9E6A' },

  section: {
    backgroundColor: '#181816',
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: '#252520',
    padding: spacing[5],
    marginBottom: spacing[4],
  },
  sectionTitle: { fontFamily: font.sansBd, fontSize: 16, color: '#F5F5F2', marginBottom: spacing[5] },

  fieldLabel: { fontFamily: font.mono, fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[2] },
  input: {
    backgroundColor: '#0D0D0B', borderWidth: 1, borderColor: '#252520',
    borderRadius: radius.sm, height: 48, paddingHorizontal: spacing[4],
    fontFamily: font.sans, fontSize: 15, color: '#F5F5F2',
  },
  readOnly: {
    backgroundColor: '#0D0D0B', borderWidth: 1, borderColor: '#1C1C18',
    borderRadius: radius.sm, height: 48, paddingHorizontal: spacing[4],
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  readOnlyText: { fontFamily: font.sans, fontSize: 15, color: '#555' },
  readOnlyNote: { fontFamily: font.mono, fontSize: 10, color: '#333', textTransform: 'uppercase' },

  errText: { fontFamily: font.sans, fontSize: 13, color: '#C06848', marginTop: spacing[3] },
  okText:  { fontFamily: font.sans, fontSize: 13, color: '#3D9E6A', marginTop: spacing[3] },

  btn: {
    marginTop: spacing[4], backgroundColor: colors.forest,
    height: 48, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontFamily: font.sansBd, fontSize: 14, color: '#F5F5F2' },

  // Subscription
  subRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] },
  subPlan:    { fontFamily: font.sansBd, fontSize: 16, color: '#F5F5F2', marginBottom: 2 },
  subDetail:  { fontFamily: font.sans, fontSize: 13, color: '#555' },
  subBadge:   { paddingHorizontal: spacing[3], paddingVertical: 5, borderRadius: radius.full, backgroundColor: '#1C1C18', borderWidth: 1, borderColor: '#252520' },
  subBadgePro:{ backgroundColor: '#0F2318', borderColor: '#3D9E6A' },
  subBadgeText:    { fontFamily: font.mono, fontSize: 10, color: '#555', letterSpacing: 0.5 },
  subBadgeTextPro: { color: '#3D9E6A' },
  cancelBtn:   { borderWidth: 1, borderColor: '#5A2510', borderRadius: radius.sm, height: 44, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontFamily: font.sans, fontSize: 14, color: '#C06848' },
  upgradeBtn:  { backgroundColor: '#3D9E6A', height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  upgradeBtnText: { fontFamily: font.sansBd, fontSize: 14, color: '#F5F5F2' },

  // Danger zone
  dangerSection: {
    borderRadius: radius.lg, borderWidth: 1, borderColor: '#5A2510',
    backgroundColor: '#110A08', padding: spacing[5], marginBottom: spacing[4],
  },
  dangerTitle:   { fontFamily: font.sansBd, fontSize: 16, color: '#C06848', marginBottom: spacing[2] },
  dangerSub:     { fontFamily: font.sans, fontSize: 13, color: '#7A4030', lineHeight: 20, marginBottom: spacing[5] },
  deleteBtn:     { borderWidth: 1, borderColor: '#C06848', borderRadius: radius.sm, height: 48, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontFamily: font.sansBd, fontSize: 14, color: '#C06848' },

  // Payments
  payRow:       { paddingVertical: spacing[3], flexDirection: 'row', alignItems: 'center' },
  payRowBorder: { borderBottomWidth: 1, borderBottomColor: '#1C1C18' },
  payDesc:      { fontFamily: font.sans, fontSize: 13, color: '#CCCCC8', marginBottom: 2 },
  payDate:      { fontFamily: font.mono, fontSize: 10, color: '#444', textTransform: 'uppercase' },
  payAmount:    { fontFamily: font.sansBd, fontSize: 14, color: '#F5F5F2', marginBottom: 2 },
  payStatus:    { fontFamily: font.mono, fontSize: 10, color: '#3D9E6A', textTransform: 'uppercase' },
});
