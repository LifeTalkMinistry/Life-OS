import { OrbArtwork } from './OrbArtwork.js';
import { priorityOptions, priorityLabel } from '../state/lifeProfile.js';

const dayOptions = [
  { id: 1, label: 'M' },
  { id: 2, label: 'T' },
  { id: 3, label: 'W' },
  { id: 4, label: 'T' },
  { id: 5, label: 'F' },
  { id: 6, label: 'S' },
  { id: 0, label: 'S' }
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

function prioritiesContent(profile) {
  return `
    <div class="orb-content setup-content setup-content-wide">
      <p class="setup-eyebrow">YOUR LIFE</p>
      <h1 class="setup-question setup-question-small">What else deserves space?</h1>
      <p class="setup-help">Choose up to four.</p>
      <div class="setup-choice-grid">
        ${priorityOptions.map((item) => `
          <button type="button" data-setup-priority="${item.id}" class="${profile.priorities.includes(item.id) ? 'is-selected' : ''}">${item.label}</button>
        `).join('')}
      </div>
      <button type="button" class="setup-continue" data-setup-action="priorities-continue" ${profile.priorities.length ? '' : 'disabled'}>Continue</button>
      ${backButton()}
    </div>
  `;
}

function nonNegotiablesContent(profile) {
  return `
    <div class="orb-content setup-content setup-content-wide">
      <p class="setup-eyebrow">PROTECT WHAT MATTERS</p>
      <h1 class="setup-question setup-question-small">What can't become leftover time?</h1>
      <p class="setup-help">Choose up to two.</p>
      <div class="setup-choice-grid">
        ${profile.priorities.map((id) => `
          <button type="button" data-setup-nonneg="${id}" class="${profile.nonNegotiables.includes(id) ? 'is-selected' : ''}">${escapeHtml(priorityLabel(id))}</button>
        `).join('')}
      </div>
      <button type="button" class="setup-continue" data-setup-action="nonneg-continue">Continue</button>
      ${backButton()}
    </div>
  `;
}

function focusContent(profile) {
  return `
    <div class="orb-content setup-content">
      <p class="setup-eyebrow">CURRENT DIRECTION</p>
      <h1 class="setup-question setup-question-small">What are you trying to move forward right now?</h1>
      <label class="setup-focus-field">
        <span class="sr-only">Current focus</span>
        <input type="text" maxlength="48" autocomplete="off" data-setup-field="currentFocus" value="${escapeHtml(profile.currentFocus)}" placeholder="e.g. Find beta users">
      </label>
      <button type="button" class="setup-continue" data-setup-action="focus-continue" ${profile.currentFocus.trim() ? '' : 'disabled'}>Continue</button>
      ${backButton()}
    </div>
  `;
}

function focusTimeContent() {
  return `
    <div class="orb-content setup-content">
      <p class="setup-eyebrow">PROTECT FOCUS</p>
      <h1 class="setup-question">How much focused time should LIFE OS protect?</h1>
      <div class="setup-options setup-options-compact">
        <button type="button" data-setup-minutes="30">30 min</button>
        <button type="button" data-setup-minutes="60">60 min</button>
        <button type="button" data-setup-minutes="90">90 min</button>
      </div>
      ${backButton()}
    </div>
  `;
}

function readyContent() {
  return `
    <div class="orb-content setup-content setup-ready-content">
      <div class="complete-check" aria-hidden="true">✓</div>
      <p class="setup-eyebrow">LIFE OS IS READY</p>
      <h1 class="setup-question">Finding what matters now…</h1>
    </div>
  `;
}

function contentForStep(step, profile) {
  if (step === 'welcome') return welcomeContent();
  if (step === 'fixed') return fixedContent();
  if (step === 'fixed-kind') return fixedKindContent(profile);
  if (step === 'fixed-days') return fixedDaysContent(profile);
  if (step === 'custom-days') return customDaysContent(profile);
  if (step === 'fixed-time') return fixedTimeContent(profile);
  if (step === 'sleep') return sleepContent(profile);
  if (step === 'priorities') return prioritiesContent(profile);
  if (step === 'nonnegotiables') return nonNegotiablesContent(profile);
  if (step === 'focus') return focusContent(profile);
  if (step === 'focus-time') return focusTimeContent();
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

export function LifeSetupOrb({ step, profile, onAction, onField }) {
  const shell = document.createElement('div');
  shell.className = `orb-shell setup-orb-shell setup-step-${step}`;

  const orb = document.createElement('div');
  orb.className = 'orb setup-orb';
  orb.innerHTML = contentForStep(step, profile);
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
    const update = () => {
      onField?.(input.dataset.setupField, input.value);
      if (input.dataset.setupField === 'currentFocus') {
        const continueButton = orb.querySelector('[data-setup-action="focus-continue"]');
        if (continueButton) continueButton.disabled = !input.value.trim();
      }
    };
    input.addEventListener('input', update);
    input.addEventListener('change', update);
  });

  shell.append(OrbArtwork(), orb);
  return shell;
}
