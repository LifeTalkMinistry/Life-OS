import { OrbArtwork } from './OrbArtwork.js';
import { formatCountdown, remainingMs } from '../restState.js';

const MENU_ITEMS = [
  ['take-rest', 'Take a Rest'],
  ['history', 'Rest History'],
  ['insights', 'Rest Insights'],
  ['my-rests', 'My Rests']
];

function ensureOrbMenuStyles() {
  if (document.querySelector('#pause-orb-menu-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-orb-menu-style';
  style.textContent = `
    .pause-idle-content,
    .pause-menu-content {
      width: 84%;
      display: grid;
      justify-items: center;
    }

    .pause-idle-content .orb-kicker,
    .pause-menu-content .orb-kicker {
      margin-bottom: 7px;
    }

    .pause-idle-content .orb-title,
    .pause-menu-content .orb-title {
      font-size: clamp(1.28rem, 6vw, 2rem);
      line-height: 1.02;
    }

    .pause-idle-content .orb-divider,
    .pause-menu-content .orb-divider {
      width: 68%;
      margin: 12px auto 5px;
    }

    .pause-orb-menu {
      width: 92%;
      height: clamp(80px, 27vw, 108px);
      overflow: hidden;
      mask-image: linear-gradient(to bottom, transparent 0, #000 13%, #000 87%, transparent 100%);
      -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 13%, #000 87%, transparent 100%);
    }

    .pause-orb-menu-scroller {
      width: 100%;
      height: 100%;
      overflow-y: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      scroll-snap-type: y proximity;
      touch-action: pan-y;
      padding: 7px 0;
    }

    .pause-orb-menu-scroller::-webkit-scrollbar {
      display: none;
    }

    .pause-orb-menu-item {
      appearance: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 34px;
      padding: 5px 8px;
      border: 0;
      border-bottom: 1px solid rgba(181, 139, 255, .14);
      background: transparent;
      color: #e8e1ef;
      font-size: clamp(.66rem, 2.9vw, .82rem);
      font-weight: 450;
      letter-spacing: .025em;
      text-align: center;
      cursor: pointer;
      scroll-snap-align: center;
    }

    .pause-orb-menu-item:last-child {
      border-bottom: 0;
    }

    .pause-orb-menu-item:hover,
    .pause-orb-menu-item:focus-visible {
      color: #fff;
      background: rgba(126, 80, 208, .13);
      outline: none;
    }

    @media (max-width: 360px), (max-height: 640px) {
      .pause-idle-content .orb-title,
      .pause-menu-content .orb-title {
        font-size: clamp(1.18rem, 5.6vw, 1.72rem);
      }
      .pause-idle-content .orb-divider,
      .pause-menu-content .orb-divider {
        margin: 9px auto 3px;
      }
      .pause-orb-menu {
        height: clamp(72px, 25vw, 92px);
      }
      .pause-orb-menu-item {
        min-height: 30px;
        padding-block: 4px;
        font-size: clamp(.62rem, 2.7vw, .76rem);
      }
    }
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function menuMarkup() {
  return `
    <nav class="pause-orb-menu" aria-label="PAUSE main menu">
      <div class="pause-orb-menu-scroller">
        ${MENU_ITEMS.map(([id, label]) => `<button type="button" class="pause-orb-menu-item" data-pause-menu="${id}">${label}</button>`).join('')}
      </div>
    </nav>
  `;
}

function idleContent() {
  return `
    <div class="orb-content orb-now-content pause-idle-content">
      <p class="orb-kicker">PAUSE</p>
      <h1 class="orb-title">READY TO<br>REST?</h1>
      <span class="orb-divider" aria-hidden="true"><i></i></span>
      ${menuMarkup()}
    </div>
  `;
}

function menuContent() {
  return `
    <div class="orb-content orb-now-content pause-menu-content">
      <p class="orb-kicker">PAUSE</p>
      <h1 class="orb-title">PAUSE<br>MENU</h1>
      <span class="orb-divider" aria-hidden="true"><i></i></span>
      ${menuMarkup()}
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
  ensureOrbMenuStyles();

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
      ? 'PAUSE menu. Swipe the actions inside the orb or tap the orb to close.'
      : 'PAUSE. Swipe the actions inside the orb or tap the orb to take a rest.');

  if (mode === 'resting') orb.innerHTML = restingContent(state);
  else if (mode === 'completed') orb.innerHTML = completedContent();
  else if (mode === 'menu') orb.innerHTML = menuContent();
  else orb.innerHTML = idleContent();

  const menuScroller = orb.querySelector('.pause-orb-menu-scroller');
  menuScroller?.addEventListener('pointerdown', (event) => event.stopPropagation());
  menuScroller?.addEventListener('pointerup', (event) => event.stopPropagation());
  menuScroller?.addEventListener('click', (event) => event.stopPropagation());

  orb.querySelectorAll('[data-pause-menu]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onAction?.(`menu:${button.dataset.pauseMenu}`);
    });
  });

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
      if (event.target.closest('button')) return;
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
