import { OrbArtwork } from './OrbArtwork.js';
import { findTimeConflict } from '../state/lifeProfile.js';

const dayOptions = [
  { id: 1, label: 'M', short: 'Mon', name: 'Monday' },
  { id: 2, label: 'T', short: 'Tue', name: 'Tuesday' },
  { id: 3, label: 'W', short: 'Wed', name: 'Wednesday' },
  { id: 4, label: 'T', short: 'Thu', name: 'Thursday' },
  { id: 5, label: 'F', short: 'Fri', name: 'Friday' },
  { id: 6, label: 'S', short: 'Sat', name: 'Saturday' },
  { id: 0, label: 'S', short: 'Sun', name: 'Sunday' }
];

const activityIconOptions = [
  { id: 'general', label: 'General' },
  { id: 'work', label: 'Work' },
  { id: 'study', label: 'Study' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'faith', label: 'Faith' },
  { id: 'creative', label: 'Creative' },
  { id: 'social', label: 'Social' },
  { id: 'routine', label: 'Routine' }
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function activityIconSvg(icon = 'general') {
  const common = 'viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
  if (icon === 'work') return `<svg ${common}><rect x="4" y="7" width="16" height="11" rx="2"/><path d="M9 7V5h6v2M4 11h16M10 11v2h4v-2"/></svg>`;
  if (icon === 'study') return `<svg ${common}><path d="M4 5.5c2.5-.7 5-.3 8 1.5v12c-3-1.8-5.5-2.2-8-1.5zM20 5.5c-2.5-.7-5-.3-8 1.5v12c3-1.8 5.5-2.2 8-1.5z"/></svg>`;
  if (icon === 'fitness') return `<svg ${common}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>`;
  if (icon === 'faith') return `<svg ${common}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>`;
  if (icon === 'creative') return `<svg ${common}><path d="m5 19 3.8-.8L18 9l-3-3-9.2 9.2zM13.8 7.2l3 3M5 19l2-2"/></svg>`;
  if (icon === 'social') return `<svg ${common}><circle cx="9" cy="9" r="3"/><circle cx="16.5" cy="10" r="2.5"/><path d="M3.5 19c.6-3 2.5-4.5 5.5-4.5s4.9 1.5 5.5 4.5M14 15c2.9-.5 5 .8 6 4"/></svg>`;
  if (icon === 'routine') return `<svg ${common}><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>`;
  return `<svg ${common}><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/></svg>`;
}

function backButton(action = 'back') {
  return `<button type="button" class="setup-back" data-setup-action="${action}">Back</button>`;
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

function dayName(day) {
  return dayOptions.find((item) => item.id === day)?.name ?? 'Day';
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
      <div class="setup-options setup-options-compact">
        <button type="button" data-setup-scope="outside" class="${profile.fixedGuidanceMode === 'outside' ? 'is-selected' : ''}">Just outside my fixed schedule</button>
        <button type="button" data-setup-scope="breakdown" class="${profile.fixedGuidanceMode === 'breakdown' ? 'is-selected' : ''}">Break down my fixed schedule too</button>
      </div>
      ${backButton()}
    </div>
  `;
}

function currentDayActivities(profile, day) {
  return profile.activities
    .filter((activity) => activity.days.includes(day))
    .sort((a, b) => a.start.localeCompare(b.start));
}

function iconPicker(draft) {
  const selected = draft?.icon || 'general';
  return `
    <div class="setup-activity-name-row">
      <label class="setup-focus-field setup-activity-name-field">
        <span class="sr-only">Activity name</span>
        <input type="text" maxlength="48" autocomplete="off" data-setup-draft-field="name" value="${escapeHtml(draft?.name)}" placeholder="Activity name">
      </label>
      <button type="button" class="setup-icon-picker-toggle" data-setup-icon-toggle aria-label="Choose activity icon" aria-expanded="false" title="Choose activity icon">
        ${activityIconSvg(selected)}
      </button>
      <div class="setup-icon-picker" data-setup-icon-picker hidden aria-label="Activity icons">
        ${activityIconOptions.map((option) => `
          <button type="button" data-setup-activity-icon="${option.id}" class="${selected === option.id ? 'is-selected' : ''}" aria-label="${option.label}" title="${option.label}">
            ${activityIconSvg(option.id)}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function activitiesContent(profile, draft, activityDay) {
  const name = dayName(activityDay);
  const existing = currentDayActivities(profile, activityDay);
  const conflict = draft?.start && draft?.end
    ? findTimeConflict(profile, activityDay, draft.start, draft.end)
    : null;
  const ready = Boolean(draft?.name?.trim() && draft?.start && draft?.end && draft.start !== draft.end && !conflict);
  const nextLabel = activityDay === 0 ? 'Review week' : `${name} looks good`;
  const canFinish = activityDay !== 0 || profile.activities.length > 0;

  return `
    <div class="orb-content setup-content setup-content-wide setup-day-builder">
      <p class="setup-eyebrow">LET'S BUILD ${name.toUpperCase()}</p>
      <h1 class="setup-question setup-question-small">What do you usually do on ${name}?</h1>
      ${iconPicker(draft)}
      <div class="setup-time-grid">
        <label><span>Start</span><input type="time" data-setup-draft-field="start" value="${escapeHtml(draft?.start)}"></label>
        <label><span>End</span><input type="time" data-setup-draft-field="end" value="${escapeHtml(draft?.end)}"></label>
      </div>
      <p class="setup-help setup-time-conflict" data-setup-conflict ${conflict ? '' : 'hidden'}>${conflict ? `That time is already occupied by ${escapeHtml(conflict.label)}.` : ''}</p>
      <button type="button" class="setup-continue" data-setup-action="activity-add" ${ready ? '' : 'disabled'}>Add activity</button>
      ${existing.length ? `
        <div class="setup-options setup-options-compact setup-day-list">
          ${existing.map((activity) => `
            <button type="button" data-setup-remove-activity="${escapeHtml(activity.id)}">
              <span class="setup-day-list-icon">${activityIconSvg(activity.icon)}</span>
              <span>${escapeHtml(activity.name)} · ${formatTime(activity.start)}–${formatTime(activity.end)}</span>
              <span aria-hidden="true">×</span>
            </button>
          `).join('')}
        </div>
      ` : '<p class="setup-help">No activities added yet.</p>'}
      <button type="button" class="setup-continue" data-setup-action="activity-day-next" ${canFinish ? '' : 'disabled'}>${nextLabel}</button>
      ${backButton('activity-day-back')}
    </div>
  `;
}

function reviewContent(profile) {
  const fixedSummary = profile.hasFixedSchedule
    ? `<button type="button" disabled>${escapeHtml(`${fixedKindCopy(profile.fixedKind)} · ${daysSummary(profile.fixedDays)} · ${formatTime(profile.fixedStart)}–${formatTime(profile.fixedEnd)}`)}</button>`
    : '';
  const activitySummary = dayOptions.map((day) => currentDayActivities(profile, day.id).map((activity) => `
    <button type="button" disabled>
      <span class="setup-day-list-icon">${activityIconSvg(activity.icon)}</span>
      <span>${escapeHtml(`${day.short} · ${activity.name} · ${formatTime(activity.start)}–${formatTime(activity.end)}`)}</span>
    </button>
  `).join('')).join('');

  return `
    <div class="orb-content setup-content setup-content-wide">
      <p class="setup-eyebrow">YOUR LIFE MAP</p>
      <h1 class="setup-question setup-question-small">Does this look right?</h1>
      <div class="setup-options setup-options-compact setup-review-list">
        ${fixedSummary}
        <button type="button" disabled>Sleep · ${escapeHtml(`${formatTime(profile.sleepStart)}–${formatTime(profile.sleepEnd)}`)}</button>
        ${activitySummary}
      </div>
      <button type="button" class="setup-continue" data-setup-action="review-edit">Edit week</button>
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

function contentForStep(step, profile, draft, activityDay) {
  if (step === 'welcome') return welcomeContent();
  if (step === 'fixed') return fixedContent();
  if (step === 'fixed-kind') return fixedKindContent(profile);
  if (step === 'fixed-days') return fixedDaysContent(profile);
  if (step === 'custom-days') return customDaysContent(profile);
  if (step === 'fixed-time') return fixedTimeContent(profile);
  if (step === 'sleep') return sleepContent(profile);
  if (step === 'fixed-scope') return fixedScopeContent(profile);
  if (step === 'activities') return activitiesContent(profile, draft, activityDay);
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

      const scale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);
      fit.style.setProperty('--setup-fit-scale', scale.toFixed(3));
    };

    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(applyFit);
    else applyFit();
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

function refreshActivityAddButton(orb, profile, activityDay) {
  const addButton = orb.querySelector('[data-setup-action="activity-add"]');
  if (!addButton) return;

  const name = orb.querySelector('[data-setup-draft-field="name"]')?.value.trim();
  const start = orb.querySelector('[data-setup-draft-field="start"]')?.value;
  const end = orb.querySelector('[data-setup-draft-field="end"]')?.value;
  const conflict = start && end && start !== end ? findTimeConflict(profile, activityDay, start, end) : null;
  const conflictNode = orb.querySelector('[data-setup-conflict]');

  if (conflictNode) {
    conflictNode.hidden = !conflict;
    conflictNode.textContent = conflict ? `That time is already occupied by ${conflict.label}.` : '';
  }

  orb.querySelectorAll('[data-setup-draft-field="start"], [data-setup-draft-field="end"]').forEach((input) => {
    input.setAttribute('aria-invalid', conflict ? 'true' : 'false');
  });

  addButton.disabled = !(name && start && end && start !== end && !conflict);
}

export function LifeSetupOrb({ step, profile, activityDraft, activityDay = 1, onAction, onField }) {
  const shell = document.createElement('div');
  shell.className = `orb-shell setup-orb-shell setup-step-${step}`;

  const orb = document.createElement('div');
  orb.className = 'orb setup-orb';
  orb.innerHTML = contentForStep(step, profile, activityDraft, activityDay);
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
      if (button.dataset.setupIconToggle !== undefined) return;
      onAction?.(button.dataset);
    });
  });

  const iconToggle = orb.querySelector('[data-setup-icon-toggle]');
  const iconPickerNode = orb.querySelector('[data-setup-icon-picker]');
  iconToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!iconPickerNode) return;
    iconPickerNode.hidden = !iconPickerNode.hidden;
    iconToggle.setAttribute('aria-expanded', iconPickerNode.hidden ? 'false' : 'true');
  });

  orb.querySelectorAll('[data-setup-field]').forEach((input) => {
    const update = () => onField?.(input.dataset.setupField, input.value);
    input.addEventListener('input', update);
    input.addEventListener('change', update);
  });

  orb.querySelectorAll('[data-setup-draft-field]').forEach((input) => {
    const update = () => {
      onField?.(`draft.${input.dataset.setupDraftField}`, input.value);
      refreshActivityAddButton(orb, profile, activityDay);
    };
    input.addEventListener('input', update);
    input.addEventListener('change', update);
  });

  shell.append(OrbArtwork(), orb);
  return shell;
}
