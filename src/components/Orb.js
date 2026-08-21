import { OrbArtwork } from './OrbArtwork.js';
import { formatClock } from '../state/lifeState.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function nowContent(activity) {
  const lines = activity.title.split('\n').map(escapeHtml).join('<br>');
  const timing = activity.kind === 'open'
    ? '<p class="orb-until">No activity scheduled</p>'
    : `
      <p class="orb-until">Until</p>
      <p class="orb-time">${formatClock(activity.end)}</p>
    `;

  return `
    <div class="orb-content orb-now-content">
      <p class="orb-kicker">RUNNING NOW</p>
      <h1 class="orb-title">${lines}</h1>
      <span class="orb-divider" aria-hidden="true"><i></i></span>
      ${timing}
    </div>
  `;
}

function adjustContent() {
  return `
    <div class="orb-content orb-choice-content">
      <p class="orb-prompt-title">WHAT CHANGED?</p>
      <div class="orb-options">
        <button type="button" data-action="done">I'm done</button>
        <button type="button" data-action="more">I need more time</button>
        <button type="button" data-action="cant">I can't do this now</button>
        <button type="button" data-action="urgent">Something urgent came up</button>
      </div>
    </div>
  `;
}

function moreTimeContent() {
  return `
    <div class="orb-content orb-choice-content">
      <p class="orb-prompt-title">HOW MUCH MORE TIME?</p>
      <div class="orb-options orb-options-compact">
        <button type="button" data-minutes="15">+15 min</button>
        <button type="button" data-minutes="30">+30 min</button>
        <button type="button" data-minutes="60">+60 min</button>
      </div>
    </div>
  `;
}

function cantNowContent() {
  return `
    <div class="orb-content orb-choice-content">
      <p class="orb-prompt-title">WHAT SHOULD LIFE OS DO?</p>
      <div class="orb-options orb-options-compact">
        <button type="button" data-defer="later">Move later today</button>
        <button type="button" data-defer="another-day">Move to another day</button>
        <button type="button" data-defer="skip">Skip today</button>
      </div>
    </div>
  `;
}

function urgentContent() {
  return `
    <div class="orb-content orb-choice-content">
      <p class="orb-prompt-title">HOW MUCH TIME DO YOU NEED?</p>
      <div class="orb-options orb-options-compact">
        <button type="button" data-urgent="15">15 min</button>
        <button type="button" data-urgent="30">30 min</button>
        <button type="button" data-urgent="60">1 hour</button>
        <button type="button" data-urgent="unknown">Not sure</button>
      </div>
    </div>
  `;
}

function completedContent() {
  return `
    <div class="orb-content orb-completed-content">
      <div class="complete-check" aria-hidden="true">✓</div>
      <p class="orb-prompt-title">COMPLETED</p>
      <p class="complete-copy">Finding what matters next…</p>
    </div>
  `;
}

export function Orb({ activity, mode = 'now', gestureHandlers, onAction }) {
  const shell = document.createElement('div');
  shell.className = `orb-shell orb-mode-${mode}`;
  shell.dataset.testid = 'orb';

  const orb = document.createElement('div');
  orb.className = 'orb';
  orb.setAttribute('role', 'button');
  orb.setAttribute('tabindex', mode === 'now' ? '0' : '-1');
  orb.setAttribute('aria-label', mode === 'now'
    ? 'Current activity. Tap for why, hold for today, double tap to adjust.'
    : 'LIFE OS adjustment controls');

  if (mode === 'now' || mode === 'today') orb.innerHTML = nowContent(activity);
  if (mode === 'adjust') orb.innerHTML = adjustContent();
  if (mode === 'more-time') orb.innerHTML = moreTimeContent();
  if (mode === 'cant-now') orb.innerHTML = cantNowContent();
  if (mode === 'urgent-time') orb.innerHTML = urgentContent();
  if (mode === 'completed') orb.innerHTML = completedContent();

  if (mode === 'now' && gestureHandlers) {
    orb.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      try { orb.setPointerCapture?.(event.pointerId); } catch {}
      gestureHandlers.pointerDown();
    });
    orb.addEventListener('pointerup', (event) => {
      event.preventDefault();
      gestureHandlers.pointerUp();
    });
    orb.addEventListener('pointercancel', () => gestureHandlers.cancel());
    orb.addEventListener('contextmenu', (event) => event.preventDefault());
    orb.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        gestureHandlers.keyboardTap?.();
      }
    });
  }

  orb.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onAction?.(button.dataset);
    });
  });

  shell.append(OrbArtwork(), orb);
  return shell;
}
