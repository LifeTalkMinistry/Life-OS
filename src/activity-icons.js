export const activityIconOptions = [
  { id: 'general', label: 'General', quick: true },
  { id: 'routine', label: 'Routine', quick: true },
  { id: 'work', label: 'Work', quick: true },
  { id: 'study', label: 'Study', quick: true },
  { id: 'faith', label: 'Faith', quick: true },
  { id: 'fitness', label: 'Fitness', quick: true },
  { id: 'meal', label: 'Meal', quick: true },
  { id: 'commute', label: 'Commute', quick: true },
  { id: 'home', label: 'Home' },
  { id: 'cleaning', label: 'Cleaning' },
  { id: 'laundry', label: 'Laundry' },
  { id: 'bath', label: 'Bath / Hygiene' },
  { id: 'grooming', label: 'Get ready' },
  { id: 'cooking', label: 'Cooking' },
  { id: 'grocery', label: 'Grocery' },
  { id: 'errands', label: 'Errands' },
  { id: 'reading', label: 'Reading' },
  { id: 'writing', label: 'Writing' },
  { id: 'creative', label: 'Creative' },
  { id: 'music', label: 'Music' },
  { id: 'content', label: 'Content creation' },
  { id: 'business', label: 'Business' },
  { id: 'meeting', label: 'Meeting' },
  { id: 'finance', label: 'Money / Finance' },
  { id: 'prayer', label: 'Prayer' },
  { id: 'church', label: 'Church' },
  { id: 'family', label: 'Family' },
  { id: 'social', label: 'Social' },
  { id: 'rest', label: 'Rest' },
  { id: 'health', label: 'Health' },
  { id: 'walk', label: 'Walk' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'call', label: 'Call' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'pet', label: 'Pet care' },
  { id: 'childcare', label: 'Childcare' },
  { id: 'medicine', label: 'Medicine' },
  { id: 'appointment', label: 'Appointment' }
];

export const activityIconIds = activityIconOptions.map((option) => option.id);

export function activityIconSvgMarkup(icon = 'general') {
  const common = 'viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
  if (icon === 'work' || icon === 'fixed') return `<svg ${common}><rect x="4" y="7" width="16" height="11" rx="2"/><path d="M9 7V5h6v2M4 11h16M10 11v2h4v-2"/></svg>`;
  if (icon === 'study' || icon === 'reading') return `<svg ${common}><path d="M4 5.5c2.5-.7 5-.3 8 1.5v12c-3-1.8-5.5-2.2-8-1.5zM20 5.5c-2.5-.7-5-.3-8 1.5v12c3-1.8 5.5-2.2 8-1.5z"/></svg>`;
  if (icon === 'fitness') return `<svg ${common}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>`;
  if (icon === 'faith') return `<svg ${common}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>`;
  if (icon === 'creative' || icon === 'writing') return `<svg ${common}><path d="m5 19 3.8-.8L18 9l-3-3-9.2 9.2zM13.8 7.2l3 3M5 19l2-2"/></svg>`;
  if (icon === 'social' || icon === 'meeting') return `<svg ${common}><circle cx="9" cy="9" r="3"/><circle cx="16.5" cy="10" r="2.5"/><path d="M3.5 19c.6-3 2.5-4.5 5.5-4.5s4.9 1.5 5.5 4.5M14 15c2.9-.5 5 .8 6 4"/></svg>`;
  if (icon === 'routine') return `<svg ${common}><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>`;
  if (icon === 'sleep') return `<svg ${common}><path d="M19 15.5A7.5 7.5 0 0 1 8.5 5a7.5 7.5 0 1 0 10.5 10.5Z"/></svg>`;
  if (icon === 'meal') return `<svg ${common}><path d="M7 3v8M4.5 3v5c0 2 5 2 5 0V3M7 11v10M16 3v18M16 3c3 2 3 7 0 9"/></svg>`;
  if (icon === 'commute') return `<svg ${common}><rect x="4" y="6" width="16" height="11" rx="3"/><path d="M7 17v2M17 17v2M6 11h12M8 8h8"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/></svg>`;
  if (icon === 'home') return `<svg ${common}><path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4z"/></svg>`;
  if (icon === 'cleaning') return `<svg ${common}><path d="M15 4 8 18M12 10l5 2M6 18h8l-2 3H5zM18 5l1 1M19 3v4M17 5h4"/></svg>`;
  if (icon === 'laundry') return `<svg ${common}><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M8 6h1M12 6h4"/></svg>`;
  if (icon === 'bath') return `<svg ${common}><path d="M5 10h14M7 10V7a3 3 0 0 1 6 0M4 14h16M6 14v2a5 5 0 0 0 5 5h2a5 5 0 0 0 5-5v-2M7 21v-2M17 21v-2"/></svg>`;
  if (icon === 'grooming') return `<svg ${common}><circle cx="12" cy="9" r="4"/><path d="M5 21c.7-4 3-6 7-6s6.3 2 7 6M17 4l2-2M18 7h3"/></svg>`;
  if (icon === 'cooking') return `<svg ${common}><path d="M5 10h14v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3zM3 10h18M8 7c0-2 2-2 2-4M14 7c0-2 2-2 2-4"/></svg>`;
  if (icon === 'grocery') return `<svg ${common}><path d="M5 9h14l-1 10H6zM8 9l4-6 4 6M8 13v3M12 13v3M16 13v3"/></svg>`;
  if (icon === 'errands') return `<svg ${common}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9l1.5 1.5L12 8M14 9h3M8 14l1.5 1.5L12 13M14 14h3"/></svg>`;
  if (icon === 'music') return `<svg ${common}><path d="M9 18V6l9-2v12M9 9l9-2"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="15.5" cy="16" r="2.5"/></svg>`;
  if (icon === 'content') return `<svg ${common}><rect x="3" y="6" width="18" height="13" rx="3"/><path d="m10 10 5 3-5 3zM8 6l1-2h6l1 2"/></svg>`;
  if (icon === 'business') return `<svg ${common}><path d="M5 21V5h10v16M15 9h4v12M8 8h2M8 12h2M8 16h2M12 8h1M12 12h1M12 16h1M17 12h1M17 16h1"/></svg>`;
  if (icon === 'finance') return `<svg ${common}><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M15 14h3"/><circle cx="16" cy="14" r=".5"/></svg>`;
  if (icon === 'prayer') return `<svg ${common}><path d="M8 4v7l-2-3c-1-1-2 0-1 2l4 8h6l4-8c1-2-1-3-2-1l-1 2V4M12 3v8"/></svg>`;
  if (icon === 'church') return `<svg ${common}><path d="M12 3v5M9.5 5.5h5M5 21v-9l7-5 7 5v9M9 21v-5h6v5"/></svg>`;
  if (icon === 'family') return `<svg ${common}><circle cx="12" cy="7" r="3"/><circle cx="6" cy="10" r="2"/><circle cx="18" cy="10" r="2"/><path d="M7 20c.5-4 2-6 5-6s4.5 2 5 6M2.5 20c.3-3 1.5-4.5 3.5-4.5M21.5 20c-.3-3-1.5-4.5-3.5-4.5"/></svg>`;
  if (icon === 'rest') return `<svg ${common}><path d="M4 13h16v6H4zM6 13V9h6a3 3 0 0 1 3 3v1M4 19v2M20 19v2"/></svg>`;
  if (icon === 'health') return `<svg ${common}><path d="M12 20s-7-4.2-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.8-7 10-7 10Z"/><path d="M7 12h3l1-2 2 4 1-2h3"/></svg>`;
  if (icon === 'walk') return `<svg ${common}><circle cx="13" cy="4" r="2"/><path d="m11 8 3 2 2 4M11 8 8 12M13 11l-1 5-4 5M12 16l5 5"/></svg>`;
  if (icon === 'gaming') return `<svg ${common}><path d="M7 8h10c3 0 5 8 3 10-1 1-3-2-4-3H8c-1 1-3 4-4 3-2-2 0-10 3-10Z"/><path d="M8 11v4M6 13h4M15 12h.01M18 14h.01"/></svg>`;
  if (icon === 'call') return `<svg ${common}><path d="M7 4 4 7c2 7 6 11 13 13l3-3-4-4-2 2c-3-1-5-3-6-6l2-2z"/></svg>`;
  if (icon === 'shopping') return `<svg ${common}><path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2"/></svg>`;
  if (icon === 'pet') return `<svg ${common}><circle cx="7" cy="8" r="2"/><circle cx="17" cy="8" r="2"/><circle cx="5" cy="13" r="2"/><circle cx="19" cy="13" r="2"/><path d="M12 11c-4 0-6 4-4 7 1 2 3 1 4 0 1 1 3 2 4 0 2-3 0-7-4-7Z"/></svg>`;
  if (icon === 'childcare') return `<svg ${common}><circle cx="12" cy="12" r="8"/><path d="M10 7c1-2 4-2 5 0M9 12h.01M15 12h.01M9 16c2 1 4 1 6 0"/></svg>`;
  if (icon === 'medicine') return `<svg ${common}><path d="M7 17 17 7a4 4 0 0 0-6-6L1 11a4 4 0 0 0 6 6Zm-2-8 6 6"/></svg>`;
  if (icon === 'appointment') return `<svg ${common}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16M8 13h3M8 16h6"/></svg>`;
  return `<svg ${common}><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/></svg>`;
}
