import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, font } from '../src/lib/theme';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch } from '../src/lib/api';

export default function SettingsScreen() {
  const { user, refresh } = useAuth();
  const router = useRouter();

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
});
