function ensurePauseSettingsPanelStyles() {
  if (document.querySelector('#pause-settings-panel-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-settings-panel-style';
  style.textContent = `
    .pause-settings-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1200;
      display: grid;
      place-items: center;
      padding: max(18px, env(safe-area-inset-top)) 16px max(18px, env(safe-area-inset-bottom));
      background: rgba(2, 2, 7, .78);
      backdrop-filter: blur(16px);
    }

    .pause-settings-panel {
      width: min(100%, 410px);
      max-height: min(88svh, 700px);
      overflow: auto;
      border: 1px solid rgba(178, 134, 240, .2);
      border-radius: 25px;
      padding: 22px;
      background:
        radial-gradient(circle at 50% -10%, rgba(116, 70, 190, .16), transparent 38%),
        linear-gradient(180deg, rgba(18, 12, 30, .98), rgba(7, 5, 13, .99));
      box-shadow: 0 28px 78px rgba(0, 0, 0, .56);
    }

    .pause-settings-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 20px;
    }

    .pause-settings-header p {
      margin: 0 0 6px;
      color: #9985ad;
      font-size: .6rem;
      font-weight: 720;
      letter-spacing: .15em;
    }

    .pause-settings-header h2 {
      margin: 0;
      color: #f3edf8;
      font-size: 1.4rem;
      font-weight: 470;
      letter-spacing: -.02em;
    }

    .pause-settings-close {
      appearance: none;
      width: 34px;
      height: 34px;
      flex: 0 0 34px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(166, 125, 226, .17);
      border-radius: 50%;
      background: rgba(80, 47, 131, .08);
      color: #aaa0b3;
      font-size: 1rem;
      cursor: pointer;
    }

    .pause-settings-section-label {
      margin: 18px 4px 8px;
      color: #6f6678;
      font-size: .55rem;
      font-weight: 760;
      letter-spacing: .13em;
    }

    .pause-settings-list {
      display: grid;
      gap: 8px;
    }

    .pause-settings-row {
      appearance: none;
      width: 100%;
      min-height: 64px;
      display: grid;
      grid-template-columns: 36px 1fr auto;
      align-items: center;
      gap: 11px;
      padding: 11px 12px;
      border: 1px solid rgba(159, 119, 217, .13);
      border-radius: 14px;
      background: rgba(58, 36, 92, .055);
      color: #ece6f2;
      text-align: left;
      cursor: pointer;
    }

    .pause-settings-row:is(:hover, :focus-visible) {
      border-color: rgba(185, 142, 245, .34);
      background: rgba(91, 55, 147, .12);
      outline: none;
    }

    .pause-settings-icon {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(178, 135, 240, .17);
      border-radius: 11px;
      color: #bd94f5;
      background: rgba(102, 61, 166, .08);
    }

    .pause-settings-icon svg {
      width: 17px;
      height: 17px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.65;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .pause-settings-copy {
      min-width: 0;
      display: grid;
      gap: 3px;
    }

    .pause-settings-copy strong {
      color: #eee8f4;
      font-size: .78rem;
      font-weight: 590;
    }

    .pause-settings-copy small {
      color: #817789;
      font-size: .62rem;
      line-height: 1.35;
    }

    .pause-settings-chevron {
      color: #695f73;
      font-size: 1rem;
    }

    .pause-settings-account {
      margin-top: 8px;
      padding: 13px 14px;
      border: 1px solid rgba(159, 119, 217, .11);
      border-radius: 14px;
      background: rgba(58, 36, 92, .04);
    }

    .pause-settings-account small {
      display: block;
      color: #706877;
      font-size: .56rem;
      font-weight: 720;
      letter-spacing: .09em;
      text-transform: uppercase;
    }

    .pause-settings-account strong {
      display: block;
      margin-top: 5px;
      overflow: hidden;
      color: #dcd4e4;
      font-size: .7rem;
      font-weight: 520;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pause-settings-signout {
      appearance: none;
      width: 100%;
      min-height: 44px;
      margin-top: 10px;
      border: 1px solid rgba(194, 117, 165, .15);
      border-radius: 12px;
      background: rgba(96, 42, 72, .07);
      color: #b99baa;
      font-size: .68rem;
      cursor: pointer;
    }

    .pause-settings-signout:is(:hover, :focus-visible) {
      border-color: rgba(211, 136, 181, .3);
      color: #e0bdcf;
      outline: none;
    }
  `;
  document.head.appendChild(style);
}

function icon(name) {
  if (name === 'recovery') return '<svg viewBox="0 0 24 24"><path d="M5 16c2-6 5-9 10-10-1 5-4 8-10 10Z"/><path d="M6 17c3-1 6-3 9-7"/><path d="M5 17v3"/></svg>';
  if (name === 'nudges') return '<svg viewBox="0 0 24 24"><path d="M7 16h10l-1.3-2.2V10a3.7 3.7 0 0 0-7.4 0v3.8L7 16Z"/><path d="M10 19h4"/></svg>';
  return '<svg viewBox="0 0 24 24"><path d="M5 18V9M10 18V5M15 18v-6M20 18V8"/></svg>';
}

function settingsRow(id, title, detail, iconName) {
  return `
    <button type="button" class="pause-settings-row" data-pause-setting="${id}">
      <span class="pause-settings-icon" aria-hidden="true">${icon(iconName)}</span>
      <span class="pause-settings-copy">
        <strong>${title}</strong>
        <small>${detail}</small>
      </span>
      <span class="pause-settings-chevron" aria-hidden="true">›</span>
    </button>
  `;
}

export function PauseSettingsPanel({ email = '', onClose, onSelect, onSignOut }) {
  ensurePauseSettingsPanelStyles();
  const backdrop = document.createElement('div');
  backdrop.className = 'pause-settings-backdrop';

  const panel = document.createElement('section');
  panel.className = 'pause-settings-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'PAUSE settings');
  panel.innerHTML = `
    <div class="pause-settings-header">
      <div>
        <p>PAUSE SETTINGS</p>
        <h2>How PAUSE works for you</h2>
      </div>
      <button type="button" class="pause-settings-close" data-settings-close aria-label="Close settings">×</button>
    </div>

    <p class="pause-settings-section-label">RECOVERY</p>
    <div class="pause-settings-list">
      ${settingsRow('recovery', 'Recovery Plan', 'Change work days, shift, commute, wind-down, or protected recovery.', 'recovery')}
      ${settingsRow('nudges', 'Nudge Preferences', 'Choose exactly when PAUSE is allowed to interrupt you.', 'nudges')}
      ${settingsRow('insights', 'Rest Insights', 'Review your recorded rest patterns and history.', 'insights')}
    </div>

    <p class="pause-settings-section-label">ACCOUNT</p>
    <div class="pause-settings-account">
      <small>Signed in as</small>
      <strong>${email || 'PAUSE account'}</strong>
      <button type="button" class="pause-settings-signout" data-settings-signout>Sign out</button>
    </div>
  `;

  panel.querySelector('[data-settings-close]')?.addEventListener('click', () => onClose?.());
  panel.querySelectorAll('[data-pause-setting]').forEach((button) => {
    button.addEventListener('click', () => onSelect?.(button.dataset.pauseSetting));
  });
  panel.querySelector('[data-settings-signout]')?.addEventListener('click', () => onSignOut?.());

  backdrop.addEventListener('pointerdown', (event) => {
    if (event.target === backdrop) onClose?.();
  });

  backdrop.appendChild(panel);
  return backdrop;
}
