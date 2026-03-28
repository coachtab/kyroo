-- Migration: Add users, premium_articles tables

CREATE TABLE IF NOT EXISTS users (
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

CREATE TABLE IF NOT EXISTS premium_articles (
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

-- Seed articles
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

Each pick includes our honest review, alternatives we considered, and who it is best for.', true)
ON CONFLICT (slug) DO NOTHING;
