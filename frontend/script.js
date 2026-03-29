// ========================================
// KYROO - Dynamic Frontend
// ========================================

const API_BASE = window.location.origin;
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

// ---- Icon SVG map (matches DB icon names) ----
const ICONS = {
  search: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  layers: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  users: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  activity: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  cpu: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/><path d="M9 1v3"/><path d="M15 1v3"/><path d="M9 20v3"/><path d="M15 20v3"/><path d="M20 9h3"/><path d="M20 14h3"/><path d="M1 9h3"/><path d="M1 14h3"/></svg>',
  'bar-chart': '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>',
  book: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  mail: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  star: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  heart: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  box: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  instagram: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
  whatsapp: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>',
};

// Larger icons for explore cards
const ICONS_LG = {};
Object.keys(ICONS).forEach(k => {
  ICONS_LG[k] = ICONS[k].replace(/width="\d+"/, 'width="32"').replace(/height="\d+"/, 'height="32"');
});

// ---- Helper: escape HTML ----
function esc(str) {
  const el = document.createElement('span');
  el.textContent = str || '';
  return el.innerHTML;
}

// ---- Render section label ----
function renderSectionHeader(container, section) {
  if (!container) return;
  container.innerHTML = `
    <span class="section__tag">${esc(section.tag)}</span>
    <h2 class="section__title">${esc(section.title)}</h2>
    ${section.description ? `<p class="section__desc">${esc(section.description)}</p>` : ''}
  `;
}

// ---- Render functions ----

function renderHero(data) {
  const hero = data.sections.hero;
  const titleEl = document.getElementById('heroTitle');
  titleEl.innerHTML = `<span class="hero__title--accent">${esc(hero.title)}</span>`;
  document.getElementById('heroSubtitle').textContent = hero.description;
  updateHeroCTAs();
}

function renderAbout(data) {
  const about = data.sections.about;
  const el = document.getElementById('aboutStatement');
  if (!el) return;
  el.innerHTML = `
    <h2 class="about__headline">${esc(about.title)}</h2>
    ${about.description ? `<p class="about__desc">${esc(about.description)}</p>` : ''}
  `;
}

// Map free content titles to article categories
const CONTENT_CATEGORY_MAP = {
  'Weekly Trend Drops': 'Trends',
  'AI Tool Picks': 'AI',
  'Fitness Quick Tips': 'Fitness',
  'Recommendation Lists': 'Recommendations',
  'The KYROO Newsletter': null,
  'Short Guides': null,
};

function renderFreeContent(data) {
  renderSectionHeader(document.getElementById('freeContentHeader'), data.sections['free-content']);
  const grid = document.getElementById('freeContentGrid');
  grid.innerHTML = data.freeContent.map((card, i) => `
    <article class="content-card" data-animate="fade-up" data-delay="${i * 100}" data-category="${esc(CONTENT_CATEGORY_MAP[card.title] || '')}">
      <div class="content-card__badge">${esc(card.badge)}</div>
      <div class="content-card__icon-wrap">${ICONS[card.icon] || ''}</div>
      <h3 class="content-card__title">${esc(card.title)}</h3>
      <p class="content-card__text">${esc(card.text)}</p>
      <span class="content-card__cta">${esc(card.cta_text)}</span>
    </article>
  `).join('');

  grid.querySelectorAll('.content-card').forEach(card => {
    card.addEventListener('click', () => {
      const cat = card.dataset.category;
      if (cat) {
        filterArticles(cat);
      } else {
        scrollToSection('newsletter');
      }
    });
  });
}

function renderPremium(data) {
  renderSectionHeader(document.getElementById('premiumHeader'), data.sections.premium);

  const plan = data.premiumPlan;
  const featuresHtml = data.premiumFeatures.map(f => `
    <div class="premium__feature">
      <div class="premium__feature-check">${ICONS.check}</div>
      <div>
        <h4 class="premium__feature-title">${esc(f.title)}</h4>
        <p class="premium__feature-text">${esc(f.text)}</p>
      </div>
    </div>
  `).join('');

  const planItemsHtml = plan ? plan.items.map(item => `<li>${esc(item)}</li>`).join('') : '';

  document.getElementById('premiumGrid').innerHTML = `
    <div class="premium__features" data-animate="fade-up">
      ${featuresHtml}
    </div>
    ${plan ? `
    <div class="premium__card" data-animate="fade-up" data-delay="200">
      <div class="premium__card-badge">${esc(plan.badge)}</div>
      <h3 class="premium__card-title">${esc(plan.name)}</h3>
      <div class="premium__card-price">
        <span class="premium__card-amount">${parseInt(plan.price)} EUR</span>
        <span class="premium__card-period">${esc(plan.period)}</span>
      </div>
      <p class="premium__card-note">${esc(plan.note)}</p>
      <ul class="premium__card-list">${planItemsHtml}</ul>
      <button type="button" class="btn btn--primary btn--full" id="premiumCTA"></button>
      <p class="premium__card-guarantee">${esc(plan.guarantee)}</p>
    </div>
    ` : ''}
  `;

  updatePremiumCTA();
}

function updatePremiumCTA() {
  const btn = document.getElementById('premiumCTA');
  if (!btn) return;

  if (currentUser && currentUser.is_premium) {
    btn.textContent = 'You have Premium';
    btn.className = 'btn btn--outline btn--full';
    btn.onclick = () => showAccountModal();
  } else if (currentUser) {
    btn.textContent = 'Go Premium';
    btn.onclick = () => activatePremium();
  } else {
    btn.textContent = 'Get started';
    btn.onclick = () => showAuthModal('signup');
  }
}

const ARROW_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';

function renderExplore(data) {
  renderSectionHeader(document.getElementById('exploreHeader'), data.sections.explore);
  const grid = document.getElementById('exploreGrid');
  grid.innerHTML = data.categories.map((cat, i) => `
    <div class="explore__card" data-category="${esc(cat.title)}" data-animate="fade-up" data-delay="${i * 100}">
      <div class="explore__card-top">
        <div class="explore__card-icon">${ICONS_LG[cat.icon] || ''}</div>
        <span class="explore__card-arrow">${ARROW_SVG}</span>
      </div>
      <h3 class="explore__card-title">${esc(cat.title)}</h3>
      <p class="explore__card-text">${esc(cat.text)}</p>
      <span class="explore__card-cta">Browse articles ${ARROW_SVG}</span>
    </div>
  `).join('');

  grid.querySelectorAll('.explore__card').forEach(card => {
    card.addEventListener('click', () => {
      filterArticles(card.dataset.category);
    });
  });
}

function renderWhy(data) {
  renderSectionHeader(document.getElementById('whyHeader'), data.sections.why);
  document.getElementById('whyGrid').innerHTML = data.whyCards.map((card, i) => `
    <div class="why__card" data-animate="fade-up" data-delay="${i * 100}">
      <div class="why__card-number">${esc(card.number)}</div>
      <h3 class="why__card-title">${esc(card.title)}</h3>
      <p class="why__card-text">${esc(card.text)}</p>
    </div>
  `).join('');
}

function renderNewsletter(data) {
  const section = data.sections.newsletter;
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
  const title = section.title.replace(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/gi, today);
  document.getElementById('newsletterTitle').innerHTML = esc(title);
  updateNewsletterUI();
}

function updateNewsletterUI() {
  const form = document.getElementById('newsletterForm');
  const success = document.getElementById('newsletterSuccess');
  if (!form || !success) return;

  // Only hide the form if the user just subscribed (in this session)
  // Don't override the form for logged-in users - they might want to subscribe too
  if (currentUser) {
    // Pre-fill email if form is visible
    const emailInput = document.getElementById('emailInput');
    if (emailInput && !emailInput.value) {
      emailInput.value = currentUser.email;
    }
  }
}

function renderSocials(data) {
  document.getElementById('footerSocials').innerHTML = data.socialLinks.map(link => `
    <a href="${esc(link.url)}" class="footer__social" aria-label="${esc(link.platform)}">
      ${ICONS[link.icon] || ''}
    </a>
  `).join('');
}

function renderFooterLinks(data) {
  const container = document.getElementById('footerLinks');
  if (!container || !data.footerLinks) return;

  // Add categories column from DB data
  const cols = { ...data.footerLinks };
  if (data.categories && !cols['Categories']) {
    cols['Categories'] = data.categories.map(c => ({ label: c.title, url: 'category:' + c.title, column_title: 'Categories' }));
  }

  const modalLinks = { imprint: 'Imprint', privacy: 'Privacy', terms: 'Terms' };

  container.innerHTML = Object.entries(cols).map(([title, links]) => `
    <div class="footer__col">
      <h4 class="footer__col-title">${esc(title)}</h4>
      ${links.map(l => {
        if (modalLinks[l.url]) {
          return `<a href="javascript:void(0)" class="footer__link footer__modal-link" data-modal="${esc(l.url)}">${esc(l.label)}</a>`;
        }
        if (l.url && l.url.startsWith('category:')) {
          return `<a href="javascript:void(0)" class="footer__link footer__category-link" data-category="${esc(l.url.slice(9))}">${esc(l.label)}</a>`;
        }
        return `<a href="${esc(l.url)}" class="footer__link">${esc(l.label)}</a>`;
      }).join('')}
    </div>
  `).join('');

  // Wire modal links
  container.querySelectorAll('.footer__modal-link').forEach(link => {
    link.addEventListener('click', () => {
      const type = link.dataset.modal;
      if (type === 'imprint') showImprint(data);
      else if (type === 'privacy') showPrivacy(data);
      else if (type === 'terms') showTerms(data);
    });
  });

  // Wire category links
  container.querySelectorAll('.footer__category-link').forEach(link => {
    link.addEventListener('click', () => {
      filterArticles(link.dataset.category);
    });
  });
}

function renderArticlesHeader(data) {
  const header = document.getElementById('articlesHeader');
  if (!header || !data.settings) return;
  header.innerHTML = `
    <span class="section__tag">${esc(data.settings.articles_tag || 'Read')}</span>
    <h2 class="section__title">${esc(data.settings.articles_title || 'Latest from KYROO')}</h2>
    <p class="section__desc">${esc(data.settings.articles_desc || '')}</p>
  `;
}

function showPrivacy(data) {
  const s = data.settings || {};
  document.getElementById('privacyContent').innerHTML = `
    <h2 class="modal__title">${esc(s.privacy_title || 'Privacy Policy')}</h2>
    <div class="legal__body">${esc(s.privacy_body || '')}</div>
  `;
  showModal('privacyModal');
}

function showTerms(data) {
  const s = data.settings || {};
  document.getElementById('termsContent').innerHTML = `
    <h2 class="modal__title">${esc(s.terms_title || 'Terms of Service')}</h2>
    <div class="legal__body">${esc(s.terms_body || '')}</div>
  `;
  showModal('termsModal');
}

function showImprint(data) {
  const s = data.settings || {};
  document.getElementById('imprintContent').innerHTML = `
    <h2 class="modal__title">Imprint</h2>
    <div class="imprint__content">
      <div class="imprint__block">
        <h4 class="imprint__label">Company</h4>
        <p>${esc(s.imprint_company || '')}</p>
        <p>${esc(s.imprint_street || '')}</p>
        <p>${esc(s.imprint_city || '')}</p>
      </div>
      <div class="imprint__block">
        <h4 class="imprint__label">Contact</h4>
        <p>Telefon: ${esc(s.imprint_phone || '')}</p>
        <p>E-Mail: ${esc(s.imprint_email || '')}</p>
      </div>
      <div class="imprint__block">
        <h4 class="imprint__label">Legal</h4>
        <p>Umsatzsteuer ID: ${esc(s.imprint_vat || '')}</p>
        <p>Founder: ${esc(s.imprint_founder || '')}</p>
      </div>
    </div>
  `;
  showModal('imprintModal');
}

// ========================================
// Auth state
// ========================================
let currentUser = null;
let authToken = localStorage.getItem('kyroo_token');

function authHeaders() {
  return authToken ? { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function setAuth(user, token) {
  currentUser = user;
  authToken = token;
  if (token) localStorage.setItem('kyroo_token', token);
  else localStorage.removeItem('kyroo_token');
  updateAuthUI();
}

function clearAuth() {
  setAuth(null, null);
}

let pageReady = false;

function updateAuthUI() {
  const btn = document.getElementById('navAuthBtn');
  // Admin link
  let adminLink = document.getElementById('navAdminLink');
  if (currentUser && currentUser.is_admin) {
    if (!adminLink) {
      adminLink = document.createElement('a');
      adminLink.id = 'navAdminLink';
      adminLink.href = '/admin.html';
      adminLink.className = 'nav__link';
      adminLink.textContent = 'Admin';
      btn.parentNode.insertBefore(adminLink, btn);
    }
  } else if (adminLink) {
    adminLink.remove();
  }

  if (currentUser) {
    btn.textContent = currentUser.name || currentUser.email.split('@')[0];
  } else {
    btn.textContent = 'Log in';
  }
  btn.href = 'javascript:void(0)';
  btn.onclick = (e) => {
    e.preventDefault();
    if (currentUser) showAccountModal();
    else showAuthModal('login');
  };

  // Update dependent sections
  updateHeroCTAs();
  updateNewsletterUI();
  updatePremiumCTA();
}

// ========================================
// Modal helpers
// ========================================
function showModal(id) {
  document.getElementById(id).hidden = false;
  document.body.style.overflow = 'hidden';
}

function hideModal(id) {
  document.getElementById(id).hidden = true;
  document.body.style.overflow = '';
}

function showAuthModal(view) {
  document.getElementById('loginView').hidden = view !== 'login';
  document.getElementById('signupView').hidden = view !== 'signup';
  document.getElementById('accountView').hidden = view !== 'account';
  document.getElementById('forgotView').hidden = view !== 'forgot';
  document.getElementById('loginError').hidden = true;
  document.getElementById('signupError').hidden = true;
  showModal('authModal');
}

async function showAccountModal() {
  if (!currentUser) return showAuthModal('login');

  const info = document.getElementById('accountInfo');
  const actions = document.getElementById('accountActions');

  // Fetch fresh user data
  try {
    const meRes = await fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() });
    if (meRes.ok) currentUser = await meRes.json();
  } catch (e) {}

  const expiresDate = currentUser.premium_expires_at
    ? new Date(currentUser.premium_expires_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  info.innerHTML = `
    <div class="account-info">
      <div class="account-info__row">
        <span class="account-info__label">Email</span>
        <span class="account-info__value">${esc(currentUser.email)}</span>
      </div>
      <div class="account-info__row">
        <span class="account-info__label">Name</span>
        <span class="account-info__value">${esc(currentUser.name || '-')}</span>
      </div>
      <div class="account-info__row">
        <span class="account-info__label">Plan</span>
        <span class="account-info__value">
          ${currentUser.is_premium
            ? '<span class="account-badge account-badge--premium">Premium</span>'
            : '<span class="account-badge account-badge--free">Free</span>'}
        </span>
      </div>
      ${expiresDate ? `
      <div class="account-info__row">
        <span class="account-info__label">Renews</span>
        <span class="account-info__value">${expiresDate}</span>
      </div>
      ` : ''}
    </div>
  `;

  if (currentUser.is_premium) {
    actions.innerHTML = `
      <button type="button" class="btn btn--outline btn--full" id="cancelPremiumBtn">Cancel Premium</button>
    `;
    document.getElementById('cancelPremiumBtn').onclick = cancelPremium;
  } else {
    actions.innerHTML = `
      <button type="button" class="btn btn--primary btn--full" id="activatePremiumBtn">Go Premium - starting at 6 EUR/month</button>
    `;
    document.getElementById('activatePremiumBtn').onclick = () => { hideModal('authModal'); activatePremium(); };
  }

  showAuthModal('account');
}

// ========================================
// Auth actions
// ========================================
async function doLogin(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  setAuth(data.user, data.token);
  hideModal('authModal');
  loadArticles();
}

async function doSignup(name, email, password) {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Signup failed');
  setAuth(data.user, data.token);
  hideModal('authModal');
  loadArticles();
}

function activatePremium() {
  if (!currentUser) return showAuthModal('signup');
  showCheckoutModal();
}

async function cancelPremium() {
  const btn = document.getElementById('cancelPremiumBtn');
  btn.textContent = 'Cancelling...';
  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/premium/cancel`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setAuth(data.user, data.token);
    showAccountModal();
    loadArticles();
  } catch (err) {
    btn.textContent = 'Cancel Premium';
    btn.disabled = false;
  }
}

// ========================================
// Checkout flow
// ========================================
let selectedPlan = 'yearly';
let selectedPaymentMethodId = null;

async function showCheckoutModal() {
  if (!currentUser) return showAuthModal('login');

  const methods = await fetch(`${API_BASE}/api/payment-methods`, { headers: authHeaders() }).then(r => r.json());

  selectedPlan = 'yearly';
  selectedPaymentMethodId = methods.find(m => m.is_default)?.id || null;

  renderCheckout(methods);
  showModal('checkoutModal');
}

function renderCheckout(methods) {
  const content = document.getElementById('checkoutContent');
  const price = selectedPlan === 'yearly' ? '72 EUR' : '6 EUR';
  const period = selectedPlan === 'yearly' ? '/year' : '/month';
  const note = selectedPlan === 'yearly' ? 'Thats 6 EUR/month. Best value.' : 'Billed monthly. Switch to yearly to save.';

  content.innerHTML = `
    <h2 class="modal__title">Go Premium</h2>
    <p class="modal__subtitle">Unlock the full KYROO experience</p>

    <div class="checkout__plan">
      <div class="checkout__plan-row">
        <span class="checkout__plan-name">KYROO Premium</span>
        <span class="checkout__plan-price">${price}<small>${period}</small></span>
      </div>
      <p class="checkout__plan-note">${note}</p>
      <div class="checkout__plan-toggle">
        <button type="button" class="plan-toggle-btn ${selectedPlan === 'monthly' ? 'plan-toggle-btn--active' : ''}" data-plan="monthly">Monthly - 6 EUR</button>
        <button type="button" class="plan-toggle-btn ${selectedPlan === 'yearly' ? 'plan-toggle-btn--active' : ''}" data-plan="yearly">Yearly - 72 EUR</button>
      </div>
    </div>

    ${methods.length > 0 ? `
      <p class="checkout__section-title">Saved payment methods</p>
      <div class="checkout__methods">
        ${methods.map(m => `
          <button type="button" class="payment-method-option ${selectedPaymentMethodId === m.id ? 'payment-method-option--selected' : ''}" data-pm-id="${m.id}">
            <span class="payment-method-option__radio"></span>
            <span class="payment-method-option__label">${esc(m.label)}</span>
            <span class="payment-method-option__type">${esc(m.type.toUpperCase())}</span>
          </button>
        `).join('')}
      </div>
    ` : ''}

    <p class="checkout__section-title">${methods.length > 0 ? 'Or add a new payment method' : 'Add a payment method'}</p>
    <div class="checkout__new-method">
      <div class="checkout__tabs">
        <button type="button" class="checkout__tab checkout__tab--active" data-tab="card">Card</button>
        <button type="button" class="checkout__tab" data-tab="paypal">PayPal</button>
        <button type="button" class="checkout__tab" data-tab="sepa">SEPA</button>
      </div>
      <div id="paymentForm">
        <div class="checkout__card-fields" id="cardForm">
          <input type="text" class="modal__input" id="cardNumber" placeholder="Card number" maxlength="19">
          <div class="checkout__card-row">
            <input type="text" class="modal__input" id="cardExpiry" placeholder="MM/YY" maxlength="5">
            <input type="text" class="modal__input" id="cardCVC" placeholder="CVC" maxlength="4">
          </div>
        </div>
        <div class="checkout__card-fields" id="paypalForm" hidden>
          <input type="email" class="modal__input" id="paypalEmail" placeholder="PayPal email address">
        </div>
        <div class="checkout__card-fields" id="sepaForm" hidden>
          <input type="text" class="modal__input" id="sepaIBAN" placeholder="IBAN (e.g. DE89 3704 0044 0532 0130 00)">
        </div>
      </div>
    </div>

    <div class="checkout__divider"></div>

    <div class="checkout__total">
      <span>Total today</span>
      <span class="checkout__total-amount">${price}</span>
    </div>

    <div class="modal__error" id="checkoutError" hidden></div>
    <button type="button" class="btn btn--primary btn--full" id="checkoutPayBtn">Start Premium</button>
    <p class="checkout__guarantee">14-day free trial. Cancel anytime. Secure payment.</p>
  `;

  // Wire plan toggle
  content.querySelectorAll('.plan-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedPlan = btn.dataset.plan;
      renderCheckout(methods);
    });
  });

  // Wire saved payment method selection
  content.querySelectorAll('.payment-method-option').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedPaymentMethodId = parseInt(btn.dataset.pmId);
      renderCheckout(methods);
    });
  });

  // Wire payment type tabs
  content.querySelectorAll('.checkout__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      content.querySelectorAll('.checkout__tab').forEach(t => t.classList.remove('checkout__tab--active'));
      tab.classList.add('checkout__tab--active');
      document.getElementById('cardForm').hidden = tab.dataset.tab !== 'card';
      document.getElementById('paypalForm').hidden = tab.dataset.tab !== 'paypal';
      document.getElementById('sepaForm').hidden = tab.dataset.tab !== 'sepa';
      // Deselect saved method when adding new
      selectedPaymentMethodId = null;
      content.querySelectorAll('.payment-method-option').forEach(o => o.classList.remove('payment-method-option--selected'));
    });
  });

  // Wire card number formatting
  const cardInput = document.getElementById('cardNumber');
  if (cardInput) {
    cardInput.addEventListener('input', () => {
      let v = cardInput.value.replace(/\D/g, '').slice(0, 16);
      cardInput.value = v.replace(/(.{4})/g, '$1 ').trim();
    });
  }

  // Wire expiry formatting
  const expiryInput = document.getElementById('cardExpiry');
  if (expiryInput) {
    expiryInput.addEventListener('input', () => {
      let v = expiryInput.value.replace(/\D/g, '').slice(0, 4);
      if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
      expiryInput.value = v;
    });
  }

  // Wire pay button
  document.getElementById('checkoutPayBtn').addEventListener('click', processCheckout);
}

async function processCheckout() {
  const btn = document.getElementById('checkoutPayBtn');
  const errEl = document.getElementById('checkoutError');
  errEl.hidden = true;
  btn.textContent = 'Processing...';
  btn.disabled = true;

  try {
    let pmId = selectedPaymentMethodId;

    // If no saved method selected, add the new one first
    if (!pmId) {
      const activeTab = document.querySelector('.checkout__tab--active')?.dataset.tab || 'card';
      let body = { type: activeTab };

      if (activeTab === 'card') {
        body.card_number = document.getElementById('cardNumber').value;
        body.card_expiry = document.getElementById('cardExpiry').value;
        body.card_cvc = document.getElementById('cardCVC').value;
        if (!body.card_number || !body.card_expiry || !body.card_cvc) throw new Error('Please fill in all card fields');
      } else if (activeTab === 'paypal') {
        body.paypal_email = document.getElementById('paypalEmail').value;
        if (!body.paypal_email) throw new Error('Please enter your PayPal email');
      } else if (activeTab === 'sepa') {
        body.iban = document.getElementById('sepaIBAN').value;
        if (!body.iban) throw new Error('Please enter your IBAN');
      }

      const pmRes = await fetch(`${API_BASE}/api/payment-methods`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const pmData = await pmRes.json();
      if (!pmRes.ok) throw new Error(pmData.error);
      pmId = pmData.id;
    }

    // Process checkout
    const res = await fetch(`${API_BASE}/api/premium/checkout`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ payment_method_id: pmId, plan: selectedPlan }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    setAuth(data.user, data.token);
    loadArticles();

    // Show success
    document.getElementById('checkoutContent').innerHTML = `
      <div class="checkout__success">
        <div class="checkout__success-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h3>Welcome to Premium</h3>
        <p>You now have full access to all KYROO content, deep dives, and member-only features.</p>
        <button type="button" class="btn btn--primary" id="checkoutDoneBtn">Start exploring</button>
      </div>
    `;
    document.getElementById('checkoutDoneBtn').addEventListener('click', () => {
      hideModal('checkoutModal');
      scrollToSection('articles');
    });
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
    btn.textContent = 'Start Premium';
    btn.disabled = false;
  }
}

async function restoreSession() {
  if (!authToken) return;
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() });
    if (!res.ok) { clearAuth(); return; }
    const user = await res.json();
    currentUser = user;
    updateAuthUI();
  } catch (e) {
    clearAuth();
  }
}

// ========================================
// Articles
// ========================================
async function loadArticles() {
  try {
    const url = activeFilter
      ? `${API_BASE}/api/articles?category=${encodeURIComponent(activeFilter)}`
      : `${API_BASE}/api/articles`;
    const res = await fetch(url, { headers: authHeaders() });
    const articles = await res.json();
    renderArticles(articles);
    updateFilterBar();
  } catch (err) {
    console.error('Failed to load articles:', err);
  }
}

function renderArticles(articles) {
  const grid = document.getElementById('articlesGrid');

  if (articles.length === 0) {
    grid.innerHTML = `<div class="articles__empty">
      <p>No articles in this category yet. Check back soon.</p>
    </div>`;
    return;
  }

  grid.innerHTML = articles.map((a, i) => `
    <div class="article-card ${a.video_url ? 'article-card--has-video' : ''}" data-slug="${esc(a.slug)}" data-animate="fade-up" data-delay="${i * 80}">
      ${a.video_url ? `
        <div class="article-card__video">
          <video src="${esc(a.video_url)}" muted playsinline preload="metadata"></video>
          <span class="article-card__play">&#9654;</span>
          ${a.video_duration ? `<span class="article-card__duration">${Math.round(a.video_duration)}s</span>` : ''}
        </div>
      ` : ''}
      <div class="article-card__top">
        <span class="article-card__category">${esc(a.category)}</span>
        ${a.is_premium ? '<span class="article-card__lock">Premium</span>' : ''}
        ${a.video_url ? '<span class="article-card__lock" style="color:var(--color-text-secondary)">Video</span>' : ''}
      </div>
      <h3 class="article-card__title">${esc(a.title)}</h3>
      <p class="article-card__excerpt">${esc(a.excerpt)}</p>
      <span class="article-card__cta">${a.is_premium && (!currentUser || !currentUser.is_premium) ? 'Unlock' : a.video_url ? 'Watch' : 'Read'} ${ARROW_SVG}</span>
    </div>
  `).join('');

  // Attach click handlers and video hover
  grid.querySelectorAll('.article-card').forEach(card => {
    card.addEventListener('click', () => openArticle(card.dataset.slug));
    const vid = card.querySelector('video');
    if (vid) {
      card.addEventListener('mouseenter', () => { vid.currentTime = 0; vid.play().catch(() => {}); });
      card.addEventListener('mouseleave', () => { vid.pause(); vid.currentTime = 0; });
    }
  });

  initAnimations();
}

async function openArticle(slug) {
  try {
    const res = await fetch(`${API_BASE}/api/articles/${slug}`, { headers: authHeaders() });
    const article = await res.json();

    const content = document.getElementById('articleContent');

    if (article.locked) {
      content.innerHTML = `
        <div class="article-reader__category">${esc(article.category)}</div>
        <h2 class="article-reader__title">${esc(article.title)}</h2>
        <p class="article-reader__excerpt">${esc(article.excerpt)}</p>
        <div class="article-reader__locked">
          <h3>Premium Content</h3>
          <p>${esc(article.message)}</p>
          ${currentUser
            ? '<button type="button" class="btn btn--primary" id="articleActivateBtn">Go Premium to unlock</button>'
            : '<button type="button" class="btn btn--primary" id="articleLoginBtn">Sign up to unlock</button>'}
        </div>
      `;
      const loginBtn = document.getElementById('articleLoginBtn');
      const activateBtn = document.getElementById('articleActivateBtn');
      if (loginBtn) loginBtn.onclick = () => { hideModal('articleModal'); showAuthModal('signup'); };
      if (activateBtn) activateBtn.onclick = () => { hideModal('articleModal'); showCheckoutModal(); };
    } else {
      content.innerHTML = `
        <div class="article-reader__category">${esc(article.category)}</div>
        <h2 class="article-reader__title">${esc(article.title)}</h2>
        ${article.video_url ? `
          <div class="article-reader__video">
            <video src="${esc(article.video_url)}" controls playsinline preload="metadata"></video>
          </div>
        ` : ''}
        <p class="article-reader__excerpt">${esc(article.excerpt)}</p>
        <div class="article-reader__body">${esc(article.body)}</div>
      `;
    }

    showModal('articleModal');
  } catch (err) {
    console.error('Failed to load article:', err);
  }
}

// ---- Hero CTAs ----
function updateHeroCTAs() {
  const cta1 = document.getElementById('heroCTA1');
  const cta2 = document.getElementById('heroCTA2');
  if (!cta1 || !cta2) return;

  if (currentUser && currentUser.is_premium) {
    cta1.textContent = 'Read';
    cta1.href = '#articles';
    cta1.onclick = (e) => { e.preventDefault(); scrollToSection('articles'); };
    cta2.textContent = 'Account';
    cta2.href = 'javascript:void(0)';
    cta2.onclick = (e) => { e.preventDefault(); showAccountModal(); };
  } else if (currentUser) {
    cta1.textContent = 'Explore';
    cta1.href = '#explore';
    cta1.onclick = (e) => { e.preventDefault(); scrollToSection('explore'); };
    cta2.textContent = 'Go Premium';
    cta2.href = 'javascript:void(0)';
    cta2.onclick = (e) => { e.preventDefault(); scrollToSection('premium'); };
  } else {
    cta1.textContent = 'Explore';
    cta1.href = '#explore';
    cta1.onclick = (e) => { e.preventDefault(); scrollToSection('explore'); };
    cta2.textContent = 'Subscribe';
    cta2.href = '#premium';
    cta2.onclick = (e) => { e.preventDefault(); scrollToSection('premium'); };
  }
}

// ---- Scroll helper ----
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 72;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
}

// ---- Filter articles by category ----
let activeFilter = null;

async function filterArticles(category) {
  activeFilter = category;
  try {
    const url = category ? `${API_BASE}/api/articles?category=${encodeURIComponent(category)}` : `${API_BASE}/api/articles`;
    const res = await fetch(url, { headers: authHeaders() });
    const articles = await res.json();
    renderArticles(articles);
    updateFilterBar();
    scrollToSection('articles');
  } catch (err) {
    console.error('Failed to filter articles:', err);
  }
}

function updateFilterBar() {
  let bar = document.getElementById('articlesFilterBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'articlesFilterBar';
    bar.className = 'articles__filter-bar';
    const header = document.querySelector('#articles .section__header');
    header.parentNode.insertBefore(bar, header.nextSibling);
  }

  const categories = ['All', 'AI', 'Fitness', 'Trends', 'Recommendations', 'Lifestyle', 'Future Tools'];
  bar.innerHTML = categories.map(cat => {
    const isActive = (cat === 'All' && !activeFilter) || cat === activeFilter;
    return `<button type="button" class="filter-btn ${isActive ? 'filter-btn--active' : ''}" data-filter="${cat === 'All' ? '' : cat}">${esc(cat)}</button>`;
  }).join('');

  bar.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.filter;
      if (cat) filterArticles(cat);
      else { activeFilter = null; loadArticles(); updateFilterBar(); }
    });
  });
}

// ---- Init scroll animations (called after dynamic render) ----
function initAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = parseInt(entry.target.dataset.delay) || 0;
        setTimeout(() => entry.target.classList.add('is-visible'), delay);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('[data-animate]:not(.is-visible)').forEach(el => observer.observe(el));
}

// ---- Main ----
document.addEventListener('DOMContentLoaded', async () => {

  // Nav scroll effect
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('nav--scrolled', window.scrollY > 20);
  }, { passive: true });

  // Mobile nav toggle
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navMenu.classList.toggle('active');
    document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
  });
  navMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navToggle.classList.remove('active');
      navMenu.classList.remove('active');
      document.body.style.overflow = '';
    });
  });

  // Smooth scroll (skip '#' only links and the auth button)
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      if (anchor.id === 'navAuthBtn') return;
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 72;
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
      }
    });
  });

  // ---- Auth modal wiring ----
  document.getElementById('authModalClose').onclick = () => hideModal('authModal');
  document.getElementById('authModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideModal('authModal');
  });
  document.getElementById('articleModalClose').onclick = () => hideModal('articleModal');
  document.getElementById('articleModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideModal('articleModal');
  });
  document.getElementById('checkoutModalClose').onclick = () => hideModal('checkoutModal');
  document.getElementById('checkoutModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideModal('checkoutModal');
  });
  document.getElementById('privacyModalClose').onclick = () => hideModal('privacyModal');
  document.getElementById('privacyModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideModal('privacyModal');
  });
  document.getElementById('termsModalClose').onclick = () => hideModal('termsModal');
  document.getElementById('termsModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideModal('termsModal');
  });
  document.getElementById('imprintModalClose').onclick = () => hideModal('imprintModal');
  document.getElementById('imprintModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideModal('imprintModal');
  });

  // Auth button - direct listener as fallback
  document.getElementById('navAuthBtn').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentUser) showAccountModal();
    else showAuthModal('login');
  });

  document.getElementById('showSignup').onclick = (e) => { e.preventDefault(); showAuthModal('signup'); };
  document.getElementById('showLogin').onclick = (e) => { e.preventDefault(); showAuthModal('login'); };
  document.getElementById('showForgot').onclick = (e) => { e.preventDefault(); showAuthModal('forgot'); };
  document.getElementById('backToLogin').onclick = (e) => { e.preventDefault(); showAuthModal('login'); };
  document.getElementById('logoutBtn').onclick = () => { clearAuth(); hideModal('authModal'); loadArticles(); };

  // Forgot password form
  document.getElementById('forgotForm').onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('forgotError');
    const successEl = document.getElementById('forgotSuccess');
    errEl.hidden = true;
    successEl.hidden = true;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.textContent = 'Sending...';
    btn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: document.getElementById('forgotEmail').value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      e.target.hidden = true;
      successEl.hidden = false;
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
      btn.textContent = 'Send reset link';
      btn.disabled = false;
    }
  };

  // Login form
  document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('loginError');
    errEl.hidden = true;
    try {
      await doLogin(
        document.getElementById('loginEmail').value,
        document.getElementById('loginPassword').value
      );
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  };

  // Signup form
  document.getElementById('signupForm').onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('signupError');
    errEl.hidden = true;
    try {
      await doSignup(
        document.getElementById('signupName').value,
        document.getElementById('signupEmail').value,
        document.getElementById('signupPassword').value
      );
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  };

  // ---- Newsletter form ----
  const form = document.getElementById('newsletterForm');
  const success = document.getElementById('newsletterSuccess');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const email = document.getElementById('emailInput').value;
    btn.textContent = 'Joining...';
    btn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Subscription failed');
      form.hidden = true;
      success.hidden = false;
    } catch (err) {
      btn.textContent = 'Subscribe';
      btn.disabled = false;
    }
  });

  // ---- Restore session (clear stale tokens) ----
  await restoreSession();
  // Ensure modals stay closed on page load
  hideModal('authModal');
  hideModal('articleModal');

  // ---- Fetch site data and render ----
  try {
    const res = await fetch(`${API_BASE}/api/site`);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();

    renderHero(data);
    renderExplore(data);
    renderArticlesHeader(data);
    renderPremium(data);
    renderNewsletter(data);
    renderSocials(data);
    renderFooterLinks(data);
    initAnimations();
  } catch (err) {
    console.error('Failed to load site data:', err);
  }

  // ---- Load articles ----
  loadArticles();

  // Allow auth modal only after page is fully initialized
  pageReady = true;

  // ---- WebSocket live updates ----
  connectWebSocket();
});

function connectWebSocket() {
  let ws;
  let reconnectDelay = 1000;

  function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('[KYROO] Live updates connected');
      reconnectDelay = 1000;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleLiveUpdate(msg);
      } catch (e) {}
    };

    ws.onclose = () => {
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 15000);
    };

    ws.onerror = () => ws.close();
  }

  connect();
}

async function handleLiveUpdate(msg) {
  switch (msg.type) {
    case 'article-created':
    case 'article-updated':
    case 'article-deleted':
      loadArticles();
      break;
    case 'content-updated':
      // Reload full site data
      try {
        const res = await fetch(`${API_BASE}/api/site`);
        if (!res.ok) return;
        const data = await res.json();
        renderHero(data);
        renderAbout(data);
        renderExplore(data);
        renderArticlesHeader(data);
        renderPremium(data);
        renderNewsletter(data);
        renderSocials(data);
        renderFooterLinks(data);
      } catch (e) {}
      break;
  }
}
