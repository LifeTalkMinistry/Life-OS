function pauseSleepStreakCompactEnsureStyles() {
  if (document.querySelector('#pause-sleep-streak-compact-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-sleep-streak-compact-style';
  style.textContent = `
    .pause-sleep-routine-streak.is-compact {
      position: relative;
      padding: 18px;
    }

    .pause-sleep-routine-streak.is-compact > small,
    .pause-sleep-routine-streak.is-compact > p {
      display: none !important;
    }

    .pause-sleep-streak-summary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      min-width: 0;
      text-align: center;
    }

    .pause-sleep-routine-streak.is-compact .pause-sleep-streak-summary > strong {
      display: block;
      margin: 0;
      text-align: center;
    }

    .pause-sleep-streak-info-button {
      appearance: none;
      display: inline-grid;
      place-items: center;
      flex: 0 0 18px;
      width: 18px;
      height: 18px;
      padding: 0;
      border: 1px solid rgba(175, 136, 235, .34);
      border-radius: 50%;
      background: rgba(81, 48, 132, .12);
      color: #9b8aaa;
      font-size: .66rem;
      font-weight: 650;
      line-height: 1;
      cursor: pointer;
    }

    .pause-sleep-streak-info-button:hover,
    .pause-sleep-streak-info-button:focus-visible {
      border-color: rgba(194, 151, 255, .56);
      color: #e5d7f5;
      outline: none;
    }

    .pause-sleep-streak-info-popover {
      position: absolute;
      left: 18px;
      right: 18px;
      top: calc(100% - 8px);
      z-index: 8;
      padding: 13px 14px;
      border: 1px solid rgba(177, 133, 242, .24);
      border-radius: 12px;
      background: rgba(12, 8, 24, .98);
      color: #aaa0b5;
      box-shadow: 0 14px 34px rgba(0, 0, 0, .36);
      font-size: .68rem;
      line-height: 1.5;
    }

    .pause-sleep-streak-info-popover[hidden] {
      display: none;
    }
  `;
  document.head.appendChild(style);
}

function pauseSleepStreakCompactEnhance() {
  const card = document.querySelector('.pause-view-insights [data-pause-sleep-routine-streak]');
  if (!card) return;

  pauseSleepStreakCompactEnsureStyles();
  card.classList.add('is-compact');

  const existingStrong = card.querySelector(':scope > strong');
  const existingSummary = card.querySelector(':scope > .pause-sleep-streak-summary');
  if (existingSummary || !existingStrong) return;

  const summary = document.createElement('div');
  summary.className = 'pause-sleep-streak-summary';
  existingStrong.before(summary);
  summary.appendChild(existingStrong);

  const infoButton = document.createElement('button');
  infoButton.type = 'button';
  infoButton.className = 'pause-sleep-streak-info-button';
  infoButton.dataset.pauseSleepStreakInfo = 'true';
  infoButton.setAttribute('aria-label', 'How Sleep Routine Streak works');
  infoButton.setAttribute('aria-expanded', 'false');
  infoButton.textContent = 'i';
  summary.appendChild(infoButton);

  const popover = document.createElement('div');
  popover.className = 'pause-sleep-streak-info-popover';
  popover.dataset.pauseSleepStreakPopover = 'true';
  popover.hidden = true;
  popover.textContent = 'A routine day counts when your ORB-tracked rest reaches at least 6 hours and at least 90% of your Planned Sleep. Eligible routine days are based on your work schedule. Qualifying routine days in a row build your streak.';
  card.appendChild(popover);
}

function pauseSleepStreakCompactClose() {
  const popover = document.querySelector('[data-pause-sleep-streak-popover]');
  const button = document.querySelector('[data-pause-sleep-streak-info]');
  if (popover) popover.hidden = true;
  button?.setAttribute('aria-expanded', 'false');
}

function pauseSleepStreakCompactQueue() {
  queueMicrotask(pauseSleepStreakCompactEnhance);
}

export function initializePauseSleepRoutineStreakCompact() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-pause-sleep-streak-info]');
    if (button) {
      const card = button.closest('[data-pause-sleep-routine-streak]');
      const popover = card?.querySelector('[data-pause-sleep-streak-popover]');
      if (!popover) return;
      const willOpen = popover.hidden;
      pauseSleepStreakCompactClose();
      popover.hidden = !willOpen;
      button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      return;
    }

    if (!event.target.closest('[data-pause-sleep-routine-streak]')) {
      pauseSleepStreakCompactClose();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') pauseSleepStreakCompactClose();
  });

  window.addEventListener('pause:insights-opened', pauseSleepStreakCompactQueue);
  window.addEventListener('pause:state-changed', pauseSleepStreakCompactQueue);
  window.addEventListener('focus', pauseSleepStreakCompactQueue);
  pauseSleepStreakCompactQueue();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initializePauseSleepRoutineStreakCompact();
}
