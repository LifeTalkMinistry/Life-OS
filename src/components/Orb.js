import { OrbArtwork } from './OrbArtwork.js';
import { formatCountdown, remainingMs } from '../restState.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function idleContent() {
  return `
    <div class="orb-content orb-now-content pause-idle-content">
      <p class="orb-kicker">PAUSE</p>
      <h1 class="orb-title">READY TO<br>REST?</h1>
      <span class="orb-divider" aria-hidden="true"><i></i></span>
      <p class="orb-until">Tap to take a rest</p>
    </div>
  `;
}

function menuContent() {
  return `
    <div class="orb-content orb-now-content pause-menu-content">
      <p class="orb-kicker">PAUSE</p>
      <h1 class="orb-title">PAUSE<br>MENU</h1>
      <span class="orb-divider" aria-hidden="true"><i></i></span>
      <p class="orb-until">Choose an action</p>
    </div>
  `;
}

function restingContent(state) {
  const session = state.active;
  return `
    <div class="orb-content orb-now-content pause-resting-content">
      <p class="orb-kicker">RESTING</p>
      <h1 class="orb-title pause-rest-label">${escapeHtml(session?.label || 'Rest')}</h1>
      <span class="orb-divider" aria-hidden="true"><i></i></span>
      <p class="orb-time pause-countdown" data-pause-countdown>${formatCountdown(remainingMs(state))}</p>
      <button type="button" class="pause-end-rest" data-pause-action="end-rest">END REST</button>
    </div>
  `;
}

function completedContent() {
  return `
    <div class="orb-content orb-completed-content">
      <div class="complete-check" aria-hidden="true">✓</div>
      <p class="orb-prompt-title">REST COMPLETE</p>
      <p class="complete-copy">Return when you're ready.</p>
    </div>
  `;
}

export function Orb({ state, mode = 'idle', gestureHandlers, onAction }) {
  const shell = document.createElement('div');
  shell.className = `orb-shell orb-mode-${mode}`;
  shell.dataset.testid = 'orb';

  const orb = document.createElement('div');
  orb.className = 'orb';
  orb.setAttribute('role', 'button');
  orb.setAttribute('tabindex', '0');
  orb.setAttribute('aria-label', mode === 'resting'
    ? `Resting: ${state.active?.label || 'Rest'}. Hold for menu.`
    : mode === 'menu'
      ? 'PAUSE menu. Tap to close.'
      : 'PAUSE. Tap to take a rest or hold for the main menu.');

  if (mode === 'resting') orb.innerHTML = restingContent(state);
  else if (mode === 'completed') orb.innerHTML = completedContent();
  else if (mode === 'menu') orb.innerHTML = menuContent();
  else orb.innerHTML = idleContent();

  if ((mode === 'idle' || mode === 'resting') && gestureHandlers) {
    orb.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target.closest('button')) return;
      event.preventDefault();
      try { orb.setPointerCapture?.(event.pointerId); } catch {}
      gestureHandlers.pointerDown();
    });
    orb.addEventListener('pointerup', (event) => {
      if (event.target.closest('button')) return;
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

  if (mode === 'menu') {
    orb.addEventListener('click', () => onAction?.('close-menu'));
  }

  orb.querySelector('[data-pause-action="end-rest"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    onAction?.('end-rest');
  });

  shell.append(OrbArtwork(), orb);
  return shell;
}
