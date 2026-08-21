export const demoActivities = [
  {
    id: 'devotion',
    title: 'DAILY DEVOTION',
    shortTitle: 'Daily Devotion',
    start: '11:00',
    end: '11:30',
    timeLabel: '11:00',
    objective: 'Start the day grounded and aligned.',
    why: 'This is a protected non-negotiable before the rest of the day expands.',
    recommendedMinutes: 30,
    kind: 'fixed'
  },
  {
    id: 'lunch',
    title: 'LUNCH / BREAK',
    shortTitle: 'Lunch / Break',
    start: '13:00',
    end: '13:45',
    timeLabel: '1:00',
    objective: 'Pause, eat, and recover.',
    why: 'Recovery protects the quality of the next focus block.',
    recommendedMinutes: 45,
    kind: 'fixed'
  },
  {
    id: 'clara-outreach',
    title: 'CLARA\nOUTREACH',
    shortTitle: 'CLARA Outreach',
    start: '15:30',
    end: '17:00',
    timeLabel: '3:30',
    objective: 'Recruit real beta users.',
    why: 'You are behind your current recruitment target.',
    recommendedMinutes: 90,
    kind: 'flexible'
  },
  {
    id: 'workout',
    title: 'WORKOUT',
    shortTitle: 'Workout',
    start: '18:00',
    end: '18:45',
    timeLabel: '6:00',
    objective: 'Complete the planned strength session.',
    why: 'Health is protected, but it does not need to interrupt the current bottleneck.',
    recommendedMinutes: 45,
    kind: 'flexible'
  },
  {
    id: 'family',
    title: 'FAMILY /\nPERSONAL TIME',
    shortTitle: 'Family / Personal Time',
    start: '20:00',
    end: '20:45',
    timeLabel: '8:00',
    objective: 'Be fully present before work.',
    why: 'Personal connection is a protected part of the day, not leftover time.',
    recommendedMinutes: 45,
    kind: 'fixed'
  },
  {
    id: 'work',
    title: 'WORK',
    shortTitle: 'Work',
    start: '21:00',
    end: '23:59',
    timeLabel: '9:00',
    objective: 'Prepare for the fixed work commitment.',
    why: 'Work is a fixed constraint and cannot be casually displaced.',
    recommendedMinutes: 180,
    kind: 'fixed'
  }
];

export const initialFocusId = 'clara-outreach';
