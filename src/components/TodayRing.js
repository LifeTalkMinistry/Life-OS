import { parseMinutes } from '../state/lifeState.js';

function positionForTime(time) {
  const total = parseMinutes(time);
  const hour = Math.floor(total / 60) % 12;
  const minute = total % 60;
  const degrees = hour * 30 + minute * 0.5;
  const radians = (degrees * Math.PI) / 180;
  const isCardinal = minute === 0 && [0, 3, 6, 9].includes(hour);
  const radius = isCardinal ? 34.5 : 39.5;
  return {
    x: 50 + Math.sin(radians) * radius,
    y: 50 - Math.cos(radians) * radius,
    degrees
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function iconForActivity(id) {
  const icons = {
    devotion: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5c2.5-.8 5-.3 8 1.7v11c-3-2-5.5-2.5-8-1.7z"/><path d="M20 5.5c-2.5-.8-5-.3-8 1.7v11c3-2 5.5-2.5 8-1.7z"/></svg>',
    lunch: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h11v4.5A4.5 4.5 0 0 1 11.5 18h-2A4.5 4.5 0 0 1 5 13.5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 6c0-1 1-1.3 1-2.3M12 6c0-1 1-1.3 1-2.3"/></svg>',
    'clara-outreach': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 4 2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.3-4.5 2.3.9-5-3.6-3.5 5-.7z"/></svg>',
    workout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12"/></svg>',
    family: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="2.5"/><circle cx="16.5" cy="9" r="2"/><path d="M4.5 18c.5-3 2-4.5 4.5-4.5s4 1.5 4.5 4.5M14 14.5c2.5-.8 4.5.5 5.5 3.5"/></svg>',
    work: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="8" width="16" height="10" rx="2"/><path d="M9 8V6h6v2M4 12.5c4.5 2 11.5 2 16 0M10.5 13h3"/></svg>',
    'current-focus': '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    'fixed-schedule': '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="11" rx="2"/><path d="M8 7V5h8v2M4 11h16"/></svg>',
    sleep: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 15.5A7.5 7.5 0 0 1 8.5 5a7.5 7.5 0 1 0 10.5 10.5Z"/></svg>'
  };
  return icons[id] || '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/></svg>';
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

export function TodayRing(activities, currentId, onSystemControl) {
  const ring = document.createElement('div');
  ring.className = 'today-ring';
  ring.setAttribute('aria-label', "Today's major activities and system controls");

  const ticks = document.createElement('div');
  ticks.className = 'today-ticks';
  ring.appendChild(ticks);

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

  ['12:00', '3:00', '6:00', '9:00'].forEach((label, index) => {
    const marker = document.createElement('span');
    marker.className = `clock-marker clock-marker-${index}`;
    marker.textContent = label;
    ring.appendChild(marker);
  });

  activities.filter((activity) => activity.id !== 'urgent').forEach((activity) => {
    const { x, y, degrees } = positionForTime(activity.start);
    const node = document.createElement('div');
    const isCardinal = [0, 90, 180, 270].some((angle) => Math.abs(degrees - angle) < 0.01);
    const isBottom = degrees > 135 && degrees < 225;
    node.className = `activity-node${activity.id === currentId ? ' is-current' : ''}${isCardinal ? ' is-cardinal' : ''}${isBottom ? ' is-bottom' : ''}`;
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    node.innerHTML = `
      <span class="activity-node-dot" aria-hidden="true">${iconForActivity(activity.id)}</span>
      <span class="activity-node-time">${escapeHtml(activity.timeLabel)}</span>
      <span class="activity-node-title">${escapeHtml(activity.shortTitle)}</span>
    `;
    ring.appendChild(node);
  });

  return ring;
}
