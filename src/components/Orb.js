import { OrbArtwork } from './OrbArtwork.js';
import { elapsedMs, formatCountdown, formatElapsed, remainingMs, timerOvertimeMs } from '../restState.js';

function ensurePauseSymbolStyles() {
  if (document.querySelector('#pause-symbol-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-symbol-style';
  style.textContent = `
    .pause-idle-content {
      display: grid;
      place-items: center;
      align-content: center;
      gap: 16px;
    }

    .pause-symbol {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: clamp(14px, 4vw, 22px);
      width: min(54%, 132px);
      height: clamp(70px, 22vw, 102px);
      filter: drop-shadow(0 0 14px rgba(212, 187, 255, .16));
    }

    .pause-symbol span {
      display: block;
      width: clamp(12px, 4vw, 18px);
      height: 78%;
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(231,218,255,.88));
      box-shadow:
        0 0 9px rgba(255,255,255,.18),
        0 0 20px rgba(174,119,255,.28);
      transform-origin: 50% 50%;
      animation: pause-eye-blink 4.2s cubic-bezier(.4, 0, .2, 1) infinite;
      will-change: transform;
    }

    @keyframes pause-eye-blink {
      0%, 44%, 53%, 100% {
        transform: scaleY(1) scaleX(1);
      }
      47% {
        transform: scaleY(.42) scaleX(1.04);
      }
      49.2%, 50.8% {
        transform: scaleY(.07) scaleX(1.12);
      }
      52% {
        transform: scaleY(.5) scaleX(1.03);
      }
    }

    .pause-symbol-caption {
      margin: 0;
      color: rgba(240, 233, 248, .8);
      font-size: clamp(.72rem, 3vw, .9rem);
      font-weight: 430;
      letter-spacing: .035em;
      text-shadow: 0 0 14px rgba(159, 103, 255, .2);
    }

    .pause-resting-content {
      display: grid;
      place-items: center;
      align-content: center;
      gap: 18px;
    }

    .pause-resting-content .pause-countdown {
      margin: 0;
    }

    .pause-timer-overtime {
      color: #c8b6e2;
    }

    .orb-mode-idle .orb:hover .pause-symbol span,
    .orb-mode-idle .orb:focus-visible .pause-symbol span {
      background: #fff;
      box-shadow:
        0 0 10px rgba(255,255,255,.28),
        0 0 28px rgba(174,119,255,.42);
    }

    @media (prefers-reduced-motion: reduce) {
      .pause-symbol span {
        animation: none;
      }
    }

    @media (max-width: 360px), (max-height: 640px) {
      .pause-idle-content { gap: 12px; }
      .pause-symbol {
        height: clamp(62px, 20vw, 88px);
        gap: clamp(12px, 3.6vw, 18px);
      }
      .pause-symbol span {
        width: clamp(10px, 3.7vw, 16px);
      }
    }
  `;
  document.head.appendChild(style);
}

function idleContent() {
  return `
    <div class="orb-content orb-now-content pause-idle-content">
      <div class="pause-symbol" aria-hidden="true">
        <span></span>
        <span></span>
      </div>
      <p class="pause-symbol-caption">Tap to pause</p>
    </div>
  `;
}

function menuContent() {
  return `
    <div class="orb-content orb-now-content pause-menu-content">
      <h1 class="orb-title">Drag to Choose</h1>
    </div>
  `;
}

function restingContent(state) {
  const session = state.active;
  const timerExpired = Boolean(session?.timerExpiredAt);
  const isPlanned = Boolean(session?.endAt);
  const timer = timerExpired
    ? `+${formatElapsed(timerOvertimeMs(state))}`
    : isPlanned
      ? formatCountdown(remainingMs(state))
      : formatElapsed(elapsedMs(state));

  return `
    <div class="orb-content orb-now-content pause-resting-content">
      <p class="orb-time pause-countdown${timerExpired ? ' pause-timer-overtime' : ''}" data-pause-timer>${timer}</p>
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
  ensurePauseSymbolStyles();

  const shell = document.createElement('div');
  shell.className = `orb-shell orb-mode-${mode}`;
  shell.dataset.testid = 'orb';

  const orb = document.createElement('div');
  orb.className = 'orb';
  orb.setAttribute('role', 'button');
  orb.setAttribute('tabindex', '0');
  orb.setAttribute('aria-label', mode === 'resting'
    ? state.active?.timerExpiredAt
      ? `Timer done for ${state.active?.label || 'Rest'}. Rest is still running. End rest when you are ready.`
      : `Resting: ${state.active?.label || 'Rest'}. End rest when you are ready. Press and hold, drag to an option, then release to choose it.`
    : mode === 'menu'
      ? 'PAUSE radial menu. Keep holding, drag to an option, and release to select. Release elsewhere to cancel.'
      : 'Pause now. Tap to begin immediately. Press and hold, drag to an option, then release to choose it.');

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
        if (event.shiftKey) gestureHandlers.keyboardHold?.();
        else gestureHandlers.keyboardTap?.();
      }
    });
  }

  // This click remains as a keyboard/mouse accessibility escape. Pointer holds
  // normally close automatically on release when no radial option is chosen.
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
