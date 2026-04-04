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

type AuthView = 'login' | 'signup' | 'signup-sent' | 'forgot' | 'forgot-sent';

export default function AuthScreen() {
  const params = useLocalSearchParams<{ tab?: string; verified?: string; error?: string }>();
  const initialView: AuthView = params.tab === 'signup' ? 'signup' : 'login';
  const [view, setView] = useState<AuthView>(initialView);
  const [signupEmail, setSignupEmail] = useState('');

  const verifiedBanner = params.verified === 'true';
  const expiredBanner  = params.error === 'expired';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {(verifiedBanner || expiredBanner) && (
          <View style={[styles.banner, expiredBanner && styles.bannerError]}>
            <Text style={styles.bannerText}>
              {verifiedBanner ? '✓  Email verified — you can now sign in.' : '✕  Link expired or already used. Please sign up again.'}
            </Text>
          </View>
        )}
        {view === 'login'        && <LoginView onSignup={() => setView('signup')} onForgot={() => setView('forgot')} />}
        {view === 'signup'       && <SignupView onLogin={() => setView('login')} onSent={e => { setSignupEmail(e); setView('signup-sent'); }} />}
        {view === 'signup-sent'  && <SignupSentView email={signupEmail} onLogin={() => setView('login')} />}
        {view === 'forgot'       && <ForgotView onBack={() => setView('login')} onSent={() => setView('forgot-sent')} />}
        {view === 'forgot-sent'  && <ForgotSentView onBack={() => setView('login')} />}
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

      {/* Brand mark */}
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>K</Text>
      </View>

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
            placeholderTextColor="#555"
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
            placeholderTextColor="#555"
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
function SignupView({ onLogin, onSent }: { onLogin: () => void; onSent: (email: string) => void }) {
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
      onSent(e);
    } catch (err: any) {
      setError(err.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <CloseBtn />

      {/* Brand mark */}
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>K</Text>
      </View>

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
            placeholderTextColor="#555"
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
            placeholderTextColor="#555"
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
            placeholderTextColor="#555"
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
            placeholderTextColor="#555"
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

// ─── SIGNUP SENT ─────────────────────────────────────────────
function SignupSentView({ email, onLogin }: { email: string; onLogin: () => void }) {
  return (
    <ScrollView contentContainerStyle={[styles.container, styles.centeredContainer]} keyboardShouldPersistTaps="handled">
      <View style={styles.sentIcon}><Text style={styles.sentIconText}>✉️</Text></View>
      <Text style={styles.eyebrow}>// CHECK YOUR EMAIL</Text>
      <Text style={styles.title}>One more step.</Text>
      <Text style={styles.sub}>
        We sent an activation link to{'\n'}
        <Text style={styles.sentEmail}>{email}</Text>
      </Text>
      <Text style={[styles.sub, { marginTop: spacing[4] }]}>
        Click the link in the email to activate your account. Check your spam folder if you don't see it.
      </Text>
      <TouchableOpacity style={[styles.btn, { marginTop: spacing[8], alignSelf: 'stretch' }]} onPress={onLogin}>
        <Text style={styles.btnText}>Back to sign in</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── FORGOT ──────────────────────────────────────────────────
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
            placeholderTextColor="#555"
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

      <TouchableOpacity style={[styles.btn, { marginTop: spacing[8], alignSelf: 'stretch' }]} onPress={onBack}>
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
  const barColors = ['#C06848', '#E67E22', '#C8873A', '#3D9E6A'];
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
  safe: { flex: 1, backgroundColor: '#0D0D0B' },
  container: { padding: spacing[5], paddingTop: spacing[6], paddingBottom: spacing[10] },
  centeredContainer: { alignItems: 'center', paddingTop: spacing[16] },

  brandMark: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#3D9E6A',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
    marginTop: spacing[8], marginBottom: spacing[6],
  },
  brandMarkText: { fontFamily: font.sansBd, fontSize: 28, color: '#FFFFFF' },

  banner: { backgroundColor: '#0F2318', borderBottomWidth: 1, borderBottomColor: '#3D9E6A', paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
  bannerError: { backgroundColor: '#2A1510', borderBottomColor: '#C06848' },
  bannerText: { fontFamily: font.sans, fontSize: 13, color: '#6DBF8A', lineHeight: 18 },

  closeBtn: { alignSelf: 'flex-end', padding: spacing[2], marginBottom: spacing[5] },
  closeBtnText: { fontSize: 18, color: '#444' },
  backBtn: { marginBottom: spacing[6] },
  backBtnText: { fontFamily: font.mono, fontSize: 13, color: '#3D9E6A', textTransform: 'uppercase', letterSpacing: 0.5 },

  eyebrow: { fontFamily: font.mono, fontSize: 11, color: '#555', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[3] },
  title: { fontFamily: font.sansBd, fontSize: 32, color: '#F5F5F2', lineHeight: 38, marginBottom: spacing[3] },
  sub: { fontFamily: font.sans, fontSize: 15, color: '#888', lineHeight: 22, marginBottom: spacing[2] },

  form: { marginTop: spacing[6], gap: spacing[1] },

  input: {
    backgroundColor: '#181816',
    borderWidth: 1, borderColor: '#252520',
    borderRadius: radius.sm,
    height: 52, paddingHorizontal: spacing[4],
    fontFamily: font.sans, fontSize: 16, color: '#F5F5F2',
  },
  inputError: { borderColor: '#C06848' },

  forgotLink: { alignSelf: 'flex-end', marginTop: spacing[2], marginBottom: spacing[1] },
  forgotLinkText: { fontFamily: font.sans, fontSize: 13, color: '#3D9E6A' },

  btn: {
    marginTop: spacing[4],
    backgroundColor: '#3D9E6A',
    height: 52, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { fontFamily: font.sansBd, fontSize: 16, color: '#FFFFFF' },

  legalNote: { fontFamily: font.sans, fontSize: 12, color: '#555', lineHeight: 17, textAlign: 'center', marginTop: spacing[4] },

  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing[7] },
  switchText: { fontFamily: font.sans, fontSize: 14, color: '#555' },
  switchLink: { fontFamily: font.sansBd, fontSize: 14, color: '#3D9E6A' },

  sentIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#0F2318',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[6],
  },
  sentIconText: { fontSize: 32, color: '#3D9E6A' },
  sentEmail: { fontFamily: font.sansBd, color: '#F5F5F2' },
});

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: spacing[4] },
  label: { fontFamily: font.mono, fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[2] },
});

const errorStyles = StyleSheet.create({
  box: { backgroundColor: '#2A1510', borderWidth: 1, borderColor: '#5A2510', borderRadius: radius.sm, padding: spacing[3], marginTop: spacing[2] },
  text: { fontFamily: font.sans, fontSize: 13, color: '#C06848', lineHeight: 18 },
});

const strengthStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2], marginBottom: spacing[2] },
  bars: { flex: 1, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#252520' },
  label: { fontFamily: font.mono, fontSize: 11, letterSpacing: 0.3 },
});
