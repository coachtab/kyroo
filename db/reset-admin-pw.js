const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const pool = new Pool({ host: '127.0.0.1', port: 15433, database: 'kyroo', user: 'kyroo', password: 'kyroo_pass' });

bcrypt.hash('KyrooAdmin2026', 10).then(hash => {
  return pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'okamara@gmail.com']);
}).then(() => {
  console.log('Password updated to: KyrooAdmin2026');
  pool.end();
});
