import { activityIconSvgMarkup } from '../activity-icons.js';
import { parseMinutes } from '../state/lifeState.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HALF_DAY_MINUTES = 720;
const FULL_DAY_MINUTES = 1440;
const TODAY_RING_RADIUS = {
  am: 34.8,
  pm: 43.2
};

function normalizeMinute(value) {
  return ((value % FULL_DAY_MINUTES) + FULL_DAY_MINUTES) % FULL_DAY_MINUTES;
}

function todayPeriodForMinutes(totalMinutes) {
  return normalizeMinute(totalMinutes) < HALF_DAY_MINUTES ? 'am' : 'pm';
}

function todayPeriodForTime(time) {
  return todayPeriodForMinutes(parseMinutes(time));
}

function positionForTime(time) {
  const total = normalizeMinute(parseMinutes(time));
  const period = todayPeriodForMinutes(total);
  const clockMinutes = total % HALF_DAY_MINUTES;
  const degrees = (clockMinutes / HALF_DAY_MINUTES) * 360;
  const radians = (degrees * Math.PI) / 180;
  const radius = TODAY_RING_RADIUS[period];

  return {
    x: 50 + Math.sin(radians) * radius,
    y: 50 - Math.cos(radians) * radius,
    degrees,
    period
  };
}

function activityDuration(start, end) {
  return (parseMinutes(end) - parseMinutes(start) + FULL_DAY_MINUTES) % FULL_DAY_MINUTES;
}

function activitySegments(activity) {
  const startMinute = normalizeMinute(parseMinutes(activity.start));
  const duration = activityDuration(activity.start, activity.end);
  if (!duration) return [];

  const absoluteEnd = startMinute + duration;
  const segments = [];
  let cursor = startMinute;

  while (cursor < absoluteEnd) {
    const nextBoundary = (Math.floor(cursor / HALF_DAY_MINUTES) + 1) * HALF_DAY_MINUTES;
    const segmentEnd = Math.min(absoluteEnd, nextBoundary);
    const normalizedStart = normalizeMinute(cursor);

    segments.push({
      period: todayPeriodForMinutes(normalizedStart),
      clockStartMinute: normalizedStart % HALF_DAY_MINUTES,
      duration: segmentEnd - cursor
    });

    cursor = segmentEnd;
  }

  return segments;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function iconForActivity(activity) {
  if (activity?.schedule?.icon) return activityIconSvgMarkup(activity.schedule.icon);
  if (activity?.id === 'fixed-schedule') return activityIconSvgMarkup('work');
  if (activity?.id === 'sleep') return activityIconSvgMarkup('sleep');
  if (activity?.id === 'open-time') return activityIconSvgMarkup('general');
  return activityIconSvgMarkup('general');
}

function systemControl(kind, label) {
  const icon = kind === 'settings'
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7a6 6 0 0 0-.8-1.8l.9-1.9-2.2-2.2-1.9.9a6 6 0 0 0-1.8-.8L10.5 2h-3l-.7 2a6 6 0 0 0-1.8.8l-1.9-.9L.9 6.1 1.8 8a6 6 0 0 0-.8 1.8l-2 .7v3l2 .7a6 6 0 0 0 .8 1.8l-.9 1.9 2.2 2.2 1.9-.9a6 6 0 0 0 1.8.8l.7 2h3l.7-2a6 6 0 0 0 1.8-.8l1.9.9 2.2-2.2-.9-1.9a6 6 0 0 0 .8-1.8z" transform="translate(2 0) scale(.83)"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 10v6M12 7.25h.01"/></svg>';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'today-system-button';
  button.dataset.systemControl = kind;
  button.setAttribute('aria-label', label);
  button.innerHTML = `
    <span class="today-system-button-icon">${icon}</span>
    <span class="today-system-button-label">${label}</span>
  `;
  return button;
}

function createOrbitSvg() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('today-orbit-svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');

  ['pm', 'am'].forEach((period) => {
    const line = document.createElementNS(SVG_NS, 'circle');
    line.setAttribute('cx', '50');
    line.setAttribute('cy', '50');
    line.setAttribute('r', String(TODAY_RING_RADIUS[period]));
    line.classList.add('today-orbit-line', `is-${period}`);

    const ticks = document.createElementNS(SVG_NS, 'circle');
    ticks.setAttribute('cx', '50');
    ticks.setAttribute('cy', '50');
    ticks.setAttribute('r', String(TODAY_RING_RADIUS[period]));
    ticks.setAttribute('pathLength', '120');
    ticks.setAttribute('transform', 'rotate(-90 50 50)');
    ticks.classList.add('today-orbit-ticks', `is-${period}`);

    svg.append(line, ticks);
  });

  return svg;
}

function appendActivityArc(svg, activity, segment, isCurrent) {
  const circle = document.createElementNS(SVG_NS, 'circle');
  const startPercent = (segment.clockStartMinute / HALF_DAY_MINUTES) * 100;
  const durationPercent = (segment.duration / HALF_DAY_MINUTES) * 100;

  circle.setAttribute('cx', '50');
  circle.setAttribute('cy', '50');
  circle.setAttribute('r', String(TODAY_RING_RADIUS[segment.period]));
  circle.setAttribute('pathLength', '100');
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke-dasharray', `${durationPercent} ${Math.max(0, 100 - durationPercent)}`);
  circle.setAttribute('stroke-dashoffset', `${-startPercent}`);
  circle.setAttribute('transform', 'rotate(-90 50 50)');
  circle.classList.add('today-activity-arc', `is-${segment.period}`);
  if (isCurrent) circle.classList.add('is-current');
  if (activity.kind) circle.classList.add(`is-${activity.kind}`);
  svg.appendChild(circle);
}

function createPeriodLabel(period) {
  const label = document.createElement('span');
  label.className = `today-period-label is-${period}`;
  label.textContent = period.toUpperCase();
  label.setAttribute('aria-hidden', 'true');
  return label;
}

export function TodayRing(activities, currentId, onSystemControl) {
  const ring = document.createElement('div');
  ring.className = 'today-ring today-ring-dual';
  ring.setAttribute('aria-label', "Today's schedule. Inner orbit is AM and outer orbit is PM.");

  const orbitSvg = createOrbitSvg();
  activities
    .filter((activity) => activity.id !== 'urgent')
    .forEach((activity) => {
      activitySegments(activity).forEach((segment) => {
        appendActivityArc(orbitSvg, activity, segment, activity.id === currentId);
      });
    });

  ring.appendChild(orbitSvg);
  ring.append(createPeriodLabel('pm'), createPeriodLabel('am'));

  const controls = document.createElement('div');
  controls.className = 'today-system-controls';
  controls.setAttribute('aria-label', 'LIFE OS controls');
  ['settings', 'info'].forEach((kind) => {
    const label = kind === 'settings' ? 'Settings' : 'Info';
    const button = systemControl(kind, label);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onSystemControl?.(kind);
    });
    controls.appendChild(button);
  });
  ring.appendChild(controls);

  ['12', '3', '6', '9'].forEach((label, index) => {
    const marker = document.createElement('span');
    marker.className = `clock-marker clock-marker-${index}`;
    marker.textContent = label;
    ring.appendChild(marker);
  });

  activities.filter((activity) => activity.id !== 'urgent').forEach((activity) => {
    const { x, y, degrees, period } = positionForTime(activity.start);
    const node = document.createElement('div');
    const isCardinal = [0, 90, 180, 270].some((angle) => Math.abs(degrees - angle) < 0.01);
    const isBottom = degrees > 135 && degrees < 225;
    node.className = `activity-node is-${period}${activity.id === currentId ? ' is-current' : ''}${isCardinal ? ' is-cardinal' : ''}${isBottom ? ' is-bottom' : ''}`;
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    node.innerHTML = `
      <span class="activity-node-dot" aria-hidden="true">${iconForActivity(activity)}</span>
      <span class="activity-node-time">${escapeHtml(activity.timeLabel)}</span>
      <span class="activity-node-title">${escapeHtml(activity.shortTitle)}</span>
    `;
    ring.appendChild(node);
  });

  return ring;
}
