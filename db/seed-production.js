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
    hero_typewriter: 'Curated in Berlin.|Built in Prenzlauer Berg.|Trends before they trend.|Your culture, filtered.|Signal over noise.|AI, fitness, culture.|For the curious.',
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
  await pool.query("UPDATE sections SET title = $1, description = $2 WHERE slug = 'hero'", ['Curated in Berlin.', 'Trends. AI. Fitness. Culture. One place.']);
  await pool.query("UPDATE sections SET title = $1, description = NULL WHERE slug = 'explore'", ['Explore.']);
  await pool.query("UPDATE sections SET title = $1, description = NULL WHERE slug = 'newsletter'", ['Sunday mornings, sorted.']);
  console.log('Sections updated');

  // Social links
  await pool.query("UPDATE social_links SET url = $1 WHERE platform = 'Instagram'", ['https://instagram.com/kyrooai']);
  await pool.query("UPDATE social_links SET url = $1 WHERE platform = 'Twitter / X'", ['https://x.com/kyroo']);
  await pool.query("UPDATE social_links SET url = $1 WHERE platform = 'WhatsApp'", ['https://wa.me/4915155623461']);
  console.log('Social links updated');

  // Footer links
  await pool.query("DELETE FROM footer_links WHERE label IN ('About', 'Free Content')");
  await pool.query("UPDATE footer_links SET url = 'privacy' WHERE label = 'Privacy Policy'");
  await pool.query("UPDATE footer_links SET url = 'terms' WHERE label = 'Terms of Service'");
  await pool.query("UPDATE footer_links SET url = 'imprint' WHERE label = 'Imprint'");
  console.log('Footer links updated');

  await pool.end();
  console.log('Production seed complete.');
}

seed().catch(err => { console.error(err); process.exit(1); });
