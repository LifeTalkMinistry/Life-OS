const SVG_NS = 'http://www.w3.org/2000/svg';
const ORBIT_DAYS = [0, 1, 2, 3, 4, 5, 6];

function parseTime(time) {
  const [hour, minute] = String(time || '00:00').split(':').map(Number);
  return (hour * 60) + minute;
}

function shortTimeFromMinutes(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const suffix = hour24 >= 12 ? 'P' : 'A';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}${minute ? `:${String(minute).padStart(2, '0')}` : ''}${suffix}`;
}

function fixedLabel(kind) {
  if (kind === 'school') return 'SCHOOL';
  if (kind === 'both') return 'WORK / SCHOOL';
  return 'WORK';
}

function iconSvg(icon = 'general') {
  const common = 'viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
  if (icon === 'work' || icon === 'fixed') return `<svg ${common}><rect x="4" y="7" width="16" height="11" rx="2"/><path d="M9 7V5h6v2M4 11h16M10 11v2h4v-2"/></svg>`;
  if (icon === 'study') return `<svg ${common}><path d="M4 5.5c2.5-.7 5-.3 8 1.5v12c-3-1.8-5.5-2.2-8-1.5zM20 5.5c-2.5-.7-5-.3-8 1.5v12c3-1.8 5.5-2.2 8-1.5z"/></svg>`;
  if (icon === 'fitness') return `<svg ${common}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>`;
  if (icon === 'faith') return `<svg ${common}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>`;
  if (icon === 'creative') return `<svg ${common}><path d="m5 19 3.8-.8L18 9l-3-3-9.2 9.2zM13.8 7.2l3 3M5 19l2-2"/></svg>`;
  if (icon === 'social') return `<svg ${common}><circle cx="9" cy="9" r="3"/><circle cx="16.5" cy="10" r="2.5"/><path d="M3.5 19c.6-3 2.5-4.5 5.5-4.5s4.9 1.5 5.5 4.5M14 15c2.9-.5 5 .8 6 4"/></svg>`;
  if (icon === 'routine') return `<svg ${common}><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>`;
  if (icon === 'sleep') return `<svg ${common}><path d="M19 15.5A7.5 7.5 0 0 1 8.5 5a7.5 7.5 0 1 0 10.5 10.5Z"/></svg>`;
  return `<svg ${common}><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/></svg>`;
}

function fragmentPosition(fragment) {
  const midpoint = fragment.startMinute + ((fragment.endMinute - fragment.startMinute) / 2);
  const degrees = (midpoint / 1440) * 360;
  const radians = (degrees * Math.PI) / 180;
  const radius = 41.5;
  return {
    x: 50 + Math.sin(radians) * radius,
    y: 50 - Math.cos(radians) * radius,
    degrees
  };
}

function fragmentsForRecurring(block, days, day) {
  const fragments = [];
  const start = parseTime(block.start);
  const end = parseTime(block.end);
  const previousDay = (day + 6) % 7;

  if (start < end) {
    if (days.includes(day)) fragments.push({ ...block, startMinute: start, endMinute: end });
    return fragments;
  }

  if (days.includes(previousDay) && end > 0) {
    fragments.push({ ...block, startMinute: 0, endMinute: end, carried: true });
  }
  if (days.includes(day) && start < 1440) {
    fragments.push({ ...block, startMinute: start, endMinute: 1440 });
  }
  return fragments;
}

function createArc(fragment) {
  const circle = document.createElementNS(SVG_NS, 'circle');
  const startPercent = (fragment.startMinute / 1440) * 100;
  const durationPercent = ((fragment.endMinute - fragment.startMinute) / 1440) * 100;
  circle.setAttribute('cx', '50');
  circle.setAttribute('cy', '50');
  circle.setAttribute('r', '36.5');
  circle.setAttribute('pathLength', '100');
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke-dasharray', `${durationPercent} ${Math.max(0, 100 - durationPercent)}`);
  circle.setAttribute('stroke-dashoffset', `${-startPercent}`);
  circle.setAttribute('transform', 'rotate(-90 50 50)');
  circle.classList.add('setup-day-orbit-arc', `is-${fragment.kind}`);
  return circle;
}

function createNode(fragment, shell) {
  const { x, y, degrees } = fragmentPosition(fragment);
  const node = document.createElement(fragment.kind === 'activity' ? 'button' : 'div');
  if (node instanceof HTMLButtonElement) node.type = 'button';
  node.className = `setup-day-orbit-node is-${fragment.kind}`;
  if (degrees > 135 && degrees < 225) node.classList.add('is-bottom');
  if (degrees > 45 && degrees < 135) node.classList.add('is-right');
  if (degrees > 225 && degrees < 315) node.classList.add('is-left');
  node.style.left = `${x}%`;
  node.style.top = `${y}%`;

  const dot = document.createElement('span');
  dot.className = 'setup-day-orbit-dot';
  dot.innerHTML = iconSvg(fragment.icon);

  const time = document.createElement('span');
  time.className = 'setup-day-orbit-time';
  time.textContent = shortTimeFromMinutes(fragment.startMinute);

  const title = document.createElement('span');
  title.className = 'setup-day-orbit-title';
  title.textContent = fragment.label;

  node.append(dot, time, title);

  if (fragment.kind === 'activity') {
    node.dataset.activityId = fragment.id;
    node.setAttribute('aria-label', `${fragment.label}, ${shortTimeFromMinutes(fragment.startMinute)}. Tap to remove this activity.`);
    node.title = 'Tap to remove';
    node.addEventListener('click', (event) => {
      event.stopPropagation();
      const removeButton = shell.querySelector(`[data-setup-remove-activity="${CSS.escape(fragment.id)}"]`);
      removeButton?.click();
    });
  }

  return node;
}

function fragmentsForDay(profile, day) {
  const fragments = [];

  if (profile.sleepStart && profile.sleepEnd) {
    fragments.push(...fragmentsForRecurring({
      id: 'sleep',
      kind: 'sleep',
      label: 'SLEEP',
      icon: 'sleep',
      start: profile.sleepStart,
      end: profile.sleepEnd
    }, ORBIT_DAYS, day));
  }

  if (profile.hasFixedSchedule && profile.fixedStart && profile.fixedEnd) {
    fragments.push(...fragmentsForRecurring({
      id: 'fixed',
      kind: 'fixed',
      label: fixedLabel(profile.fixedKind),
      icon: 'fixed',
      start: profile.fixedStart,
      end: profile.fixedEnd
    }, profile.fixedDays || [], day));
  }

  (profile.activities || []).forEach((activity) => {
    fragments.push(...fragmentsForRecurring({
      id: activity.id,
      kind: 'activity',
      label: activity.name,
      icon: activity.icon || 'general',
      start: activity.start,
      end: activity.end
    }, activity.days || [], day));
  });

  return fragments;
}

function stateKey(profile, day) {
  const previousDay = (day + 6) % 7;
  return JSON.stringify({
    day,
    sleepStart: profile.sleepStart,
    sleepEnd: profile.sleepEnd,
    hasFixedSchedule: profile.hasFixedSchedule,
    fixedKind: profile.fixedKind,
    fixedDays: profile.fixedDays,
    fixedStart: profile.fixedStart,
    fixedEnd: profile.fixedEnd,
    activities: (profile.activities || []).filter((activity) =>
      activity.days?.includes(day) || activity.days?.includes(previousDay)
    )
  });
}

function buildOrbit(profile, day, shell) {
  const ring = document.createElement('div');
  ring.className = 'setup-day-orbit';
  ring.dataset.stateKey = stateKey(profile, day);
  ring.setAttribute('aria-label', 'Current day map');

  const ticks = document.createElement('div');
  ticks.className = 'setup-day-orbit-ticks';
  ring.appendChild(ticks);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('setup-day-orbit-arcs');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  ring.appendChild(svg);

  [
    ['12A', 'top'],
    ['6A', 'right'],
    ['12P', 'bottom'],
    ['6P', 'left']
  ].forEach(([label, position]) => {
    const marker = document.createElement('span');
    marker.className = `setup-day-orbit-marker is-${position}`;
    marker.textContent = label;
    ring.appendChild(marker);
  });

  fragmentsForDay(profile, day).forEach((fragment) => {
    svg.appendChild(createArc(fragment));
    ring.appendChild(createNode(fragment, shell));
  });

  return ring;
}

function renderSetupOrbit() {
  const shell = document.querySelector('.setup-step-activities');
  if (!shell) return;

  const state = window.__LIFE_OS__?.getState?.();
  const profile = state?.lifeProfile;
  const day = state?.setupActivityDay;
  if (!profile || day === undefined || day === null) return;

  const key = stateKey(profile, day);
  const existing = shell.querySelector(':scope > .setup-day-orbit');
  if (existing?.dataset.stateKey === key) return;
  existing?.remove();
  shell.prepend(buildOrbit(profile, day, shell));
}

let renderQueued = false;
function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderSetupOrbit();
  });
}

const appRoot = document.querySelector('#app');
if (appRoot) {
  const observer = new MutationObserver(queueRender);
  observer.observe(appRoot, { childList: true, subtree: true });
}

queueRender();
