import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, radius, font } from '../src/lib/theme';
import { apiFetch } from '../src/lib/api';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [done, setDone]           = useState(false);

  async function submit() {
    if (!password || password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (!token) { setError('Invalid or missing reset token.'); return; }
    setLoading(true); setError('');
    try {
      const res  = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Reset failed. The link may have expired.'); return; }
      setDone(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.iconText}>✕</Text>
          <Text style={s.title}>Invalid link</Text>
          <Text style={s.sub}>This reset link is invalid or has already been used.</Text>
          <TouchableOpacity style={s.btn} onPress={() => router.push('/auth')} activeOpacity={0.85}>
            <Text style={s.btnText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <View style={s.successIcon}><Text style={{ fontSize: 32 }}>✓</Text></View>
          <Text style={s.title}>Password updated</Text>
          <Text style={s.sub}>Your password has been changed successfully. You can now sign in.</Text>
          <TouchableOpacity style={[s.btn, { alignSelf: 'stretch' }]} onPress={() => router.push('/auth')} activeOpacity={0.85}>
            <Text style={s.btnText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

          <View style={s.brandMark}>
            <Text style={s.brandMarkText}>K</Text>
          </View>

          <Text style={s.eyebrow}>// NEW PASSWORD</Text>
          <Text style={s.title}>Set a new{'\n'}password.</Text>
          <Text style={s.sub}>Choose something strong. At least 6 characters.</Text>

          <View style={s.form}>
            <Text style={s.fieldLabel}>New password</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={v => { setPassword(v); setError(''); }}
              secureTextEntry
              placeholder="Min. 6 characters"
              placeholderTextColor="#333"
              autoFocus
            />

            <Text style={[s.fieldLabel, { marginTop: spacing[4] }]}>Confirm password</Text>
            <TextInput
              style={[s.input, confirm && password !== confirm && s.inputError]}
              value={confirm}
              onChangeText={v => { setConfirm(v); setError(''); }}
              secureTextEntry
              placeholder="Repeat new password"
              placeholderTextColor="#333"
              returnKeyType="done"
              onSubmitEditing={submit}
            />

            {!!error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading} activeOpacity={0.85}>
              <Text style={s.btnText}>{loading ? 'Updating…' : 'Update password'}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0D0D0B' },
  container: { padding: spacing[5], paddingTop: spacing[6], paddingBottom: spacing[10] },

  brandMark: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#3D9E6A',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
    marginTop: spacing[8], marginBottom: spacing[6],
  },
  brandMarkText: { fontFamily: font.sansBd, fontSize: 28, color: '#FFFFFF' },

  eyebrow: { fontFamily: font.mono, fontSize: 11, color: '#555', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[3] },
  title:   { fontFamily: font.sansBd, fontSize: 32, color: '#F5F5F2', lineHeight: 38, marginBottom: spacing[3] },
  sub:     { fontFamily: font.sans, fontSize: 15, color: '#888', lineHeight: 22 },

  form:       { marginTop: spacing[6] },
  fieldLabel: { fontFamily: font.mono, fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[2] },
  input: {
    backgroundColor: '#181816', borderWidth: 1, borderColor: '#252520',
    borderRadius: radius.sm, height: 52, paddingHorizontal: spacing[4],
    fontFamily: font.sans, fontSize: 15, color: '#F5F5F2',
  },
  inputError: { borderColor: '#C06848' },

  errorBox: { backgroundColor: '#2A1510', borderWidth: 1, borderColor: '#5A2510', borderRadius: radius.sm, padding: spacing[3], marginTop: spacing[3] },
  errorText: { fontFamily: font.sans, fontSize: 13, color: '#C06848' },

  btn:         { marginTop: spacing[5], backgroundColor: '#3D9E6A', height: 52, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.55 },
  btnText:     { fontFamily: font.sansBd, fontSize: 16, color: '#FFFFFF' },

  // Done / invalid states
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#0F2318', alignItems: 'center', justifyContent: 'center', marginBottom: spacing[5] },
  iconText:    { fontSize: 32, color: '#C06848', marginBottom: spacing[5] },
});
