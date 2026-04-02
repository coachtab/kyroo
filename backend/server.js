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
app.use(cors());
app.use(express.json({ type: 'application/json' }));
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

// Plan limits
const PLAN_LIMITS = { free: 0, basic: 5, pro: Infinity };

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
  // Get fresh user data with plan
  const { rows } = await pool.query('SELECT plan, is_admin, is_premium FROM users WHERE id = $1', [req.user.id]);
  if (rows.length === 0) { res.status(401).json({ error: 'User not found' }); return false; }
  const user = rows[0];

  if (user.is_admin) return true;

  // Free programs are accessible on any plan
  if (programId && FREE_PROGRAM_IDS.has(programId)) return true;

  const plan = user.plan || 'free';
  if (plan === 'free' && !user.is_premium) { res.status(403).json({ error: 'Upgrade to unlock all programs', plan: 'free' }); return false; }

  const { allowed, used, limit } = await canGenerateProgram(req.user.id, plan);
  if (!allowed) {
    res.status(429).json({ error: `You have used all ${limit} programs this month. Upgrade to Pro for unlimited.`, used, limit, plan });
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
    const token = generateToken(user);

    // Send verification email (non-blocking - don't fail signup if email fails)
    const verifyUrl = `${BASE_URL}/api/auth/verify?token=${verifyToken}`;
    sendEmail(email, 'Welcome to KYROO - Verify your email', `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
        <h1 style="font-size:24px;margin-bottom:8px">Welcome to KYROO${name ? ', ' + name : ''}</h1>
        <p style="color:#666;margin-bottom:32px">Verify your email to get full access.</p>
        <a href="${verifyUrl}" style="display:inline-block;background:#c27a56;color:#fff;padding:12px 32px;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px">Verify email</a>
        <p style="color:#999;font-size:12px;margin-top:32px">Or copy this link: ${verifyUrl}</p>
      </div>
    `).catch(err => console.error('Verification email failed:', err.message));

    res.status(201).json({ user, token });
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
    if (rowCount === 0) return res.send('<html><body style="font-family:sans-serif;text-align:center;padding:80px"><h2>Link expired or already used.</h2><a href="/">Go to KYROO</a></body></html>');
    res.send('<html><body style="font-family:sans-serif;text-align:center;padding:80px"><h2>Email verified.</h2><p style="color:#666">You can close this tab.</p><a href="/">Go to KYROO</a></body></html>');
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

    const resetUrl = `${BASE_URL}/reset-password.html?token=${resetToken}`;
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
      'SELECT id, email, name, is_premium, is_admin, plan, premium_started_at, premium_expires_at, created_at FROM users WHERE id = $1',
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

// ---- 12-Week Program Generator ----
app.post('/api/program/generate', authRequired, async (req, res) => {
  if (!(await checkProgramAccess(req, res, req.body.program_id))) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI not configured' });

  const { level, experience_years, weight, height, age, sex, squat, bench, deadlift, ohp, days_per_week, session_minutes, equipment, primary_goal, secondary_goal } = req.body;

  if (!level || !weight || !height || !age || !sex || !days_per_week || !session_minutes) {
    return res.status(400).json({ error: 'Please fill in all required fields' });
  }

  try {
    const client = new Anthropic({ apiKey });

    const systemPrompt = `You are an elite personal trainer and strength coach with more than 10 years of experience. You write training programs that even complete beginners can follow without confusion.\n\n${KYROO_SYSTEM_RULES}`;

    const userPrompt = `Your client:
- Level: ${level} with ${experience_years || 'some'} years of training
- Body: ${weight}kg, ${height}cm, ${age} years old, ${sex}
- Current 1RMs: Squat ${squat || 'unknown'}kg, Bench ${bench || 'unknown'}kg, Deadlift ${deadlift || 'unknown'}kg, OHP ${ohp || 'unknown'}kg
- Schedule: ${days_per_week} days per week, max ${session_minutes} minutes per session
- Equipment: ${equipment || 'full commercial gym'}
- Primary goal: ${primary_goal || 'hypertrophy'}
- Secondary goal: ${secondary_goal || 'building raw strength'}

Design a complete 12-week periodized training program.

IMPORTANT FORMATTING RULES:
- Write for someone who may have never followed a structured program before
- For EVERY exercise, include a one-line plain-English description of how to perform it (e.g. "Stand with feet shoulder-width apart, lower your hips until thighs are parallel to the floor, then stand back up")
- Explain what "tempo 3-1-1-0" means the first time you use it
- Explain what RPE means the first time you use it
- Explain what a deload is and why it matters
- Use simple language throughout - no jargon without explanation
- Format each training day clearly with: Exercise Name, How To Do It (one line), Sets x Reps, Tempo, Rest
- Use numbered lists for exercises within each session
- Group weeks clearly: Week 1-4, Week 5-8, Week 9-12

Include:
1. A short overview of the program approach (2-3 sentences, plain English)
2. The weekly training split (which days train which body parts)
3. Every session written out with exercise name, brief how-to, sets, reps, tempo, rest
4. How to increase weight week by week (be specific: "add 2.5kg to upper body lifts, 5kg to lower body lifts each week")
5. Deload instructions (when, what to change, why)
6. A quick note on why key exercises were chosen

Start with:

# KYROO 12-WEEK TRAINING PROGRAM
Designed for: ${level} | ${days_per_week} days/week | ${session_minutes} min sessions | Goal: ${primary_goal}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const program = message.content[0].text;
    res.json({ program });
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

// POST /api/stripe/create-payment-intent - create a Stripe PaymentIntent
app.post('/api/stripe/create-payment-intent', authRequired, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Payment processing is not configured on this server.' });
  const { plan } = req.body;
  if (!plan || !['monthly', 'yearly'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  const amount = plan === 'yearly' ? 7200 : 600; // Stripe uses cents
  const desc = plan === 'yearly' ? 'KYROO Premium - Annual' : 'KYROO Premium - Monthly';

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      description: desc,
      metadata: {
        user_id: String(req.user.id),
        user_email: req.user.email,
        plan,
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Payment setup failed' });
  }
});

// POST /api/stripe/confirm-payment - confirm payment and activate premium
app.post('/api/stripe/confirm-payment', authRequired, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Payment processing is not configured on this server.' });
  const { payment_intent_id, plan } = req.body;

  try {
    // Verify payment with Stripe
    const intent = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (intent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const amount = plan === 'yearly' ? 72.00 : 6.00;
    const desc = plan === 'yearly' ? 'KYROO Premium - Annual (72 EUR/year)' : 'KYROO Premium - Monthly (6 EUR/month)';

    // Record payment in our database
    await pool.query(
      'INSERT INTO payments (user_id, amount, currency, description, status) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, amount, 'EUR', desc, 'completed']
    );

    // Activate premium
    const now = new Date();
    const expires = new Date(now);
    if (plan === 'yearly') {
      expires.setFullYear(expires.getFullYear() + 1);
    } else {
      expires.setMonth(expires.getMonth() + 1);
    }

    await pool.query(
      'UPDATE users SET is_premium = true, premium_started_at = $1, premium_expires_at = $2, updated_at = $1 WHERE id = $3',
      [now, expires, req.user.id]
    );

    const { rows } = await pool.query(
      'SELECT id, email, name, is_premium, is_admin, premium_started_at, premium_expires_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = rows[0];
    const token = generateToken(user);
    res.json({ user, token, message: 'Premium activated! Welcome to KYROO Premium.' });
    broadcast('premium-activated', { userId: req.user.id });
  } catch (err) {
    console.error('Payment confirmation error:', err);
    res.status(500).json({ error: 'Payment confirmation failed' });
  }
});

// GET /api/stripe/publishable-key - expose publishable key to frontend
app.get('/api/stripe/publishable-key', (req, res) => {
  res.json({ key: process.env.STRIPE_PUBLISHABLE_KEY || '' });
});

// POST /api/premium/cancel
app.post('/api/premium/cancel', authRequired, async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET is_premium = false, premium_expires_at = NULL, updated_at = NOW() WHERE id = $1',
      [req.user.id]
    );
    const { rows } = await pool.query(
      'SELECT id, email, name, is_premium FROM users WHERE id = $1',
      [req.user.id]
    );
    const token = generateToken(rows[0]);
    res.json({ user: rows[0], token, message: 'Premium cancelled.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel premium' });
  }
});

// GET /api/payments
app.get('/api/payments', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, amount, currency, description, status, created_at FROM payments WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json(rows);
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

wss.on('connection', (ws) => {
  wsClients.add(ws);
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
