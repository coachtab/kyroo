import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, spacing, radius, font } from '../src/lib/theme';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch } from '../src/lib/api';

type AuthView = 'login' | 'signup' | 'forgot' | 'forgot-sent';

export default function AuthScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [view, setView] = useState<AuthView>(params.tab === 'signup' ? 'signup' : 'login');

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {view === 'login'       && <LoginView onSignup={() => setView('signup')} onForgot={() => setView('forgot')} />}
        {view === 'signup'      && <SignupView onLogin={() => setView('login')} />}
        {view === 'forgot'      && <ForgotView onBack={() => setView('login')} onSent={() => setView('forgot-sent')} />}
        {view === 'forgot-sent' && <ForgotSentView onBack={() => setView('login')} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Close button ────────────────────────────────────────────
function CloseBtn() {
  const router = useRouter();
  return (
    <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} hitSlop={12}>
      <Text style={styles.closeBtnText}>✕</Text>
    </TouchableOpacity>
  );
}

// ─── LOGIN ───────────────────────────────────────────────────
function LoginView({ onSignup, onForgot }: { onSignup: () => void; onForgot: () => void }) {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const passwordRef             = useRef<TextInput>(null);

  async function submit() {
    setError('');
    const e = email.trim().toLowerCase();
    if (!e || !password) { setError('Please enter your email and password.'); return; }
    if (!e.includes('@')) { setError('Please enter a valid email address.'); return; }
    setLoading(true);
    try {
      await login(e, password);
      router.back();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <CloseBtn />
      <Text style={styles.eyebrow}>// SIGN IN</Text>
      <Text style={styles.title}>Welcome back.</Text>
      <Text style={styles.sub}>Sign in to access your programs and fitness plans.</Text>

      <View style={styles.form}>
        <Field label="Email">
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={v => { setEmail(v); setError(''); }}
            placeholder="you@example.com"
            placeholderTextColor={colors.ink4}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        </Field>

        <Field label="Password">
          <TextInput
            ref={passwordRef}
            style={styles.input}
            value={password}
            onChangeText={v => { setPassword(v); setError(''); }}
            placeholder="••••••••"
            placeholderTextColor={colors.ink4}
            secureTextEntry
            autoComplete="current-password"
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </Field>

        <TouchableOpacity style={styles.forgotLink} onPress={onForgot}>
          <Text style={styles.forgotLinkText}>Forgot password?</Text>
        </TouchableOpacity>

        {!!error && <ErrorBox message={error} />}

        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={submit} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Don't have an account? </Text>
        <TouchableOpacity onPress={onSignup}>
          <Text style={styles.switchLink}>Sign up</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── SIGNUP ──────────────────────────────────────────────────
function SignupView({ onLogin }: { onLogin: () => void }) {
  const router  = useRouter();
  const { signup } = useAuth();
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const emailRef    = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef  = useRef<TextInput>(null);

  async function submit() {
    setError('');
    const e = email.trim().toLowerCase();
    const n = name.trim();
    if (!n)              { setError('Please enter your name.'); return; }
    if (!e || !e.includes('@')) { setError('Please enter a valid email address.'); return; }
    if (!password)       { setError('Please enter a password.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await signup(n, e, password);
      router.back();
    } catch (err: any) {
      setError(err.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <CloseBtn />
      <Text style={styles.eyebrow}>// CREATE ACCOUNT</Text>
      <Text style={styles.title}>Start your journey.</Text>
      <Text style={styles.sub}>Create your free account. No credit card required.</Text>

      <View style={styles.form}>
        <Field label="Name">
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={v => { setName(v); setError(''); }}
            placeholder="Your full name"
            placeholderTextColor={colors.ink4}
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />
        </Field>

        <Field label="Email">
          <TextInput
            ref={emailRef}
            style={styles.input}
            value={email}
            onChangeText={v => { setEmail(v); setError(''); }}
            placeholder="you@example.com"
            placeholderTextColor={colors.ink4}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        </Field>

        <Field label="Password">
          <TextInput
            ref={passwordRef}
            style={styles.input}
            value={password}
            onChangeText={v => { setPassword(v); setError(''); }}
            placeholder="Min. 6 characters"
            placeholderTextColor={colors.ink4}
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
        </Field>

        <Field label="Confirm password">
          <TextInput
            ref={confirmRef}
            style={[styles.input, confirm && password && confirm !== password && styles.inputError]}
            value={confirm}
            onChangeText={v => { setConfirm(v); setError(''); }}
            placeholder="Repeat your password"
            placeholderTextColor={colors.ink4}
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </Field>

        <PasswordStrength password={password} />

        {!!error && <ErrorBox message={error} />}

        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={submit} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Creating account…' : 'Create account'}</Text>
        </TouchableOpacity>

        <Text style={styles.legalNote}>
          By creating an account you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Already have an account? </Text>
        <TouchableOpacity onPress={onLogin}>
          <Text style={styles.switchLink}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── FORGOT PASSWORD ─────────────────────────────────────────
function ForgotView({ onBack, onSent }: { onBack: () => void; onSent: () => void }) {
  const [email, setEmail]     = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    const e = email.trim().toLowerCase();
    if (!e || !e.includes('@')) { setError('Please enter a valid email address.'); return; }
    setLoading(true);
    try {
      await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: e }),
      });
      // Always advance to "sent" — don't reveal whether email exists
      onSent();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={12}>
        <Text style={styles.backBtnText}>‹ Back</Text>
      </TouchableOpacity>

      <Text style={styles.eyebrow}>// RESET PASSWORD</Text>
      <Text style={styles.title}>Forgot your{'\n'}password?</Text>
      <Text style={styles.sub}>
        Enter the email address linked to your account. We'll send you a link to reset your password.
      </Text>

      <View style={styles.form}>
        <Field label="Email">
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={v => { setEmail(v); setError(''); }}
            placeholder="you@example.com"
            placeholderTextColor={colors.ink4}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={submit}
            autoFocus
          />
        </Field>

        {!!error && <ErrorBox message={error} />}

        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={submit} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Sending…' : 'Send reset link'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── FORGOT SENT CONFIRMATION ────────────────────────────────
function ForgotSentView({ onBack }: { onBack: () => void }) {
  return (
    <ScrollView contentContainerStyle={[styles.container, styles.centeredContainer]}>
      <View style={styles.sentIcon}>
        <Text style={styles.sentIconText}>✉</Text>
      </View>
      <Text style={styles.title}>Check your email.</Text>
      <Text style={styles.sub}>
        If an account exists for that address, we've sent a password reset link. It may take a minute to arrive.
      </Text>
      <Text style={[styles.sub, { marginTop: spacing[3] }]}>
        Check your spam folder if you don't see it.
      </Text>

      <TouchableOpacity style={[styles.btn, { marginTop: spacing[8] }]} onPress={onBack}>
        <Text style={styles.btnText}>Back to sign in</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Shared sub-components ───────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      {children}
    </View>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <View style={errorStyles.box}>
      <Text style={errorStyles.text}>{message}</Text>
    </View>
  );
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password) ? 3
    : password.length >= 8 && /[A-Z0-9]/.test(password) ? 2
    : password.length >= 6 ? 1 : 0;
  const labels = ['Too short', 'Weak', 'Fair', 'Strong'];
  const barColors = [colors.error, '#E67E22', colors.amber, colors.forest];
  return (
    <View style={strengthStyles.wrap}>
      <View style={strengthStyles.bars}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[strengthStyles.bar, i <= score && { backgroundColor: barColors[score] }]} />
        ))}
      </View>
      <Text style={[strengthStyles.label, { color: barColors[score] }]}>{labels[score]}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.parchment },
  container: { padding: spacing[5], paddingTop: spacing[6], paddingBottom: spacing[10] },
  centeredContainer: { alignItems: 'center', paddingTop: spacing[16] },

  closeBtn: { alignSelf: 'flex-end', padding: spacing[2], marginBottom: spacing[5] },
  closeBtnText: { fontSize: 18, color: colors.ink3 },
  backBtn: { marginBottom: spacing[6] },
  backBtnText: { fontFamily: font.mono, fontSize: 13, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },

  eyebrow: { fontFamily: font.mono, fontSize: 11, color: colors.ink3, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[3] },
  title: { fontFamily: font.sansBd, fontSize: 32, color: colors.ink, lineHeight: 38, marginBottom: spacing[3] },
  sub: { fontFamily: font.sans, fontSize: 15, color: colors.ink2, lineHeight: 22, marginBottom: spacing[2] },

  form: { marginTop: spacing[6], gap: spacing[1] },

  input: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.line2,
    borderRadius: radius.sm,
    height: 50, paddingHorizontal: spacing[4],
    fontFamily: font.sans, fontSize: 15, color: colors.ink,
  },
  inputError: { borderColor: colors.error },

  forgotLink: { alignSelf: 'flex-end', marginTop: spacing[2], marginBottom: spacing[1] },
  forgotLinkText: { fontFamily: font.sans, fontSize: 13, color: colors.forest },

  btn: {
    marginTop: spacing[4],
    backgroundColor: colors.forest,
    height: 52, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { fontFamily: font.sansBd, fontSize: 16, color: colors.white },

  legalNote: { fontFamily: font.sans, fontSize: 12, color: colors.ink4, lineHeight: 17, textAlign: 'center', marginTop: spacing[4] },

  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing[7] },
  switchText: { fontFamily: font.sans, fontSize: 14, color: colors.ink3 },
  switchLink: { fontFamily: font.sansBd, fontSize: 14, color: colors.forest },

  sentIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.forestLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[6],
  },
  sentIconText: { fontSize: 32, color: colors.forest },
});

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: spacing[4] },
  label: { fontFamily: font.mono, fontSize: 11, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[2] },
});

const errorStyles = StyleSheet.create({
  box: { backgroundColor: '#FDECEA', borderWidth: 1, borderColor: '#F5C6C2', borderRadius: radius.sm, padding: spacing[3], marginTop: spacing[2] },
  text: { fontFamily: font.sans, fontSize: 13, color: colors.error, lineHeight: 18 },
});

const strengthStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2], marginBottom: spacing[2] },
  bars: { flex: 1, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.line2 },
  label: { fontFamily: font.mono, fontSize: 11, letterSpacing: 0.3 },
});
