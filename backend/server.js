const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
const Stripe = require('stripe');
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const nodemailer = require('nodemailer');
const multer = require('multer');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger.json');
const Anthropic = require('@anthropic-ai/sdk');

// Shared rules injected into every AI system prompt
const KYROO_SYSTEM_RULES = `LANGUAGE RULES: Write in simple, short sentences. Use everyday English — no fancy words. Explain every term the first time. Use bullet points and numbered lists. A 14-year-old should understand every sentence. This is a print-ready PDF.
BRAND RULES: Do NOT mention any third-party apps or platforms by name (e.g. MyFitnessPal, Strava, Nike Training Club, Cronometer, Garmin Connect, etc.). If you need to refer to a tracking app or tool, refer to it as "Kyroo".`;

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'kyroo-secret-change-in-production';
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// Email transporter
const mailTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

let smtpVerified = false;
let smtpWorks = false;

async function sendEmail(to, subject, html) {
  // Extract any verification/reset links for console output
  const linkMatch = html.match(/href="(http[^"]+(?:verify|reset)[^"]*)"/);
  const link = linkMatch ? linkMatch[1] : null;

  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
    if (link) console.log(`[EMAIL] Link: ${link}`);
    return;
  }

  // Only try SMTP if it has not already failed
  if (smtpVerified && !smtpWorks) {
    console.log(`[EMAIL] SMTP unavailable. To: ${to} | Subject: ${subject}`);
    if (link) console.log(`[EMAIL] Link: ${link}`);
    return;
  }

  try {
    await mailTransport.sendMail({
      from: `"KYROO" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    smtpVerified = true;
    smtpWorks = true;
    console.log(`[EMAIL] Sent to ${to}`);
  } catch (err) {
    smtpVerified = true;
    smtpWorks = false;
    console.log(`[EMAIL] SMTP failed (${err.code}). To: ${to} | Subject: ${subject}`);
    if (link) console.log(`[EMAIL] Link: ${link}`);
  }
}

// Database connection with retry logic
const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 15432,
  database: process.env.DB_NAME || 'kyroo',
  user: process.env.DB_USER || 'kyroo',
  password: process.env.DB_PASSWORD || 'kyroo_pass',
  client_encoding: 'UTF8',
});

async function waitForDb(retries = 15, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('Database connected.');
      return;
    } catch (err) {
      console.log(`Waiting for database... (${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Could not connect to database');
}

// Middleware
const corsOptions = {
  origin: [
    'https://kyroo.de',
    'https://www.kyroo.de',
    'https://app.kyroo.de',
    'http://localhost:3001',
    'http://localhost:8081',
    'http://localhost:19006',
  ],
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // handle preflight for all routes
app.use(express.json({
  type: 'application/json',
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));

// Force UTF-8 charset on every JSON/text response
app.use((_req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Accept-Charset', 'utf-8');
  next();
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'KYROO API Docs',
}));

const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

// -- Auth middleware --
function authOptional(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
    } catch (e) {
      req.user = null;
    }
  }
  next();
}

function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Login required' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, is_premium: user.is_premium, is_admin: user.is_admin || false, plan: user.plan || 'free' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Plan limits — free users get 5 generations/month, Pro is unlimited
const PLAN_LIMITS = { free: 5, basic: 5, pro: Infinity };

// Programs accessible on the free plan
const FREE_PROGRAM_IDS = new Set(['beginner', 'home']);

async function getUserUsageThisMonth(userId) {
  const { rows } = await pool.query(
    "SELECT COUNT(*) as count FROM ai_usage WHERE user_id = $1 AND created_at >= date_trunc('month', NOW())",
    [userId]
  );
  return parseInt(rows[0].count);
}

async function canGenerateProgram(userId, plan) {
  if (plan === 'pro' || plan === 'admin') return { allowed: true, used: 0, limit: Infinity };
  const used = await getUserUsageThisMonth(userId);
  const limit = PLAN_LIMITS[plan] || 0;
  return { allowed: used < limit, used, limit };
}

async function recordUsage(userId, programType, tokensUsed) {
  await pool.query(
    'INSERT INTO ai_usage (user_id, program_type, tokens_used) VALUES ($1, $2, $3)',
    [userId, programType, tokensUsed || 0]
  );
}

async function checkProgramAccess(req, res, programId) {
  const { rows } = await pool.query('SELECT plan, is_admin, is_premium FROM users WHERE id = $1', [req.user.id]);
  if (rows.length === 0) { res.status(401).json({ error: 'User not found' }); return false; }
  const user = rows[0];

  // Admins: unlimited, unrestricted
  if (user.is_admin) return true;

  const plan = user.plan || 'free';
  const isPro = user.is_premium || plan === 'pro';

  // Block free users from premium programs (they can still use beginner & home)
  const isFreeProgram = !programId || FREE_PROGRAM_IDS.has(programId);
  if (!isPro && !isFreeProgram) {
    res.status(403).json({ error: 'Upgrade to Pro to unlock all programs.', plan });
    return false;
  }

  // Pro users: unlimited
  if (isPro) return true;

  // Free / basic users: enforce monthly generation limit
  const { allowed, used, limit } = await canGenerateProgram(req.user.id, plan);
  if (!allowed) {
    res.status(429).json({
      error: `You've used all ${limit} plans this month. Upgrade to Pro for unlimited.`,
      used, limit, plan,
    });
    return false;
  }
  return true;
}

function adminRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Login required' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    if (!decoded.is_admin) return res.status(403).json({ error: 'Admin access required' });
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ========================================
// Auth Routes
// ========================================

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    const hash = await bcrypt.hash(password, 10);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, name, verify_token, plan) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, is_premium, is_admin, plan, email_verified, created_at',
      [email, hash, name || null, verifyToken, 'free']
    );
    const user = rows[0];

    // Send verification email before issuing any token
    const verifyUrl = `${BASE_URL}/api/auth/verify?token=${verifyToken}`;
    sendEmail(email, 'Welcome to KYROO – Verify your email', `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;background:#f9f8f5">
        <h1 style="font-size:24px;margin-bottom:8px;color:#1a1a2e">Welcome to KYROO${name ? ', ' + name : ''}!</h1>
        <p style="color:#666;margin-bottom:32px">One last step — verify your email to activate your account.</p>
        <a href="${verifyUrl}" style="display:inline-block;background:#4a6741;color:#fff;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px">Activate my account</a>
        <p style="color:#999;font-size:12px;margin-top:32px">Or copy this link:<br>${verifyUrl}</p>
        <p style="color:#ccc;font-size:11px;margin-top:16px">If you didn't create this account, you can safely ignore this email.</p>
      </div>
    `).catch(err => console.error('Verification email failed:', err.message));

    // No token issued — user must verify email first
    res.status(201).json({ message: 'Account created. Please check your email and click the activation link to sign in.' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// GET /api/auth/verify - email verification
app.get('/api/auth/verify', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Invalid link');
  try {
    const { rowCount } = await pool.query(
      'UPDATE users SET email_verified = true, verify_token = NULL WHERE verify_token = $1',
      [token]
    );
    if (rowCount === 0) return res.redirect('https://app.kyroo.de/auth?error=expired');
    res.redirect('https://app.kyroo.de/auth?verified=true');
  } catch (err) {
    res.status(500).send('Verification failed');
  }
});

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const { rows } = await pool.query('SELECT id, email, name FROM users WHERE email = $1', [email]);
    // Always return success to prevent email enumeration
    if (rows.length === 0) return res.json({ success: true });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, expires, rows[0].id]
    );

    const resetUrl = `https://app.kyroo.de/reset-password?token=${resetToken}`;
    await sendEmail(email, 'KYROO - Reset your password', `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
        <h1 style="font-size:24px;margin-bottom:8px">Reset your password</h1>
        <p style="color:#666;margin-bottom:32px">Click below to set a new password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#c27a56;color:#fff;padding:12px 32px;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px">Reset password</a>
        <p style="color:#999;font-size:12px;margin-top:32px">If you didn't request this, ignore this email.</p>
      </div>
    `).catch(err => console.error('Reset email failed:', err.message));

    res.json({ success: true });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and new password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );
    if (rows.length === 0) return res.status(400).json({ error: 'Invalid or expired reset link' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hash, rows[0].id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email before signing in. Check your inbox for the activation link.', unverified: true });
    }
    const token = generateToken(user);
    res.json({
      user: { id: user.id, email: user.email, name: user.name, is_premium: user.is_premium, is_admin: user.is_admin, plan: user.plan || 'free' },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, is_premium, is_admin, plan, premium_started_at, premium_expires_at, created_at, body_age, body_weight, body_height, body_sex FROM users WHERE id = $1',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];
    const used = await getUserUsageThisMonth(user.id);
    const limit = user.is_admin ? Infinity : (PLAN_LIMITS[user.plan] || 0);
    res.json({ ...user, usage: { used, limit, remaining: Math.max(0, limit - used) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PATCH /api/auth/body-stats — save body stats once, reused across all wizards
app.patch('/api/auth/body-stats', authRequired, async (req, res) => {
  const { age, weight, height, sex } = req.body;
  const a = parseInt(age, 10);
  const w = parseFloat(weight);
  const h = parseInt(height, 10);
  if (!a || a < 10 || a > 100) return res.status(400).json({ error: 'Invalid age.' });
  if (!w || w < 20 || w > 300) return res.status(400).json({ error: 'Invalid weight.' });
  if (!h || h < 100 || h > 250) return res.status(400).json({ error: 'Invalid height.' });
  try {
    await pool.query(
      'UPDATE users SET body_age=$1, body_weight=$2, body_height=$3, body_sex=$4 WHERE id=$5',
      [a, w, h, sex || 'male', req.user.id]
    );
    res.json({ message: 'Body stats saved.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save body stats.' });
  }
});

// ── Saved Plans ─────────────────────────────────────────────
app.post('/api/plans', authRequired, async (req, res) => {
  const { program_id, program_name, program_icon, content } = req.body;
  if (!program_id || !program_name || !content) return res.status(400).json({ error: 'Missing fields.' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO user_plans (user_id, program_id, program_name, program_icon, content) VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at',
      [req.user.id, program_id, program_name, program_icon || '', content]
    );
    res.status(201).json({ id: rows[0].id, created_at: rows[0].created_at });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save plan.' });
  }
});

app.get('/api/plans', authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, program_id, program_name, program_icon, content, created_at FROM user_plans WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ plans: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch plans.' });
  }
});

app.delete('/api/plans/:id', authRequired, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM user_plans WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Plan not found.' });
    res.json({ message: 'Plan deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete plan.' });
  }
});

app.patch('/api/auth/update-profile', authRequired, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
  try {
    await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name.trim(), req.user.id]);
    res.json({ message: 'Profile updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

app.post('/api/auth/change-password', authRequired, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'All fields are required.' });
  if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  try {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });
    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Password changed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// ========================================
// Premium Subscription Routes
// ========================================

// ---- Train Together ----

// GET /api/locations - list training locations
app.get('/api/locations', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM training_locations ORDER BY sort_order');
  res.json(rows);
});

// GET /api/checkins - get active check-ins
app.get('/api/checkins', async (req, res) => {
  // Clean expired
  await pool.query('DELETE FROM checkins WHERE expires_at < NOW()');

  const { rows } = await pool.query(`
    SELECT c.id, c.location, c.activity, c.user_name, c.created_at, c.expires_at,
           tl.name as location_name, tl.short_name
    FROM checkins c
    JOIN training_locations tl ON c.location = tl.slug
    WHERE c.expires_at > NOW()
    ORDER BY c.created_at DESC
  `);
  res.json(rows);
});

// GET /api/checkins/counts - get counts per location
app.get('/api/checkins/counts', async (req, res) => {
  await pool.query('DELETE FROM checkins WHERE expires_at < NOW()');
  const { rows } = await pool.query(`
    SELECT tl.slug, tl.name, tl.short_name, COUNT(c.id)::int as count
    FROM training_locations tl
    LEFT JOIN checkins c ON c.location = tl.slug AND c.expires_at > NOW()
    GROUP BY tl.slug, tl.name, tl.short_name
    ORDER BY tl.sort_order
  `);
  res.json(rows);
});

// POST /api/checkins - check in
app.post('/api/checkins', authRequired, async (req, res) => {
  const { location, activity } = req.body;
  if (!location) return res.status(400).json({ error: 'Location required' });

  // Verify location exists
  const loc = await pool.query('SELECT slug FROM training_locations WHERE slug = $1', [location]);
  if (loc.rows.length === 0) return res.status(400).json({ error: 'Invalid location' });

  // Remove any existing check-in for this user
  await pool.query('DELETE FROM checkins WHERE user_id = $1', [req.user.id]);

  // Get user name
  const user = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
  const userName = user.rows[0]?.name || req.user.email.split('@')[0];

  const { rows } = await pool.query(
    'INSERT INTO checkins (user_id, user_name, location, activity) VALUES ($1, $2, $3, $4) RETURNING *',
    [req.user.id, userName, location, activity || null]
  );

  broadcast('checkin', { location, activity, user_name: userName });
  res.status(201).json(rows[0]);
});

// DELETE /api/checkins - check out
app.delete('/api/checkins', authRequired, async (req, res) => {
  await pool.query('DELETE FROM checkins WHERE user_id = $1', [req.user.id]);
  broadcast('checkout', { user_id: req.user.id });
  res.json({ success: true });
});

// ── Program-specific prompt builder ─────────────────────────────────────────
function buildProgramPrompt(programId, data) {
  const {
    level, age, weight, height, sex,
    days_per_week, session_minutes, equipment,
    primary_goal, nutrition, biggest_challenge, injuries, timeframe, muscle_focus, challenge_vision, beginner_vision,
  } = data;

  const clientBase = [
    `- Age: ${age} | Sex: ${sex} | Weight: ${weight}kg | Height: ${height}cm`,
    `- Experience level: ${level}`,
    `- Available days: ${days_per_week} days/week | Session length: ~${session_minutes || 60} min`,
    `- Equipment: ${equipment || 'full commercial gym'}`,
    `- Biggest challenge: ${biggest_challenge || 'staying consistent'}`,
    `- Injuries / limitations: ${injuries || 'None'}`,
    `- Nutrition focus requested: ${nutrition || 'basic principles'}`,
  ].join('\n');

  switch (programId) {

    // ── 1. Weight Loss ──────────────────────────────────────────────────────
    case 'weightloss': {
      const wlDuration = timeframe || '12 weeks';
      // Build phases dynamically based on duration
      const wlWeeks = parseInt(wlDuration) || 12;
      const phase1End = Math.round(wlWeeks * 0.33);
      const phase2End = Math.round(wlWeeks * 0.66);
      const phaseBreakdown = wlWeeks <= 4
        ? `### Phase 1 — Weeks 1–2: Foundation (Build the habit)\n### Phase 2 — Weeks 3–4: Acceleration (Push harder)`
        : `### Phase 1 — Weeks 1–${phase1End}: Foundation (Build the habit)\n### Phase 2 — Weeks ${phase1End + 1}–${phase2End}: Acceleration (Increase intensity)\n### Phase 3 — Weeks ${phase2End + 1}–${wlWeeks}: Peak (Push to the finish)`;
      return {
        system: `You are a specialist fat-loss coach and registered dietitian with 12+ years helping clients shed body fat permanently — not just lose water weight. Every plan you write combines calorie-deficit nutrition, metabolic conditioning, and strategic cardio. You NEVER recommend crash diets, starvation, or unsustainable methods. You write so a complete beginner understands everything.\n\n${KYROO_SYSTEM_RULES}`,
        user: `CLIENT PROFILE:\n${clientBase}\n- Primary goal: ${primary_goal || 'lose body fat'}\n- Target timeframe: ${wlDuration}\n\nCreate a complete ${wlDuration.toUpperCase()} WEIGHT LOSS PLAN. This plan must be ONLY about fat loss — no muscle-building programs repackaged as fat loss.\n\nSTRUCTURE YOUR PLAN EXACTLY LIKE THIS:\n\n# KYROO ${wlDuration.toUpperCase()} WEIGHT LOSS PLAN\nDesigned for: ${level} | ${days_per_week} days/week | Goal: Sustainable fat loss in ${wlDuration}\n\n## YOUR FAT-LOSS STRATEGY (plain English, 3-4 sentences)\nExplain caloric deficit, why this works, and what makes this plan realistic for ${wlDuration}.\n\n## DAILY CALORIE & MACRO TARGETS\n- Calculate and state their estimated TDEE\n- Recommend a deficit (state exact kcal target)\n- Protein, carbs, fat in grams with a one-line reason for each\n- Give 3 simple food swap examples\n\n## WEEKLY TRAINING STRUCTURE\nFor each of the ${days_per_week} training days per week, label as: FAT-BURN SESSION or RESISTANCE SESSION\n- FAT-BURN SESSIONS: cardio-focused (LISS, HIIT, or circuit). Explain what LISS and HIIT mean the first time. State duration, intensity (heart-rate zone or RPE), and exact format.\n- RESISTANCE SESSIONS: full-body or upper/lower. Use compound movements to preserve muscle during deficit. For every exercise include: name, one-line how-to, sets × reps, rest.\n\n## PHASE BREAKDOWN\n${phaseBreakdown}\nFor each phase: training approach, calorie adjustments if needed, what to expect on the scales.\n\n## WEEKLY CHECK-IN SYSTEM\nWhat to track each week (weight, measurements, energy levels). How to adjust if fat loss stalls.\n\n## WHAT NOT TO DO\n3 common fat-loss mistakes this client must avoid.`,
        maxTokens: 8000,
      };
    }

    // ── 2. Muscle Building ──────────────────────────────────────────────────
    case 'muscle': {
      const mbDuration = timeframe || '16 weeks';
      const mbWeeks = parseInt(mbDuration) || 16;
      // Build phase breakdown scaled to duration
      let mbPhases;
      if (mbWeeks <= 8) {
        mbPhases = `## PHASE 1 — WEEKS 1–4: FOUNDATION\n- Goal: Establish baseline loads, master technique\n- For each session: exercise name, one-line how-to, sets × reps, tempo, rest\n- Weekly progression rule: how much weight to add and when\n\n## PHASE 2 — WEEKS 5–${mbWeeks}: VOLUME BLOCK\n- Goal: Increase sets per muscle group to drive hypertrophy\n- Show total weekly sets per muscle group\n- Week ${mbWeeks}: Active deload — explain what to change and why`;
      } else if (mbWeeks <= 12) {
        mbPhases = `## PHASE 1 — WEEKS 1–4: FOUNDATION\n- Goal: Master technique, establish baseline loads\n- For each session: exercise name, one-line how-to, sets × reps, tempo, rest\n- Weekly progression rule\n\n## PHASE 2 — WEEKS 5–8: VOLUME BLOCK\n- Goal: Increase weekly sets to drive hypertrophy\n- Show total weekly sets per muscle group\n\n## PHASE 3 — WEEKS 9–${mbWeeks}: INTENSITY & PEAK\n- Goal: Higher loads, lower reps, mechanical tension\n- Week ${mbWeeks}: Active deload — explain what deload means and why it accelerates gains`;
      } else {
        mbPhases = `## PHASE 1 — WEEKS 1–4: FOUNDATION\n- Goal: Master technique, establish baseline loads\n- For each session: exercise name, one-line how-to, sets × reps, tempo (explain tempo notation once), rest\n- Weekly progression rule: how much weight to add and when\n\n## PHASE 2 — WEEKS 5–8: VOLUME BLOCK\n- Goal: Increase weekly sets to drive hypertrophy\n- New exercises introduced, volume increased per muscle group\n- Show total weekly sets per muscle group\n\n## PHASE 3 — WEEKS 9–12: INTENSITY BLOCK\n- Goal: Higher loads, lower reps, more mechanical tension\n- Explain the shift from volume to intensity and why it matters\n\n## PHASE 4 — WEEKS 13–${mbWeeks}: PEAK & DELOAD\n- Weeks 13–${mbWeeks - 1}: Peak performance — hardest sessions of the program\n- Week ${mbWeeks}: Full deload — explain what deload means, what to change, why it boosts long-term gains`;
      }
      return {
        system: `You are an elite hypertrophy coach with a decade of experience programming for natural athletes. You specialise in progressive overload, optimal training volume, and evidence-based muscle-building protocols. You write programs that maximise muscle growth within the time and equipment available. You never write generic fitness advice — every recommendation is specific and actionable.\n\n${KYROO_SYSTEM_RULES}`,
        user: `CLIENT PROFILE:\n${clientBase}\n- Primary goal: ${primary_goal || 'build muscle mass'}\n- Muscle priority: ${muscle_focus || 'full body balanced development'}\n- Target timeframe: ${mbDuration}\n\nCreate a complete ${mbDuration.toUpperCase()} MUSCLE BUILDING PROGRAM. This is PURELY a hypertrophy program — no cardio-heavy fat-loss content.\n\nSTRUCTURE YOUR PLAN EXACTLY LIKE THIS:\n\n# KYROO ${mbDuration.toUpperCase()} MUSCLE BUILDING PROGRAM\nDesigned for: ${level} | ${days_per_week} days/week | Goal: ${primary_goal || 'Maximum hypertrophy'}\nMuscle priority: ${muscle_focus || 'full body balanced'}\n\n## THE SCIENCE OF YOUR PROGRAM (3-4 sentences, plain English)\nExplain progressive overload, muscle protein synthesis, and why this ${mbDuration} structure works for this client's goal.\n\n## YOUR TRAINING SPLIT\nRecommend the best split for ${days_per_week} days/week (e.g. Push/Pull/Legs, Upper/Lower, Full Body). Explain why this split was chosen and how it targets ${muscle_focus || 'all muscle groups'} effectively.\n\n${mbPhases}\n\n## NUTRITION FOR MUSCLE GROWTH\n- Calorie surplus recommendation (state exact kcal target above their estimated TDEE)\n- Protein target in grams per kg of bodyweight — explain why\n- Meal timing around training (pre/post workout windows)\n- ${nutrition}\n\n## RECOVERY PROTOCOL\nSleep targets, rest day activity, how to recognise overtraining vs normal fatigue.\n\n## WHAT NOT TO DO\n3 muscle-building mistakes this client — given their level and goal — must avoid.`,
        maxTokens: 8000,
      };
    }

    // ── 3. 90-Day Challenge ─────────────────────────────────────────────────
    case 'challenge90':
      return {
        system: `You are a transformation coach who specialises in 90-day body and habit transformations. Your tone is direct, motivating, and honest — like a brilliant coach who has seen it all and knows exactly what separates people who finish from those who quit. You write accountability-first programs with clear daily actions, weekly milestones, and an escalating challenge structure across three 30-day phases.\n\n${KYROO_SYSTEM_RULES}`,
        user: `CLIENT PROFILE:\n${clientBase}\n- Transformation goal: ${primary_goal || 'complete body and habit transformation'}\n- Day 90 success vision: ${challenge_vision || 'a visibly transformed body and new permanent habits'}\n- Biggest threat to finishing: ${biggest_challenge || 'motivation dropping off'}\n\nCreate a 90-DAY TRANSFORMATION CHALLENGE. This is NOT a generic fitness plan — it is a structured challenge with escalating difficulty, daily accountability, and milestone checkpoints. Every section must speak directly to this client's goal and their threat to quitting.\n\nSTRUCTURE YOUR PLAN EXACTLY LIKE THIS:\n\n# KYROO 90-DAY TRANSFORMATION CHALLENGE\nDesigned for: ${level} | ${days_per_week} days/week | Mission: ${primary_goal || 'full transformation'}\n\n## YOUR CHALLENGE CONTRACT\nAddress the client directly. State their goal (${primary_goal}), their Day 90 vision (${challenge_vision}), and their biggest threat (${biggest_challenge}). Write 3-4 sentences as if handing them the contract before they sign. Make it feel real and non-negotiable.\n\n## THE 5 CHALLENGE RULES\n5 non-negotiable rules for 90 days. Make them specific, bold, and tied to this client's goal and threat. Not generic gym rules.\n\n## PHASE 1 — DAYS 1–30: BUILD THE FOUNDATION\n**Theme:** Consistency over intensity — show up before you level up\n- Complete weekly training structure for all ${days_per_week} days (label each session type)\n- For each session: exercise list with sets × reps and one-line coaching note\n- Daily non-negotiables checklist (training, sleep, hydration, nutrition)\n- Specific strategy to counter: "${biggest_challenge}"\n- Day 30 checkpoint: exact measurements and performance tests to record\n\n## PHASE 2 — DAYS 31–60: RAISE THE BAR\n**Theme:** Progressive overload — harder, heavier, hungrier\n- Show the exact training changes vs Phase 1 (new exercises, more volume, less rest)\n- Add weekly challenge elements (e.g. PR attempts, cardio finishers, time challenges)\n- Nutrition tightens: specific Phase 2 adjustments based on typical Phase 1 results\n- Day 60 checkpoint: compare to Day 30 metrics, what winning looks like at this point\n\n## PHASE 3 — DAYS 61–90: FINISH STRONG\n**Theme:** Peak performance — the final version of you\n- Highest intensity phase — hardest sessions of the entire program\n- Mental toughness section: 3 specific tactics for the final stretch (days 75-90 are the hardest)\n- Day 90 checkpoint: full re-test vs Day 1, how to measure and celebrate the transformation\n\n## NUTRITION STRATEGY (phase by phase)\nPhase 1: ${nutrition} — build the base eating pattern.\nPhase 2: Tighten and optimise for the goal.\nPhase 3: Peak-phase nutrition — fuel performance and the final push.\nKeep it practical, no obsessive tracking unless the client chose macro tracking.\n\n## WHEN YOU MISS A DAY\nDirect, honest advice. No guilt. Exactly what to do the next day to get back on track without losing momentum.\n\n## THE DAY 90 PROMISE\nWrite directly to this client. If they complete every phase, exactly what will they have: physically, in their habits, and in their self-belief. Reference their Day 90 vision: "${challenge_vision}".`,
        maxTokens: 9000,
      };

    // ── 4. Beginner Program ─────────────────────────────────────────────────
    case 'beginner': {
      const bgDuration = beginner_vision || timeframe || '8 weeks';
      const bgWeeks = parseInt(bgDuration) || 8;
      const bgPhase1End = Math.min(Math.round(bgWeeks * 0.5), 4);
      const bgPhase2Start = bgPhase1End + 1;
      return {
        system: `You are a beginner fitness coach who specialises in helping complete beginners start their fitness journey without injury, overwhelm, or confusion. Your entire job is to make fitness feel simple, achievable, and fun. You never use jargon without explaining it. You focus on movement patterns, habit building, and small wins that compound over time. You write like a patient, encouraging coach — never condescending, never overwhelming.\n\n${KYROO_SYSTEM_RULES}`,
        user: `CLIENT PROFILE:\n${clientBase}\n- Reason for starting: ${primary_goal || 'get started with fitness'}\n- What held them back: ${level || 'never had a structured plan'}\n- Main goal beyond starting: ${nutrition || 'improve general fitness'}\n- Biggest worry: ${biggest_challenge || 'not knowing what to do'}\n- Program length chosen: ${bgDuration}\n\nCreate a ${bgDuration.toUpperCase()} BEGINNER PROGRAM. This is ONLY for beginners — no advanced techniques, no complex periodisation, no jargon. Everything must be achievable on Day 1. Write like you're talking to a real person who is nervous about this.\n\nSTRUCTURE YOUR PLAN EXACTLY LIKE THIS:\n\n# KYROO ${bgDuration.toUpperCase()} BEGINNER PROGRAM\nDesigned for: First-timers | ${days_per_week} days/week | ${bgDuration} to build real habits\n\n## YOUR PERSONAL WELCOME (write directly to this client)\n4-5 sentences. Acknowledge what held them back (${level}), validate their decision to start, and address their biggest worry (${biggest_challenge}) head on. Make them feel like this time is different — because they have a real plan.\n\n## THE 5 MOVEMENTS YOU WILL MASTER\nThis beginner will learn the 5 fundamental patterns: Push, Pull, Hinge, Squat, Carry. For each:\n- What it is in plain English (no gym terms)\n- Why it matters for everyday life (real example)\n- The exact beginner-friendly version they will do in Week 1\n- One thing NOT to do (the most common beginner error)\n\n## YOUR WEEKLY SCHEDULE (${days_per_week} days/week)\nFull body sessions only — no splits for beginners. Label each day clearly.\nInclude rest day guidance: what to do on rest days (walk, stretch) and why they matter.\n\n## PHASE 1 — WEEKS 1–${bgPhase1End}: LEARN THE MOVEMENTS\nTheme: Form over everything. Never fail a rep.\nFor every exercise in every session:\n- Name + one-line plain-English how-to\n- Sets × Reps (2-3 sets MAX in the first two weeks)\n- Rest time\n- Easier variation (if they struggle) and harder variation (if too easy)\nWeek 1: bodyweight only. Week 2 onwards: add light load only when form is solid.\n\n## PHASE 2 — WEEKS ${bgPhase2Start}–${bgWeeks}: BUILD THE HABIT\nTheme: Add load, add confidence, make it automatic.\nProgression rules from Phase 1 — show the exact changes (more sets, slightly heavier, shorter rest).\nIntroduce the 2-rep rule: if you can do 2 extra reps easily, it is time to add weight.\n\n## NUTRITION — KEEPING IT SIMPLE\n${nutrition}. Three rules only. No calorie counting, no macros. Plate method or equivalent. One real food swap example.\n\n## RECOVERY FOR BEGINNERS\nSoreness vs injury — how to tell the difference (be specific). Sleep minimum. What to do when motivation dips in week 3 (the most common quitting point).\n\n## FINAL WEEK MILESTONE TEST\nA simple set of exercises to test on Day 1 and repeat on Day ${bgWeeks * 7}. Show how to measure and celebrate the progress made.`,
        maxTokens: 8000,
      };
    }

    // ── 5. Home Workout Plan ────────────────────────────────────────────────
    case 'home': {
      const hwDuration = timeframe || '10 weeks';
      const hwWeeks = parseInt(hwDuration) || 10;
      // Scale 3 phases to the chosen duration
      const hw1End = Math.max(Math.round(hwWeeks * 0.3), 1);
      const hw2End = Math.max(Math.round(hwWeeks * 0.7), hw1End + 1);
      const hw3Start = hw2End + 1;
      return {
        system: `You are a calisthenics and home-fitness specialist who has coached hundreds of clients to get in outstanding shape using nothing but their bodyweight and minimal equipment. You know every bodyweight progression, every creative substitute for gym equipment, and exactly how to make a living room feel like a serious training facility. You NEVER suggest exercises requiring gym equipment unless the client has explicitly stated they have it. You understand that training at home has unique challenges — motivation, distractions, and progression — and you address all three.\n\n${KYROO_SYSTEM_RULES}`,
        user: `CLIENT PROFILE:\n${clientBase}\n- Reason for training at home: ${primary_goal || 'convenience and no gym'}\n- Equipment available: ${equipment || 'bodyweight only'}\n- Main fitness goal: ${nutrition || 'get fit at home'}\n- Bodyweight experience level: ${level || 'some basics'}\n- Biggest home training challenge: ${biggest_challenge || 'staying consistent'}\n- Program length: ${hwDuration}\n\nCreate a ${hwDuration.toUpperCase()} HOME WORKOUT PLAN. Use ONLY the equipment stated above. NO gym machines, NO barbells, NO equipment the client doesn't have.\n\nSTRUCTURE YOUR PLAN EXACTLY LIKE THIS:\n\n# KYROO ${hwDuration.toUpperCase()} HOME WORKOUT PLAN\nDesigned for: Home training | ${days_per_week} days/week | Equipment: ${equipment || 'bodyweight only'} | Goal: ${nutrition || 'get fit'}\n\n## YOUR HOME TRAINING SPACE\nWhat they need in terms of space and items (mat, chair, wall, door frame). Nothing that costs money unless already stated in their equipment.\n\n## THE HOME PROGRESSION SYSTEM\nExplain how to get harder without adding weight — the 3 tools of bodyweight progression:\n1. Leverage (change angle to increase/decrease difficulty)\n2. Tempo (slower reps = more time under tension = harder)\n3. Unilateral (one limb at a time = double the challenge)\nGive one concrete example for a push pattern, pull pattern, and leg pattern using their equipment.\n\n## BEATING "${biggest_challenge}"\nA direct 3-point strategy to overcome their specific home training obstacle. Make this personal and practical, not generic.\n\n## YOUR TRAINING SPLIT (${days_per_week} days/week)\nRecommend Upper/Lower or Full Body based on days. Explain why this split works for home training at this frequency.\n\n## PHASE 1 — WEEKS 1–${hw1End}: BUILD THE BASE\nFoundational movements only. Master form before progressing.\nFor all exercises: name, how-to (2 sentences), sets × reps or time, rest, easier variation, harder variation.\nAll exercises must use only: ${equipment || 'bodyweight'}.\n\n## PHASE 2 — WEEKS ${hw1End + 1}–${hw2End}: INCREASE DIFFICULTY\nProgress each Phase 1 exercise to a harder variation. Show the exact progression chain.\nIntroduce circuit or superset formats to raise intensity without new equipment.\n\n## PHASE 3 — WEEKS ${hw3Start}–${hwWeeks}: PEAK HOME STRENGTH\nMost challenging progressions available with their equipment.\nIntroduce timed sets, AMRAP, or density blocks. Explain each format briefly.\n\n## CARDIO AT HOME\nCardio protocol for each phase using only bodyweight. HIIT formats, jump rope alternatives, stair options. State duration and structure.\n\n## NUTRITION FOR HOME ATHLETES\nSimple eating guidance for their goal (${nutrition || 'general fitness'}). Focus on practical, no-fuss meals. Three rules maximum.`,
        maxTokens: 8000,
      };
    }

    // ── 6. Swim Training ───────────────────────────────────────────────────
    case 'swim': {
      const swDuration = timeframe || '12 weeks';
      const swWeeks = parseInt(swDuration) || 12;
      // Scale phases to duration
      const sw1End = Math.max(Math.round(swWeeks * 0.3), 1);
      const sw2End = Math.max(Math.round(swWeeks * 0.65), sw1End + 1);
      const sw3Start = sw2End + 1;
      const strokeFocus = nutrition || 'freestyle';
      const poolEnv = equipment || '25-metre pool';
      return {
        system: `You are an elite swim coach with 15+ years coaching competitive and recreational swimmers from beginner to national level. You write pool-based training programs structured exactly like real swim practices — with warm-up sets, technique drills, main sets, and cool-downs written in standard swim notation (e.g. "4×100m @ 2:00 rest :20"). You know stroke mechanics, training zones, and competition preparation inside-out. You NEVER include gym weights, running, or land-based training unless specifically requested. You understand open water specifics (sighting, drafting, navigation) and adapt sessions accordingly when relevant.\n\n${KYROO_SYSTEM_RULES}`,
        user: `SWIMMER PROFILE:\n${clientBase}\n- Swim goal: ${primary_goal || 'improve swim fitness and technique'}\n- Current level: ${level || 'recreational'}\n- Stroke focus: ${strokeFocus}\n- Training environment: ${poolEnv}\n- Biggest struggle in the water: ${biggest_challenge || 'general technique'}\n- Training block: ${swDuration}\n\nCreate a ${swDuration.toUpperCase()} SWIM TRAINING PLAN. This is ONLY water-based training — no running, no gym weights. Every session must be written as a real structured swim practice.\n\nSTRUCTURE YOUR PLAN EXACTLY LIKE THIS:\n\n# KYROO ${swDuration.toUpperCase()} SWIM TRAINING PLAN\nDesigned for: ${level} swimmer | ${days_per_week} sessions/week | Stroke focus: ${strokeFocus} | Environment: ${poolEnv}\n\n## SWIM NOTATION GUIDE (explain once — beginners need this)\nExplain clearly: "4×100m @ 2:00" means 4 repetitions of 100m with a 2-minute interval. REST = time between reps. DRILL = technique-focused exercise. KICK = legs only (with board). PULL = arms only (with buoy). RPE = effort on a 1-10 scale.\n\n## YOUR TRAINING ZONES\nZone 1 (easy aerobic — could hold a conversation), Zone 2 (moderate — controlled effort, slightly breathless), Zone 3 (threshold — hard, sustainable for 10-20 min), Zone 4 (race pace — very hard). Give feel-based descriptions, not heart rate numbers.\n\n## STROKE TECHNIQUE FOCUS: ${strokeFocus.toUpperCase()}\nIdentify the 3 most common faults for ${strokeFocus} at ${level} level. For each fault:\n- What it looks like underwater\n- Why it slows them down\n- The exact drill to fix it (written step by step)\n\n## FIXING "${biggest_challenge}"\n3 targeted sets and drills specifically for their biggest struggle (${biggest_challenge}). Include how to measure improvement week by week.\n\n## PHASE 1 — WEEKS 1–${sw1End}: BASE AEROBIC FOUNDATION\nFocus: Build aerobic base, ingrain technique, establish routine.\n- Lower intensity (Zone 1–2), longer rest intervals\n- Full sessions written out in swim notation for all ${days_per_week} sessions/week\n- Session types: TECHNIQUE / AEROBIC / EASY ENDURANCE\n- Each session: warm-up set, drill set, main set, cool-down, coach's focus note\n\n## PHASE 2 — WEEKS ${sw1End + 1}–${sw2End}: BUILD VOLUME & THRESHOLD\nFocus: Increase total distance, introduce Zone 3 work, reduce rest.\n- Show exact progression from Phase 1 (more distance, less rest, harder sets)\n- Introduce threshold sets (CSS pace or time-trial based)\n- Session types: THRESHOLD / VOLUME / TECHNIQUE\n\n## PHASE 3 — WEEKS ${sw3Start}–${swWeeks}: RACE PACE & PEAK\nFocus: Speed, race-pace sets, peak performance.\n- Highest intensity phase — short, fast sets at goal pace\n- ${primary_goal?.includes('race') || primary_goal?.includes('open') ? 'Include race-specific sets: starts, turns, open water sighting drills, negative splits.' : 'Performance benchmarks: time trial structure and how to pace it.'}\n- Final week: active recovery taper if racing, or consolidation week if fitness-focused\n\n## DRYLAND CONDITIONING (15 min, 2×/week — optional)\nCore stability and shoulder health only. Exercises that directly translate to better swimming. No heavy weights.\n\n## FUELLING FOR SWIMMERS\nHydration strategy (swimmers don't feel themselves sweating). Pre-session and post-session nutrition. Simple and practical.`,
        maxTokens: 9000,
      };
    }

    // ── Default fallback ────────────────────────────────────────────────────
    default:
      return {
        system: `You are an elite personal trainer with 10+ years of experience writing personalised training programs.\n\n${KYROO_SYSTEM_RULES}`,
        user: `CLIENT:\n${clientBase}\n- Goal: ${primary_goal}\n\nCreate a complete 12-week training program with weekly sessions fully written out, nutrition guidance, and a progression plan.`,
        maxTokens: 7000,
      };
  }
}

// ---- Program Generator (all programs use this single endpoint) ----
app.post('/api/program/generate', authRequired, async (req, res) => {
  if (!(await checkProgramAccess(req, res, req.body.programId))) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI not configured' });

  const { programId, age, weight, height, level } = req.body;
  if (!age || !weight || !height || !level) {
    return res.status(400).json({ error: 'Please fill in all required fields' });
  }

  try {
    const client = new Anthropic({ apiKey });
    const { system, user, maxTokens } = buildProgramPrompt(programId, req.body);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const tokens = message.usage ? (message.usage.input_tokens + message.usage.output_tokens) : 0;
    await recordUsage(req.user.id, programId || 'unknown', tokens);

    res.json({ program: message.content[0].text });
  } catch (err) {
    console.error('Program generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate program' });
  }
});

// ---- Plateau Breaker Generator ----
app.post('/api/program/plateau', authRequired, async (req, res) => {
  if (!(await checkProgramAccess(req, res, req.body.program_id))) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI not configured' });

  const { weeks_stuck, squat, bench, deadlift, ohp, current_program, training_week, sleep_hours, stress_level, stress_reason, nutrition, years_lifting } = req.body;

  try {
    const client = new Anthropic({ apiKey });

    const systemPrompt = `You are a strength coach who specialises in diagnosing and fixing training plateaus in intermediate lifters. Write for someone who may not know advanced terminology — explain everything clearly.\n\n${KYROO_SYSTEM_RULES}`;

    const userPrompt = `Client situation:
- Stuck on lifts for ${weeks_stuck || 'several'} weeks despite consistent training
- Current 1RMs: Squat ${squat || 'unknown'}kg, Bench ${bench || 'unknown'}kg, Deadlift ${deadlift || 'unknown'}kg, OHP ${ohp || 'unknown'}kg
- Current program: ${current_program || 'Not specified'}
- Typical training week: ${training_week || 'Not specified'}
- Sleep: ${sleep_hours || 'unknown'} hours per night
- Stress: ${stress_level || 'moderate'} due to ${stress_reason || 'general life'}
- Nutrition: ${nutrition || 'Not specified'}
- Lifting experience: ${years_lifting || 'unknown'} years

Conduct a thorough analysis of every possible reason they may have plateaued across:
1. Programming (volume, intensity, frequency, exercise selection, progression model)
2. Recovery (sleep, stress, deload frequency)
3. Nutrition (calories, protein, timing)
4. Training psychology (staleness, motivation, effort)

Then build a detailed 8-week plan specifically designed to break through each stall, with:
- Weekly targets
- Programming adjustments
- Technique focus points
- Lifestyle changes
- Clear explanation of WHY each change is being made

Prioritise the most likely causes based on the information given.

Start with: # KYROO PLATEAU BREAKER - 8-WEEK PLAN`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const tokens = message.usage ? (message.usage.input_tokens + message.usage.output_tokens) : 0;
    await recordUsage(req.user.id, req.path, tokens);
    res.json({ program: message.content[0].text, tokens_used: tokens });
  } catch (err) {
    console.error('Plateau generator error:', err.message);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
});

// ---- Weak Point Fixer ----
app.post('/api/program/weakpoints', authRequired, async (req, res) => {
  if (!(await checkProgramAccess(req, res))) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI not configured' });

  const { aesthetic_weakpoints, performance_weakpoints, current_program } = req.body;

  if (!aesthetic_weakpoints && !performance_weakpoints) {
    return res.status(400).json({ error: 'Please describe at least one weak point' });
  }

  try {
    const client = new Anthropic({ apiKey });

    const systemPrompt = `You are a physique coach and movement specialist with extensive experience helping lifters identify and fix weak points. Write clearly so even beginners can follow every instruction.\n\n${KYROO_SYSTEM_RULES}`;

    const userPrompt = `Client's weak points:

Aesthetic weak points (underdeveloped muscle groups): ${aesthetic_weakpoints || 'Not specified'}

Performance weak points (where lifts break down): ${performance_weakpoints || 'Not specified'}

Current program: ${current_program || 'Not specified'}

For EACH weak point listed, provide:
1. The most likely root cause - is it a muscle imbalance, technique flaw, programming error, or structural limitation? Explain in plain English.
2. Specific corrective and strengthening exercises with sets, reps, tempo, and detailed coaching cues. For every exercise, include a one-line description of how to perform it.
3. Clear instructions on how to integrate these into the existing program without excessive fatigue
4. A realistic timeline for noticeable improvement
5. Measurable markers - numbers, movement quality standards, or visual indicators - that confirm the weak point is genuinely improving

Format this as a prioritized action plan that can be started this week. Write so someone can print this, bring it to the gym, and follow it without confusion.

Start with: # KYROO WEAK POINT ACTION PLAN`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const tokens = message.usage ? (message.usage.input_tokens + message.usage.output_tokens) : 0;
    await recordUsage(req.user.id, req.path, tokens);
    res.json({ program: message.content[0].text, tokens_used: tokens });
  } catch (err) {
    console.error('Weak point generator error:', err.message);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
});

// ---- Progress Tracker Generator ----
app.post('/api/program/tracker', authRequired, async (req, res) => {
  if (!(await checkProgramAccess(req, res))) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI not configured' });

  const { program_type, duration_weeks, primary_goal, tracking_experience, current_bodyweight, key_lifts } = req.body;

  try {
    const client = new Anthropic({ apiKey });

    const systemPrompt = `You are a high-performance coach who specializes in data-driven accountability systems for lifters. Write so even someone who has never tracked anything can follow every instruction.\n\n${KYROO_SYSTEM_RULES}`;

    const userPrompt = `Client details:
- Program type: ${program_type || '12-week muscle-building program'}
- Duration: ${duration_weeks || '12'} weeks
- Primary goal: ${primary_goal || 'muscle growth'}
- Tracking experience: ${tracking_experience || 'beginner'}
- Current bodyweight: ${current_bodyweight || 'not specified'}
- Key lifts to track: ${key_lifts || 'squat, bench, deadlift, OHP'}

Design a complete monitoring framework that includes:

1. WEEKLY CHECK-IN TEMPLATE
- Bodyweight tracking: how to weigh yourself accurately, when to weigh, how to handle daily fluctuations (use weekly averages)
- Key lift numbers: how to log them meaningfully
- Subjective scores (1-10) for: energy, recovery quality, mood, training performance
- Sleep quality and duration tracking
- Nutritional adherence score

2. PHOTO PROGRESS PROTOCOL
- Which angles to use (front relaxed, front flexed, side, back)
- Lighting and background guidelines
- Timing relative to food and water
- How to make accurate comparisons over time

3. MUSCLE MEASUREMENT PROTOCOL
- Which body parts to measure and exactly how
- How to measure consistently (include landmarks on the body)
- How often to take measurements
- How to interpret the data

4. DATA-DRIVEN DECISION GUIDE
Give specific if/then rules, for example:
- If bodyweight hasn't moved in 2 weeks -> do X
- If strength is dropping despite adequate calories -> do Y
- If measurements are increasing but weight is stable -> interpret as Z
- If subjective scores are consistently low -> do W
Include at least 8 specific scenarios with clear actions.

5. MONTHLY REVIEW FRAMEWORK
- How to assess overall progress
- How to identify patterns
- How to reset targets for the next block

6. PSYCHOLOGY OF TRACKING
- How to use data to stay motivated without becoming obsessive
- How to interpret slow progress
- Warning signs you are over-tracking
- How to stay consistent when numbers do not move

Format this as a professional tracking system document. Use clear templates someone can print and fill in. Include example entries where helpful. Make this feel like the monitoring system of a professional athlete, but written so anyone can use it from day one.

Start with: # KYROO PROGRESS TRACKING SYSTEM`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const tokens = message.usage ? (message.usage.input_tokens + message.usage.output_tokens) : 0;
    await recordUsage(req.user.id, req.path, tokens);
    res.json({ program: message.content[0].text, tokens_used: tokens });
  } catch (err) {
    console.error('Tracker generator error:', err.message);
    res.status(500).json({ error: 'Failed to generate tracking system' });
  }
});

// ---- 90-Day Summer Shred ----
app.post('/api/program/summer', authRequired, async (req, res) => {
  if (!(await checkProgramAccess(req, res))) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI not configured' });

  const { bodyweight, body_fat_estimate, training_days, current_steps, sleep_hours, biggest_challenge, diet_preference } = req.body;

  try {
    const client = new Anthropic({ apiKey });

    const systemPrompt = `You are a no-BS body recomposition coach who specializes in 90-day summer transformations. Your tone is direct, motivating, and practical — like a friend who is also a coach. No jargon without explanation. Write for someone who has tried and failed before.\n\n${KYROO_SYSTEM_RULES}`;

    const userPrompt = `Client:
- Bodyweight: ${bodyweight || 'not specified'}kg
- Body fat estimate: ${body_fat_estimate || 'not specified'}
- Training days available: ${training_days || '4'} per week
- Current daily steps: ${current_steps || 'not specified'}
- Sleep: ${sleep_hours || 'not specified'} hours per night
- Biggest challenge: ${biggest_challenge || 'staying consistent'}
- Diet preference: ${diet_preference || 'no preference'}

Build a COMPLETE personalized 90-day summer shred plan using this 5-step framework:

STEP 1: CALORIE DEFICIT
- Calculate their specific maintenance calories based on their bodyweight
- Set their specific deficit number (300-500 below maintenance)
- Give them their exact daily calorie target
- Tell them exactly how to track using Kyroo
- Include the weekly weight loss target (0.5-1% bodyweight)
- Include adjustment rules: what to do if weight stalls, what to do if losing too fast

STEP 2: DIET
- Calculate their exact protein target (1g per lb bodyweight)
- Calculate carb and fat ranges
- Give them 5 specific high-protein meal ideas they can make in under 15 minutes
- Include a sample full day of eating with exact macros
- One autopilot meal they can repeat daily

STEP 3: PROGRESSIVE OVERLOAD TRAINING
- Design a specific ${training_days || '4'}-day training split
- Write out every session: exercise, sets, reps
- For every exercise, one line on how to do it
- Include progression rules: when to add weight, how much
- Explain what to do when lifts stall on a cut

STEP 4: STEP MAXXING
- Their specific daily step target based on current activity
- A realistic plan to build up if they are currently low
- Best times and methods for getting steps in
- Incline treadmill protocol if they have gym access

STEP 5: SLEEP PROTOCOL
- Their target sleep hours
- A specific wind-down routine
- What to avoid before bed
- Why this matters more on a cut (cortisol, muscle recovery)

Then add:
- A week-by-week timeline showing what to expect at weeks 2, 4, 8, and 12
- Three rules for when motivation drops
- What to do about social events, alcohol, and eating out

Write this so someone can start tomorrow morning. No fluff. Every instruction is actionable.

Start with: # KYROO 90-DAY SUMMER SHRED`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const tokens = message.usage ? (message.usage.input_tokens + message.usage.output_tokens) : 0;
    await recordUsage(req.user.id, req.path, tokens);
    res.json({ program: message.content[0].text, tokens_used: tokens });
  } catch (err) {
    console.error('Summer shred generator error:', err.message);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
});

// ---- Injury Prevention Generator ----
app.post('/api/program/injury', authRequired, async (req, res) => {
  if (!(await checkProgramAccess(req, res))) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI not configured' });

  const { main_lifts, current_niggles, training_age, prehab_experience, injury_history } = req.body;

  try {
    const client = new Anthropic({ apiKey });

    const systemPrompt = `You are a sports physiotherapist and strength coach who specializes in keeping lifters healthy, pain-free, and training consistently for the long term. Write so anyone can follow every instruction — no medical jargon without explanation.\n\n${KYROO_SYSTEM_RULES}`;

    const userPrompt = `Client:
- Main lifts: ${main_lifts || 'squat, bench press, deadlift, overhead press, barbell rows'}
- Current niggles or discomfort: ${current_niggles || 'none reported'}
- Training age: ${training_age || 'not specified'}
- Prehab experience: ${prehab_experience || 'none'}
- Injury history: ${injury_history || 'none reported'}

Build a comprehensive injury prevention plan covering:

1. COMMON INJURIES PER LIFT
For each of the main lifts, explain: the most common injuries, what causes them (movement dysfunction, muscle imbalance, or technique error), and how to spot the warning signs in yourself before injury occurs.

2. 20-MINUTE PREHAB ROUTINE (3x per week)
Cover shoulders, hips, knees, lower back, and elbows. For each exercise include:
- Exercise name and one-line description of how to do it
- Sets x Reps
- Coaching cues (what to feel, what to avoid)
Keep the total routine under 20 minutes.

3. SMART WARM-UP PROTOCOL
A warm-up for heavy training sessions that prepares the nervous system and protects joints WITHOUT fatiguing you before working sets. Include specific steps and timing.

4. TRAINING AROUND NIGGLES
A framework for modifying exercises, reducing load, and managing discomfort without making things worse. Include specific exercise swaps for each main lift.

5. RED FLAGS vs NORMAL SORENESS
Clear guidelines to distinguish real injury requiring rest or professional assessment from normal training soreness or fatigue. Use a simple traffic light system (green/amber/red).

6. RETURN TO TRAINING PROTOCOL
How to come back after a short layoff due to illness or injury. Week-by-week guide with specific percentage-based loading.

7. TECHNIQUE ADJUSTMENTS
For each main lift, give 2-3 technique tweaks that reduce joint stress without hurting performance. Explain why each adjustment helps.

Format this as a practical document someone can print and reference.

Start with: # KYROO INJURY PREVENTION PLAN`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const tokens = message.usage ? (message.usage.input_tokens + message.usage.output_tokens) : 0;
    await recordUsage(req.user.id, req.path, tokens);
    res.json({ program: message.content[0].text, tokens_used: tokens });
  } catch (err) {
    console.error('Injury prevention generator error:', err.message);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
});

// ---- Nutrition Shredder ----
app.post('/api/program/nutrition', authRequired, async (req, res) => {
  if (!(await checkProgramAccess(req, res))) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI not configured' });

  const { age, sex, height, weight, goal_weight, timeline, job_type, exercise, sleep_hours, stress, alcohol, fav_meals, hated_foods, restrictions, cooking_style, snack_preference, snack_reason } = req.body;

  if (!weight || !height || !age || !sex) {
    return res.status(400).json({ error: 'Please fill in your stats' });
  }

  try {
    const client = new Anthropic({ apiKey });

    const systemPrompt = `You are an expert nutritionist with 30 years of experience. Your tone is encouraging, straight-talking, and fun — like a brilliant friend with a nutrition degree. Write so a complete beginner can follow everything.\n\n${KYROO_SYSTEM_RULES}`;

    const userPrompt = `CLIENT PROFILE:
- Age: ${age}, Sex: ${sex}, Height: ${height}cm, Weight: ${weight}kg
- Goal weight: ${goal_weight || 'not specified'}
- Timeline: ${timeline || 'steady and sustainable'}
- Job: ${job_type || 'not specified'}
- Exercise: ${exercise || 'not specified'}
- Sleep: ${sleep_hours || 'not specified'} hours/night
- Stress: ${stress || 'moderate'}
- Alcohol: ${alcohol || 'not specified'}
- Favorite meals: ${fav_meals || 'not specified'}
- Foods they hate: ${hated_foods || 'none'}
- Dietary restrictions: ${restrictions || 'none'}
- Cooking style: ${cooking_style || 'quick meals'}
- Snack preference: ${snack_preference || 'both sweet and savory'}
- Snacking reason: ${snack_reason || 'habit'}

BUILD THE COMPLETE PLAN:

1. CALORIE CALCULATION
Use Mifflin-St Jeor: Men: (10 x kg) + (6.25 x cm) - (5 x age) + 5 | Women: same but -161
Apply activity multiplier based on job + exercise. Show full calculation step by step.
Warn that online calculators are inaccurate. Set 500kcal deficit. Never below that for active people.

2. MACROS - Protein (1g per lb bodyweight), carbs, fats with explanation

3. 7-DAY MEAL PLAN
- Fun themed days (Mediterranean Monday, Tex-Mex Tuesday etc)
- Use their favorite foods as inspiration
- Calories and macros per meal
- Flag batch-cook meals
- 2 secret treat meals (feel indulgent, secretly low cal)
- Factor alcohol into relevant days
- Every day must hit total calorie and macro targets

4. SNACK SWAPS - 5+ healthier alternatives matching their preferences with calories

5. PERSONAL FAT LOSS RULES - 5 rules specific to THEM based on their profile

6. REALISTIC TIMELINE - Week-by-week projection, honest and motivating

7. HYDRATION - 35ml per kg + adjustments, practical tips for their lifestyle

8. SUPPLEMENTS - Only evidence-backed: whey, creatine (3-5g daily), caffeine, vitamin D, omega-3, magnesium. Dose, timing, why it matters for them specifically. Make clear supplements are the 1%.

Start with: # KYROO NUTRITION PLAN`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const tokens = message.usage ? (message.usage.input_tokens + message.usage.output_tokens) : 0;
    await recordUsage(req.user.id, req.path, tokens);
    res.json({ program: message.content[0].text, tokens_used: tokens });
  } catch (err) {
    console.error('Nutrition generator error:', err.message);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
});

// ---- Beginner Transformation ----
app.post('/api/program/beginner', authRequired, async (req, res) => {
  if (!(await checkProgramAccess(req, res, 'beginner'))) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI not configured' });

  const { goal, starting_point, age, weight, height, sex, days_per_week, session_minutes, equipment, nutrition, biggest_challenge, injuries } = req.body;

  try {
    const client = new Anthropic({ apiKey });

    const systemPrompt = `You are a beginner fitness coach who has helped hundreds of first-timers start their fitness journey. Your tone is warm, supportive, and crystal clear — like a knowledgeable friend who never makes anyone feel judged or confused. You never use gym jargon without instantly explaining it. You know that the hardest part for beginners is just showing up consistently, so you design programs that are simple to follow, realistic, and build confidence week by week.\n\n${KYROO_SYSTEM_RULES}`;

    const userPrompt = `Your client is a beginner starting their fitness journey for the first time (or restarting after a long break).

About them:
- Why they're starting: ${goal || 'build a consistent fitness habit and feel better'}
- Where they are right now: ${starting_point || 'lightly active, no structured exercise'}
- Age: ${age || 25} · ${sex || 'unspecified'} · ${weight || 75}kg · ${height || 170}cm
- Available: ${days_per_week || 3} days per week · ${session_minutes || 45} minutes per session
- Where they'll train: ${equipment || 'full commercial gym'}
- How they eat: ${nutrition || 'balanced, no special diet'}
- Biggest challenge: ${biggest_challenge || 'not knowing where to start'}
- Physical limitations: ${injuries || 'none'}

Create a complete 8-week Beginner Transformation program. This person may never have followed a structured plan before. Your job is to make this feel easy to start AND easy to stick to.

---

LANGUAGE RULES FOR THIS PROGRAM:
- Write like a supportive friend who happens to be a great coach
- SHORT sentences. One idea per sentence. No walls of text.
- NEVER use a fitness term without explaining it immediately in plain English
- Forbidden without explanation: RPE, periodization, hypertrophy, progressive overload, deload, 1RM, tempo notation like "3-1-1-0"
- If you must use them, say: "progressive overload (which just means lifting a little more each week)"
- Every exercise MUST have a "How to do it:" line — one simple sentence a 12-year-old could follow

---

PROGRAM STRUCTURE — 8 weeks, 4 clear phases:

## PHASE 1 — WEEKS 1–2: Just Show Up
Goal: Build the habit. Not fitness — the HABIT.
- Very simple exercises. Light weights or bodyweight only.
- Sessions should end with the client feeling good, not exhausted.
- Focus: learn how each movement feels. Don't worry about weight.
- Max 4 exercises per session.

## PHASE 2 — WEEKS 3–4: Start Feeling It
Goal: Add a little challenge. Keep it enjoyable.
- Introduce 1–2 new exercises.
- Slightly more weight or more reps than Phase 1.
- Still very manageable. They should leave sessions thinking "I can do this."

## PHASE 3 — WEEKS 5–6: Build Momentum
Goal: Get stronger. Notice real changes.
- Increase weight or reps each session.
- Tell them EXACTLY how much to add: "Add 2.5kg to this exercise each week."
- One "challenge set" per session — push a little harder than comfortable.

## PHASE 4 — WEEKS 7–8: See the Results
Goal: Consolidate strength and confidence.
- Same structure as Phase 3 but heavier.
- End each workout with a short motivational note (one sentence — specific to what they achieved that day).

---

FOR EVERY SINGLE WORKOUT, write out:

**[Day] — [Session Name]**
Warm-up (5 minutes):
List 3–4 simple warm-up moves with reps (e.g. "10 arm circles each direction, 10 bodyweight squats, 30-second hip circles")

Main session:
1. [Exercise Name]
   How to do it: [One plain-English sentence. Be specific about foot position, hand position, depth, etc.]
   Sets × Reps: [e.g. 3 × 10]
   Rest: [specific, e.g. "60 seconds between sets"]

Cool-down (3 minutes):
List 2–3 stretches with hold times.

---

WEEKLY SCHEDULE:
Show a simple weekly plan like:
- Monday: Session A
- Tuesday: Rest or a 20-minute walk (optional — walking is always good)
- Wednesday: Session B
- Thursday: Rest
- Friday: Session C
- Saturday/Sunday: Rest, stretch, or walk

Adapt the schedule to their ${days_per_week || 3} available days.

---

PROGRESSION GUIDE (keep it extremely simple):
- When to add weight: "When you can do ALL the reps with good form and it feels easy — add 2.5kg to upper body lifts, 5kg to lower body lifts next session."
- When to drop weight: "If you can't finish a set with good form, reduce by 20% and build back up."
- NEVER mention percentages of a 1RM (they don't know their max lifts).
- When to repeat a week: "If life got in the way and you missed 2+ sessions, just repeat that week. No shame — just repeat."

---

NUTRITION (tailored to: ${nutrition || 'no special diet'}):
Keep this SIMPLE. Maximum 5 bullet points.
- One clear daily protein target (grams, not percentages)
- What to eat 1–2 hours before a workout (specific foods and portions)
- What to eat within 30–60 minutes after a workout (specific foods and portions)
- One simple habit to start with: just ONE thing they can do differently starting tomorrow
- If their diet is "${nutrition}", give specific examples of good choices they already understand

---

ADDRESSING THEIR CHALLENGE:
Their biggest challenge is: "${biggest_challenge || 'not knowing where to start'}"
Give 3 very specific, practical strategies to beat this exact challenge. Not motivational quotes — real tactics.
Example format: "When [specific situation happens], do [specific action]."

---

WHAT TO EXPECT WEEK BY WEEK:
Be honest and specific. No hype.
- Weeks 1–2: "You'll probably feel sore the day after. That's normal. Here's what to do about it."
- Weeks 3–4: "You'll start to notice [specific physical or energy change]."
- Weeks 5–6: "Your clothes might start to fit differently. You'll notice [specific strength milestone]."
- Weeks 7–8: "You'll be able to [specific thing they couldn't do in Week 1]."

---

${injuries && injuries.toLowerCase() !== 'none' ? `WORKING AROUND THEIR LIMITATIONS (${injuries}):
For each limitation they mentioned, provide:
- Which exercises to avoid
- A specific alternative exercise that achieves the same result safely` : `LISTEN TO YOUR BODY GUIDE:
Three simple signals:
- Stop immediately if: [2 specific warning signs]
- Slow down if: [2 signs to ease off]
- You're doing great if: [2 signs they're on track]`}

---

Start with:

# KYROO BEGINNER TRANSFORMATION
**Your 8-week plan to build the habit, gain real strength, and feel the difference.**

> Goal: ${goal || 'build a consistent fitness habit'}
> ${days_per_week || 3} days/week · ${session_minutes || 45} min sessions · ${equipment || 'gym'}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const tokens = message.usage ? (message.usage.input_tokens + message.usage.output_tokens) : 0;
    await recordUsage(req.user.id, req.path, tokens);
    res.json({ program: message.content[0].text, tokens_used: tokens });
  } catch (err) {
    console.error('Beginner program generator error:', err.message);
    res.status(500).json({ error: 'Failed to generate beginner program' });
  }
});

// ---- Swim Tournament Prep ----
app.post('/api/program/swim', authRequired, async (req, res) => {
  if (!(await checkProgramAccess(req, res))) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI not configured' });

  const { swim_level, age, sex, weight, pool_sessions, session_minutes, pool_access, dryland_access, weeks_to_tournament, nutrition, injuries } = req.body;

  try {
    const client = new Anthropic({ apiKey });

    const systemPrompt = `You are an elite swimming coach and sports performance specialist with 15+ years coaching competitive swimmers from club level to national championships. You understand periodization for aquatic sports, dryland training for swimmers, race-day tapering, and performance nutrition specific to swimming. You write plans that are detailed, practical, and immediately actionable — whether the swimmer is a recreational competitor or a seasoned athlete.\n\n${KYROO_SYSTEM_RULES}`;

    const userPrompt = `Your athlete is preparing for a swim tournament in ${weeks_to_tournament || '4'} weeks.

Athlete profile:
- Swim level: ${swim_level || 'intermediate'} (beginner = recreational club swimmer; intermediate = regular competitor; advanced = national/elite level)
- Age: ${age || 22}, ${sex || 'other'}, ${weight || 70}kg
- Pool access: ${pool_access || 'indoor competition pool (25m or 50m)'}
- Pool sessions: ${pool_sessions || 3} per week, ${session_minutes || 60} minutes per session
- Dryland training: ${dryland_access || 'full commercial gym'}
- Nutrition preference: ${nutrition || 'balanced'}
- Physical limitations or injuries: ${injuries || 'none'}

Build a complete KYROO Swim Tournament Prep Plan structured in three phases:

---

PHASE 1 — BUILD (weeks 1 to ${Math.max(1, Math.floor((parseInt(weeks_to_tournament) || 4) / 2))}): Volume and aerobic base
- In-water: aerobic threshold sets, technique drills, stroke efficiency work
- Dryland: strength base — focus on pulling power (lats, rhomboids), core stability, hip rotation
- For each dryland exercise: one plain-English line on how to perform it
- Nutrition: fueling for high-volume training (calorie targets, carb timing around sessions)
- Recovery: sleep, cold exposure, active recovery swims

PHASE 2 — PEAK (following weeks up to taper): Race-pace sharpening
- In-water: race-pace intervals, lactate threshold sets, stroke-specific speed work
- Dryland: explosive power — reduce volume by 20%, maintain intensity; plyometrics, resistance bands
- Nutrition: shift to performance fueling — pre-session carb loading, post-session protein targets
- Race simulation: one practice set per week at full race pace and distance

PHASE 3 — TAPER (final 7–10 days before tournament): Peak freshness
- In-water: reduce volume by 40–50%, maintain race-pace speed; 2–3 race-pace tune-up sets
- Dryland: stop heavy lifting 5 days before race — only mobility, activation, and light band work
- Nutrition: carbohydrate loading protocol (specific grams per kg bodyweight, 3 days out), hydration plan
- Sleep: 9+ hours, fixed wake time, no racing dreams strategy
- Race-day morning: warm-up pool routine, pre-race meal timing (what, when, how much)

---

For EACH training week, write out:
- Every pool session (sets, distances, intervals, rest, target pace or RPE)
  - Use standard swim notation: e.g. "4 × 100m @ 1:45 rest, race pace"
  - Explain RPE for swimming the first time it appears
  - Explain what "descending intervals" means if used
- Every dryland session (exercises, sets, reps, tempo, rest)
  - One-line how-to for each exercise
- One recovery day protocol

---

NUTRITION SECTION:
Tailored to their preference (${nutrition || 'balanced'}):
- Daily calorie target based on training load (give a specific number)
- Pre-session meal: what to eat, how much, how long before
- Post-session recovery meal: protein + carbs with specific targets
- Race-day nutrition: exact timeline from waking up to race start
- Hydration: daily target + electrolyte strategy for race day
- Foods to avoid in the final week before competition

MENTAL PERFORMANCE SECTION:
- A 10-minute pre-race visualization script they can use the night before
- Warm-up pool routine: exact order and timing for race-day warm-up
- 3 specific focus cues for their race (not generic motivation — technical cues like "high elbow catch", "drive the turn")
- How to handle nerves: a simple breathing protocol

INJURY PREVENTION:
- 3 swimmer-specific mobility exercises to do daily (shoulder internal rotation, thoracic spine, hip flexors)
- Warning signs to watch for during taper (taper madness, how to handle feeling "flat")
- What to do if an old injury flares during taper week

Start with:

# KYROO SWIM TOURNAMENT PREP
${swim_level || 'Intermediate'} swimmer · ${pool_sessions || 3} pool sessions/week · ${weeks_to_tournament || '4'} weeks to race day`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const tokens = message.usage ? (message.usage.input_tokens + message.usage.output_tokens) : 0;
    await recordUsage(req.user.id, req.path, tokens);
    res.json({ program: message.content[0].text, tokens_used: tokens });
  } catch (err) {
    console.error('Swim prep generator error:', err.message);
    res.status(500).json({ error: 'Failed to generate swim plan' });
  }
});

// GET /api/usage - get current user's usage
app.get('/api/usage', authRequired, async (req, res) => {
  const { rows } = await pool.query('SELECT plan FROM users WHERE id = $1', [req.user.id]);
  const plan = rows[0]?.plan || 'free';
  const used = await getUserUsageThisMonth(req.user.id);
  const limit = req.user.is_admin ? Infinity : (PLAN_LIMITS[plan] || 0);
  res.json({ plan, used, limit, remaining: limit === Infinity ? 'unlimited' : Math.max(0, limit - used) });
});

// ---- Stripe Checkout ----

async function activatePremium(userId, plan) {
  const now = new Date();
  const expires = new Date(now);
  if (plan === 'yearly') expires.setFullYear(expires.getFullYear() + 1);
  else expires.setMonth(expires.getMonth() + 1);
  await pool.query(
    'UPDATE users SET is_premium=true, plan=$1, premium_started_at=$2, premium_expires_at=$3, updated_at=$2 WHERE id=$4',
    [plan === 'yearly' ? 'pro' : 'pro', now, expires, userId]
  );
  const amount = plan === 'yearly' ? 72.00 : 6.00;
  const desc   = plan === 'yearly' ? 'KYROO Pro – Annual (€72/year)' : 'KYROO Pro – Monthly (€6/month)';
  await pool.query(
    'INSERT INTO payments (user_id, amount, currency, description, status) VALUES ($1,$2,$3,$4,$5)',
    [userId, amount, 'EUR', desc, 'completed']
  );
}

// POST /api/stripe/create-checkout-session
app.post('/api/stripe/create-checkout-session', authRequired, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Payment processing is not configured.' });
  const { plan } = req.body;
  if (!plan || !['monthly', 'yearly'].includes(plan)) return res.status(400).json({ error: 'Invalid plan.' });
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: req.user.email,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: plan === 'yearly' ? 'KYROO Pro – Annual' : 'KYROO Pro – Monthly',
            description: plan === 'yearly' ? 'Full access for 12 months' : 'Full access for 1 month',
          },
          unit_amount: plan === 'yearly' ? 7200 : 600,
        },
        quantity: 1,
      }],
      success_url: `https://app.kyroo.de/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `https://app.kyroo.de/upgrade`,
      metadata: { user_id: String(req.user.id), plan },
    });
    res.json({ url: session.url, session_id: session.id });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

// GET /api/stripe/verify-session?session_id=... — called from app after redirect
app.get('/api/stripe/verify-session', authRequired, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Payment processing is not configured.' });
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'Missing session_id.' });
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid') return res.status(402).json({ error: 'Payment not completed.' });
    // Guard: ensure this session belongs to the logged-in user
    if (session.metadata?.user_id !== String(req.user.id)) return res.status(403).json({ error: 'Session does not match your account.' });
    const plan = session.metadata?.plan || 'monthly';
    await activatePremium(req.user.id, plan);
    const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const token = generateToken(rows[0]);
    res.json({ token, message: 'Welcome to KYROO Pro!' });
  } catch (err) {
    console.error('Verify session error:', err.message);
    res.status(500).json({ error: 'Verification failed.' });
  }
});

// POST /api/stripe/webhook — Stripe sends events here (set STRIPE_WEBHOOK_SECRET in .env)
app.post('/api/stripe/webhook', async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  if (webhookSecret) {
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    event = req.body;
    console.warn('[stripe webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status === 'paid') {
      const userId = parseInt(session.metadata?.user_id);
      const plan   = session.metadata?.plan || 'monthly';
      if (userId) {
        await activatePremium(userId, plan).catch(err => console.error('activatePremium webhook error:', err));
        console.log(`[stripe] Activated premium for user ${userId} (${plan})`);
      }
    }
  }
  res.json({ received: true });
});

// GET /api/stripe/publishable-key
app.get('/api/stripe/publishable-key', (_req, res) => {
  res.json({ key: process.env.STRIPE_PUBLISHABLE_KEY || '' });
});

// GET /api/payments
app.get('/api/payments', authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, amount, currency, description, status, created_at FROM payments WHERE user_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ payments: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments.' });
  }
});

// POST /api/premium/cancel
app.post('/api/premium/cancel', authRequired, async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET is_premium=false, plan=\'free\', premium_expires_at=NULL, updated_at=NOW() WHERE id=$1',
      [req.user.id]
    );
    const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const token = generateToken(rows[0]);
    res.json({ token, message: 'Subscription cancelled.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel subscription.' });
  }
});

// ========================================
// DSGVO Routes (Art. 15, 17, 20 DSGVO)
// ========================================

// GET /api/account/data-export - Art. 15 & 20 DSGVO (Auskunftsrecht & Datenportabilitaet)
app.get('/api/account/data-export', authRequired, async (req, res) => {
  try {
    const [user, payments, subscriber] = await Promise.all([
      pool.query('SELECT id, email, name, is_premium, email_verified, premium_started_at, premium_expires_at, created_at FROM users WHERE id = $1', [req.user.id]),
      pool.query('SELECT amount, currency, description, status, created_at FROM payments WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]),
      pool.query('SELECT email, subscribed_at, consent_given, consent_date FROM subscribers WHERE email = $1', [req.user.email]),
    ]);

    res.json({
      export_date: new Date().toISOString(),
      data_controller: 'KYROO, Schoenhauser Allee 100, 10119 Berlin',
      contact: 'info@kyroo.de',
      user_data: user.rows[0] || null,
      payment_history: payments.rows,
      newsletter_subscription: subscriber.rows[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Data export failed' });
  }
});

// DELETE /api/account - Art. 17 DSGVO (Recht auf Loeschung)
app.delete('/api/account', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const email = req.user.email;

    // Delete in order (foreign key constraints)
    await pool.query('DELETE FROM payments WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_plans WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM subscribers WHERE email = $1', [email]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ success: true, message: 'Alle Daten wurden geloescht. (All data has been deleted.)' });
  } catch (err) {
    console.error('Account deletion error:', err);
    res.status(500).json({ error: 'Account deletion failed' });
  }
});

// ========================================
// Admin Routes
// ========================================

// ---- Video upload config ----
const UPLOADS_DIR = path.join(FRONTEND_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      cb(null, name);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.webm', '.mov', '.m4v'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only video files are allowed (mp4, webm, mov, m4v)'));
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

// POST /api/admin/upload-video - upload a video clip
app.post('/api/admin/upload-video', adminRequired, (req, res, next) => {
  upload.single('video')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No video file provided' });

    const videoUrl = `/uploads/${req.file.filename}`;
    res.json({ url: videoUrl, filename: req.file.filename, size: req.file.size });
  });
});

// DELETE /api/admin/delete-video - remove an uploaded video
app.delete('/api/admin/delete-video', adminRequired, (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'Filename required' });
  const filePath = path.join(UPLOADS_DIR, path.basename(filename));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true });
});

// ---- Image upload ----
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed (jpg, png, gif, webp, svg)'));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// POST /api/admin/upload-image
app.post('/api/admin/upload-image', adminRequired, (req, res) => {
  imageUpload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    res.json({ url: `/uploads/${req.file.filename}`, filename: req.file.filename });
  });
});

// POST /api/admin/articles/:id/images - attach images to article
app.post('/api/admin/articles/:id/images', adminRequired, async (req, res) => {
  const { images } = req.body;
  if (!images || !Array.isArray(images)) return res.status(400).json({ error: 'images array required' });
  try {
    // Clear existing and re-insert
    await pool.query('DELETE FROM article_images WHERE article_id = $1', [req.params.id]);
    for (let i = 0; i < images.length; i++) {
      await pool.query(
        'INSERT INTO article_images (article_id, url, caption, sort_order) VALUES ($1, $2, $3, $4)',
        [req.params.id, images[i].url, images[i].caption || null, i]
      );
    }
    const { rows } = await pool.query('SELECT * FROM article_images WHERE article_id = $1 ORDER BY sort_order', [req.params.id]);
    res.json(rows);
    broadcast('article-updated', { id: parseInt(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save images' });
  }
});

// GET /api/articles/:slug images are included in the article response
// (handled below in the existing route)

// POST /api/admin/generate - AI article generation
app.post('/api/admin/generate', adminRequired, async (req, res) => {
  const { prompt, category, is_premium } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured. Set it as an environment variable.' });

  try {
    const client = new Anthropic({ apiKey });

    const systemPrompt = `You are an editorial writer for KYROO, a Berlin-based discovery and lifestyle platform. Your writing style is:
- Clean, confident, opinionated
- Prenzlauer Berg hipster meets Gen-Z internet culture
- No corporate speak, no fluff
- Short paragraphs, punchy sentences
- Honest and direct

Generate a complete article in JSON format with these exact fields:
- "title": compelling headline (max 80 chars)
- "slug": URL-friendly slug derived from title (lowercase, hyphens, no special chars)
- "excerpt": one-sentence teaser (max 160 chars)
- "body": full article body as plain text with paragraph breaks (min 300 words)
- "category": one of: AI, Fitness, Trends, Recommendations, Lifestyle, Future Tools

Return ONLY valid JSON, no markdown, no code fences.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: `Write an article about: ${prompt}${category ? `\nCategory: ${category}` : ''}` }],
      system: systemPrompt,
    });

    const text = message.content[0].text.trim();
    let article;
    try {
      article = JSON.parse(text);
    } catch (e) {
      // Try to extract JSON from response
      const match = text.match(/\{[\s\S]*\}/);
      if (match) article = JSON.parse(match[0]);
      else throw new Error('AI response was not valid JSON');
    }

    // Override category if specified
    if (category) article.category = category;
    article.is_premium = is_premium || false;

    res.json(article);
  } catch (err) {
    console.error('AI generation error:', err);
    res.status(500).json({ error: err.message || 'AI generation failed' });
  }
});

// GET /api/admin/articles - list all articles with full body
app.get('/api/admin/articles', adminRequired, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT pa.*,
      (SELECT COUNT(*) FROM article_images WHERE article_id = pa.id)::int as image_count,
      (SELECT url FROM article_images WHERE article_id = pa.id ORDER BY sort_order LIMIT 1) as thumbnail
    FROM premium_articles pa ORDER BY pa.published_at DESC
  `);
  res.json(rows);
});

// POST /api/admin/articles - create article
app.post('/api/admin/articles', adminRequired, async (req, res) => {
  const { title, slug, category, excerpt, body, is_premium, video_url, video_duration } = req.body;
  if (!title || !slug || !category || !excerpt || !body) {
    return res.status(400).json({ error: 'All fields are required: title, slug, category, excerpt, body' });
  }
  if (video_duration && video_duration > 30) {
    return res.status(400).json({ error: 'Video must be 30 seconds or shorter' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO premium_articles (title, slug, category, excerpt, body, is_premium, video_url, video_duration) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [title, slug, category, excerpt, body, is_premium || false, video_url || null, video_duration || null]
    );
    res.status(201).json(rows[0]);
    broadcast('article-created', { article: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'An article with this slug already exists' });
    console.error('Create article error:', err);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

// PUT /api/admin/articles/:id - update article
app.put('/api/admin/articles/:id', adminRequired, async (req, res) => {
  const { title, slug, category, excerpt, body, is_premium, video_url, video_duration } = req.body;
  if (video_duration && video_duration > 30) {
    return res.status(400).json({ error: 'Video must be 30 seconds or shorter' });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE premium_articles SET title = COALESCE($1, title), slug = COALESCE($2, slug), category = COALESCE($3, category), excerpt = COALESCE($4, excerpt), body = COALESCE($5, body), is_premium = COALESCE($6, is_premium), video_url = $7, video_duration = $8 WHERE id = $9 RETURNING *',
      [title, slug, category, excerpt, body, is_premium, video_url !== undefined ? video_url : null, video_duration !== undefined ? video_duration : null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Article not found' });
    res.json(rows[0]);
    broadcast('article-updated', { article: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Slug already in use' });
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// DELETE /api/admin/articles/:id
app.delete('/api/admin/articles/:id', adminRequired, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM premium_articles WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Article not found' });
  res.json({ success: true });
  broadcast('article-deleted', { id: parseInt(req.params.id) });
});

// GET /api/admin/stats - dashboard stats
app.get('/api/admin/stats', adminRequired, async (req, res) => {
  const [users, premium, articles, subscribers] = await Promise.all([
    pool.query('SELECT COUNT(*) as count FROM users'),
    pool.query('SELECT COUNT(*) as count FROM users WHERE is_premium = true'),
    pool.query('SELECT COUNT(*) as count FROM premium_articles'),
    pool.query('SELECT COUNT(*) as count FROM subscribers'),
  ]);
  res.json({
    total_users: parseInt(users.rows[0].count),
    premium_users: parseInt(premium.rows[0].count),
    total_articles: parseInt(articles.rows[0].count),
    total_subscribers: parseInt(subscribers.rows[0].count),
  });
});

// ========================================
// Articles Routes (public)
// ========================================

// GET /api/articles - list all articles (body hidden for premium if not subscribed)
app.get('/api/articles', authOptional, async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT pa.id, pa.slug, pa.category, pa.title, pa.excerpt, pa.is_premium, pa.video_url, pa.video_duration, pa.published_at, (SELECT url FROM article_images WHERE article_id = pa.id ORDER BY sort_order LIMIT 1) as thumbnail FROM premium_articles pa';
    const params = [];
    if (category) {
      query += ' WHERE pa.category = $1';
      params.push(category);
    }
    query += ' ORDER BY pa.published_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// GET /api/articles/:slug - get full article (premium content gated)
app.get('/api/articles/:slug', authOptional, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM premium_articles WHERE slug = $1', [req.params.slug]);
    if (rows.length === 0) return res.status(404).json({ error: 'Article not found' });

    const article = rows[0];
    const images = await pool.query('SELECT id, url, caption, sort_order FROM article_images WHERE article_id = $1 ORDER BY sort_order', [article.id]);
    article.images = images.rows;

    if (article.is_premium) {
      const isPremiumUser = req.user && (req.user.is_premium || req.user.is_admin);
      if (!isPremiumUser) {
        // Return excerpt only, hide full body
        return res.json({
          ...article,
          body: null,
          locked: true,
          message: 'This is premium content. Subscribe to KYROO Premium to read the full article.',
        });
      }
    }

    res.json({ ...article, locked: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// ========================================
// Site Content Routes
// ========================================

app.get('/api/site', async (req, res) => {
  try {
    const [
      sections, heroStats, aboutCards, freeContent,
      premiumFeatures, premiumPlan, categories, whyCards, socialLinks,
      settings, footerLinks,
    ] = await Promise.all([
      pool.query('SELECT * FROM sections ORDER BY id'),
      pool.query('SELECT * FROM hero_stats ORDER BY sort_order'),
      pool.query('SELECT * FROM about_cards ORDER BY sort_order'),
      pool.query('SELECT * FROM free_content ORDER BY sort_order'),
      pool.query('SELECT * FROM premium_features ORDER BY sort_order'),
      pool.query('SELECT * FROM premium_plan LIMIT 1'),
      pool.query('SELECT * FROM categories ORDER BY sort_order'),
      pool.query('SELECT * FROM why_cards ORDER BY sort_order'),
      pool.query('SELECT * FROM social_links ORDER BY sort_order'),
      pool.query('SELECT * FROM site_settings'),
      pool.query('SELECT * FROM footer_links ORDER BY col_order, sort_order'),
    ]);

    const sectionMap = {};
    sections.rows.forEach(s => { sectionMap[s.slug] = s; });

    const settingsMap = {};
    settings.rows.forEach(s => { settingsMap[s.key] = s.value; });

    // Group footer links by column
    const footerCols = {};
    footerLinks.rows.forEach(l => {
      if (!footerCols[l.column_title]) footerCols[l.column_title] = [];
      footerCols[l.column_title].push(l);
    });

    res.json({
      sections: sectionMap,
      heroStats: heroStats.rows,
      aboutCards: aboutCards.rows,
      freeContent: freeContent.rows,
      premiumFeatures: premiumFeatures.rows,
      premiumPlan: premiumPlan.rows[0] || null,
      categories: categories.rows,
      whyCards: whyCards.rows,
      socialLinks: socialLinks.rows,
      settings: settingsMap,
      footerLinks: footerCols,
    });
  } catch (err) {
    console.error('Error fetching site data:', err);
    res.status(500).json({ error: 'Failed to load site data' });
  }
});

// POST /api/subscribe
app.post('/api/subscribe', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  try {
    await pool.query(
      'INSERT INTO subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
      [email]
    );
    res.json({ success: true, message: 'Subscribed successfully' });
    broadcast('new-subscriber', {});
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Subscription failed' });
  }
});

app.get('/api/subscribe/check', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.json({ subscribed: false });
  const { rows } = await pool.query('SELECT id FROM subscribers WHERE email = $1', [email]);
  res.json({ subscribed: rows.length > 0 });
});

app.get('/api/subscribers/count', async (req, res) => {
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM subscribers');
  res.json({ count: parseInt(rows[0].count) });
});

// Fallback - serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// ========================================
// WebSocket server
// ========================================
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const wsClients = new Set();

// ── Live training presence (user_id → last-seen timestamp) ──
const trainingNow = new Map(); // userId -> timestamp

function trainingCount() { return trainingNow.size; }

function broadcastTraining() {
  broadcast('training-update', { count: trainingCount() });
}

// Remove stale entries (no heartbeat within 90s)
setInterval(() => {
  const cutoff = Date.now() - 90_000;
  let changed = false;
  for (const [uid, ts] of trainingNow) {
    if (ts < cutoff) { trainingNow.delete(uid); changed = true; }
  }
  if (changed) broadcastTraining();
}, 30_000);

// POST /api/training/join
app.post('/api/training/join', authRequired, (req, res) => {
  trainingNow.set(req.user.id, Date.now());
  broadcastTraining();
  res.json({ count: trainingCount() });
});

// POST /api/training/leave
app.post('/api/training/leave', authRequired, (req, res) => {
  trainingNow.delete(req.user.id);
  broadcastTraining();
  res.json({ count: trainingCount() });
});

// POST /api/training/heartbeat — keeps session alive every 60s
app.post('/api/training/heartbeat', authRequired, (req, res) => {
  if (trainingNow.has(req.user.id)) {
    trainingNow.set(req.user.id, Date.now());
  }
  res.json({ count: trainingCount() });
});

// GET /api/training/count
app.get('/api/training/count', (_req, res) => {
  res.json({ count: trainingCount() });
});

wss.on('connection', (ws) => {
  wsClients.add(ws);
  // Send current count immediately on connect
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'training-update', data: { count: trainingCount() }, timestamp: Date.now() }));
  }
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      // Respond to client keepalive pings with a pong
      if (msg.type === 'ping') {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      }
    } catch {}
  });
  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));
});

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data, timestamp: Date.now() });
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}


// Start server
async function start() {
  await waitForDb();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`KYROO API running on http://localhost:${PORT}`);
    console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
