import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { spacing, radius, font } from '../src/lib/theme';

const TABS = ['Imprint', 'Terms', 'Privacy'] as const;
type Tab = typeof TABS[number];

export default function LegalScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('Imprint');

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Legal</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.75}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'Imprint'  && <Imprint />}
        {tab === 'Terms'    && <Terms />}
        {tab === 'Privacy'  && <Privacy />}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Imprint ────────────────────────────────────────────────────
function Imprint() {
  return (
    <View style={c.wrap}>
      <Text style={c.eyebrow}>// IMPRESSUM</Text>
      <Text style={c.title}>Imprint</Text>
      <Text style={c.sub}>Information pursuant to § 5 TMG (German Telemedia Act)</Text>

      <Section title="Operator">
        <Row label="Company" value="Kyroo" />
        <Row label="Founder" value="Damian Kamara" />
        <Row label="Email" value="legal@kyroo.de" onPress={() => Linking.openURL('mailto:legal@kyroo.de')} />
        <Row label="Website" value="app.kyroo.de" />
      </Section>

      <Section title="Responsible for Content">
        <P>Responsible for editorial content pursuant to § 55 para. 2 RStV (German Interstate Broadcasting Agreement): Damian Kamara</P>
      </Section>

      <Section title="Dispute Resolution">
        <P>
          The European Commission provides a platform for online dispute resolution (ODR):{' '}
          <Text style={c.link} onPress={() => Linking.openURL('https://ec.europa.eu/consumers/odr')}>
            https://ec.europa.eu/consumers/odr
          </Text>
        </P>
        <P>We are not obligated and not willing to participate in dispute resolution proceedings before a consumer arbitration board.</P>
      </Section>

      <Section title="Liability for Content">
        <P>As a service provider, we are responsible for our own content on these pages in accordance with general law pursuant to § 7 para. 1 TMG. According to §§ 8 to 10 TMG, however, we are not obligated to monitor transmitted or stored third-party information or to investigate circumstances that indicate illegal activity.</P>
      </Section>

      <Section title="Copyright">
        <P>The content and works created by the site operators on these pages are subject to German copyright law. Reproduction, adaptation, distribution, or any kind of exploitation outside the limits of copyright law requires the written consent of the respective author or creator.</P>
      </Section>
    </View>
  );
}

// ── Terms of Service ──────────────────────────────────────────
function Terms() {
  return (
    <View style={c.wrap}>
      <Text style={c.eyebrow}>// TERMS OF SERVICE</Text>
      <Text style={c.title}>Terms & Conditions</Text>
      <Text style={c.sub}>Last updated: April 2026</Text>

      <Section title="1. Acceptance of Terms">
        <P>By accessing or using Kyroo ("the Service"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the Service.</P>
      </Section>

      <Section title="2. Description of Service">
        <P>Kyroo is an AI-powered fitness coaching platform that generates personalised training and nutrition programs. The Service is provided "as is" and is intended for informational and motivational purposes only.</P>
        <P style={c.warning}>Kyroo is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider before starting any exercise program.</P>
      </Section>

      <Section title="3. Account Registration">
        <P>You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your credentials and for all activities that occur under your account.</P>
        <P>You must be at least 16 years old to use the Service. By registering, you confirm that you meet this age requirement.</P>
      </Section>

      <Section title="4. Subscriptions & Payments">
        <P>Kyroo offers a free tier and a Pro subscription. Subscription fees are billed in advance on a recurring basis. All payments are processed securely via Stripe.</P>
        <P>You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period. No refunds are issued for partial periods unless required by applicable law.</P>
      </Section>

      <Section title="5. Acceptable Use">
        <P>You agree not to:</P>
        <Bullet>Use the Service for any unlawful purpose</Bullet>
        <Bullet>Share your account credentials with others</Bullet>
        <Bullet>Attempt to reverse-engineer, scrape, or exploit the platform</Bullet>
        <Bullet>Submit false or misleading information</Bullet>
        <Bullet>Interfere with the security or integrity of the Service</Bullet>
      </Section>

      <Section title="6. AI-Generated Content">
        <P>Training plans are generated by artificial intelligence based on the information you provide. Results vary between individuals. Kyroo does not guarantee specific fitness outcomes. You use AI-generated plans at your own risk.</P>
      </Section>

      <Section title="7. Intellectual Property">
        <P>All content, branding, and technology within the Service is owned by Kyroo and protected by applicable intellectual property laws. You may not reproduce or distribute any part of the Service without express written permission.</P>
      </Section>

      <Section title="8. Limitation of Liability">
        <P>To the fullest extent permitted by law, Kyroo shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.</P>
      </Section>

      <Section title="9. Modifications">
        <P>We reserve the right to modify these Terms at any time. Continued use of the Service after changes are posted constitutes acceptance of the revised Terms. Material changes will be notified via email or in-app notice.</P>
      </Section>

      <Section title="10. Governing Law">
        <P>These Terms are governed by the laws of Germany. Any disputes shall be subject to the exclusive jurisdiction of German courts.</P>
      </Section>

      <Section title="Contact">
        <P>For questions about these Terms, contact us at{' '}
          <Text style={c.link} onPress={() => Linking.openURL('mailto:legal@kyroo.de')}>legal@kyroo.de</Text>
        </P>
      </Section>
    </View>
  );
}

// ── Privacy Policy / GDPR ─────────────────────────────────────
function Privacy() {
  return (
    <View style={c.wrap}>
      <Text style={c.eyebrow}>// PRIVACY & GDPR</Text>
      <Text style={c.title}>Privacy Policy</Text>
      <Text style={c.sub}>Last updated: April 2026 · GDPR compliant</Text>

      <Section title="1. Data Controller">
        <P>The data controller responsible for your personal data is the operator of Kyroo. For all data-related enquiries:</P>
        <Row label="Email" value="privacy@kyroo.de" onPress={() => Linking.openURL('mailto:privacy@kyroo.de')} />
      </Section>

      <Section title="2. Data We Collect">
        <P>We collect and process the following personal data:</P>
        <Bullet>
          <Text style={c.bold}>Account data:</Text> Name, email address, password (hashed, never stored in plain text)
        </Bullet>
        <Bullet>
          <Text style={c.bold}>Body statistics:</Text> Age, weight, height, biological sex — entered voluntarily to personalise your training plan
        </Bullet>
        <Bullet>
          <Text style={c.bold}>Usage data:</Text> Number of plans generated, subscription status, timestamps
        </Bullet>
        <Bullet>
          <Text style={c.bold}>Payment data:</Text> Payment transactions processed by Stripe. Kyroo does not store card numbers
        </Bullet>
        <Bullet>
          <Text style={c.bold}>Technical data:</Text> IP address, device type, app version — for security and diagnostics only
        </Bullet>
      </Section>

      <Section title="3. Legal Basis for Processing">
        <P>We process your data on the following legal bases under GDPR Article 6:</P>
        <Bullet><Text style={c.bold}>Art. 6(1)(b) — Contract:</Text> Processing necessary to provide the Service you signed up for</Bullet>
        <Bullet><Text style={c.bold}>Art. 6(1)(a) — Consent:</Text> For optional body statistics and marketing communications</Bullet>
        <Bullet><Text style={c.bold}>Art. 6(1)(f) — Legitimate interests:</Text> Security, fraud prevention, service improvement</Bullet>
        <Bullet><Text style={c.bold}>Art. 6(1)(c) — Legal obligation:</Text> Tax and accounting records related to subscriptions</Bullet>
      </Section>

      <Section title="4. Purpose of Processing">
        <P>Your data is used to:</P>
        <Bullet>Create and manage your account</Bullet>
        <Bullet>Generate personalised AI fitness and nutrition plans</Bullet>
        <Bullet>Process subscription payments</Bullet>
        <Bullet>Send transactional emails (account verification, password reset)</Bullet>
        <Bullet>Maintain security and prevent abuse</Bullet>
        <Bullet>Comply with legal obligations</Bullet>
      </Section>

      <Section title="5. Third-Party Processors">
        <P>We share data with the following sub-processors, all bound by data processing agreements:</P>
        <Bullet><Text style={c.bold}>Stripe Inc.</Text> — Payment processing (US, Privacy Shield / SCCs)</Bullet>
        <Bullet><Text style={c.bold}>OpenAI L.L.C.</Text> — AI plan generation. Prompts include your body stats and goals. No data is used to train OpenAI models under our enterprise agreement</Bullet>
        <Bullet><Text style={c.bold}>Our hosting provider</Text> — Server infrastructure located in the EU (Germany)</Bullet>
      </Section>

      <Section title="6. Data Retention">
        <P>We retain your personal data for as long as your account is active. If you delete your account, all personal data is permanently erased within 30 days, except where retention is required by law (e.g. payment records retained for 10 years per German tax law).</P>
      </Section>

      <Section title="7. Your Rights (GDPR Art. 15–22)">
        <P>As a data subject under GDPR, you have the following rights:</P>
        <Bullet><Text style={c.bold}>Right of access (Art. 15):</Text> Request a copy of all data we hold about you</Bullet>
        <Bullet><Text style={c.bold}>Right to rectification (Art. 16):</Text> Correct inaccurate personal data</Bullet>
        <Bullet><Text style={c.bold}>Right to erasure (Art. 17):</Text> Request deletion of your data ("right to be forgotten")</Bullet>
        <Bullet><Text style={c.bold}>Right to restriction (Art. 18):</Text> Restrict how we process your data</Bullet>
        <Bullet><Text style={c.bold}>Right to portability (Art. 20):</Text> Receive your data in a structured, machine-readable format</Bullet>
        <Bullet><Text style={c.bold}>Right to object (Art. 21):</Text> Object to processing based on legitimate interests</Bullet>
        <Bullet><Text style={c.bold}>Right to withdraw consent:</Text> Where processing is based on consent, you may withdraw at any time</Bullet>
        <P style={{ marginTop: spacing[3] }}>To exercise any of these rights, contact us at{' '}
          <Text style={c.link} onPress={() => Linking.openURL('mailto:privacy@kyroo.de')}>privacy@kyroo.de</Text>
          . We will respond within 30 days.
        </P>
      </Section>

      <Section title="8. Right to Lodge a Complaint">
        <P>You have the right to lodge a complaint with your national data protection supervisory authority. In Germany, this is the Federal Commissioner for Data Protection and Freedom of Information (BfDI):</P>
        <Row label="Website" value="bfdi.bund.de" onPress={() => Linking.openURL('https://www.bfdi.bund.de')} />
      </Section>

      <Section title="9. Cookies & Local Storage">
        <P>The Kyroo mobile app uses secure local storage (AsyncStorage) solely to store your authentication token. No third-party tracking cookies are used in the app.</P>
      </Section>

      <Section title="10. Security">
        <P>We implement industry-standard security measures including: TLS encryption in transit, bcrypt password hashing, JWT-based authentication with expiry, and restricted database access. No system is 100% secure — if you discover a vulnerability, please report it to{' '}
          <Text style={c.link} onPress={() => Linking.openURL('mailto:security@kyroo.de')}>security@kyroo.de</Text>
        </P>
      </Section>

      <Section title="11. Changes to This Policy">
        <P>We may update this Privacy Policy from time to time. Material changes will be communicated via email or in-app notification. Continued use of the Service after changes constitutes acceptance.</P>
      </Section>
    </View>
  );
}

// ── Shared sub-components ─────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={c.section}>
      <Text style={c.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function P({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[c.p, style]}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={c.bulletRow}>
      <Text style={c.bulletDot}>·</Text>
      <Text style={c.bulletText}>{children}</Text>
    </View>
  );
}

function Row({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <View style={c.row}>
      <Text style={c.rowLabel}>{label}</Text>
      <Text style={[c.rowValue, onPress && c.link]} onPress={onPress}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#0D0D0B' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: '#1C1C18',
  },
  backBtn:     { width: 60 },
  backText:    { fontFamily: font.mono, fontSize: 12, color: '#3D9E6A', textTransform: 'uppercase', letterSpacing: 0.4 },
  headerTitle: { fontFamily: font.sansBd, fontSize: 16, color: '#F5F5F2' },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0D0D0B',
    borderBottomWidth: 1, borderBottomColor: '#1C1C18',
    paddingHorizontal: spacing[4],
    gap: spacing[1],
  },
  tab: {
    flex: 1, paddingVertical: spacing[3],
    alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: '#3D9E6A' },
  tabText:       { fontFamily: font.mono, fontSize: 12, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 },
  tabTextActive: { color: '#3D9E6A' },

  content: { paddingBottom: spacing[16] },
});

const c = StyleSheet.create({
  wrap:    { padding: spacing[5] },
  eyebrow: { fontFamily: font.mono, fontSize: 11, color: '#555', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[2] },
  title:   { fontFamily: font.sansBd, fontSize: 28, color: '#F5F5F2', marginBottom: spacing[1] },
  sub:     { fontFamily: font.mono, fontSize: 11, color: '#444', marginBottom: spacing[6] },

  section:      { marginBottom: spacing[6] },
  sectionTitle: { fontFamily: font.sansBd, fontSize: 14, color: '#3D9E6A', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing[3], borderLeftWidth: 2, borderLeftColor: '#3D9E6A', paddingLeft: spacing[3] },

  p:       { fontFamily: font.sans, fontSize: 14, color: '#888', lineHeight: 22, marginBottom: spacing[3] },
  warning: { backgroundColor: '#1A0E08', borderLeftWidth: 2, borderLeftColor: '#C06848', paddingLeft: spacing[3], paddingVertical: spacing[2], borderRadius: 4, color: '#C09060' },

  bulletRow:  { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2], paddingLeft: spacing[2] },
  bulletDot:  { fontFamily: font.mono, fontSize: 14, color: '#3D9E6A', lineHeight: 22, width: 12 },
  bulletText: { flex: 1, fontFamily: font.sans, fontSize: 14, color: '#888', lineHeight: 22 },

  bold: { fontFamily: font.sansBd, color: '#CCCCC8' },
  link: { color: '#3D9E6A', textDecorationLine: 'underline' },

  row:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: '#1C1C18' },
  rowLabel: { fontFamily: font.mono, fontSize: 12, color: '#555', textTransform: 'uppercase', letterSpacing: 0.4 },
  rowValue: { fontFamily: font.sans, fontSize: 14, color: '#CCCCC8' },
});
