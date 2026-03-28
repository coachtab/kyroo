const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger.json');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'kyroo-secret-change-in-production';

// Database connection with retry logic
const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 15432,
  database: process.env.DB_NAME || 'kyroo',
  user: process.env.DB_USER || 'kyroo',
  password: process.env.DB_PASSWORD || 'kyroo_pass',
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
app.use(express.json());

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
    { id: user.id, email: user.email, is_premium: user.is_premium, is_admin: user.is_admin || false },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
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
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, is_premium, is_admin, created_at',
      [email, hash, name || null]
    );
    const user = rows[0];
    const token = generateToken(user);
    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed' });
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
      user: { id: user.id, email: user.email, name: user.name, is_premium: user.is_premium, is_admin: user.is_admin },
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
      'SELECT id, email, name, is_premium, is_admin, premium_started_at, premium_expires_at, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ========================================
// Premium Subscription Routes
// ========================================

// ---- Payment Methods ----

// GET /api/payment-methods
app.get('/api/payment-methods', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, type, label, last_four, is_default, created_at FROM payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
    [req.user.id]
  );
  res.json(rows);
});

// POST /api/payment-methods
app.post('/api/payment-methods', authRequired, async (req, res) => {
  const { type, card_number, card_expiry, card_cvc, paypal_email } = req.body;

  if (!type) return res.status(400).json({ error: 'Payment type required' });

  let label, lastFour;
  if (type === 'card') {
    if (!card_number || !card_expiry || !card_cvc) {
      return res.status(400).json({ error: 'Card details required' });
    }
    const digits = card_number.replace(/\s/g, '');
    if (digits.length < 13 || digits.length > 19) {
      return res.status(400).json({ error: 'Invalid card number' });
    }
    lastFour = digits.slice(-4);
    // Detect card brand
    const brand = digits.startsWith('4') ? 'Visa' : digits.startsWith('5') ? 'Mastercard' : digits.startsWith('3') ? 'Amex' : 'Card';
    label = `${brand} ending in ${lastFour}`;
  } else if (type === 'paypal') {
    if (!paypal_email) return res.status(400).json({ error: 'PayPal email required' });
    label = `PayPal (${paypal_email})`;
    lastFour = null;
  } else if (type === 'sepa') {
    const { iban } = req.body;
    if (!iban) return res.status(400).json({ error: 'IBAN required' });
    lastFour = iban.replace(/\s/g, '').slice(-4);
    label = `SEPA ending in ${lastFour}`;
  } else {
    return res.status(400).json({ error: 'Invalid payment type' });
  }

  try {
    // If first payment method, make it default
    const existing = await pool.query('SELECT COUNT(*) as count FROM payment_methods WHERE user_id = $1', [req.user.id]);
    const isDefault = parseInt(existing.rows[0].count) === 0;

    const { rows } = await pool.query(
      'INSERT INTO payment_methods (user_id, type, label, last_four, is_default) VALUES ($1, $2, $3, $4, $5) RETURNING id, type, label, last_four, is_default',
      [req.user.id, type, label, lastFour, isDefault]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Add payment method error:', err);
    res.status(500).json({ error: 'Failed to add payment method' });
  }
});

// DELETE /api/payment-methods/:id
app.delete('/api/payment-methods/:id', authRequired, async (req, res) => {
  await pool.query('DELETE FROM payment_methods WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

// ---- Premium Checkout ----

// POST /api/premium/checkout
app.post('/api/premium/checkout', authRequired, async (req, res) => {
  const { payment_method_id, plan } = req.body;

  try {
    // Verify payment method belongs to user
    const pm = await pool.query('SELECT * FROM payment_methods WHERE id = $1 AND user_id = $2', [payment_method_id, req.user.id]);
    if (pm.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    const amount = plan === 'yearly' ? 72.00 : 6.00;
    const desc = plan === 'yearly' ? 'KYROO Premium - Annual (72 EUR/year)' : 'KYROO Premium - Monthly (6 EUR/month)';

    // Record payment
    await pool.query(
      'INSERT INTO payments (user_id, payment_method_id, amount, currency, description, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, payment_method_id, amount, 'EUR', desc, 'completed']
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
      'SELECT id, email, name, is_premium, premium_started_at, premium_expires_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = rows[0];
    const token = generateToken(user);
    res.json({ user, token, message: 'Premium activated! Welcome to KYROO Premium.' });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Checkout failed' });
  }
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
    'SELECT p.id, p.amount, p.currency, p.description, p.status, p.created_at, pm.label as payment_method FROM payments p LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id WHERE p.user_id = $1 ORDER BY p.created_at DESC',
    [req.user.id]
  );
  res.json(rows);
});

// ========================================
// Admin Routes
// ========================================

// POST /api/admin/generate - AI article generation
app.post('/api/admin/generate', adminRequired, async (req, res) => {
  const { prompt, category, is_premium } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured. Set it as an environment variable.' });

  try {
    const Anthropic = require('@anthropic-ai/sdk');
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
  const { rows } = await pool.query('SELECT * FROM premium_articles ORDER BY published_at DESC');
  res.json(rows);
});

// POST /api/admin/articles - create article
app.post('/api/admin/articles', adminRequired, async (req, res) => {
  const { title, slug, category, excerpt, body, is_premium } = req.body;
  if (!title || !slug || !category || !excerpt || !body) {
    return res.status(400).json({ error: 'All fields are required: title, slug, category, excerpt, body' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO premium_articles (title, slug, category, excerpt, body, is_premium) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, slug, category, excerpt, body, is_premium || false]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'An article with this slug already exists' });
    console.error('Create article error:', err);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

// PUT /api/admin/articles/:id - update article
app.put('/api/admin/articles/:id', adminRequired, async (req, res) => {
  const { title, slug, category, excerpt, body, is_premium } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE premium_articles SET title = COALESCE($1, title), slug = COALESCE($2, slug), category = COALESCE($3, category), excerpt = COALESCE($4, excerpt), body = COALESCE($5, body), is_premium = COALESCE($6, is_premium) WHERE id = $7 RETURNING *',
      [title, slug, category, excerpt, body, is_premium, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Article not found' });
    res.json(rows[0]);
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
    let query = 'SELECT id, slug, category, title, excerpt, is_premium, published_at FROM premium_articles';
    const params = [];
    if (category) {
      query += ' WHERE category = $1';
      params.push(category);
    }
    query += ' ORDER BY published_at DESC';
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

    if (article.is_premium) {
      const isPremiumUser = req.user && req.user.is_premium;
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
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Subscription failed' });
  }
});

app.get('/api/subscribers/count', async (req, res) => {
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM subscribers');
  res.json({ count: parseInt(rows[0].count) });
});

// Fallback - serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Start server
async function start() {
  await waitForDb();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KYROO API running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
