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
    tagline: '16-week · hypertrophy',
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
    tagline: '8-week · first steps',
    badge: 'PREMIUM',
    filters: ['beginner', 'home', 'gym'],
    description: 'Learn the 5 fundamental movement patterns, build real habits, and finish 8 weeks feeling confident in any gym.',
  },
  {
    id: 'home',
    name: 'Home Workout Plan',
    icon: '🏠',
    tagline: '10-week · no gym needed',
    badge: 'PREMIUM',
    filters: ['home', 'fat-loss', 'muscle'],
    description: 'Pure bodyweight training with progressive difficulty. No equipment, no commute — just results from your living room.',
  },
  {
    id: 'swim',
    name: 'Swim Training',
    icon: '🏊',
    tagline: 'Custom · pool sessions',
    badge: 'PREMIUM',
    filters: ['sport', 'endurance'],
    description: 'Structured pool sessions with warm-ups, drills, main sets, and cool-downs. Built for your stroke and current level.',
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
