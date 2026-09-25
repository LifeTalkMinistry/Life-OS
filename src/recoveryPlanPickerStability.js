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
