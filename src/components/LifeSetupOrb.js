import { OrbArtwork } from './OrbArtwork.js';

const dayOptions = [
  { id: 1, label: 'M', short: 'Mon' },
  { id: 2, label: 'T', short: 'Tue' },
  { id: 3, label: 'W', short: 'Wed' },
  { id: 4, label: 'T', short: 'Thu' },
  { id: 5, label: 'F', short: 'Fri' },
  { id: 6, label: 'S', short: 'Sat' },
  { id: 0, label: 'S', short: 'Sun' }
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function backButton() {
  return '<button type="button" class="setup-back" data-setup-action="back">Back</button>';
}

function formatTime(time) {
  const [hourValue, minuteValue] = String(time || '00:00').split(':').map(Number);
  const suffix = hourValue >= 12 ? 'PM' : 'AM';
  const hour = hourValue % 12 || 12;
  return `${hour}:${String(minuteValue || 0).padStart(2, '0')} ${suffix}`;
}

function daysSummary(days = []) {
  const normalized = [...days].sort((a, b) => a - b);
  if (normalized.length === 7) return 'Every day';
  if ([1, 2, 3, 4, 5].every((day) => normalized.includes(day)) && normalized.length === 5) return 'Mon–Fri';
  return dayOptions.filter((day) => normalized.includes(day.id)).map((day) => day.short).join(', ');
}

function fixedKindCopy(kind) {
  if (kind === 'school') return 'School';
  if (kind === 'both') return 'Work + school';
  return 'Work';
}

function welcomeContent() {
  return `
    <div class="orb-content setup-content setup-welcome-content">
      <p class="setup-eyebrow">LIFE OS</p>
      <h1 class="setup-hero">READY TO<br>TAKE CONTROL?</h1>
      <span class="setup-pulse" aria-hidden="true"></span>
      <p class="setup-tap">Tap to begin</p>
    </div>
  `;
}

function fixedContent() {
  return `
    <div class="orb-content setup-content">
      <p class="setup-eyebrow">LET'S START WITH REALITY</p>
      <h1 class="setup-question">Do you have a fixed work or school schedule?</h1>
      <div class="setup-options">
        <button type="button" data-setup-fixed="yes">Yes</button>
        <button type="button" data-setup-fixed="no">No</button>
      </div>
      ${backButton()}
    </div>
  `;
}

function fixedKindContent(profile) {
  return `
    <div class="orb-content setup-content">
      <p class="setup-eyebrow">FIXED REALITY</p>
      <h1 class="setup-question">What is fixed?</h1>
      <div class="setup-options setup-options-compact">
        ${['work', 'school', 'both'].map((kind) => `
          <button type="button" data-setup-kind="${kind}" class="${profile.fixedKind === kind ? 'is-selected' : ''}">
            ${kind === 'both' ? 'Work + school' : kind[0].toUpperCase() + kind.slice(1)}
          </button>
        `).join('')}
      </div>
      ${backButton()}
    </div>
  `;
}

function fixedDaysContent() {
  return `
    <div class="orb-content setup-content">
      <p class="setup-eyebrow">FIXED REALITY</p>
      <h1 class="setup-question">Which days?</h1>
      <div class="setup-options setup-options-compact">
        <button type="button" data-setup-days="weekdays">Monday – Friday</button>
        <button type="button" data-setup-days="everyday">Every day</button>
        <button type="button" data-setup-days="custom">Choose days</button>
      </div>
      ${backButton()}
    </div>
  `;
}

function customDaysContent(profile) {
  return `
    <div class="orb-content setup-content">
      <p class="setup-eyebrow">CHOOSE DAYS</p>
      <h1 class="setup-question setup-question-small">Tap the days that are fixed.</h1>
      <div class="setup-days" aria-label="Fixed schedule days">
        ${dayOptions.map((day) => `
          <button type="button" data-setup-day="${day.id}" class="${profile.fixedDays.includes(day.id) ? 'is-selected' : ''}">${day.label}</button>
        `).join('')}
      </div>
      <button type="button" class="setup-continue" data-setup-action="days-continue" ${profile.fixedDays.length ? '' : 'disabled'}>Continue</button>
      ${backButton()}
    </div>
  `;
}

function fixedTimeContent(profile) {
  return `
    <div class="orb-content setup-content">
      <p class="setup-eyebrow">FIXED REALITY</p>
      <h1 class="setup-question setup-question-small">What time is normally fixed?</h1>
      <div class="setup-time-grid">
        <label><span>Start</span><input type="time" data-setup-field="fixedStart" value="${escapeHtml(profile.fixedStart)}"></label>
        <label><span>End</span><input type="time" data-setup-field="fixedEnd" value="${escapeHtml(profile.fixedEnd)}"></label>
      </div>
      <button type="button" class="setup-continue" data-setup-action="fixed-time-continue">Continue</button>
      ${backButton()}
    </div>
  `;
}

function sleepContent(profile) {
  return `
    <div class="orb-content setup-content">
      <p class="setup-eyebrow">PROTECT RECOVERY</p>
      <h1 class="setup-question setup-question-small">When do you usually sleep?</h1>
      <div class="setup-time-grid">
        <label><span>Sleep</span><input type="time" data-setup-field="sleepStart" value="${escapeHtml(profile.sleepStart)}"></label>
        <label><span>Wake</span><input type="time" data-setup-field="sleepEnd" value="${escapeHtml(profile.sleepEnd)}"></label>
      </div>
      <button type="button" class="setup-continue" data-setup-action="sleep-continue">Continue</button>
      ${backButton()}
    </div>
  `;
}

function fixedScopeContent(profile) {
  return `
    <div class="orb-content setup-content setup-content-wide">
      <p class="setup-eyebrow">FIXED TIME</p>
      <h1 class="setup-question setup-question-small">How should LIFE OS treat those fixed hours?</h1>
      <p class="setup-help">Recommended: guide only the time you control.</p>
      <div class="setup-options setup-options-compact">
        <button type="button" data-setup-scope="outside" class="${profile.fixedGuidanceMode === 'outside' ? 'is-selected' : ''}">Just outside my fixed schedule</button>
        <button type="button" data-setup-scope="breakdown" class="${profile.fixedGuidanceMode === 'breakdown' ? 'is-selected' : ''}">Break down my fixed schedule too</button>
      </div>
      ${backButton()}
    </div>
  `;
}

function activityDraftReady(draft) {
  return Boolean(
    draft?.name?.trim()
    && Array.isArray(draft.days)
    && draft.days.length
    && draft.start
    && draft.end
    && draft.start !== draft.end
  );
}

function activitiesContent(profile, draft) {
  const scopeHelp = profile.hasFixedSchedule && profile.fixedGuidanceMode === 'breakdown'
    ? 'Add the activities you want LIFE OS to guide, including inside work or school.'
    : profile.hasFixedSchedule
      ? 'Add what usually happens outside your fixed schedule.'
      : 'Add the activities that normally make up your day.';

  return `
    <div class="orb-content setup-content setup-content-wide">
      <p class="setup-eyebrow">YOUR TIME</p>
      <h1 class="setup-question setup-question-small">Let’s map the time you control.</h1>
      <p class="setup-help">${scopeHelp}</p>
      <label class="setup-focus-field">
        <span class="sr-only">Activity name</span>
        <input type="text" maxlength="48" autocomplete="off" data-setup-draft-field="name" value="${escapeHtml(draft?.name)}" placeholder="Activity name">
      </label>
      <div class="setup-days" aria-label="Activity days">
        ${dayOptions.map((day) => `
          <button type="button" data-setup-activity-day="${day.id}" class="${draft?.days?.includes(day.id) ? 'is-selected' : ''}">${day.label}</button>
        `).join('')}
      </div>
      <div class="setup-time-grid">
        <label><span>Start</span><input type="time" data-setup-draft-field="start" value="${escapeHtml(draft?.start)}"></label>
        <label><span>End</span><input type="time" data-setup-draft-field="end" value="${escapeHtml(draft?.end)}"></label>
      </div>
      <button type="button" class="setup-continue" data-setup-action="activity-add" ${activityDraftReady(draft) ? '' : 'disabled'}>Add activity</button>
      ${profile.activities.length ? `
        <p class="setup-help">${profile.activities.length} ${profile.activities.length === 1 ? 'activity' : 'activities'} mapped.</p>
        <div class="setup-options setup-options-compact">
          ${profile.activities.map((activity) => `
            <button type="button" data-setup-remove-activity="${escapeHtml(activity.id)}">${escapeHtml(activity.name)} · ${formatTime(activity.start)}–${formatTime(activity.end)} ×</button>
          `).join('')}
        </div>
      ` : ''}
      <button type="button" class="setup-continue" data-setup-action="activities-continue" ${profile.activities.length ? '' : 'disabled'}>Review map</button>
      ${backButton()}
    </div>
  `;
}

function reviewContent(profile) {
  const summary = [];
  if (profile.hasFixedSchedule) {
    summary.push(`${fixedKindCopy(profile.fixedKind)} · ${daysSummary(profile.fixedDays)} · ${formatTime(profile.fixedStart)}–${formatTime(profile.fixedEnd)}`);
  }
  summary.push(`Sleep · ${formatTime(profile.sleepStart)}–${formatTime(profile.sleepEnd)}`);
  profile.activities.forEach((activity) => {
    summary.push(`${activity.name} · ${daysSummary(activity.days)} · ${formatTime(activity.start)}–${formatTime(activity.end)}`);
  });

  return `
    <div class="orb-content setup-content setup-content-wide">
      <p class="setup-eyebrow">YOUR LIFE MAP</p>
      <h1 class="setup-question setup-question-small">Does this look right?</h1>
      <div class="setup-options setup-options-compact">
        ${summary.map((item) => `<button type="button" disabled>${escapeHtml(item)}</button>`).join('')}
      </div>
      <button type="button" class="setup-continue" data-setup-action="review-edit">Edit activities</button>
      <button type="button" class="setup-continue" data-setup-action="review-confirm">Looks good</button>
      ${backButton()}
    </div>
  `;
}

function readyContent() {
  return `
    <div class="orb-content setup-content setup-ready-content">
      <div class="complete-check" aria-hidden="true">✓</div>
      <p class="setup-eyebrow">LIFE OS IS READY</p>
      <h1 class="setup-question">Loading what should be running now…</h1>
    </div>
  `;
}

function contentForStep(step, profile, draft) {
  if (step === 'welcome') return welcomeContent();
  if (step === 'fixed') return fixedContent();
  if (step === 'fixed-kind') return fixedKindContent(profile);
  if (step === 'fixed-days') return fixedDaysContent(profile);
  if (step === 'custom-days') return customDaysContent(profile);
  if (step === 'fixed-time') return fixedTimeContent(profile);
  if (step === 'sleep') return sleepContent(profile);
  if (step === 'fixed-scope') return fixedScopeContent(profile);
  if (step === 'activities') return activitiesContent(profile, draft);
  if (step === 'review') return reviewContent(profile);
  return readyContent();
}

function installSetupSafeZone(orb, step) {
  if (step === 'welcome') return;

  const content = orb.querySelector('.setup-content');
  if (!content) return;

  const safeZone = document.createElement('div');
  safeZone.className = `setup-safe-zone${content.classList.contains('setup-content-wide') ? ' is-wide' : ''}`;

  const fit = document.createElement('div');
  fit.className = 'setup-fit';

  content.replaceWith(safeZone);
  fit.appendChild(content);
  safeZone.appendChild(fit);

  const fitContent = () => {
    fit.style.setProperty('--setup-fit-scale', '1');

    const applyFit = () => {
      if (!orb.isConnected) return;

      const availableWidth = safeZone.clientWidth;
      const availableHeight = safeZone.clientHeight;
      const naturalWidth = Math.max(content.scrollWidth, fit.scrollWidth);
      const naturalHeight = Math.max(content.scrollHeight, fit.scrollHeight);

      if (!availableWidth || !availableHeight || !naturalWidth || !naturalHeight) return;

      const scale = Math.min(
        1,
        availableWidth / naturalWidth,
        availableHeight / naturalHeight
      );

      fit.style.setProperty('--setup-fit-scale', scale.toFixed(3));
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(applyFit);
    } else {
      applyFit();
    }
  };

  fitContent();

  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => {
      if (!orb.isConnected) {
        observer.disconnect();
        return;
      }
      fitContent();
    });
    observer.observe(orb);
  }
}

function refreshActivityAddButton(orb) {
  const addButton = orb.querySelector('[data-setup-action="activity-add"]');
  if (!addButton) return;

  const name = orb.querySelector('[data-setup-draft-field="name"]')?.value.trim();
  const start = orb.querySelector('[data-setup-draft-field="start"]')?.value;
  const end = orb.querySelector('[data-setup-draft-field="end"]')?.value;
  const hasDay = Boolean(orb.querySelector('[data-setup-activity-day].is-selected'));
  addButton.disabled = !(name && start && end && start !== end && hasDay);
}

export function LifeSetupOrb({ step, profile, activityDraft, onAction, onField }) {
  const shell = document.createElement('div');
  shell.className = `orb-shell setup-orb-shell setup-step-${step}`;

  const orb = document.createElement('div');
  orb.className = 'orb setup-orb';
  orb.innerHTML = contentForStep(step, profile, activityDraft);
  installSetupSafeZone(orb, step);

  if (step === 'welcome') {
    orb.setAttribute('role', 'button');
    orb.setAttribute('tabindex', '0');
    orb.setAttribute('aria-label', 'Ready to take control. Tap to begin Life Setup.');
    const begin = () => onAction?.({ setupAction: 'begin' });
    orb.addEventListener('click', begin);
    orb.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        begin();
      }
    });
  }

  orb.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onAction?.(button.dataset);
    });
  });

  orb.querySelectorAll('[data-setup-field]').forEach((input) => {
    const update = () => onField?.(input.dataset.setupField, input.value);
    input.addEventListener('input', update);
    input.addEventListener('change', update);
  });

  orb.querySelectorAll('[data-setup-draft-field]').forEach((input) => {
    const update = () => {
      onField?.(`draft.${input.dataset.setupDraftField}`, input.value);
      refreshActivityAddButton(orb);
    };
    input.addEventListener('input', update);
    input.addEventListener('change', update);
  });

  shell.append(OrbArtwork(), orb);
  return shell;
}
