#!/usr/bin/env node
// Seed test users for all roles.
// Usage: node db/seed-test-users.js
// Run from the project root (where .env lives).

const path = require('path');
const fs = require('fs');

// Load .env from project root
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    });
}

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host:     process.env.DB_HOST     || '127.0.0.1',
  port:     process.env.DB_PORT     || 15432,
  database: process.env.DB_NAME     || 'kyroo',
  user:     process.env.DB_USER     || 'kyroo',
  password: process.env.DB_PASSWORD || 'kyroo_pass',
});

const TEST_PASSWORD = 'test1234';

const TEST_USERS = [
  { email: 'free@kyroo.test',  name: 'Free User',  plan: 'free',  is_admin: false },
  { email: 'basic@kyroo.test', name: 'Basic User', plan: 'basic', is_admin: false },
  { email: 'pro@kyroo.test',   name: 'Pro User',   plan: 'pro',   is_admin: false },
  { email: 'admin@kyroo.test', name: 'Admin User', plan: 'pro',   is_admin: true  },
];

async function run() {
  console.log('\n  Kyroo — Seeding test users\n');

  // Ensure schema has all required columns (idempotent — run each separately)
  const alterStatements = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin              BOOLEAN DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS plan                  VARCHAR(20) DEFAULT 'free'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified        BOOLEAN DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token          VARCHAR(255)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token           VARCHAR(255)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires   TIMESTAMP`,
  ];
  for (const sql of alterStatements) await pool.query(sql);

  // Ensure ai_usage table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_usage (
      id           SERIAL PRIMARY KEY,
      user_id      INT REFERENCES users(id) ON DELETE CASCADE,
      program_type VARCHAR(100),
      tokens_used  INT DEFAULT 0,
      created_at   TIMESTAMP DEFAULT NOW()
    );
  `);

  const hash = await bcrypt.hash(TEST_PASSWORD, 10);

  for (const u of TEST_USERS) {
    await pool.query(
      `INSERT INTO users (email, password_hash, name, plan, is_admin, is_premium, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             name          = EXCLUDED.name,
             plan          = EXCLUDED.plan,
             is_admin      = EXCLUDED.is_admin,
             is_premium    = EXCLUDED.is_premium,
             email_verified = true`,
      [u.email, hash, u.name, u.plan, u.is_admin, u.plan !== 'free']
    );
    const tag = u.is_admin ? ' [ADMIN]' : '';
    console.log(`  ✓  ${u.email.padEnd(22)}  plan: ${u.plan.padEnd(5)}${tag}`);
  }

  console.log(`\n  Password for all accounts: ${TEST_PASSWORD}`);
  console.log('\n  Done.\n');
  await pool.end();
}

run().catch(err => {
  console.error('\n  [ERROR]', err.message);
  process.exit(1);
});
