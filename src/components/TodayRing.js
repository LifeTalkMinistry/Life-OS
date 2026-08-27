const ITEMS = [
  { id: 'take-rest', label: 'Take a Rest' },
  { id: 'history', label: 'Rest History' },
  { id: 'insights', label: 'Rest Insights' },
  { id: 'my-rests', label: 'My Rests' }
];

export function TodayRing(onSelect) {
  const carousel = document.createElement('nav');
  carousel.className = 'pause-menu-carousel';
  carousel.setAttribute('aria-label', 'PAUSE main menu');

  const scroller = document.createElement('div');
  scroller.className = 'pause-menu-scroller';
  scroller.setAttribute('role', 'list');

  ITEMS.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pause-menu-carousel-item';
    button.dataset.pauseMenu = item.id;
    button.setAttribute('role', 'listitem');
    button.textContent = item.label;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onSelect?.(item.id);
    });
    button.addEventListener('focus', () => {
      button.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    });
    scroller.appendChild(button);
  });

  carousel.appendChild(scroller);
  return carousel;
}
