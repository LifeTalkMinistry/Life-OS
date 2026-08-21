import { parseMinutes } from '../state/lifeState.js';

function positionForTime(time) {
  const total = parseMinutes(time);
  const hour = Math.floor(total / 60) % 12;
  const minute = total % 60;
  const degrees = hour * 30 + minute * 0.5;
  const radians = (degrees * Math.PI) / 180;
  return {
    x: 50 + Math.sin(radians) * 45,
    y: 50 - Math.cos(radians) * 45
  };
}

export function TodayRing(activities, currentId) {
  const ring = document.createElement('div');
  ring.className = 'today-ring';
  ring.setAttribute('aria-label', "Today's major activities");

  const ticks = document.createElement('div');
  ticks.className = 'today-ticks';
  ring.appendChild(ticks);

  ['12:00', '3:00', '6:00', '9:00'].forEach((label, index) => {
    const marker = document.createElement('span');
    marker.className = `clock-marker clock-marker-${index}`;
    marker.textContent = label;
    ring.appendChild(marker);
  });

  activities.filter((activity) => activity.id !== 'urgent').forEach((activity) => {
    const { x, y } = positionForTime(activity.start);
    const node = document.createElement('div');
    node.className = `activity-node${activity.id === currentId ? ' is-current' : ''}`;
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    node.innerHTML = `
      <span class="activity-node-dot" aria-hidden="true"></span>
      <span class="activity-node-time">${activity.timeLabel}</span>
      <span class="activity-node-title">${activity.shortTitle}</span>
    `;
    ring.appendChild(node);
  });

  return ring;
}
