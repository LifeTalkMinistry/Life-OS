const SVG_NS = 'http://www.w3.org/2000/svg';
const HALF_DAY_MINUTES = 720;
const FULL_DAY_MINUTES = 1440;

const RING_RADIUS = {
  am: 35.8,
  pm: 43.3
};

function parseTime(time) {
  const [hour, minute] = String(time || '00:00').split(':').map(Number);
  return (hour * 60) + minute;
}

function normalizeMinute(totalMinutes) {
  return ((totalMinutes % FULL_DAY_MINUTES) + FULL_DAY_MINUTES) % FULL_DAY_MINUTES;
}

function periodForMinute(totalMinutes) {
  return normalizeMinute(totalMinutes) < HALF_DAY_MINUTES ? 'am' : 'pm';
}

function clockMinuteForMinute(totalMinutes) {
  return normalizeMinute(totalMinutes) % HALF_DAY_MINUTES;
}

function shortTimeFromMinutes(totalMinutes) {
  const normalized = normalizeMinute(totalMinutes);
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

function finishIconSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 20V4M8 5h9l-2.2 3L17 11H8"/></svg>';
}

/*
 * Two standard 12-hour clocks share the same angles:
 * 12 = top, 3 = right, 6 = bottom, 9 = left.
 * Inner ring is AM; outer ring is PM.
 */
function positionForClockMinute(clockMinute, period) {
  const normalizedClockMinute = ((clockMinute % HALF_DAY_MINUTES) + HALF_DAY_MINUTES) % HALF_DAY_MINUTES;
  const degrees = (normalizedClockMinute / HALF_DAY_MINUTES) * 360;
  const radians = (degrees * Math.PI) / 180;
  const radius = RING_RADIUS[period];
  return {
    x: 50 + Math.sin(radians) * radius,
    y: 50 - Math.cos(radians) * radius,
    degrees
  };
}

function blockDuration(start, end) {
  const startMinute = parseTime(start);
  const endMinute = parseTime(end);
  return ((endMinute - startMinute) + FULL_DAY_MINUTES) % FULL_DAY_MINUTES;
}

/* Split at noon/midnight so every line segment lives on the correct ring. */
function segmentsForBlock(block) {
  const startMinute = parseTime(block.start);
  const duration = blockDuration(block.start, block.end);
  if (!duration) return [];

  const absoluteEnd = startMinute + duration;
  const segments = [];
  let cursor = startMinute;

  while (cursor < absoluteEnd) {
    const nextBoundary = (Math.floor(cursor / HALF_DAY_MINUTES) + 1) * HALF_DAY_MINUTES;
    const segmentEnd = Math.min(absoluteEnd, nextBoundary);
    const normalizedStart = normalizeMinute(cursor);
    const period = periodForMinute(normalizedStart);
    const clockStartMinute = clockMinuteForMinute(normalizedStart);
    const segmentDuration = segmentEnd - cursor;

    segments.push({
      ...block,
      period,
      clockStartMinute,
      segmentDuration
    });

    cursor = segmentEnd;
  }

  return segments;
}

function createTickCircle(period) {
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', '50');
  circle.setAttribute('cy', '50');
  circle.setAttribute('r', String(RING_RADIUS[period]));
  circle.setAttribute('pathLength', '120');
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke-dasharray', '0.7 9.3');
  circle.setAttribute('transform', 'rotate(-90 50 50)');
  circle.classList.add('setup-day-orbit-tick-circle', `is-${period}`);
  return circle;
}

function createArc(segment) {
  const circle = document.createElementNS(SVG_NS, 'circle');
  const startPercent = (segment.clockStartMinute / HALF_DAY_MINUTES) * 100;
  const durationPercent = (segment.segmentDuration / HALF_DAY_MINUTES) * 100;
  circle.setAttribute('cx', '50');
  circle.setAttribute('cy', '50');
  circle.setAttribute('r', String(RING_RADIUS[segment.period]));
  circle.setAttribute('pathLength', '100');
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke-dasharray', `${durationPercent} ${Math.max(0, 100 - durationPercent)}`);
  circle.setAttribute('stroke-dashoffset', `${-startPercent}`);
  circle.setAttribute('transform', 'rotate(-90 50 50)');
  circle.classList.add('setup-day-orbit-arc', `is-${segment.kind}`, `is-${segment.period}`);
  return circle;
}

function createStartNode(block, shell) {
  const startMinute = parseTime(block.start);
  const period = periodForMinute(startMinute);
  const clockMinute = clockMinuteForMinute(startMinute);
  const { x, y } = positionForClockMinute(clockMinute, period);
  const node = document.createElement(block.kind === 'activity' ? 'button' : 'div');
  if (node instanceof HTMLButtonElement) node.type = 'button';
  node.className = `setup-day-orbit-node is-${block.kind} is-${period}`;
  node.style.left = `${x}%`;
  node.style.top = `${y}%`;
  node.setAttribute('aria-label', `${block.label} starts ${shortTimeFromMinutes(startMinute)}`);
  node.title = `${block.label} · ${shortTimeFromMinutes(startMinute)}`;

  const dot = document.createElement('span');
  dot.className = 'setup-day-orbit-dot';
  dot.innerHTML = iconSvg(block.icon);

  const time = document.createElement('span');
  time.className = 'setup-day-orbit-time';
  time.textContent = shortTimeFromMinutes(startMinute);

  node.append(dot, time);

  if (block.kind === 'activity') {
    node.dataset.activityId = block.id;
    node.setAttribute('aria-label', `${block.label} starts ${shortTimeFromMinutes(startMinute)}. Tap to remove this activity.`);
    node.title = `${block.label} · ${shortTimeFromMinutes(startMinute)} · tap to remove`;
    node.addEventListener('click', (event) => {
      event.stopPropagation();
      const removeButton = shell.querySelector(`[data-setup-remove-activity="${CSS.escape(block.id)}"]`);
      removeButton?.click();
    });
  }

  return node;
}

/* One universal finish flag marks the exact end of every block. */
function createEndMarker(block) {
  const endMinute = parseTime(block.end);
  const period = periodForMinute(endMinute);
  const clockMinute = clockMinuteForMinute(endMinute);
  const { x, y } = positionForClockMinute(clockMinute, period);
  const marker = document.createElement('div');
  marker.className = `setup-day-orbit-endpoint is-${block.kind} is-${period}`;
  marker.style.left = `${x}%`;
  marker.style.top = `${y}%`;
  marker.setAttribute('aria-label', `${block.label} ends ${shortTimeFromMinutes(endMinute)}`);
  marker.title = `${block.label} ends · ${shortTimeFromMinutes(endMinute)}`;

  const icon = document.createElement('span');
  icon.className = 'setup-day-orbit-endpoint-icon';
  icon.innerHTML = finishIconSvg();

  const time = document.createElement('span');
  time.className = 'setup-day-orbit-endpoint-time';
  time.textContent = shortTimeFromMinutes(endMinute);

  marker.append(icon, time);
  return marker;
}

function blocksForDay(profile, day) {
  const blocks = [];

  if (profile.sleepStart && profile.sleepEnd) {
    blocks.push({
      id: 'sleep',
      kind: 'sleep',
      label: 'SLEEP',
      icon: 'sleep',
      start: profile.sleepStart,
      end: profile.sleepEnd
    });
  }

  if (
    profile.hasFixedSchedule
    && profile.fixedDays?.includes(day)
    && profile.fixedStart
    && profile.fixedEnd
  ) {
    blocks.push({
      id: 'fixed',
      kind: 'fixed',
      label: fixedLabel(profile.fixedKind),
      icon: 'fixed',
      start: profile.fixedStart,
      end: profile.fixedEnd
    });
  }

  (profile.activities || [])
    .filter((activity) => activity.days?.includes(day))
    .forEach((activity) => blocks.push({
      id: activity.id,
      kind: 'activity',
      label: activity.name,
      icon: activity.icon || 'general',
      start: activity.start,
      end: activity.end
    }));

  return blocks;
}

function stateKey(profile, day) {
  return JSON.stringify({
    day,
    sleepStart: profile.sleepStart,
    sleepEnd: profile.sleepEnd,
    hasFixedSchedule: profile.hasFixedSchedule,
    fixedKind: profile.fixedKind,
    fixedDays: profile.fixedDays,
    fixedStart: profile.fixedStart,
    fixedEnd: profile.fixedEnd,
    activities: (profile.activities || []).filter((activity) => activity.days?.includes(day))
  });
}

function createPeriodLabel(period) {
  const label = document.createElement('span');
  label.className = `setup-day-orbit-period-label is-${period}`;
  label.textContent = period.toUpperCase();
  label.setAttribute('aria-hidden', 'true');
  return label;
}

function createClockAnchor(label, position) {
  const marker = document.createElement('span');
  marker.className = `setup-day-orbit-clock-label is-${position}`;
  marker.textContent = label;
  marker.setAttribute('aria-hidden', 'true');
  return marker;
}

function buildOrbit(profile, day, shell) {
  const ring = document.createElement('div');
  ring.className = 'setup-day-orbit';
  ring.dataset.stateKey = stateKey(profile, day);
  ring.setAttribute('aria-label', 'Current day map. Inner ring is AM. Outer ring is PM. Standard clock positions: 12 top, 3 right, 6 bottom, 9 left.');

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('setup-day-orbit-arcs');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  svg.append(createTickCircle('am'), createTickCircle('pm'));
  ring.appendChild(svg);

  ring.append(
    createPeriodLabel('am'),
    createPeriodLabel('pm'),
    createClockAnchor('12', 'top'),
    createClockAnchor('3', 'right'),
    createClockAnchor('6', 'bottom'),
    createClockAnchor('9', 'left')
  );

  blocksForDay(profile, day).forEach((block) => {
    segmentsForBlock(block).forEach((segment) => svg.appendChild(createArc(segment)));
    ring.appendChild(createStartNode(block, shell));
    ring.appendChild(createEndMarker(block));
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
