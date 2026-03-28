-- KYROO Database Schema & Seed Data

-- ========================================
-- Sections (hero, about, newsletter, etc.)
-- ========================================
CREATE TABLE sections (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(50) UNIQUE NOT NULL,
    tag VARCHAR(100),
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- About cards
-- ========================================
CREATE TABLE about_cards (
    id SERIAL PRIMARY KEY,
    icon VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    text TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- Free content cards
-- ========================================
CREATE TABLE free_content (
    id SERIAL PRIMARY KEY,
    badge VARCHAR(50),
    icon VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    text TEXT NOT NULL,
    cta_text VARCHAR(100) DEFAULT 'Read free >',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- Premium features
-- ========================================
CREATE TABLE premium_features (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    text TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- Premium plan
-- ========================================
CREATE TABLE premium_plan (
    id SERIAL PRIMARY KEY,
    badge VARCHAR(100),
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    period VARCHAR(50) DEFAULT '/month',
    note TEXT,
    guarantee TEXT,
    items TEXT[] NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- Explore categories
-- ========================================
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    icon VARCHAR(50) NOT NULL,
    title VARCHAR(100) NOT NULL,
    text VARCHAR(255) NOT NULL,
    link VARCHAR(255) DEFAULT '#',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- Why KYROO cards
-- ========================================
CREATE TABLE why_cards (
    id SERIAL PRIMARY KEY,
    number VARCHAR(10) NOT NULL,
    title VARCHAR(150) NOT NULL,
    text TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- Hero stats
-- ========================================
CREATE TABLE hero_stats (
    id SERIAL PRIMARY KEY,
    value VARCHAR(50) NOT NULL,
    label VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- Users
-- ========================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(150),
    is_premium BOOLEAN DEFAULT false,
    premium_started_at TIMESTAMP,
    premium_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- Premium content articles
-- ========================================
CREATE TABLE premium_articles (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    excerpt TEXT NOT NULL,
    body TEXT NOT NULL,
    is_premium BOOLEAN DEFAULT false,
    published_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- Newsletter subscribers
-- ========================================
CREATE TABLE subscribers (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    subscribed_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- Social links
-- ========================================
CREATE TABLE social_links (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    url VARCHAR(255) DEFAULT '#',
    icon VARCHAR(50) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- SEED DATA
-- ========================================

-- Sections
INSERT INTO sections (slug, tag, title, description) VALUES
('hero', 'Born in Berlin. Made for everywhere.', 'Culture moves fast. We move faster.', 'KYROO is the editorial platform for the curious - curating AI, fitness, trends, and lifestyle picks from Prenzlauer Berg to the rest of the world. Independent. Opinionated. Always ahead.'),
('about', 'The Platform', 'What is KYROO?', 'Born out of a Prenzlauer Berg apartment and a shared obsession with what''s next. KYROO is where editorial taste meets internet speed - a curated lens on AI, fitness, culture, and the tools shaping modern life. No algorithms. No corporate fluff. Just a small team with strong opinions and good taste.'),
('free-content', 'Free for Everyone', 'Good taste shouldn''t cost you.', 'Our best thinking is free. Trend reports, tool reviews, fitness guides, curated lists - no paywall, no catch. We built KYROO because the internet deserves better editorial.'),
('premium', 'Go Premium', 'For the ones who want the full picture.', 'Go deeper with exclusive reports, advanced picks, and member-only drops. KYROO Premium is for people who treat staying informed like a craft.'),
('explore', 'Explore', 'Pick your rabbit hole.', 'Every vertical is curated by people who actually live in these spaces - not content farms, not SEO bait. Real taste, real depth.'),
('why', 'Why KYROO', 'Independently curated. Unapologetically opinionated.', NULL),
('newsletter', 'The Monday Drop', 'Your week starts here.', 'Join 12,000+ curious people who start their Monday with KYROO''s briefing - trends, tools, and handpicked insights. Written in Berlin, read everywhere.');

-- Hero stats
INSERT INTO hero_stats (value, label, sort_order) VALUES
('50K+', 'Monthly readers', 1),
('200+', 'Curated picks', 2),
('Berlin', 'based', 3);

-- About cards
INSERT INTO about_cards (icon, title, text, sort_order) VALUES
('search', 'Editorially Curated', 'No algorithms, no engagement traps. Every piece is hand-picked by our editorial team - the way a good bookstore picks its shelves.', 1),
('layers', 'Multi-Vertical', 'AI breakthroughs, fitness routines, culture shifts, the best new tools - we cover the full spectrum of what makes modern life interesting.', 2),
('users', 'Gen Z / Gen Alpha / Culture People', 'Built for the generation that grew up online and the one growing up right now. Fast, visual, zero fluff - and enough depth to actually learn something.', 3);

-- Free content
INSERT INTO free_content (badge, icon, title, text, cta_text, sort_order) VALUES
('Trending', 'activity', 'Weekly Trend Drops', 'What''s actually moving culture this week - distilled into a 3-minute read every Monday. Like a friend who always knows things first.', 'Read free >', 1),
('Popular', 'cpu', 'AI Tool Picks', 'We test so you don''t have to. Handpicked AI tools reviewed for real-world use - honest takes, no hype, no affiliate bait.', 'Explore tools >', 2),
('New', 'bar-chart', 'Fitness Quick Tips', 'Science-backed micro-guides for workouts, nutrition, and recovery. Written by people who actually go to the gym, not influencers.', 'Get tips >', 3),
('Curated', 'book', 'Recommendation Lists', 'Our editors'' top picks across apps, gear, reads, and more. Updated monthly. Think of it as a Berlin concept store, but online.', 'See lists >', 4),
('Weekly', 'mail', 'The KYROO Newsletter', 'One email. Everything worth knowing. 12,000+ subscribers start their week with us. Join before it gets too popular.', 'Subscribe free >', 5),
('Guide', 'star', 'Short Guides', 'Bite-sized guides on building better habits, using AI at work, and navigating the culture - written like magazine pieces, not blog posts.', 'Start reading >', 6);

-- Premium features
INSERT INTO premium_features (title, text, sort_order) VALUES
('Exclusive Deep Dives', 'Long-form editorial pieces on emerging trends, AI shifts, and culture movements - published before the mainstream catches on.', 1),
('Advanced Recommendations', 'Personalized picks based on your taste profile - tools, gear, content, and experiences curated just for you.', 2),
('Member-Only Drops', 'Early access to curated drops, Berlin-based partner collabs, and limited content releases you won''t find anywhere else.', 3),
('Premium Fitness Programs', 'Structured workout programs, nutrition blueprints, and recovery protocols designed by actual coaches.', 4),
('Ad-Free Reading', 'Pure editorial, zero distractions. The reading experience the internet was supposed to have.', 5);

-- Premium plan
INSERT INTO premium_plan (badge, name, price, period, note, guarantee, items) VALUES
('Most Popular', 'KYROO Premium', 6.00, '/month', 'Billed annually at 72 EUR/year. Cancel anytime.', '14-day free trial. No credit card required.',
 ARRAY['Everything in Free', 'Exclusive long-form deep dives', 'Personalized advanced picks', 'Member-only drops & early access', 'Premium fitness programs', 'Ad-free reading experience', 'Priority community access']);

-- Categories
INSERT INTO categories (icon, title, text, link, sort_order) VALUES
('activity', 'Trends', 'What''s actually moving culture right now', '#', 1),
('cpu', 'AI', 'Tools, breakthroughs, honest reviews', '#', 2),
('bar-chart', 'Fitness', 'Workouts, nutrition, real science', '#', 3),
('star', 'Recommendations', 'Picks curated by humans with taste', '#', 4),
('heart', 'Lifestyle', 'Living smarter, not performing harder', '#', 5),
('box', 'Future Tools', 'The apps and tech worth your attention', '#', 6);

-- Why cards
INSERT INTO why_cards (number, title, text, sort_order) VALUES
('01', 'Signal over noise', 'The internet is loud. We don''t add to it. Every piece of content is editorially vetted - if it doesn''t pass the "would I send this to a friend" test, it doesn''t ship.', 1),
('02', 'Berlin-speed ahead', 'Our editorial team lives in the spaces we cover. We spot what''s next weeks before the mainstream catches on. Prenzlauer Berg to your feed, fast.', 2),
('03', 'Human curation', 'Real editors pick every recommendation. No black-box algorithms, no engagement optimization. Just people with good taste and strong opinions.', 3),
('04', 'Everything in one place', 'AI, fitness, trends, lifestyle - stop bouncing between ten newsletters and twenty apps. We did the consolidation so you don''t have to.', 4),
('05', 'Mobile-native', 'Designed for how you actually consume content - fast, visual, swipeable. Looks good on the U-Bahn, looks good on your desktop.', 5),
('06', 'Community-shaped', 'Our best ideas come from our readers. KYROO evolves with the community, not around some growth-hack roadmap.', 6);

-- Social links
INSERT INTO social_links (platform, url, icon, sort_order) VALUES
('Instagram', '#', 'instagram', 1),
('WhatsApp', '#', 'whatsapp', 2),
('Twitter / X', '#', 'x', 3);

-- Premium articles (mix of free and premium)
INSERT INTO premium_articles (slug, category, title, excerpt, body, is_premium) VALUES
('ai-tools-march-2026', 'AI', '7 AI Tools That Actually Changed How We Work This Month', 'Forget the hype. These seven tools passed our real-world test - here is what stuck and what flopped.', 'We spent the last four weeks testing every new AI tool that crossed our desk. Most were forgettable. These seven were not.

1. Arc Browser''s AI Tab Manager - Finally, a browser that understands context. It groups your tabs by project and summarizes what you were working on when you left off.

2. Granola - Meeting notes that actually capture what matters. It listens, transcribes, and pulls out action items without you lifting a finger.

3. Cursor Composer - If you write code, this is the upgrade you did not know you needed. Multi-file editing with AI that understands your entire codebase.

4. Perplexity Spaces - Research workspaces that remember your context. Ask follow-up questions days later and it picks up where you left off.

5. Kling 2.0 - Video generation that finally looks professional. We used it for three client projects this month.

6. NotebookLM - Google''s sleeper hit. Upload any document and have a conversation with it. We use it for every deep dive we publish.

7. Bolt.new - Full-stack web apps from a prompt. Not perfect, but the speed is unreal for prototyping.', false),

('prenzlberg-fitness-guide', 'Fitness', 'The Prenzlauer Berg Fitness Guide - Our Favorite Spots', 'From outdoor calisthenics parks to boutique studios, here is where our team actually works out.', 'Living in Prenzlauer Berg means you are never far from a good workout. Here is our curated guide to the best spots in the neighborhood.

Mauerpark Calisthenics - Free, outdoor, and surprisingly well-equipped. Best at sunrise before the flea market crowd arrives.

BECYCLE - Boutique spinning meets community. The Thursday evening ride is legendary.

Yoga am Wasserturm - Small classes, great teachers, beautiful space. Book ahead or you will not get in.

Volkspark Friedrichshain Runs - The 5K loop around the park is the unofficial Prenzlauer Berg running route. You will see the same faces every morning.

CrossFit Icke - Yes, the name is peak Berlin. The coaching is legitimately excellent though.

Swimming at the SSE - Olympic-sized pool, early morning lanes are peaceful. Best-kept secret for a full-body workout.', false),

('premium-ai-deep-dive', 'AI', 'The Real State of AI in 2026 - Beyond the Headlines', 'Our comprehensive analysis of where AI actually stands, who is winning, and what comes next. Premium members only.', 'This is our most in-depth report of the quarter. We interviewed 30+ founders, analyzed market data, and synthesized everything into what we believe is the clearest picture of where AI is headed.

The short version: the foundation model race is consolidating, but the application layer is exploding. The winners will not be the companies building models - they will be the ones building workflows.

Chapter 1: The Model Layer
The gap between frontier models is shrinking. Claude, GPT, and Gemini are converging on capability. The real differentiator is now reliability, speed, and cost.

Chapter 2: The Application Layer
This is where the action is. Vertical AI companies - those building for specific industries - are growing 3x faster than horizontal tools.

Chapter 3: What Comes Next
Agents are real, but overhyped. The first wave will be narrow and task-specific. General-purpose agents are still years away.

Chapter 4: Our Picks
The 12 companies we think will define the next 18 months of AI. Names you know and names you do not - yet.', true),

('premium-fitness-program', 'Fitness', '12-Week Strength Program - The KYROO Method', 'A structured strength program designed by actual coaches. No fluff, just progressive overload and real results.', 'This program is designed for intermediate lifters who want to get stronger without living in the gym. Three days per week, 60 minutes per session.

The Philosophy:
- Progressive overload is the only thing that matters
- Recovery is training
- Track everything, guess nothing

Week 1-4: Foundation Phase
Day A: Squat 4x6, Bench 4x6, Rows 3x8, Accessories
Day B: Deadlift 4x5, OHP 4x6, Pull-ups 3xMax, Accessories
Day C: Front Squat 3x8, Incline Bench 3x8, RDL 3x10, Accessories

Week 5-8: Building Phase
Increase working weights by 2.5kg per week. If you miss reps, hold the weight for another week.

Week 9-12: Peak Phase
Reduce volume, increase intensity. Test your maxes in week 12.

Nutrition Guidelines:
- Protein: 1.8g per kg bodyweight minimum
- Sleep: 7+ hours non-negotiable
- Hydration: 3L daily

Full exercise descriptions, video links, and a tracking spreadsheet are included below.', true),

('trend-drop-week12', 'Trends', 'Trend Drop #47 - What Moved This Week', 'De-influencing is back, AI wearables are struggling, and a Berlin startup just raised 50M for digital fashion.', 'Welcome to Trend Drop #47. Here is what actually mattered this week.

1. De-influencing 2.0 - The backlash to overconsumption content is back, but this time it is more nuanced. People are not anti-buying - they are anti-waste. Brands that lead with longevity are winning.

2. AI Wearables Hit a Wall - Humane laid off 40% of staff. The Rabbit R1 is being used as a paperweight. The lesson: nobody wants a new device. They want AI in the devices they already own.

3. Berlin x Digital Fashion - Replicant, a Kreuzberg-based startup, just raised 50M EUR to build digital fashion for gaming avatars. The crossover of streetwear and gaming is the most underrated trend of 2026.

4. Micro-Fitness Breaks - The 5-minute workout trend is not just TikTok noise. Companies are building it into their workplace wellness programs. We tested three apps - Wakeout is the best.

5. The Newsletter Shakeout - Substack, Beehiiv, and Ghost are all fighting for creators. Our take: pick based on ownership and portability, not features.

See you next Monday.', false),

('premium-recommendations-q1', 'Recommendations', 'Q1 2026 - The KYROO 25: Our Absolute Best Picks', 'The definitive list of the 25 best tools, apps, products, and experiences we discovered this quarter.', 'Every quarter, our editorial team votes on the best discoveries across all verticals. These are the 25 things that earned a permanent place in our lives.

TECH
1. Arc Max - The browser we switched to permanently
2. Raycast - Replaced Spotlight, Alfred, and three other apps
3. Linear - Project management that developers actually enjoy
4. Readwise Reader - Where we do all our reading now

FITNESS
5. WHOOP 5.0 - Finally accurate enough to trust
6. Theragun Sense - Best recovery tool at this price
7. MacroFactor - The only nutrition app that adapts to you

LIFESTYLE
8. Kinto Tumbler - The best travel mug. Not close.
9. Muji Gel Pen 0.38 - Sometimes analog wins
10. Uniqlo Airism - The base layer everything else is measured against

APPS
11. Artifact - News curation done right
12. Flighty - Makes air travel almost bearable
13. Endel - AI-generated focus music that actually works

... and 12 more picks available exclusively for KYROO Premium members.

Each pick includes our honest review, alternatives we considered, and who it is best for.', true);
