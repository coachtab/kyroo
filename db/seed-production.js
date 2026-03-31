const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 15433,
  database: 'kyroo',
  user: 'kyroo',
  password: 'kyroo_pass',
});

async function seed() {
  // Admin user
  const hash = await bcrypt.hash('Apache2008//!!', 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, name, is_admin, is_premium)
     VALUES ($1, $2, $3, true, false)
     ON CONFLICT (email) DO UPDATE SET password_hash = $2, is_admin = true`,
    ['okamara@gmail.com', hash, 'Damian Kamara']
  );
  console.log('Admin user ready');

  // Site settings
  const settings = {
    hero_typewriter: 'Your program. Your rules.|Get fit on your terms.|90 days. Your way.|Transform. Starting now.|Change starts here.',
    articles_tag: 'READ',
    articles_title: 'Read.',
    articles_desc: '',
    imprint_company: 'KYROO UG',
    imprint_street: 'Schoenhauser Allee 100',
    imprint_city: '10119 Berlin',
    imprint_phone: '(+49) 0151 / 55 623 461',
    imprint_email: 'info@kyroo.de',
    imprint_vat: 'DE12345566',
    imprint_founder: 'Damian Kamara',
    privacy_title: 'Privacy Policy',
    terms_title: 'Terms of Service',
  };

  for (const [k, v] of Object.entries(settings)) {
    await pool.query(
      'INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      [k, v]
    );
  }
  console.log('Settings seeded');

  // Sections
  await pool.query("UPDATE sections SET title = $1, description = $2 WHERE slug = 'hero'", ['Your program. Your rules.', 'Choose a program. Get your personalized plan.']);
  await pool.query("UPDATE sections SET title = $1, description = NULL WHERE slug = 'explore'", ['Explore.']);
  await pool.query("UPDATE sections SET title = $1, description = NULL WHERE slug = 'newsletter'", ['Sunday mornings, sorted.']);
  console.log('Sections updated');

  // Social links
  await pool.query("UPDATE social_links SET url = $1 WHERE platform = 'Instagram'", ['https://instagram.com/kyrooai']);
  await pool.query("UPDATE social_links SET url = $1 WHERE platform = 'Twitter / X'", ['https://x.com/kyroo']);
  await pool.query("UPDATE social_links SET url = $1 WHERE platform = 'WhatsApp'", ['https://wa.me/4915155623461']);
  console.log('Social links updated');

  // Footer links — clean single set, no duplicates
  await pool.query("DELETE FROM footer_links");
  await pool.query(`INSERT INTO footer_links (column_title, label, url, col_order, sort_order) VALUES
    ('Programs', '90-Day Challenge', '/program.html#challenge90', 1, 1),
    ('Programs', 'Getting Fit for Summer', '/program.html#summer', 1, 2),
    ('Programs', 'Weight Loss Plan', '/program.html#weightloss', 1, 3),
    ('Programs', 'Muscle Gain Plan', '/program.html#muscle', 1, 4),
    ('Legal', 'Privacy Policy', 'privacy', 2, 1),
    ('Legal', 'Terms of Service', 'terms', 2, 2),
    ('Legal', 'Imprint', 'imprint', 2, 3)`);
  console.log('Footer links updated');

  await pool.end();
  console.log('Production seed complete.');
}

seed().catch(err => { console.error(err); process.exit(1); });
