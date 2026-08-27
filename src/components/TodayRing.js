const ITEMS = [
  { id: 'take-rest', label: 'Take a Rest', x: 50, y: 8, icon: '⏸' },
  { id: 'history', label: 'Rest History', x: 86, y: 50, icon: '↺' },
  { id: 'insights', label: 'Rest Insights', x: 50, y: 92, icon: '◌' },
  { id: 'my-rests', label: 'My Rests', x: 14, y: 50, icon: '✦' }
];

export function TodayRing(onSelect) {
  const ring = document.createElement('div');
  ring.className = 'today-ring pause-menu-ring';
  ring.setAttribute('aria-label', 'PAUSE main menu');

  const ticks = document.createElement('div');
  ticks.className = 'today-ticks';
  ring.appendChild(ticks);

  ITEMS.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'activity-node pause-menu-node';
    button.style.left = `${item.x}%`;
    button.style.top = `${item.y}%`;
    button.dataset.pauseMenu = item.id;
    button.innerHTML = `
      <span class="activity-node-dot pause-menu-icon" aria-hidden="true">${item.icon}</span>
      <span class="activity-node-title">${item.label}</span>
    `;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onSelect?.(item.id);
    });
    ring.appendChild(button);
  });

  return ring;
}
