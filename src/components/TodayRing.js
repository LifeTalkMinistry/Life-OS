import { activityIconSvgMarkup } from '../activity-icons.js';
import { parseMinutes } from '../state/lifeState.js';

const TODAY_SVG_NS = 'http://www.w3.org/2000/svg';
const TODAY_HALF_DAY_MINUTES = 720;
const TODAY_FULL_DAY_MINUTES = 1440;
const TODAY_RING_RADIUS = {
  am: 34.8,
  pm: 43.2
};

function todayNormalizeMinute(value) {
  return ((value % TODAY_FULL_DAY_MINUTES) + TODAY_FULL_DAY_MINUTES) % TODAY_FULL_DAY_MINUTES;
}

function todayPeriodForMinutes(totalMinutes) {
  return todayNormalizeMinute(totalMinutes) < TODAY_HALF_DAY_MINUTES ? 'am' : 'pm';
}

function todayPositionForTime(time) {
  const total = todayNormalizeMinute(parseMinutes(time));
  const period = todayPeriodForMinutes(total);
  const clockMinutes = total % TODAY_HALF_DAY_MINUTES;
  const degrees = (clockMinutes / TODAY_HALF_DAY_MINUTES) * 360;
  const radians = (degrees * Math.PI) / 180;
  const radius = TODAY_RING_RADIUS[period];

  return {
    x: 50 + Math.sin(radians) * radius,
    y: 50 - Math.cos(radians) * radius,
    degrees,
    period
  };
}

function todayActivityDuration(start, end) {
  return (parseMinutes(end) - parseMinutes(start) + TODAY_FULL_DAY_MINUTES) % TODAY_FULL_DAY_MINUTES;
}

function todayActivitySegments(activity) {
  const startMinute = todayNormalizeMinute(parseMinutes(activity.start));
  const duration = todayActivityDuration(activity.start, activity.end);
  if (!duration) return [];

  const absoluteEnd = startMinute + duration;
  const segments = [];
  let cursor = startMinute;

  while (cursor < absoluteEnd) {
    const nextBoundary = (Math.floor(cursor / TODAY_HALF_DAY_MINUTES) + 1) * TODAY_HALF_DAY_MINUTES;
    const segmentEnd = Math.min(absoluteEnd, nextBoundary);
    const normalizedStart = todayNormalizeMinute(cursor);

    segments.push({
      period: todayPeriodForMinutes(normalizedStart),
      clockStartMinute: normalizedStart % TODAY_HALF_DAY_MINUTES,
      duration: segmentEnd - cursor
    });

    cursor = segmentEnd;
  }

  return segments;
}

function todayEscapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function todayIconForActivity(activity) {
  if (activity?.schedule?.icon) return activityIconSvgMarkup(activity.schedule.icon);
  if (activity?.id === 'fixed-schedule') return activityIconSvgMarkup('work');
  if (activity?.id === 'sleep') return activityIconSvgMarkup('sleep');
  if (activity?.id === 'open-time') return activityIconSvgMarkup('general');
  return activityIconSvgMarkup('general');
}

function todaySystemControl(kind, label) {
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

function createTodayOrbitSvg() {
  const svg = document.createElementNS(TODAY_SVG_NS, 'svg');
  svg.classList.add('today-orbit-svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');

  ['pm', 'am'].forEach((period) => {
    const line = document.createElementNS(TODAY_SVG_NS, 'circle');
    line.setAttribute('cx', '50');
    line.setAttribute('cy', '50');
    line.setAttribute('r', String(TODAY_RING_RADIUS[period]));
    line.classList.add('today-orbit-line', `is-${period}`);

    const ticks = document.createElementNS(TODAY_SVG_NS, 'circle');
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

function appendTodayActivityArc(svg, activity, segment, isCurrent) {
  const circle = document.createElementNS(TODAY_SVG_NS, 'circle');
  const startPercent = (segment.clockStartMinute / TODAY_HALF_DAY_MINUTES) * 100;
  const durationPercent = (segment.duration / TODAY_HALF_DAY_MINUTES) * 100;

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

function createTodayPeriodLabel(period) {
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

  const orbitSvg = createTodayOrbitSvg();
  activities
    .filter((activity) => activity.id !== 'urgent')
    .forEach((activity) => {
      todayActivitySegments(activity).forEach((segment) => {
        appendTodayActivityArc(orbitSvg, activity, segment, activity.id === currentId);
      });
    });

  ring.appendChild(orbitSvg);
  ring.append(createTodayPeriodLabel('pm'), createTodayPeriodLabel('am'));

  const controls = document.createElement('div');
  controls.className = 'today-system-controls';
  controls.setAttribute('aria-label', 'LIFE OS controls');
  ['settings', 'info'].forEach((kind) => {
    const label = kind === 'settings' ? 'Settings' : 'Info';
    const button = todaySystemControl(kind, label);
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
    const { x, y, degrees, period } = todayPositionForTime(activity.start);
    const node = document.createElement('div');
    const isCardinal = [0, 90, 180, 270].some((angle) => Math.abs(degrees - angle) < 0.01);
    const isBottom = degrees > 135 && degrees < 225;
    node.className = `activity-node is-${period}${activity.id === currentId ? ' is-current' : ''}${isCardinal ? ' is-cardinal' : ''}${isBottom ? ' is-bottom' : ''}`;
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    node.innerHTML = `
      <span class="activity-node-dot" aria-hidden="true">${todayIconForActivity(activity)}</span>
      <span class="activity-node-time">${todayEscapeHtml(activity.timeLabel)}</span>
      <span class="activity-node-title">${todayEscapeHtml(activity.shortTitle)}</span>
    `;
    ring.appendChild(node);
  });

  return ring;
}
