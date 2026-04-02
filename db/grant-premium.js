/**
 * One-time script: grant premium to a user by email.
 * Usage: node db/grant-premium.js <email>
 *
 * Run from the project root with the backend env loaded:
 *   NODE_PATH=./backend/node_modules node db/grant-premium.js kamaro.consulting@gmail.com
 */

require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const email = process.argv[2];
if (!email) { console.error('Usage: node db/grant-premium.js <email>'); process.exit(1); }

const pool = new Pool({
  host:     process.env.DB_HOST     || '127.0.0.1',
  port:     process.env.DB_PORT     || 15432,
  database: process.env.DB_NAME     || 'kyroo',
  user:     process.env.DB_USER     || 'kyroo',
  password: process.env.DB_PASSWORD || 'kyroo_pass',
  client_encoding: 'UTF8',
});

(async () => {
  const { rows } = await pool.query(
    `UPDATE users
     SET is_premium         = true,
         plan               = 'pro',
         premium_started_at = NOW(),
         premium_expires_at = NOW() + INTERVAL '100 years',
         updated_at         = NOW()
     WHERE email = $1
     RETURNING id, email, name, is_premium, plan`,
    [email.toLowerCase().trim()]
  );

  if (rows.length === 0) {
    console.error(`No account found for: ${email}`);
    process.exit(1);
  }

  const u = rows[0];
  console.log(`\n✓ Premium granted`);
  console.log(`  ID:      ${u.id}`);
  console.log(`  Email:   ${u.email}`);
  console.log(`  Name:    ${u.name}`);
  console.log(`  Premium: ${u.is_premium}`);
  console.log(`  Plan:    ${u.plan}\n`);

  await pool.end();
})();
