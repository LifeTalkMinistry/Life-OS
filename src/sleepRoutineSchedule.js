const pauseScheduleBaseCreateEmpty = typeof createEmptyRecoveryPlan === 'function' ? createEmptyRecoveryPlan : null;
const pauseScheduleBaseNormalize = typeof normalizeRecoveryPlan === 'function' ? normalizeRecoveryPlan : null;
const pauseScheduleBaseContent = typeof contentForStep === 'function' ? contentForStep : null;
const pauseScheduleBaseInstallEvents = typeof installEvents === 'function' ? installEvents : null;
const pauseScheduleBasePullCloudPlan = typeof pullCloudPlan === 'function' ? pullCloudPlan : null;
const pauseScheduleBasePushCloudPlan = typeof pushCloudPlan === 'function' ? pushCloudPlan : null;
let pauseScheduleCommuteCustomizeOpen = false;

function pauseScheduleTimeToMinutes(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function pauseScheduleMinutesToTime(value) {
  const normalized = ((Number(value) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function pauseScheduleValidTime(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function pauseScheduleMinutesBetween(start, end) {
  return ((pauseScheduleTimeToMinutes(end) - pauseScheduleTimeToMinutes(start)) + 1440) % 1440;
}

function pauseScheduleFormatTime(value) {
  const minutes = pauseScheduleTimeToMinutes(value);
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${hour24 >= 12 ? 'PM' : 'AM'}`;
}

function pauseScheduleFormatMinutes(value) {
  const minutes = Math.max(0, Number(value) || 0);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  if (!remainder) return `${hours} hr${hours === 1 ? '' : 's'}`;
  return `${hours}h ${remainder}m`;
}

function pauseScheduleLegacySleepStart(plan) {
  return pauseScheduleMinutesToTime(
    pauseScheduleTimeToMinutes(plan.shiftEnd) + Number(plan.commuteMinutes || 0) + Number(plan.windDownMinutes || 0)
  );
}

function pauseScheduleCreateEmptyPlan() {
  const base = pauseScheduleBaseCreateEmpty ? pauseScheduleBaseCreateEmpty() : {};
  return {
    ...base,
    version: 4,
    sleepStart: pauseScheduleLegacySleepStart(base)
  };
}

function pauseScheduleNormalizePlan(value = {}) {
  const base = pauseScheduleBaseNormalize ? pauseScheduleBaseNormalize(value) : value;
  const fallbackSleepStart = pauseScheduleLegacySleepStart(base);
  const sleepStart = pauseScheduleValidTime(value.sleepStart) ? String(value.sleepStart) : fallbackSleepStart;
  const homeAt = pauseScheduleMinutesToTime(
    pauseScheduleTimeToMinutes(base.shiftEnd) + Number(base.commuteMinutes || 0)
  );
  const availableWindDown = Math.min(240, pauseScheduleMinutesBetween(homeAt, sleepStart));
  const windDownMinutes = Math.min(Math.max(0, Number(base.windDownMinutes || 0)), availableWindDown);
  return {
    ...base,
    version: 4,
    sleepStart,
    windDownMinutes,
    nudges: {
      ...(base.nudges || {}),
      windDownReminder: windDownMinutes > 0 && base.nudges?.windDownReminder === true
    }
  };
}

export function deriveSleepRoutineSchedule(rawPlan = {}) {
  const plan = pauseScheduleNormalizePlan(rawPlan);
  const homeAt = pauseScheduleMinutesToTime(
    pauseScheduleTimeToMinutes(plan.shiftEnd) + plan.commuteMinutes
  );
  const windDownStart = pauseScheduleMinutesToTime(
    pauseScheduleTimeToMinutes(plan.sleepStart) - plan.windDownMinutes
  );
  const wakeAt = pauseScheduleMinutesToTime(
    pauseScheduleTimeToMinutes(plan.sleepStart) + plan.recoveryMinutes
  );
  return {
    shiftEnd: plan.shiftEnd,
    homeAt,
    windDownStart,
    recoveryStart: plan.sleepStart,
    wakeAt
  };
}

function pauseScheduleNudgeMoments(rawPlan = {}) {
  const plan = pauseScheduleNormalizePlan(rawPlan);
  const sleepMinutes = pauseScheduleTimeToMinutes(plan.sleepStart);
  return {
    shiftEnd: plan.shiftEnd,
    commuteEnd: pauseScheduleMinutesToTime(pauseScheduleTimeToMinutes(plan.shiftEnd) + plan.commuteMinutes),
    windDownReminder: pauseScheduleMinutesToTime(sleepMinutes - Math.min(15, plan.windDownMinutes)),
    recoveryStart: plan.sleepStart,
    wakeTarget: pauseScheduleMinutesToTime(sleepMinutes + plan.recoveryMinutes)
  };
}

function pauseScheduleOption(value, current, label) {
  return `<button type="button" class="recovery-plan-option${Number(current) === Number(value) ? ' is-selected' : ''}" data-plan-value="${value}">${label}</button>`;
}

function pauseScheduleNavigation(label = 'Continue') {
  return `
    <div class="recovery-plan-nav">
      <button type="button" class="recovery-plan-back" data-plan-action="back">Back</button>
      <button type="button" class="recovery-plan-continue" data-plan-action="continue">${label}</button>
    </div>
  `;
}

function pauseScheduleContentForStep() {
  const plan = pauseScheduleNormalizePlan(currentPlan || {});
  const timeline = deriveSleepRoutineSchedule(plan);

  if (currentStep === 'commute') {
    return `
      <p class="recovery-plan-eyebrow">AFTER SHIFT</p>
      <h1>How long does it usually take you to get home?</h1>
      <div class="recovery-plan-options">
        ${[15, 30, 45, 60, 90].map((minutes) => pauseScheduleOption(minutes, plan.commuteMinutes, pauseScheduleFormatMinutes(minutes))).join('')}
        <button type="button" class="recovery-plan-option${pauseScheduleCommuteCustomizeOpen ? ' is-selected' : ''}" data-pause-commute-customize aria-expanded="${pauseScheduleCommuteCustomizeOpen ? 'true' : 'false'}">Customize</button>
      </div>
      ${pauseScheduleCommuteCustomizeOpen ? `
        <div class="recovery-plan-time-grid">
          <label><span>From</span><input type="time" value="${plan.shiftEnd}" disabled></label>
          <label><span>To</span><input type="time" data-plan-clock="homeAt" value="${timeline.homeAt}"></label>
        </div>
      ` : ''}
      <p class="recovery-plan-note">This is your usual travel time, not location tracking.</p>
      ${pauseScheduleNavigation()}
    `;
  }

  if (currentStep === 'sleepstart') {
    return `
      <p class="recovery-plan-eyebrow">SLEEP ANCHOR</p>
      <h1>What time do you want to start sleeping?</h1>
      <p class="recovery-plan-copy">Choose this first. PAUSE will anchor your wind-down and wake target around the sleep time you declare.</p>
      <div class="recovery-plan-time-grid recovery-plan-time-grid-single">
        <label><span>Preferred sleep starts</span><input type="time" data-pause-sleep-start value="${plan.sleepStart}" required></label>
      </div>
      <p class="recovery-plan-note">Expected home around ${pauseScheduleFormatTime(timeline.homeAt)}.</p>
      ${pauseScheduleNavigation()}
    `;
  }

  if (currentStep === 'winddown') {
    const available = Math.min(240, pauseScheduleMinutesBetween(timeline.homeAt, plan.sleepStart));
    const options = [0, 15, 30, 45, 60, 90].filter((minutes) => minutes <= available);
    return `
      <p class="recovery-plan-eyebrow">WIND-DOWN</p>
      <h1>How much wind-down time do you want before sleep?</h1>
      <p class="recovery-plan-copy">You said you want to sleep at <strong>${pauseScheduleFormatTime(plan.sleepStart)}</strong>. Choose how much time you want immediately before that.</p>
      <div class="recovery-plan-options">
        ${options.map((minutes) => pauseScheduleOption(minutes, plan.windDownMinutes, minutes === 0 ? 'None' : pauseScheduleFormatMinutes(minutes))).join('')}
      </div>
      <label class="recovery-plan-custom"><span>Custom minutes</span><input type="number" min="0" max="${available}" step="5" data-plan-field="windDownMinutes" value="${plan.windDownMinutes}"></label>
      <p class="recovery-plan-note">Wind-down: ${pauseScheduleFormatTime(timeline.windDownStart)} → ${pauseScheduleFormatTime(plan.sleepStart)}</p>
      ${pauseScheduleNavigation()}
    `;
  }

  if (currentStep === 'recovery') {
    return `
      <p class="recovery-plan-eyebrow">SLEEP ROUTINE</p>
      <h1>How much sleep are you aiming for?</h1>
      <p class="recovery-plan-copy">Sleep starts at <strong>${pauseScheduleFormatTime(plan.sleepStart)}</strong>. Choose how long you want to aim for.</p>
      <div class="recovery-plan-options recovery-plan-options-wide">
        ${[420, 450, 480, 510, 540].map((minutes) => pauseScheduleOption(minutes, plan.recoveryMinutes, pauseScheduleFormatMinutes(minutes))).join('')}
      </div>
      <label class="recovery-plan-custom"><span>Custom minutes</span><input type="number" min="240" max="720" step="15" data-plan-field="recoveryMinutes" value="${plan.recoveryMinutes}"></label>
      <p class="recovery-plan-note">Wake target: ${pauseScheduleFormatTime(timeline.wakeAt)}</p>
      ${pauseScheduleNavigation()}
    `;
  }

  if (currentStep === 'review') {
    return `
      <p class="recovery-plan-eyebrow">YOUR SLEEP ROUTINE</p>
      <h1>Here’s your routine.</h1>
      <div class="recovery-plan-summary">
        <div><span>WORK DAYS</span><strong>${daysLabel(plan.workDays)}</strong></div>
        <div><span>SHIFT</span><strong>${pauseScheduleFormatTime(plan.shiftStart)} → ${pauseScheduleFormatTime(plan.shiftEnd)}</strong></div>
        <div><span>USUAL COMMUTE</span><strong>${pauseScheduleFormatTime(plan.shiftEnd)} → ${pauseScheduleFormatTime(timeline.homeAt)}</strong><small>${pauseScheduleFormatMinutes(plan.commuteMinutes)}</small></div>
        <div><span>WIND-DOWN</span><strong>${pauseScheduleFormatTime(timeline.windDownStart)} → ${pauseScheduleFormatTime(plan.sleepStart)}</strong><small>${pauseScheduleFormatMinutes(plan.windDownMinutes)}</small></div>
        <div class="is-protected"><span>SLEEP ROUTINE</span><strong>${pauseScheduleFormatTime(plan.sleepStart)} → ${pauseScheduleFormatTime(timeline.wakeAt)}</strong><small>${pauseScheduleFormatMinutes(plan.recoveryMinutes)} planned</small></div>
      </div>
      <p class="recovery-plan-note">Your preferred sleep start is the anchor. Commute and wind-down do not silently move it.</p>
      ${navigation({ continueLabel: 'Choose nudges' })}
    `;
  }

  return pauseScheduleBaseContent ? pauseScheduleBaseContent() : '';
}

function pauseScheduleInstallEvents() {
  if (overlay && currentStep === 'commute') {
    overlay.querySelectorAll('[data-plan-value]').forEach((button) => {
      button.addEventListener('click', () => {
        pauseScheduleCommuteCustomizeOpen = false;
      }, { capture: true });
    });
  }

  pauseScheduleBaseInstallEvents?.();

  overlay?.querySelector('[data-pause-commute-customize]')?.addEventListener('click', () => {
    pauseScheduleCommuteCustomizeOpen = !pauseScheduleCommuteCustomizeOpen;
    renderOverlay();
  });

  overlay?.querySelector('[data-pause-sleep-start]')?.addEventListener('change', (event) => {
    const value = event.currentTarget.value;
    if (!pauseScheduleValidTime(value)) return;
    const plan = pauseScheduleNormalizePlan(currentPlan || {});
    const timeline = deriveSleepRoutineSchedule(plan);
    const available = Math.min(240, pauseScheduleMinutesBetween(timeline.homeAt, value));
    setPlan({
      sleepStart: value,
      windDownMinutes: Math.min(plan.windDownMinutes, available)
    });
    renderOverlay();
  });
}

async function pauseSchedulePullCloudPlan(token) {
  const cloud = await pauseScheduleBasePullCloudPlan(token);
  if (cloud?.plan && Number(cloud.plan.version || 0) < 4 && currentPlan?.sleepStart) {
    return {
      ...cloud,
      plan: {
        ...cloud.plan,
        version: 4,
        sleepStart: currentPlan.sleepStart,
        windDownMinutes: currentPlan.windDownMinutes,
        recoveryMinutes: currentPlan.recoveryMinutes
      }
    };
  }
  return cloud;
}

async function pauseSchedulePushCloudPlan(token, plan) {
  const saved = await pauseScheduleBasePushCloudPlan(token, plan);
  if (saved?.plan && Number(saved.plan.version || 0) < 4) {
    return {
      ...saved,
      plan: {
        ...saved.plan,
        version: 4,
        sleepStart: plan.sleepStart,
        windDownMinutes: plan.windDownMinutes,
        recoveryMinutes: plan.recoveryMinutes
      }
    };
  }
  return saved;
}

if (typeof window !== 'undefined' && pauseScheduleBaseNormalize && pauseScheduleBaseContent) {
  if (Array.isArray(STEPS) && !STEPS.includes('sleepstart')) {
    const windDownIndex = STEPS.indexOf('winddown');
    STEPS.splice(windDownIndex >= 0 ? windDownIndex : 5, 0, 'sleepstart');
  }

  createEmptyRecoveryPlan = pauseScheduleCreateEmptyPlan;
  normalizeRecoveryPlan = pauseScheduleNormalizePlan;
  deriveRecoveryTimeline = deriveSleepRoutineSchedule;
  deriveNudgeMoments = pauseScheduleNudgeMoments;
  contentForStep = pauseScheduleContentForStep;
  installEvents = pauseScheduleInstallEvents;
  if (pauseScheduleBasePullCloudPlan) pullCloudPlan = pauseSchedulePullCloudPlan;
  if (pauseScheduleBasePushCloudPlan) pushCloudPlan = pauseSchedulePushCloudPlan;

  if (currentPlan) currentPlan = pauseScheduleNormalizePlan(currentPlan);
  renderOverlay?.();
}
