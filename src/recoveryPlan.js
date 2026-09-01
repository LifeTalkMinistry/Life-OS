import { DEFAULT_API_URL, restorePauseBackendSession } from './auth/backendClient.js';

const RECOVERY_PLAN_STORAGE_KEY = 'pause-recovery-plan-v1';
const RECOVERY_PLAN_PATH = '/api/pause/recovery-plan';
const DAY_OPTIONS = [
  { id: 1, short: 'M', label: 'Monday' },
  { id: 2, short: 'T', label: 'Tuesday' },
  { id: 3, short: 'W', label: 'Wednesday' },
  { id: 4, short: 'T', label: 'Thursday' },
  { id: 5, short: 'F', label: 'Friday' },
  { id: 6, short: 'S', label: 'Saturday' },
  { id: 0, short: 'S', label: 'Sunday' }
];
const NUDGE_KEYS = ['shiftEnd', 'commuteEnd', 'windDownReminder', 'recoveryStart', 'wakeTarget'];
const STEPS = ['intro', 'days', 'shift', 'commute', 'winddown', 'recovery', 'review', 'nudges'];

let currentAccountId = null;
let currentPlan = null;
let currentStep = 'intro';
let overlay = null;
let hydrationPromise = null;
let editRequested = false;

function apiUrl() {
  const configured = typeof window !== 'undefined'
    ? String(window.PAUSE_API_URL || '').trim()
    : '';
  return (configured || DEFAULT_API_URL).replace(/\/+$/, '');
}

function normalizeDays(value) {
  if (!Array.isArray(value)) return [1, 2, 3, 4, 5];
  return [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    .sort((a, b) => a - b);
}

function normalizeTime(value, fallback) {
  const text = String(value || '');
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? text : fallback;
}

function clampMinutes(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizeNudges(value, windDownMinutes) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    shiftEnd: source.shiftEnd === true,
    commuteEnd: source.commuteEnd === true,
    windDownReminder: windDownMinutes > 0 && source.windDownReminder === true,
    recoveryStart: source.recoveryStart === true,
    wakeTarget: source.wakeTarget === true
  };
}

export function createEmptyRecoveryPlan() {
  return {
    version: 2,
    setupComplete: false,
    nudgeConsentComplete: false,
    workDays: [1, 2, 3, 4, 5],
    shiftStart: '22:00',
    shiftEnd: '08:00',
    commuteMinutes: 60,
    windDownMinutes: 45,
    recoveryMinutes: 480,
    nudges: {
      shiftEnd: false,
      commuteEnd: false,
      windDownReminder: false,
      recoveryStart: false,
      wakeTarget: false
    }
  };
}

export function normalizeRecoveryPlan(value = {}) {
  const base = createEmptyRecoveryPlan();
  const workDays = normalizeDays(value.workDays);
  const shiftStart = normalizeTime(value.shiftStart, base.shiftStart);
  const shiftEnd = normalizeTime(value.shiftEnd, base.shiftEnd);
  const commuteMinutes = clampMinutes(value.commuteMinutes, base.commuteMinutes, 0, 240);
  const windDownMinutes = clampMinutes(value.windDownMinutes, base.windDownMinutes, 0, 240);
  const recoveryMinutes = clampMinutes(value.recoveryMinutes, base.recoveryMinutes, 240, 720);
  const setupComplete = value.setupComplete === true
    && workDays.length > 0
    && shiftStart !== shiftEnd;
  const nudges = normalizeNudges(value.nudges, windDownMinutes);

  return {
    version: 2,
    setupComplete,
    nudgeConsentComplete: setupComplete && value.nudgeConsentComplete === true,
    workDays,
    shiftStart,
    shiftEnd,
    commuteMinutes,
    windDownMinutes,
    recoveryMinutes,
    nudges
  };
}

function storageKey(accountId) {
  return `${RECOVERY_PLAN_STORAGE_KEY}:account:${String(accountId)}`;
}

function loadLocalPlan(accountId) {
  try {
    const raw = localStorage.getItem(storageKey(accountId));
    return normalizeRecoveryPlan(raw ? JSON.parse(raw) : {});
  } catch {
    return createEmptyRecoveryPlan();
  }
}

function saveLocalPlan(accountId, plan) {
  const normalized = normalizeRecoveryPlan(plan);
  try {
    localStorage.setItem(storageKey(accountId), JSON.stringify(normalized));
  } catch {}
  return normalized;
}

async function requestPlan(token, method, body) {
  const response = await fetch(`${apiUrl()}${RECOVERY_PLAN_PATH}`, {
    method,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {}

  if (!response.ok) {
    const error = new Error(payload?.message || `Recovery Plan request failed with status ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function pullCloudPlan(token) {
  return requestPlan(token, 'GET');
}

async function pushCloudPlan(token, plan) {
  return requestPlan(token, 'PUT', { plan });
}

function timeToMinutes(value) {
  const [hour, minute] = String(value || '00:00').split(':').map(Number);
  return hour * 60 + minute;
}

function minutesToTime(value) {
  const normalized = ((Number(value) % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatTime(value) {
  const [hourValue, minuteValue] = String(value || '00:00').split(':').map(Number);
  const suffix = hourValue >= 12 ? 'PM' : 'AM';
  const hour = hourValue % 12 || 12;
  return `${hour}:${String(minuteValue || 0).padStart(2, '0')} ${suffix}`;
}

function formatMinutes(value) {
  const minutes = Math.max(0, Number(value) || 0);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  if (!remainder) return `${hours} hr${hours === 1 ? '' : 's'}`;
  return `${hours}h ${remainder}m`;
}

export function deriveRecoveryTimeline(rawPlan) {
  const plan = normalizeRecoveryPlan(rawPlan);
  const shiftEndMinutes = timeToMinutes(plan.shiftEnd);
  const homeAt = minutesToTime(shiftEndMinutes + plan.commuteMinutes);
  const recoveryStart = minutesToTime(shiftEndMinutes + plan.commuteMinutes + plan.windDownMinutes);
  const wakeAt = minutesToTime(
    shiftEndMinutes + plan.commuteMinutes + plan.windDownMinutes + plan.recoveryMinutes
  );

  return {
    shiftEnd: plan.shiftEnd,
    homeAt,
    recoveryStart,
    wakeAt
  };
}

export function deriveNudgeMoments(rawPlan) {
  const plan = normalizeRecoveryPlan(rawPlan);
  const shiftEndMinutes = timeToMinutes(plan.shiftEnd);
  const commuteEndMinutes = shiftEndMinutes + plan.commuteMinutes;
  const recoveryStartMinutes = commuteEndMinutes + plan.windDownMinutes;
  const windDownReminderMinutes = commuteEndMinutes + Math.max(0, plan.windDownMinutes - 15);
  const wakeTargetMinutes = recoveryStartMinutes + plan.recoveryMinutes;

  return {
    shiftEnd: minutesToTime(shiftEndMinutes),
    commuteEnd: minutesToTime(commuteEndMinutes),
    windDownReminder: minutesToTime(windDownReminderMinutes),
    recoveryStart: minutesToTime(recoveryStartMinutes),
    wakeTarget: minutesToTime(wakeTargetMinutes)
  };
}

function daysLabel(days) {
  const normalized = normalizeDays(days);
  if (normalized.length === 7) return 'Every day';
  if (normalized.length === 5 && [1, 2, 3, 4, 5].every((day) => normalized.includes(day))) return 'Monday–Friday';
  return DAY_OPTIONS.filter((day) => normalized.includes(day.id)).map((day) => day.label.slice(0, 3)).join(', ');
}

function stepIndex(step) {
  return Math.max(0, STEPS.indexOf(step));
}

function nextStep() {
  currentStep = STEPS[Math.min(STEPS.length - 1, stepIndex(currentStep) + 1)];
  renderOverlay();
}

function previousStep() {
  currentStep = STEPS[Math.max(0, stepIndex(currentStep) - 1)];
  renderOverlay();
}

function setPlan(patch) {
  currentPlan = normalizeRecoveryPlan({
    ...currentPlan,
    ...patch,
    setupComplete: false,
    nudgeConsentComplete: false
  });
}

function setNudge(key, enabled) {
  if (!NUDGE_KEYS.includes(key)) return;
  const plan = normalizeRecoveryPlan(currentPlan || {});
  currentPlan = normalizeRecoveryPlan({
    ...plan,
    nudgeConsentComplete: false,
    nudges: {
      ...plan.nudges,
      [key]: enabled === true
    }
  });
}

function optionButton(value, current, label, attr = 'data-plan-value') {
  return `<button type="button" class="recovery-plan-option${Number(current) === Number(value) ? ' is-selected' : ''}" ${attr}="${value}">${label}</button>`;
}

function navigation({ back = true, continueLabel = 'Continue', continueDisabled = false, action = 'continue' } = {}) {
  return `
    <div class="recovery-plan-nav">
      ${back ? '<button type="button" class="recovery-plan-back" data-plan-action="back">Back</button>' : '<span></span>'}
      <button type="button" class="recovery-plan-continue" data-plan-action="${action}" ${continueDisabled ? 'disabled' : ''}>${continueLabel}</button>
    </div>
  `;
}

function nudgeButton(key, title, detail, time, enabled) {
  return `
    <button type="button" class="recovery-plan-nudge${enabled ? ' is-selected' : ''}" data-plan-nudge="${key}" aria-pressed="${enabled ? 'true' : 'false'}">
      <span class="recovery-plan-nudge-copy">
        <strong>${title}</strong>
        <span>${detail}</span>
        <small>${formatTime(time)}</small>
      </span>
      <span class="recovery-plan-nudge-switch" aria-hidden="true"><i></i></span>
    </button>
  `;
}

function contentForStep() {
  const plan = normalizeRecoveryPlan(currentPlan || {});
  const timeline = deriveRecoveryTimeline(plan);

  if (currentStep === 'intro') {
    return `
      <p class="recovery-plan-eyebrow">RECOVERY PLAN</p>
      <h1>Let’s find where recovery fits in your real day.</h1>
      <p class="recovery-plan-copy">PAUSE only needs a few anchors around your shift. It will use them to understand the recovery routine you want to protect.</p>
      <button type="button" class="recovery-plan-primary" data-plan-action="continue">Set up my recovery</button>
    `;
  }

  if (currentStep === 'days') {
    return `
      <p class="recovery-plan-eyebrow">YOUR REALITY</p>
      <h1>Which days do you usually work?</h1>
      <p class="recovery-plan-copy">Choose the days this recovery routine normally follows.</p>
      <div class="recovery-plan-days" aria-label="Work days">
        ${DAY_OPTIONS.map((day) => `<button type="button" class="recovery-plan-day${plan.workDays.includes(day.id) ? ' is-selected' : ''}" data-plan-day="${day.id}" aria-label="${day.label}">${day.short}</button>`).join('')}
      </div>
      ${navigation({ continueDisabled: !plan.workDays.length })}
    `;
  }

  if (currentStep === 'shift') {
    return `
      <p class="recovery-plan-eyebrow">YOUR SHIFT</p>
      <h1>When does your shift normally start and end?</h1>
      <div class="recovery-plan-time-grid">
        <label><span>Shift starts</span><input type="time" data-plan-field="shiftStart" value="${plan.shiftStart}"></label>
        <label><span>Shift ends</span><input type="time" data-plan-field="shiftEnd" value="${plan.shiftEnd}"></label>
      </div>
      <p class="recovery-plan-note">Night shifts are supported. PAUSE understands when the end time falls on the next day.</p>
      ${navigation({ continueDisabled: plan.shiftStart === plan.shiftEnd })}
    `;
  }

  if (currentStep === 'commute') {
    return `
      <p class="recovery-plan-eyebrow">AFTER SHIFT</p>
      <h1>How long does it usually take you to get home?</h1>
      <div class="recovery-plan-options">
        ${[15, 30, 45, 60, 90].map((minutes) => optionButton(minutes, plan.commuteMinutes, formatMinutes(minutes))).join('')}
      </div>
      <label class="recovery-plan-custom"><span>Custom minutes</span><input type="number" min="0" max="240" step="5" data-plan-field="commuteMinutes" value="${plan.commuteMinutes}"></label>
      <p class="recovery-plan-note">This is your usual travel time, not location tracking.</p>
      ${navigation()}
    `;
  }

  if (currentStep === 'winddown') {
    return `
      <p class="recovery-plan-eyebrow">YOUR TIME</p>
      <h1>How much wind-down time do you want before recovery?</h1>
      <p class="recovery-plan-copy">Food, shower, family time, scrolling, or simply doing nothing. This is time you intentionally leave between getting home and sleeping.</p>
      <div class="recovery-plan-options">
        ${[15, 30, 45, 60, 90].map((minutes) => optionButton(minutes, plan.windDownMinutes, formatMinutes(minutes))).join('')}
      </div>
      <label class="recovery-plan-custom"><span>Custom minutes</span><input type="number" min="0" max="240" step="5" data-plan-field="windDownMinutes" value="${plan.windDownMinutes}"></label>
      ${navigation()}
    `;
  }

  if (currentStep === 'recovery') {
    return `
      <p class="recovery-plan-eyebrow">PROTECTED RECOVERY</p>
      <h1>How much sleep are you trying to protect?</h1>
      <div class="recovery-plan-options recovery-plan-options-wide">
        ${[420, 450, 480, 510, 540].map((minutes) => optionButton(minutes, plan.recoveryMinutes, formatMinutes(minutes))).join('')}
      </div>
      <label class="recovery-plan-custom"><span>Custom minutes</span><input type="number" min="240" max="720" step="15" data-plan-field="recoveryMinutes" value="${plan.recoveryMinutes}"></label>
      ${navigation()}
    `;
  }

  if (currentStep === 'review') {
    return `
      <p class="recovery-plan-eyebrow">YOUR RECOVERY ROUTINE</p>
      <h1>Here’s where recovery fits.</h1>
      <div class="recovery-plan-summary">
        <div><span>WORK DAYS</span><strong>${daysLabel(plan.workDays)}</strong></div>
        <div><span>SHIFT</span><strong>${formatTime(plan.shiftStart)} → ${formatTime(plan.shiftEnd)}</strong></div>
        <div><span>USUAL COMMUTE</span><strong>${formatTime(plan.shiftEnd)} → ${formatTime(timeline.homeAt)}</strong><small>${formatMinutes(plan.commuteMinutes)}</small></div>
        <div><span>WIND-DOWN</span><strong>${formatTime(timeline.homeAt)} → ${formatTime(timeline.recoveryStart)}</strong><small>${formatMinutes(plan.windDownMinutes)}</small></div>
        <div class="is-protected"><span>PROTECTED RECOVERY</span><strong>${formatTime(timeline.recoveryStart)} → ${formatTime(timeline.wakeAt)}</strong><small>${formatMinutes(plan.recoveryMinutes)} protected</small></div>
      </div>
      <p class="recovery-plan-note">Nothing here tracks your location or assumes you actually arrived home. These are the routine anchors you chose.</p>
      ${navigation({ continueLabel: 'Choose nudges' })}
    `;
  }

  const moments = deriveNudgeMoments(plan);
  const selectedCount = Object.values(plan.nudges).filter(Boolean).length;
  return `
    <p class="recovery-plan-eyebrow">NOISE BY CONSENT</p>
    <h1>When may PAUSE interrupt you?</h1>
    <p class="recovery-plan-copy">Nothing is on by default. Choose only the moments worth a nudge. Leaving everything off is completely valid.</p>
    <div class="recovery-plan-nudges" aria-label="Recovery nudge choices">
      ${nudgeButton('shiftEnd', 'Shift finished', 'A gentle transition out of work.', moments.shiftEnd, plan.nudges.shiftEnd)}
      ${nudgeButton('commuteEnd', 'Expected home window', 'Your usual commute window has ended. No location tracking.', moments.commuteEnd, plan.nudges.commuteEnd)}
      ${plan.windDownMinutes > 0 ? nudgeButton('windDownReminder', 'Get ready for recovery', 'A final cue to wrap up your wind-down.', moments.windDownReminder, plan.nudges.windDownReminder) : ''}
      ${nudgeButton('recoveryStart', 'Protected recovery starts', 'The recovery block you chose begins now.', moments.recoveryStart, plan.nudges.recoveryStart)}
      ${nudgeButton('wakeTarget', 'Wake target', 'Your protected recovery window is complete.', moments.wakeTarget, plan.nudges.wakeTarget)}
    </div>
    <p class="recovery-plan-nudge-summary">${selectedCount === 0 ? 'No nudges selected — PAUSE will stay quiet.' : `${selectedCount} nudge${selectedCount === 1 ? '' : 's'} selected.`}</p>
    <p class="recovery-plan-note">This saves consent only. PAUSE will ask separately before using device notifications.</p>
    ${navigation({ continueLabel: 'Save my choices', action: 'save' })}
  `;
}

function installEvents() {
  if (!overlay) return;

  overlay.querySelectorAll('[data-plan-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.planAction;
      if (action === 'back') return previousStep();
      if (action === 'continue') return nextStep();
      if (action === 'save') return saveCompletedPlan(button);
    });
  });

  overlay.querySelectorAll('[data-plan-day]').forEach((button) => {
    button.addEventListener('click', () => {
      const day = Number(button.dataset.planDay);
      const days = new Set(normalizeRecoveryPlan(currentPlan).workDays);
      if (days.has(day)) days.delete(day);
      else days.add(day);
      setPlan({ workDays: [...days] });
      renderOverlay();
    });
  });

  overlay.querySelectorAll('[data-plan-value]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = Number(button.dataset.planValue);
      if (currentStep === 'commute') setPlan({ commuteMinutes: value });
      if (currentStep === 'winddown') setPlan({ windDownMinutes: value });
      if (currentStep === 'recovery') setPlan({ recoveryMinutes: value });
      renderOverlay();
    });
  });

  overlay.querySelectorAll('[data-plan-field]').forEach((input) => {
    input.addEventListener('change', () => {
      const field = input.dataset.planField;
      const value = input.type === 'number' ? Number(input.value) : input.value;
      setPlan({ [field]: value });
      renderOverlay();
    });
  });

  overlay.querySelectorAll('[data-plan-nudge]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.planNudge;
      const plan = normalizeRecoveryPlan(currentPlan || {});
      setNudge(key, !plan.nudges[key]);
      renderOverlay();
    });
  });
}

function renderOverlay() {
  if (!overlay) return;
  overlay.innerHTML = `
    <section class="recovery-plan-card" role="dialog" aria-modal="true" aria-label="PAUSE Recovery Plan setup">
      <div class="recovery-plan-progress" aria-hidden="true"><span style="width:${Math.max(4, (stepIndex(currentStep) / (STEPS.length - 1)) * 100)}%"></span></div>
      <div class="recovery-plan-content">${contentForStep()}</div>
    </section>
  `;
  installEvents();
}

function showOverlay() {
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'recovery-plan-overlay';
    document.body.appendChild(overlay);
  }
  renderOverlay();
}

function hideOverlay() {
  overlay?.remove();
  overlay = null;
}

async function saveCompletedPlan(button) {
  if (!currentAccountId) return;
  if (button) {
    button.disabled = true;
    button.textContent = 'Saving…';
  }

  const completed = normalizeRecoveryPlan({
    ...currentPlan,
    setupComplete: true,
    nudgeConsentComplete: true
  });
  currentPlan = saveLocalPlan(currentAccountId, completed);
  editRequested = false;
  hideOverlay();

  try {
    const session = await restorePauseBackendSession();
    if (session?.token && !session.offline) {
      const saved = await pushCloudPlan(session.token, currentPlan);
      if (saved?.plan) currentPlan = saveLocalPlan(currentAccountId, saved.plan);
    }
  } catch {
    // Recovery Plan remains local-first and will be retried on a future app session.
  }
}

async function hydratePlan(accountId) {
  const local = loadLocalPlan(accountId);
  currentPlan = local;

  try {
    const session = await restorePauseBackendSession();
    if (!session?.token || session.offline) return local;
    const cloud = await pullCloudPlan(session.token);
    if (cloud?.exists && cloud.plan) {
      currentPlan = saveLocalPlan(accountId, cloud.plan);
      return currentPlan;
    }
    if (local.setupComplete) {
      const saved = await pushCloudPlan(session.token, local);
      if (saved?.plan) currentPlan = saveLocalPlan(accountId, saved.plan);
    }
  } catch {}

  return currentPlan;
}

async function reconcileRecoveryPlan() {
  const pause = window.__PAUSE__?.getState?.();
  if (!pause || pause.authStatus !== 'authenticated' || !pause.user?.id) {
    hideOverlay();
    currentAccountId = null;
    currentPlan = null;
    hydrationPromise = null;
    editRequested = false;
    return;
  }

  const accountId = String(pause.user.id);
  if (accountId !== currentAccountId) {
    currentAccountId = accountId;
    currentStep = 'intro';
    hydrationPromise = hydratePlan(accountId).finally(() => {
      hydrationPromise = null;
      reconcileRecoveryPlan();
    });
    return;
  }

  if (hydrationPromise || pause.screen === 'launch') return;

  const plan = normalizeRecoveryPlan(currentPlan || {});
  if (!plan.setupComplete && pause.screen === 'main') {
    showOverlay();
    return;
  }

  if (plan.setupComplete && !plan.nudgeConsentComplete && !editRequested && pause.screen === 'main') {
    if (!overlay) {
      currentStep = 'nudges';
      showOverlay();
    }
    return;
  }

  if (editRequested && pause.screen === 'main') {
    showOverlay();
    return;
  }

  if (plan.setupComplete && plan.nudgeConsentComplete && !editRequested) hideOverlay();
}

export function openRecoveryPlanSetup() {
  if (!currentAccountId) return false;
  editRequested = true;
  currentStep = 'days';
  showOverlay();
  return true;
}

export function getRecoveryPlan() {
  return currentPlan ? normalizeRecoveryPlan(currentPlan) : null;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.__PAUSE_RECOVERY_PLAN__ = {
    getPlan: getRecoveryPlan,
    openSetup: openRecoveryPlanSetup,
    deriveTimeline: () => currentPlan ? deriveRecoveryTimeline(currentPlan) : null,
    deriveNudgeMoments: () => currentPlan ? deriveNudgeMoments(currentPlan) : null
  };

  const interval = setInterval(reconcileRecoveryPlan, 700);
  interval.unref?.();
  window.addEventListener('focus', reconcileRecoveryPlan);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) reconcileRecoveryPlan();
  });
  reconcileRecoveryPlan();
}
