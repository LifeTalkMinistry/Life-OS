const SETUP_DAY_OFF_ALL_DAYS = [1, 2, 3, 4, 5, 6, 0];
const SETUP_DAY_OFF_NAMES = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday'
};

const setupDayOffBypass = new WeakSet();

function setupDayOffList(days) {
  const names = SETUP_DAY_OFF_ALL_DAYS
    .filter((day) => days.includes(day))
    .map((day) => SETUP_DAY_OFF_NAMES[day]);

  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function setupDayOffQuestion(fixedDays) {
  const offDays = SETUP_DAY_OFF_ALL_DAYS.filter((day) => !fixedDays.includes(day));
  if (!offDays.length) {
    return 'So you normally have no regular day off?';
  }
  if (offDays.length === 1) {
    return `So ${setupDayOffList(offDays)} is usually your day off?`;
  }
  return `So ${setupDayOffList(offDays)} are usually your days off?`;
}

function setupDayOffSyncCustomDays(targetDays) {
  requestAnimationFrame(() => {
    const state = window.__LIFE_OS__?.getState?.();
    const currentDays = Array.isArray(state?.lifeProfile?.fixedDays)
      ? state.lifeProfile.fixedDays
      : [];

    SETUP_DAY_OFF_ALL_DAYS.forEach((day) => {
      const shouldBeSelected = targetDays.includes(day);
      const isSelected = currentDays.includes(day);
      if (shouldBeSelected === isSelected) return;
      document.querySelector(`[data-setup-day="${day}"]`)?.click();
    });
  });
}

function setupDayOffOpenConfirm(originalButton, fixedDays) {
  document.querySelector('.setup-day-off-confirm')?.remove();

  const orb = originalButton.closest('.orb');
  if (!orb) return;

  const overlay = document.createElement('div');
  overlay.className = 'setup-day-off-confirm';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Confirm days off');
  overlay.innerHTML = `
    <div class="setup-day-off-confirm-content">
      <p class="setup-day-off-eyebrow">DAYS OFF</p>
      <h2>${setupDayOffQuestion(fixedDays)}</h2>
      <button type="button" class="setup-day-off-primary" data-day-off-confirm>Yes</button>
      <button type="button" class="setup-day-off-secondary" data-day-off-change>Change days</button>
    </div>
  `;

  overlay.querySelector('[data-day-off-confirm]')?.addEventListener('click', () => {
    setupDayOffBypass.add(originalButton);
    overlay.remove();
    originalButton.click();
  });

  overlay.querySelector('[data-day-off-change]')?.addEventListener('click', () => {
    overlay.remove();

    if (originalButton.dataset.setupDays === 'weekdays' || originalButton.dataset.setupDays === 'everyday') {
      const chooseDays = originalButton
        .closest('.setup-content')
        ?.querySelector('[data-setup-days="custom"]');
      if (chooseDays) {
        chooseDays.click();
        setupDayOffSyncCustomDays(fixedDays);
      }
    }
  });

  orb.appendChild(overlay);
  overlay.querySelector('[data-day-off-confirm]')?.focus();
}

function setupDayOffFixedDaysForButton(button) {
  if (button.dataset.setupDays === 'weekdays') return [1, 2, 3, 4, 5];
  if (button.dataset.setupDays === 'everyday') return [0, 1, 2, 3, 4, 5, 6];

  const state = window.__LIFE_OS__?.getState?.();
  return Array.isArray(state?.lifeProfile?.fixedDays)
    ? [...state.lifeProfile.fixedDays]
    : [];
}

document.addEventListener('click', (event) => {
  const button = event.target instanceof Element
    ? event.target.closest('button')
    : null;
  if (!button) return;

  if (setupDayOffBypass.has(button)) {
    setupDayOffBypass.delete(button);
    return;
  }

  const isPresetDays = button.dataset.setupDays === 'weekdays'
    || button.dataset.setupDays === 'everyday';
  const isCustomContinue = button.dataset.setupAction === 'days-continue';
  if (!isPresetDays && !isCustomContinue) return;

  const state = window.__LIFE_OS__?.getState?.();
  if (state?.screen !== 'setup') return;

  const fixedDays = setupDayOffFixedDaysForButton(button);
  if (!fixedDays.length) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  setupDayOffOpenConfirm(button, fixedDays);
}, true);

function setupDayOffApplyBuilderCopy() {
  const state = window.__LIFE_OS__?.getState?.();
  if (!state || state.screen !== 'setup' || state.setupStep !== 'activities') return;
  if (!state.lifeProfile?.hasFixedSchedule) return;

  const day = Number(state.setupActivityDay);
  if (state.lifeProfile.fixedDays?.includes(day)) return;
  if (!state.setupActivityDraft?.start || state.setupActivityDraft.start !== state.lifeProfile.sleepEnd) return;

  const question = document.querySelector('.setup-day-builder .setup-question');
  if (!question) return;

  const copy = "It's your day off. What do you usually do after waking up?";
  if (question.textContent !== copy) question.textContent = copy;
  question.closest('.setup-day-builder')?.classList.add('is-day-off');
}

const setupDayOffApp = document.querySelector('#app');
if (setupDayOffApp) {
  const setupDayOffObserver = new MutationObserver(() => setupDayOffApplyBuilderCopy());
  setupDayOffObserver.observe(setupDayOffApp, { childList: true, subtree: true });
  setupDayOffApplyBuilderCopy();
}
