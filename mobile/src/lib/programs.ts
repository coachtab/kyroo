export type Program = {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  duration: string;
  badge: 'FREE' | 'PREMIUM';
  filters: string[];
  description: string;
};

export const PROGRAMS: Program[] = [
  {
    id: 'weightloss',
    name: 'Weight Loss Plan',
    icon: '⚡',
    tagline: 'your pace · fat loss',
    badge: 'PREMIUM',
    filters: ['fat-loss', 'gym', 'home'],
    description: 'Calorie-deficit nutrition, metabolic conditioning, and strategic cardio — nothing else. Built to burn fat and keep it off.',
  },
  {
    id: 'muscle',
    name: 'Muscle Building',
    icon: '💪',
    tagline: 'your pace · hypertrophy',
    badge: 'PREMIUM',
    filters: ['muscle', 'gym'],
    description: '16 weeks of pure progressive overload. Volume phases, intensity blocks, and a deload — everything your muscles need to grow.',
  },
  {
    id: 'challenge90',
    name: '90-Day Challenge',
    icon: '🔥',
    tagline: '90 days · transformation',
    badge: 'PREMIUM',
    filters: ['fat-loss', 'muscle', 'gym', 'home'],
    description: 'Three 30-day phases with escalating intensity, daily accountability, and milestone checkpoints. Finish a different person.',
  },
  {
    id: 'beginner',
    name: 'Beginner Program',
    icon: '🌱',
    tagline: 'your pace · first steps',
    badge: 'PREMIUM',
    filters: ['beginner', 'home', 'gym'],
    description: 'Learn the 5 fundamental movement patterns, build real habits, and finish 8 weeks feeling confident in any gym.',
  },
  {
    id: 'home',
    name: 'Home Workout Plan',
    icon: '🏠',
    tagline: 'your pace · no gym needed',
    badge: 'PREMIUM',
    filters: ['home', 'fat-loss', 'muscle'],
    description: 'Pure bodyweight training with progressive difficulty. No equipment, no commute — just results from your living room.',
  },
  {
    id: 'swim',
    name: 'Swim Training',
    icon: '🏊',
    tagline: 'your pace · pool sessions',
    badge: 'PREMIUM',
    filters: ['sport', 'endurance'],
    description: 'Structured pool sessions with warm-ups, drills, main sets, and cool-downs. Built for your stroke and current level.',
  },
  {
    id: 'hyrox',
    name: 'Hyrox Race Plan',
    icon: '🏟️',
    tagline: 'your pace · race ready',
    badge: 'PREMIUM',
    filters: ['sport', 'gym', 'muscle'],
    description: '8 stations. 8km of running. One race. A periodised plan covering station technique, hybrid conditioning, and race-day pacing strategy.',
  },
  {
    id: 'marathon',
    name: 'Marathon Plan',
    icon: '🏃',
    tagline: 'your pace · half or full',
    badge: 'PREMIUM',
    filters: ['sport', 'endurance'],
    description: 'Half marathon or full 42.2km — long run progression, tempo work, and a structured taper. Every run has a purpose, paced to your race distance and target time.',
  },
];

export const FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Fat Loss', value: 'fat-loss' },
  { label: 'Muscle', value: 'muscle' },
  { label: 'Beginner', value: 'beginner' },
  { label: 'Home', value: 'home' },
  { label: 'Sport', value: 'sport' },
];
