const MENU_ITEMS = [
  {
    id: 'timer',
    label: 'Timer',
    icon: 'timer'
  },
  {
    id: 'recovery',
    label: 'Recovery Plan',
    icon: 'recovery'
  },
  {
    id: 'insights',
    label: 'Rest Insights',
    icon: 'insights'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings'
  }
];

function ensurePauseOrbMenuStyles() {
  if (document.querySelector('#pause-orb-menu-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-orb-menu-style';
  style.textContent = `
    /* PAUSE's orb-stage is a zero-size center anchor, so the radial menu owns
       its own canvas around that anchor. */
    .pause-orb-menu {
      position: absolute;
      left: 0;
      top: 0;
      width: min(92vw, 430px);
      height: min(56svh, 460px);
      min-height: 340px;
      z-index: 6;
      pointer-events: none;
      transform: translate(-50%, -50%);
      animation: pause-menu-in 180ms ease both;
    }

    .is-pause-menu > .pause-hint {
      opacity: 0 !important;
      pointer-events: none !important;
    }

    .pause-menu-node {
      appearance: none;
      position: absolute;
      width: clamp(104px, 28vw, 124px);
      min-height: 52px;
      padding: 9px 10px;
      border: 1px solid rgba(173, 130, 235, .22);
      border-radius: 15px;
      background: linear-gradient(180deg, rgba(21, 13, 37, .92), rgba(9, 7, 17, .96));
      color: #eee8f5;
      box-shadow: 0 12px 30px rgba(0, 0, 0, .28), inset 0 0 22px rgba(105, 62, 176, .06);
      display: grid;
      grid-template-columns: 28px 1fr;
      align-items: center;
      gap: 8px;
      text-align: left;
      pointer-events: auto;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: transform 140ms ease, border-color 140ms ease, background 140ms ease, opacity 140ms ease;
    }

    /* Four destinations: clear quadrants around the ORB. */
    .pause-menu-node[data-menu-position="0"] { right: 0; bottom: 9%; }
    .pause-menu-node[data-menu-position="1"] { left: 0; bottom: 9%; }
    .pause-menu-node[data-menu-position="2"] { left: 0; top: 9%; }
    .pause-menu-node[data-menu-position="3"] { right: 0; top: 9%; }

    .pause-menu-node:is(:hover, :focus-visible, .is-drag-target) {
      border-color: rgba(198, 157, 255, .52);
      background: linear-gradient(180deg, rgba(64, 38, 105, .92), rgba(17, 10, 31, .96));
      outline: none;
      transform: scale(1.035);
    }

    .pause-menu-node:disabled {
      opacity: .38;
      cursor: default;
    }

    .pause-menu-node-icon {
      width: 28px;
      height: 28px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(182, 139, 246, .2);
      border-radius: 50%;
      color: #c9a5ff;
      background: rgba(105, 62, 176, .08);
    }

    .pause-menu-node-icon svg {
      width: 15px;
      height: 15px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.7;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .pause-menu-node-copy {
      min-width: 0;
      display: grid;
      align-items: center;
    }

    .pause-menu-node-copy strong {
      font-size: clamp(.68rem, 2.8vw, .78rem);
      font-weight: 590;
      line-height: 1.15;
    }

    @keyframes pause-menu-in {
      from { opacity: 0; transform: translate(-50%, -50%) scale(.97); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    @media (max-width: 380px), (max-height: 650px) {
      .pause-orb-menu {
        width: min(94vw, 360px);
        height: min(54svh, 390px);
        min-height: 320px;
      }

      .pause-menu-node {
        width: clamp(92px, 27vw, 106px);
        min-height: 48px;
        padding: 7px;
        grid-template-columns: 24px 1fr;
        gap: 6px;
      }

      .pause-menu-node-icon { width: 24px; height: 24px; }
      .pause-menu-node-icon svg { width: 13px; height: 13px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .pause-orb-menu { animation: none; }
      .pause-menu-node { transition: none; }
    }
  `;
  document.head.appendChild(style);
}

function iconSvg(name) {
  if (name === 'timer') return '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7"/><path d="M9 3h6M12 6v2M17 8l2-2M12 13l3-2"/></svg>';
  if (name === 'recovery') return '<svg viewBox="0 0 24 24"><path d="M5 16c2-6 5-9 10-10-1 5-4 8-10 10Z"/><path d="M6 17c3-1 6-3 9-7"/><path d="M5 17v3"/></svg>';
  if (name === 'insights') return '<svg viewBox="0 0 24 24"><path d="M5 18V9M10 18V5M15 18v-6M20 18V8"/></svg>';
  return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></svg>';
}

export function getPauseMenuItems({ active = false } = {}) {
  return MENU_ITEMS.map((item) => ({
    ...item,
    disabled: item.id === 'timer' && active
  }));
}

export function PauseOrbMenu({ active = false, onSelect }) {
  ensurePauseOrbMenuStyles();
  const nav = document.createElement('nav');
  nav.className = 'pause-orb-menu';
  nav.setAttribute('aria-label', 'PAUSE radial menu');

  getPauseMenuItems({ active }).forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pause-menu-node';
    button.dataset.pauseMenu = item.id;
    button.dataset.menuPosition = String(index);
    button.disabled = item.disabled;
    button.setAttribute('aria-label', item.disabled ? `${item.label}. Unavailable while resting.` : item.label);
    button.innerHTML = `
      <span class="pause-menu-node-icon" aria-hidden="true">${iconSvg(item.icon)}</span>
      <span class="pause-menu-node-copy"><strong>${item.label}</strong></span>
    `;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!item.disabled) onSelect?.(item.id);
    });
    nav.appendChild(button);
  });

  return nav;
}