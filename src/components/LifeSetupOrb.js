import { OrbArtwork } from './OrbArtwork.js';
import { findTimeConflict } from '../state/lifeProfile.js';
import { activityIconOptions, activityIconSvgMarkup } from '../activity-icons.js';

const dayOptions = [
  { id: 1, label: 'M', short: 'Mon', name: 'Monday' },
  { id: 2, label: 'T', short: 'Tue', name: 'Tuesday' },
  { id: 3, label: 'W', short: 'Wed', name: 'Wednesday' },
  { id: 4, label: 'T', short: 'Thu', name: 'Thursday' },
  { id: 5, label: 'F', short: 'Fri', name: 'Friday' },
  { id: 6, label: 'S', short: 'Sat', name: 'Saturday' },
  { id: 0, label: 'S', short: 'Sun', name: 'Sunday' }
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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

function fixedSubject(kind) {
  if (kind === 'school') return 'school';
  if (kind === 'both') return 'work or school';
  return 'work';
}

function anchorActivity(profile, id) {
  return profile.activities.find((activity) => activity.id === id) ?? null;
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

function singleTimeQuestion({ eyebrow, question, value, action, label = 'Time' }) {
  return `
    <div class="orb-content setup-content setup-anchor-content">
      <p class="setup-eyebrow">${eyebrow}</p>
      <h1 class="setup-question setup-question-small">${question}</h1>
      <div class="setup-time-grid setup-time-grid-single">
        <label><span>${label}</span><input type="time" data-setup-draft-field="start" value="${escapeHtml(value)}"></label>
      </div>
      <button type="button" class="setup-continue" data-setup-action="${action}" ${value ? '' : 'disabled'}>Continue</button>
      ${backButton()}
    </div>
  `;
}

function preFixedContent(profile, draft) {
  const subject = fixedSubject(profile.fixedKind);
  return singleTimeQuestion({
    eyebrow: 'BEFORE YOUR FIXED TIME',
    question: `What time do you usually start getting ready for ${subject}?`,
    value: draft?.start,
    action: 'pre-fixed-continue',
    label: 'Start'
  });
}

function preSleepContent(draft) {
  return singleTimeQuestion({
    eyebrow: 'BEFORE SLEEP',
    question: 'What time do you usually start preparing for sleep?',
    value: draft?.start,
    action: 'pre-sleep-continue',
    label: 'Start'
  });
}

function homeArrivalContent(profile, draft) {
  const subject = fixedSubject(profile.fixedKind);
  return singleTimeQuestion({
    eyebrow: 'AFTER YOUR FIXED TIME',
    question: `What time do you usually get home after ${subject}?`,
    value: draft?.start,
    action: 'home-arrival-continue',
    label: 'Home'
  });
}

function currentDayActivities(profile, day) {
  return profile.activities
    .filter((activity) => activity.days.includes(day))
    .sort((a, b) => a.start.localeCompare(b.start));
}

function iconButton(option, selected) {
  return `
    <button type="button" data-setup-activity-icon="${option.id}" class="${selected === option.id ? 'is-selected' : ''}" aria-label="${option.label}" title="${option.label}">
      ${activityIconSvgMarkup(option.id)}
    </button>
  `;
}

function iconPicker(draft) {
  const selected = draft?.icon || 'general';
  const quickOptions = activityIconOptions.filter((option) => option.quick);
  const moreOptions = activityIconOptions.filter((option) => !option.quick);
  return `
    <div class="setup-activity-name-row">
      <label class="setup-focus-field setup-activity-name-field">
        <span class="sr-only">Activity name</span>
        <input type="text" maxlength="48" autocomplete="off" data-setup-draft-field="name" value="${escapeHtml(draft?.name)}" placeholder="Activity name">
      </label>
      <button type="button" class="setup-icon-picker-toggle" data-setup-icon-toggle aria-label="Choose activity icon" aria-expanded="false" title="Choose activity icon">
        ${activityIconSvgMarkup(selected)}
      </button>
      <div class="setup-icon-picker" data-setup-icon-picker hidden aria-label="Activity icons">
        <div class="setup-icon-picker-grid setup-icon-picker-quick">
          ${quickOptions.map((option) => iconButton(option, selected)).join('')}
        </div>
        <button type="button" class="setup-icon-more-toggle" data-setup-icon-more-toggle aria-expanded="false">More icons</button>
        <div class="setup-icon-more-panel" data-setup-icon-more-panel hidden>
          <div class="setup-icon-picker-grid">
            ${moreOptions.map((option) => iconButton(option, selected)).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function activitiesContent(profile, draft, activityDay) {
  const name = dayName(activityDay);
  const boundary = anchorActivity(profile, 'anchor-pre-sleep')?.start || profile.sleepStart;
  const dayDone = Boolean(draft?.start && boundary && draft.start === boundary);
  const nextLabel = activityDay === 0 ? 'Review week' : `${name} looks good`;

  if (dayDone) {
    return `
      <div class="orb-content setup-content setup-content-wide setup-day-builder setup-day-complete">
        <p class="setup-eyebrow">${name.toUpperCase()}</p>
        <h1 class="setup-question setup-question-small">${name} is mapped.</h1>
        <button type="button" class="setup-continue" data-setup-action="activity-day-next">${nextLabel}</button>
        ${backButton('activity-day-back')}
      </div>
    `;
  }

  const ready = Boolean(draft?.name?.trim() && draft?.start);
  return `
    <div class="orb-content setup-content setup-content-wide setup-day-builder">
      <p class="setup-eyebrow">LET'S BUILD ${name.toUpperCase()}</p>
      <h1 class="setup-question setup-question-small">From ${escapeHtml(formatTime(draft?.start))}, what do you do next?</h1>
      ${iconPicker(draft)}
      <button type="button" class="setup-continue" data-setup-action="activity-name-continue" ${ready ? '' : 'disabled'}>Continue</button>
      ${backButton('activity-day-back')}
    </div>
  `;
}

function activityEndContent(profile, draft, activityDay) {
  const conflict = draft?.start && draft?.end
    ? findTimeConflict(profile, activityDay, draft.start, draft.end)
    : null;
  const ready = Boolean(draft?.name?.trim() && draft?.start && draft?.end && draft.start !== draft.end && !conflict);

  return `
    <div class="orb-content setup-content setup-content-wide setup-activity-end">
      <p class="setup-eyebrow">${escapeHtml(dayName(activityDay).toUpperCase())}</p>
      <h1 class="setup-question setup-question-small">Until what time?</h1>
      <div class="setup-selected-activity">
        <span class="setup-day-list-icon">${activityIconSvgMarkup(draft?.icon)}</span>
        <span>${escapeHtml(draft?.name)}</span>
      </div>
      <div class="setup-time-grid setup-time-grid-single">
        <label><span>End</span><input type="time" data-setup-draft-field="end" value="${escapeHtml(draft?.end)}"></label>
      </div>
      <p class="setup-help setup-time-conflict" data-setup-conflict ${conflict ? '' : 'hidden'}>${conflict ? `That time crosses ${escapeHtml(conflict.label)}.` : ''}</p>
      <button type="button" class="setup-continue" data-setup-action="activity-add" ${ready ? '' : 'disabled'}>Save & continue</button>
      ${backButton()}
    </div>
  `;
}

function reviewContent(profile) {
  const fixedSummary = profile.hasFixedSchedule
    ? `<button type="button" disabled>${escapeHtml(`${fixedKindCopy(profile.fixedKind)} · ${daysSummary(profile.fixedDays)} · ${formatTime(profile.fixedStart)}–${formatTime(profile.fixedEnd)}`)}</button>`
    : '';
  const activitySummary = dayOptions.map((day) => currentDayActivities(profile, day.id).map((activity) => `
    <button type="button" disabled>
      <span class="setup-day-list-icon">${activityIconSvgMarkup(activity.icon)}</span>
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
  if (step === 'pre-fixed') return preFixedContent(profile, draft);
  if (step === 'pre-sleep') return preSleepContent(draft);
  if (step === 'home-arrival') return homeArrivalContent(profile, draft);
  if (step === 'activities') return activitiesContent(profile, draft, activityDay);
  if (step === 'activity-end') return activityEndContent(profile, draft, activityDay);
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

function refreshActivityControls(orb, profile, activityDay) {
  const name = orb.querySelector('[data-setup-draft-field="name"]')?.value.trim();
  const start = orb.querySelector('[data-setup-draft-field="start"]')?.value;
  const end = orb.querySelector('[data-setup-draft-field="end"]')?.value;

  const nameContinue = orb.querySelector('[data-setup-action="activity-name-continue"]');
  if (nameContinue) nameContinue.disabled = !(name && start);

  const anchorContinue = orb.querySelector('[data-setup-action$="-continue"]:not([data-setup-action="activity-name-continue"]):not([data-setup-action="activity-add"])');
  if (anchorContinue && orb.querySelector('.setup-anchor-content')) anchorContinue.disabled = !start;

  const addButton = orb.querySelector('[data-setup-action="activity-add"]');
  if (!addButton) return;

  const conflict = start && end && start !== end ? findTimeConflict(profile, activityDay, start, end) : null;
  const conflictNode = orb.querySelector('[data-setup-conflict]');

  if (conflictNode) {
    conflictNode.hidden = !conflict;
    conflictNode.textContent = conflict ? `That time crosses ${conflict.label}.` : '';
  }

  orb.querySelectorAll('[data-setup-draft-field="end"]').forEach((input) => {
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
      if (button.dataset.setupIconToggle !== undefined || button.dataset.setupIconMoreToggle !== undefined) return;
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

  const iconMoreToggle = orb.querySelector('[data-setup-icon-more-toggle]');
  const iconMorePanel = orb.querySelector('[data-setup-icon-more-panel]');
  iconMoreToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!iconMorePanel) return;
    iconMorePanel.hidden = !iconMorePanel.hidden;
    iconMoreToggle.setAttribute('aria-expanded', iconMorePanel.hidden ? 'false' : 'true');
    iconMoreToggle.textContent = iconMorePanel.hidden ? 'More icons' : 'Fewer icons';
  });

  orb.querySelectorAll('[data-setup-field]').forEach((input) => {
    const update = () => onField?.(input.dataset.setupField, input.value);
    input.addEventListener('input', update);
    input.addEventListener('change', update);
  });

  orb.querySelectorAll('[data-setup-draft-field]').forEach((input) => {
    const update = () => {
      onField?.(`draft.${input.dataset.setupDraftField}`, input.value);
      refreshActivityControls(orb, profile, activityDay);
    };
    input.addEventListener('input', update);
    input.addEventListener('change', update);
  });

  shell.append(OrbArtwork(), orb);
  return shell;
}
