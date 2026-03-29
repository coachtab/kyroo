const { Pool } = require('pg');
const pool = new Pool({ host: '127.0.0.1', port: 15433, database: 'kyroo', user: 'kyroo', password: 'kyroo_pass' });

const privacy = `KYROO UG operates the KYROO platform. This Privacy Policy explains how we collect, use, and protect your personal data in accordance with the EU General Data Protection Regulation (GDPR/DSGVO).

1. Data Controller
KYROO UG
Schoenhauser Allee 100
10119 Berlin, Germany
E-Mail: info@kyroo.de

2. Data We Collect
- Account data: email address, name, password (hashed)
- Subscription data: plan type, payment history
- Usage data: pages visited, articles read
- Newsletter: email address and subscription date
- Technical data: IP address, browser type (via server logs)

3. How We Use Your Data
- To provide and improve the KYROO platform
- To process payments and manage subscriptions
- To send newsletters you have opted into
- To analyze usage patterns and improve content
- To comply with legal obligations

4. Legal Basis (GDPR Art. 6)
- Contract performance: account management, subscriptions
- Legitimate interest: analytics, platform improvement
- Consent: newsletter, marketing communications

5. Data Sharing
We do not sell your data. We share data only with:
- Stripe (payment processing)
- Hosting providers (infrastructure)

6. Data Retention
- Account data: retained while your account is active, deleted within 30 days of account deletion
- Payment records: retained for 10 years (German tax law)
- Newsletter data: retained until you unsubscribe
- Server logs: deleted after 90 days

7. Your Rights (GDPR Art. 15-21)
You have the right to:
- Access your personal data (Art. 15)
- Rectify inaccurate data (Art. 16)
- Erase your data - right to be forgotten (Art. 17)
- Restrict processing (Art. 18)
- Data portability (Art. 20)
- Object to processing (Art. 21)
- Withdraw consent at any time

To exercise these rights, use the functions in your account (Export data / Delete account) or contact us at info@kyroo.de.

8. Cookies
We use only essential cookies for authentication and session management. No tracking cookies are used.

9. Payment Processing
Payments are processed by Stripe. KYROO never stores or has access to your full card number. Stripe's privacy policy applies to payment data.

10. Changes
We may update this policy. Changes will be posted on this page with an updated date.

Last updated: March 2026`;

const terms = `Welcome to KYROO. By using our platform, you agree to these Terms of Service.

1. About KYROO
KYROO is operated by KYROO UG, Schoenhauser Allee 100, 10119 Berlin, Germany. KYROO is a discovery and lifestyle platform offering editorial content on trends, fitness, and lifestyle.

2. Accounts
- You must be at least 16 years old to create an account
- You are responsible for keeping your login credentials secure
- One account per person
- We reserve the right to suspend accounts that violate these terms

3. Free Content
Free articles and content are available to all users at no cost. We reserve the right to change which content is free at any time.

4. KYROO Premium
- Premium subscriptions are available monthly (6 EUR/month) or annually (72 EUR/year)
- Subscriptions auto-renew unless cancelled before the renewal date
- You can cancel anytime from your account settings
- Refunds are available within 14 days of initial purchase if no premium content has been accessed
- Premium features include exclusive content and the Train Together feature
- Premium content is for personal use only and may not be redistributed

5. Train Together
- The Train Together feature allows premium users to check in at training locations
- Check-ins are visible to other users and expire after 2 hours
- KYROO is not responsible for interactions between users at training locations
- Use this feature at your own risk

6. Payment
- Payments are processed securely via Stripe
- We accept credit/debit cards and PayPal
- All prices include applicable VAT (German VAT: 19%)
- Failed payments may result in temporary loss of premium access

7. Content
- All content on KYROO is protected by copyright
- You may share article links but not reproduce full article text
- We reserve the right to remove content at our discretion

8. AI-Generated Content
Some articles on KYROO may be generated or assisted by AI. All AI content is reviewed by our editorial team before publication.

9. Limitation of Liability
KYROO provides editorial content for informational purposes only. We are not liable for decisions made based on our content, including fitness advice or lifestyle recommendations.

10. Governing Law
These terms are governed by the laws of the Federal Republic of Germany. The courts of Berlin have exclusive jurisdiction.

11. Contact
KYROO UG
Schoenhauser Allee 100
10119 Berlin
E-Mail: info@kyroo.de

Last updated: March 2026`;

async function seed() {
  await pool.query(
    "INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
    ['privacy_body', privacy]
  );
  await pool.query(
    "INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
    ['terms_body', terms]
  );
  console.log('Privacy Policy and Terms of Service seeded.');
  await pool.end();
}

seed();
