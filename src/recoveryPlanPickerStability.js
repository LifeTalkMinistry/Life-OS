export function shouldCreateRecoveryPlanOverlay(hasOverlay) {
  return !Boolean(hasOverlay);
}

if (typeof showOverlay === 'function') {
  const pauseRecoveryPlanBaseShowOverlay = showOverlay;

  showOverlay = function pauseRecoveryPlanStableShowOverlay() {
    if (!shouldCreateRecoveryPlanOverlay(Boolean(overlay))) return overlay;
    return pauseRecoveryPlanBaseShowOverlay();
  };
}

const pauseDayOffBaseCreateEmpty = typeof createEmptyRecoveryPlan === 'function' ? createEmptyRecoveryPlan : null;
const pauseDayOffBaseNormalize = typeof normalizeRecoveryPlan === 'function' ? normalizeRecoveryPlan : null;
const pauseDayOffBaseContent = typeof contentForStep === 'function' ? contentForStep : null;
const pauseDayOffBaseInstallEvents = typeof installEvents === 'function' ? installEvents : null;
const pauseDayOffBasePullCloudPlan = typeof pullCloudPlan === 'function' ? pullCloudPlan : null;
const pauseDayOffBasePushCloudPlan = typeof pushCloudPlan === 'function' ? pushCloudPlan : null;

function pauseDayOffDays(workDays) {
  const selected = new Set(Array.isArray(workDays) ? workDays.map(Number) : []);
  return DAY_OPTIONS.filter((day) => !selected.has(day.id)).map((day) => day.id);
}

function pauseDayOffCreateEmptyPlan() {
  const base = pauseDayOffBaseCreateEmpty ? pauseDayOffBaseCreateEmpty() : {};
  return {
    ...base,
    version: 5,
    dayOffSleepStart: '',
    dayOffWakeTime: ''
  };
}

function pauseDayOffNormalizePlan(value = {}) {
  const base = pauseDayOffBaseNormalize ? pauseDayOffBaseNormalize(value) : value;
  const isLegacyCompletedPlan = Number(value.version || 0) < 5 && base.setupComplete === true;
  const fallbackSleepStart = pauseScheduleValidTime(base.sleepStart) ? base.sleepStart : '';
  const fallbackWakeTime = fallbackSleepStart
    ? pauseScheduleMinutesToTime(pauseScheduleTimeToMinutes(fallbackSleepStart) + Number(base.recoveryMinutes || 0))
    : '';
  const dayOffSleepStart = pauseScheduleValidTime(value.dayOffSleepStart)
    ? String(value.dayOffSleepStart)
    : isLegacyCompletedPlan
      ? fallbackSleepStart
      : '';
  const dayOffWakeTime = pauseScheduleValidTime(value.dayOffWakeTime)
    ? String(value.dayOffWakeTime)
    : isLegacyCompletedPlan
      ? fallbackWakeTime
      : '';
  const hasDaysOff = pauseDayOffDays(base.workDays).length > 0;
  const dayOffRoutineReady = !hasDaysOff
    || (pauseScheduleValidTime(dayOffSleepStart)
      && pauseScheduleValidTime(dayOffWakeTime)
      && dayOffSleepStart !== dayOffWakeTime);
  const setupComplete = base.setupComplete === true && dayOffRoutineReady;

  return {
    ...base,
    version: 5,
    setupComplete,
    nudgeConsentComplete: setupComplete && base.nudgeConsentComplete === true,
    dayOffSleepStart,
    dayOffWakeTime
  };
}

function pauseDayOffContentForStep() {
  const plan = pauseDayOffNormalizePlan(currentPlan || {});
  const offDays = pauseDayOffDays(plan.workDays);

  if (currentStep === 'dayoff') {
    if (!offDays.length) {
      return `
        <p class="recovery-plan-eyebrow">YOUR DAYS OFF</p>
        <h1>No separate day-off routine needed.</h1>
        <p class="recovery-plan-copy">You selected every day as a work day, so PAUSE will use your regular sleep routine for now.</p>
        ${pauseScheduleNavigation()}
      `;
    }

    const validSleep = pauseScheduleValidTime(plan.dayOffSleepStart);
    const validWake = pauseScheduleValidTime(plan.dayOffWakeTime);
    const sameTime = validSleep && validWake && plan.dayOffSleepStart === plan.dayOffWakeTime;
    const sleepWindow = validSleep && validWake && !sameTime
      ? pauseScheduleFormatMinutes(pauseScheduleMinutesBetween(plan.dayOffSleepStart, plan.dayOffWakeTime))
      : '';

    return `
      <p class="recovery-plan-eyebrow">YOUR DAYS OFF</p>
      <h1>When do you usually sleep on your days off?</h1>
      <p class="recovery-plan-copy">Your sleep schedule may be different when you don't have work.</p>
      <div class="recovery-plan-time-grid">
        <label><span>Usually sleep at</span><input type="time" data-pause-dayoff-sleep value="${plan.dayOffSleepStart}" required></label>
        <label><span>Usually wake up at</span><input type="time" data-pause-dayoff-wake value="${plan.dayOffWakeTime}" required></label>
      </div>
      <p class="recovery-plan-note">Applies to ${daysLabel(offDays)}.${sleepWindow ? ` Typical sleep window: ${sleepWindow}.` : ''}</p>
      ${pauseScheduleNavigation('Continue', !validSleep || !validWake || sameTime)}
    `;
  }

  if (currentStep === 'review') {
    const timeline = deriveSleepRoutineSchedule(plan);
    const dayOffSummary = offDays.length
      ? `${pauseScheduleFormatTime(plan.dayOffSleepStart)} → ${pauseScheduleFormatTime(plan.dayOffWakeTime)}`
      : 'No regular days off';
    const dayOffDetail = offDays.length
      ? `${daysLabel(offDays)} · ${pauseScheduleFormatMinutes(pauseScheduleMinutesBetween(plan.dayOffSleepStart, plan.dayOffWakeTime))}`
      : 'Uses regular routine';

    return `
      <p class="recovery-plan-eyebrow">YOUR SLEEP ROUTINE</p>
      <h1>Here’s your routine.</h1>
      <div class="recovery-plan-summary">
        <div><span>WORK DAYS</span><strong>${daysLabel(plan.workDays)}</strong></div>
        <div><span>DAYS OFF</span><strong>${dayOffSummary}</strong><small>${dayOffDetail}</small></div>
        <div><span>SHIFT</span><strong>${pauseScheduleFormatTime(plan.shiftStart)} → ${pauseScheduleFormatTime(plan.shiftEnd)}</strong></div>
        <div><span>USUAL COMMUTE</span><strong>${pauseScheduleFormatTime(plan.shiftEnd)} → ${pauseScheduleFormatTime(timeline.homeAt)}</strong><small>${pauseScheduleFormatMinutes(plan.commuteMinutes)}</small></div>
        <div><span>WIND-DOWN</span><strong>${pauseScheduleFormatTime(timeline.windDownStart)} → ${pauseScheduleFormatTime(plan.sleepStart)}</strong><small>${pauseScheduleFormatMinutes(plan.windDownMinutes)}</small></div>
        <div class="is-protected"><span>WORKDAY SLEEP</span><strong>${pauseScheduleFormatTime(plan.sleepStart)} → ${pauseScheduleFormatTime(timeline.wakeAt)}</strong><small>${pauseScheduleFormatMinutes(plan.recoveryMinutes)} planned</small></div>
      </div>
      <p class="recovery-plan-note">PAUSE keeps your workday and day-off sleep patterns separate so one routine does not overwrite the other.</p>
      ${navigation({ continueLabel: 'Choose nudges' })}
    `;
  }

  return pauseDayOffBaseContent ? pauseDayOffBaseContent() : '';
}

function pauseDayOffInstallEvents() {
  pauseDayOffBaseInstallEvents?.();

  overlay?.querySelector('[data-pause-dayoff-sleep]')?.addEventListener('change', (event) => {
    const value = event.currentTarget.value;
    if (!pauseScheduleValidTime(value)) return;
    setPlan({ dayOffSleepStart: value });
    renderOverlay();
  });

  overlay?.querySelector('[data-pause-dayoff-wake]')?.addEventListener('change', (event) => {
    const value = event.currentTarget.value;
    if (!pauseScheduleValidTime(value)) return;
    setPlan({ dayOffWakeTime: value });
    renderOverlay();
  });
}

async function pauseDayOffPullCloudPlan(token) {
  const cloud = await pauseDayOffBasePullCloudPlan(token);
  if (cloud?.plan && Number(cloud.plan.version || 0) < 5) {
    const local = pauseDayOffNormalizePlan(currentPlan || {});
    if (pauseScheduleValidTime(local.dayOffSleepStart) && pauseScheduleValidTime(local.dayOffWakeTime)) {
      return {
        ...cloud,
        plan: {
          ...cloud.plan,
          version: 5,
          dayOffSleepStart: local.dayOffSleepStart,
          dayOffWakeTime: local.dayOffWakeTime
        }
      };
    }
  }
  return cloud;
}

async function pauseDayOffPushCloudPlan(token, plan) {
  const saved = await pauseDayOffBasePushCloudPlan(token, plan);
  if (saved?.plan && Number(saved.plan.version || 0) < 5) {
    return {
      ...saved,
      plan: {
        ...saved.plan,
        version: 5,
        dayOffSleepStart: plan.dayOffSleepStart,
        dayOffWakeTime: plan.dayOffWakeTime
      }
    };
  }
  return saved;
}

if (typeof window !== 'undefined' && pauseDayOffBaseNormalize && pauseDayOffBaseContent) {
  if (Array.isArray(STEPS) && !STEPS.includes('dayoff')) {
    const daysIndex = STEPS.indexOf('days');
    STEPS.splice(daysIndex >= 0 ? daysIndex + 1 : 2, 0, 'dayoff');
  }

  createEmptyRecoveryPlan = pauseDayOffCreateEmptyPlan;
  normalizeRecoveryPlan = pauseDayOffNormalizePlan;
  contentForStep = pauseDayOffContentForStep;
  installEvents = pauseDayOffInstallEvents;
  if (pauseDayOffBasePullCloudPlan) pullCloudPlan = pauseDayOffPullCloudPlan;
  if (pauseDayOffBasePushCloudPlan) pushCloudPlan = pauseDayOffPushCloudPlan;

  if (currentPlan) {
    let rawDayOffSleepStart = '';
    let rawDayOffWakeTime = '';
    try {
      const raw = currentAccountId ? localStorage.getItem(storageKey(currentAccountId)) : null;
      const parsed = raw ? JSON.parse(raw) : null;
      if (pauseScheduleValidTime(parsed?.dayOffSleepStart)) rawDayOffSleepStart = parsed.dayOffSleepStart;
      if (pauseScheduleValidTime(parsed?.dayOffWakeTime)) rawDayOffWakeTime = parsed.dayOffWakeTime;
    } catch {}
    currentPlan = pauseDayOffNormalizePlan({
      ...currentPlan,
      ...(rawDayOffSleepStart ? { dayOffSleepStart: rawDayOffSleepStart } : {}),
      ...(rawDayOffWakeTime ? { dayOffWakeTime: rawDayOffWakeTime } : {})
    });
  }
  renderOverlay?.();
}

const pauseRecoveryInfoObservedCards = new WeakSet();

function pauseInstallRecoveryInfoStyles() {
  if (document.querySelector('#pause-recovery-info-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-recovery-info-style';
  style.textContent = `
    .pause-recovery-status-label-row {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 18px;
    }

    .pause-recovery-info-button {
      appearance: none;
      width: 17px;
      height: 17px;
      padding: 0;
      border: 1px solid rgba(185, 154, 220, .38);
      border-radius: 50%;
      background: rgba(111, 72, 168, .08);
      color: #a997b9;
      display: inline-grid;
      place-items: center;
      font-size: .62rem;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    .pause-recovery-info-button:hover,
    .pause-recovery-info-button:focus-visible,
    .pause-recovery-info-button[aria-expanded='true'] {
      border-color: rgba(199, 166, 245, .62);
      color: #e4d8f0;
      background: rgba(112, 70, 184, .18);
      outline: none;
    }

    .pause-recovery-info-popover {
      max-width: 270px;
      margin: 8px auto 0;
      padding: 10px 12px;
      border: 1px solid rgba(166, 127, 224, .18);
      border-radius: 11px;
      background: rgba(12, 8, 24, .92);
      color: #91879c;
      font-size: .67rem;
      line-height: 1.5;
      text-align: center;
      box-shadow: 0 10px 24px rgba(0, 0, 0, .22);
    }

    .pause-recovery-info-popover strong {
      color: #c8b9d5;
      font-weight: 620;
    }

    .pause-recovery-info-popover[hidden] { display: none; }
  `;
  document.head.appendChild(style);
}

function pauseCloseRecoveryInfo(card) {
  const button = card?.querySelector('[data-recovery-info-button]');
  const popover = card?.querySelector('[data-recovery-info-popover]');
  if (!button || !popover) return;
  button.setAttribute('aria-expanded', 'false');
  popover.hidden = true;
}

function pauseEnhanceRecoveryStatusInfo(card) {
  if (!card || card.dataset.recoveryInfoEnhanced === 'true') return;
  const copy = card.querySelector('.pause-recovery-status-copy');
  const value = card.querySelector('.pause-recovery-status-value');
  if (!copy || !value) return;

  const explanation = copy.innerHTML;
  const label = card.querySelector('.pause-recovery-status-label');
  const row = document.createElement('span');
  row.className = 'pause-recovery-status-label-row';

  if (label) {
    label.replaceWith(row);
    row.appendChild(label);
  } else {
    value.insertAdjacentElement('afterend', row);
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pause-recovery-info-button';
  button.dataset.recoveryInfoButton = 'true';
  button.setAttribute('aria-label', 'Why this rest status?');
  button.setAttribute('aria-expanded', 'false');
  button.textContent = 'i';

  const popover = document.createElement('div');
  popover.className = 'pause-recovery-info-popover';
  popover.dataset.recoveryInfoPopover = 'true';
  popover.hidden = true;
  popover.innerHTML = explanation;

  row.appendChild(button);
  row.insertAdjacentElement('afterend', popover);
  copy.remove();
  card.dataset.recoveryInfoEnhanced = 'true';

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const shouldOpen = popover.hidden;
    document.querySelectorAll('[data-recovery-info-popover]:not([hidden])').forEach((openPopover) => {
      const openCard = openPopover.closest('.pause-recovery-status-card');
      if (openCard && openCard !== card) pauseCloseRecoveryInfo(openCard);
    });
    popover.hidden = !shouldOpen;
    button.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  });
}

function pauseWatchRecoveryStatusCard(card) {
  if (!card) return;
  pauseEnhanceRecoveryStatusInfo(card);
  if (pauseRecoveryInfoObservedCards.has(card)) return;
  pauseRecoveryInfoObservedCards.add(card);

  const observer = new MutationObserver(() => {
    if (!card.isConnected) {
      observer.disconnect();
      return;
    }
    if (!card.querySelector('[data-recovery-info-button]')) {
      card.dataset.recoveryInfoEnhanced = 'false';
      queueMicrotask(() => pauseEnhanceRecoveryStatusInfo(card));
    }
  });
  observer.observe(card, { childList: true, subtree: true });
}

function pauseScanRecoveryStatusInfo() {
  document.querySelectorAll('.pause-recovery-status-card').forEach(pauseWatchRecoveryStatusCard);
}

if (typeof document !== 'undefined') {
  pauseInstallRecoveryInfoStyles();
  queueMicrotask(pauseScanRecoveryStatusInfo);
  window.addEventListener('pause:insights-opened', () => queueMicrotask(pauseScanRecoveryStatusInfo));

  document.addEventListener('click', (event) => {
    document.querySelectorAll('.pause-recovery-status-card').forEach((card) => {
      if (!card.contains(event.target)) pauseCloseRecoveryInfo(card);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.pause-recovery-status-card').forEach(pauseCloseRecoveryInfo);
  });
}
