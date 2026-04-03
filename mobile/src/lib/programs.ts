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
    filters: ['fat-loss', 'home'],
    description: 'Calorie-deficit nutrition, metabolic conditioning, and strategic cardio — nothing else. Built to burn fat and keep it off.',
  },
  {
    id: 'muscle',
    name: 'Muscle Building',
    icon: '💪',
    tagline: 'your pace · hypertrophy',
    badge: 'PREMIUM',
    filters: ['strength'],
    description: '16 weeks of pure progressive overload. Volume phases, intensity blocks, and a deload — everything your muscles need to grow.',
  },
  {
    id: 'challenge90',
    name: '90-Day Challenge',
    icon: '🔥',
    tagline: '90 days · transformation',
    badge: 'PREMIUM',
    filters: ['fat-loss', 'strength'],
    description: 'Three 30-day phases with escalating intensity, daily accountability, and milestone checkpoints. Finish a different person.',
  },
  {
    id: 'beginner',
    name: 'Beginner Program',
    icon: '🌱',
    tagline: 'your pace · first steps',
    badge: 'PREMIUM',
    filters: ['beginner', 'home'],
    description: 'Learn the 5 fundamental movement patterns, build real habits, and finish 8 weeks feeling confident in any gym.',
  },
  {
    id: 'home',
    name: 'Home Workout Plan',
    icon: '🏠',
    tagline: 'your pace · no gym needed',
    badge: 'PREMIUM',
    filters: ['home', 'fat-loss', 'strength'],
    description: 'Pure bodyweight training with progressive difficulty. No equipment, no commute — just results from your living room.',
  },
  {
    id: 'swim',
    name: 'Swim Training',
    icon: '🏊',
    tagline: 'your pace · pool sessions',
    badge: 'PREMIUM',
    filters: ['sport'],
    description: 'Structured pool sessions with warm-ups, drills, main sets, and cool-downs. Built for your stroke and current level.',
  },
  {
    id: 'hyrox',
    name: 'Hyrox Race Plan',
    icon: '🏟️',
    tagline: 'your pace · race ready',
    badge: 'PREMIUM',
    filters: ['sport', 'strength'],
    description: '8 stations. 8km of running. One race. A periodised plan covering station technique, hybrid conditioning, and race-day pacing strategy.',
  },
  {
    id: 'marathon',
    name: 'Marathon Plan',
    icon: '🏃',
    tagline: 'your pace · half or full',
    badge: 'PREMIUM',
    filters: ['sport'],
    description: 'Half marathon or full 42.2km — long run progression, tempo work, and a structured taper. Every run has a purpose, paced to your race distance and target time.',
  },
  {
    id: 'crossfit',
    name: 'CrossFit Program',
    icon: '🏋️',
    tagline: 'your pace · functional fitness',
    badge: 'PREMIUM',
    filters: ['sport', 'strength'],
    description: 'Strength, gymnastics, and MetCons — programmed as real CrossFit. WODs written in full notation with Rx weights and two scaling options every session.',
  },
  {
    id: 'hiit',
    name: 'HIIT Program',
    icon: '⚡',
    tagline: 'your pace · high intensity',
    badge: 'PREMIUM',
    filters: ['fat-loss', 'home', 'strength'],
    description: 'Tabata, AMRAP, EMOM, and circuits — every session a different format, all designed to fit your session length. Maximum results in minimum time.',
  },
];

export const FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: '🔥 Burn Fat', value: 'fat-loss' },
  { label: '💪 Build Muscle', value: 'strength' },
  { label: '🏠 At Home', value: 'home' },
  { label: '🌱 Beginner', value: 'beginner' },
  { label: '🏅 Sport & Race', value: 'sport' },
];
