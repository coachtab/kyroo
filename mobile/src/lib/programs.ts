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
    tagline: '12-week plan',
    badge: 'PREMIUM',
    filters: ['fat-loss', 'gym', 'home'],
    description: 'Science-backed fat loss combining progressive training, smart cardio strategy, and personalized nutrition guidance.',
  },
  {
    id: 'muscle',
    name: 'Muscle Building',
    icon: '💪',
    tagline: '16-week plan',
    badge: 'PREMIUM',
    filters: ['muscle', 'gym'],
    description: 'Progressive overload hypertrophy program built around your schedule and available equipment.',
  },
  {
    id: 'challenge90',
    name: '90-Day Challenge',
    icon: '🔥',
    tagline: '90-day plan',
    badge: 'PREMIUM',
    filters: ['fat-loss', 'muscle', 'gym', 'home'],
    description: 'A complete 90-day transformation program. Train hard, eat smart, track progress.',
  },
  {
    id: 'beginner',
    name: 'Beginner Program',
    icon: '🌱',
    tagline: '8-week plan',
    badge: 'PREMIUM',
    filters: ['beginner', 'home', 'gym'],
    description: 'Your first real fitness plan — designed to build habits, confidence, and a solid foundation.',
  },
  {
    id: 'home',
    name: 'Home Workout Plan',
    icon: '🏠',
    tagline: '10-week plan',
    badge: 'PREMIUM',
    filters: ['home', 'fat-loss', 'muscle'],
    description: 'No gym, no excuses. A full home-based training plan with zero equipment required.',
  },
  {
    id: 'swim',
    name: 'Swim Training',
    icon: '🏊',
    tagline: 'Custom plan',
    badge: 'PREMIUM',
    filters: ['sport', 'endurance'],
    description: 'Competition-ready swim training built around your tournament date and current level.',
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
