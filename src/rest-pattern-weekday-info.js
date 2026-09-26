function pauseWeekdayInfoEnsureStyles() {
  if (document.querySelector('#pause-weekday-info-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-weekday-info-style';
  style.textContent = `
    .pause-weekday-title-row {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      position: relative;
    }

    .pause-weekday-info-button {
      appearance: none;
      display: inline-grid;
      place-items: center;
      width: 16px;
      height: 16px;
      padding: 0;
      border: 1px solid rgba(175, 136, 235, .34);
      border-radius: 50%;
      background: rgba(81, 48, 132, .12);
      color: #9b8aaa;
      font-size: .58rem;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      vertical-align: middle;
    }

    .pause-weekday-info-button:hover,
    .pause-weekday-info-button:focus-visible {
      border-color: rgba(194, 151, 255, .56);
      color: #e5d7f5;
      outline: none;
    }

    .pause-weekday-info-popover {
      position: absolute;
      left: 0;
      top: calc(100% + 10px);
      z-index: 12;
      width: min(260px, calc(100vw - 72px));
      padding: 12px 13px;
      border: 1px solid rgba(177, 133, 242, .24);
      border-radius: 12px;
      background: rgba(12, 8, 24, .98);
      color: #aaa0b5;
      box-shadow: 0 14px 34px rgba(0, 0, 0, .36);
      font-size: .68rem;
      font-weight: 400;
      letter-spacing: 0;
      line-height: 1.5;
      text-transform: none;
      text-align: left;
    }

    .pause-weekday-info-popover[hidden] {
      display: none;
    }
  `;
  document.head.appendChild(style);
}

function pauseWeekdayInfoClose() {
  const popover = document.querySelector('[data-pause-weekday-info-popover]');
  const button = document.querySelector('[data-pause-weekday-info]');
  if (popover) popover.hidden = true;
  button?.setAttribute('aria-expanded', 'false');
}

function pauseWeekdayInfoEnhance() {
  const panel = document.querySelector('.pause-view-insights');
  if (!panel) return;

  const title = [...panel.querySelectorAll('.pause-insight-section-title')]
    .find((node) => String(node.textContent || '').trim() === 'YOUR REST PATTERN · BY WEEKDAY');
  if (!title) return;

  pauseWeekdayInfoEnsureStyles();

  const section = title.closest('.pause-insight-section');
  const copy = section?.querySelector(':scope > .pause-insight-section-copy');
  const explanation = String(copy?.textContent || '').trim()
    || 'Learned from up to the last 4 weeks. Once enough history exists, weekdays rank from your highest average rest to your lowest.';
  copy?.remove();

  if (title.querySelector('[data-pause-weekday-info]')) return;

  title.classList.add('pause-weekday-title-row');

  const infoButton = document.createElement('button');
  infoButton.type = 'button';
  infoButton.className = 'pause-weekday-info-button';
  infoButton.dataset.pauseWeekdayInfo = 'true';
  infoButton.setAttribute('aria-label', 'How weekday rest patterns work');
  infoButton.setAttribute('aria-expanded', 'false');
  infoButton.textContent = 'i';
  title.appendChild(infoButton);

  const popover = document.createElement('span');
  popover.className = 'pause-weekday-info-popover';
  popover.dataset.pauseWeekdayInfoPopover = 'true';
  popover.hidden = true;
  popover.textContent = explanation;
  title.appendChild(popover);
}

function pauseWeekdayInfoQueue() {
  queueMicrotask(pauseWeekdayInfoEnhance);
}

export function initializePauseWeekdayInfo() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-pause-weekday-info]');
    if (button) {
      const title = button.closest('.pause-weekday-title-row');
      const popover = title?.querySelector('[data-pause-weekday-info-popover]');
      if (!popover) return;
      const willOpen = popover.hidden;
      pauseWeekdayInfoClose();
      popover.hidden = !willOpen;
      button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      return;
    }

    if (!event.target.closest('.pause-weekday-title-row')) {
      pauseWeekdayInfoClose();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') pauseWeekdayInfoClose();
  });

  window.addEventListener('pause:insights-opened', pauseWeekdayInfoQueue);
  window.addEventListener('pause:state-changed', pauseWeekdayInfoQueue);
  window.addEventListener('focus', pauseWeekdayInfoQueue);
  pauseWeekdayInfoQueue();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initializePauseWeekdayInfo();
}
