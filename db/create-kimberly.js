const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const pool = new Pool({ host: '127.0.0.1', port: 15433, database: 'kyroo', user: 'kyroo', password: 'kyroo_pass' });

bcrypt.hash('Kimberly2026', 10).then(hash => {
  return pool.query(
    'INSERT INTO users (email, password_hash, name, is_premium, email_verified) VALUES ($1, $2, $3, true, true) ON CONFLICT (email) DO NOTHING',
    ['kimberly@kyroo.de', hash, 'Kimberly Kamara']
  );
}).then(() => {
  console.log('Account created: kimberly@kyroo.de / Kimberly2026 (Premium)');
  pool.end();
});
