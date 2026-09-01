import {
  disablePausePushNotifications,
  enablePausePushNotifications,
  getPausePushState
} from '../pausePushClient.js';

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
    }

    button.pause-settings-row {
      appearance: none;
      cursor: pointer;
    }

    button.pause-settings-row:is(:hover, :focus-visible) {
      border-color: rgba(185, 142, 245, .34);
      background: rgba(91, 55, 147, .12);
      outline: none;
    }

    button.pause-settings-row:disabled {
      cursor: default;
      opacity: .82;
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

    .pause-settings-value {
      max-width: 112px;
      color: #9d8eab;
      font-size: .6rem;
      font-weight: 620;
      text-align: right;
      line-height: 1.25;
    }

    .pause-settings-value.is-on { color: #c9a8f5; }
    .pause-settings-value.is-blocked { color: #aa8999; }

    .pause-settings-notice {
      margin: 7px 2px 0;
      color: #8e8198;
      font-size: .6rem;
      line-height: 1.45;
    }

    .pause-settings-notice.is-error { color: #b58b9d; }

    .pause-settings-chevron {
      color: #695f73;
      font-size: 1rem;
    }

    .pause-settings-privacy-copy {
      display: none;
      margin: 8px 2px 0;
      padding: 13px 14px;
      border: 1px solid rgba(159, 119, 217, .1);
      border-radius: 13px;
      background: rgba(52, 32, 82, .05);
      color: #8f8498;
      font-size: .63rem;
      line-height: 1.55;
    }

    .pause-settings-privacy-copy.is-visible { display: block; }

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

function escapeSettingsHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function settingsIcon(name) {
  if (name === 'notifications') return '<svg viewBox="0 0 24 24"><path d="M7 16h10l-1.3-2.2V10a3.7 3.7 0 0 0-7.4 0v3.8L7 16Z"/><path d="M10 19h4"/></svg>';
  if (name === 'privacy') return '<svg viewBox="0 0 24 24"><path d="M12 3 5.5 6v5c0 4.2 2.6 7.4 6.5 9 3.9-1.6 6.5-4.8 6.5-9V6L12 3Z"/><path d="m9.5 12 1.7 1.7 3.5-4"/></svg>';
  return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8h.01"/></svg>';
}

async function updatePauseNotificationRow(panel) {
  const button = panel.querySelector('[data-settings-notifications]');
  const value = panel.querySelector('[data-settings-notification-value]');
  const notice = panel.querySelector('[data-settings-notification-notice]');
  if (!button || !value) return null;

  value.textContent = 'Checking…';
  button.disabled = true;
  let state;
  try {
    state = await getPausePushState();
  } catch {
    state = { status: 'unavailable', label: 'Unavailable', canEnable: false, canDisable: false };
  }

  value.textContent = state.label;
  value.className = `pause-settings-value ${state.status === 'on' ? 'is-on' : state.status === 'blocked' ? 'is-blocked' : ''}`.trim();
  button.disabled = !(state.canEnable || state.canDisable);
  button.dataset.notificationAction = state.canDisable ? 'disable' : 'enable';
  button.setAttribute('aria-label', state.canDisable
    ? 'Turn off PAUSE device notifications on this device'
    : state.canEnable
      ? 'Turn on PAUSE device notifications on this device'
      : `PAUSE device notifications: ${state.label}`);
  if (notice && !notice.classList.contains('is-error')) notice.textContent = '';
  return state;
}

export function PauseSettingsPanel({ email = '', onClose, onSignOut }) {
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
        <h2>App & account</h2>
      </div>
      <button type="button" class="pause-settings-close" data-settings-close aria-label="Close settings">×</button>
    </div>

    <p class="pause-settings-section-label">APP</p>
    <div class="pause-settings-list">
      <button type="button" class="pause-settings-row" data-settings-notifications>
        <span class="pause-settings-icon" aria-hidden="true">${settingsIcon('notifications')}</span>
        <span class="pause-settings-copy">
          <strong>Device Notifications</strong>
          <small>Connect this device to the nudges you chose in Recovery Plan.</small>
        </span>
        <span class="pause-settings-value" data-settings-notification-value>Checking…</span>
      </button>
      <p class="pause-settings-notice" data-settings-notification-notice></p>
    </div>

    <p class="pause-settings-section-label">ACCOUNT</p>
    <div class="pause-settings-account">
      <small>Signed in as</small>
      <strong>${escapeSettingsHtml(email || 'PAUSE account')}</strong>
      <button type="button" class="pause-settings-signout" data-settings-signout>Sign out</button>
    </div>

    <p class="pause-settings-section-label">ABOUT</p>
    <div class="pause-settings-list">
      <button type="button" class="pause-settings-row" data-settings-privacy aria-expanded="false">
        <span class="pause-settings-icon" aria-hidden="true">${settingsIcon('privacy')}</span>
        <span class="pause-settings-copy">
          <strong>Privacy & Data</strong>
          <small>See what PAUSE stores and what it does not track.</small>
        </span>
        <span class="pause-settings-chevron" aria-hidden="true">›</span>
      </button>
      <div class="pause-settings-privacy-copy" data-settings-privacy-copy>
        PAUSE stores your rest records and preferences under your PAUSE account and syncs them when cloud sync is available. Your Recovery Plan uses the schedule and commute estimates you enter. PAUSE does not use Recovery Plan to track your live location.
      </div>
      <div class="pause-settings-row">
        <span class="pause-settings-icon" aria-hidden="true">${settingsIcon('about')}</span>
        <span class="pause-settings-copy">
          <strong>PAUSE Version</strong>
          <small>Current app release.</small>
        </span>
        <span class="pause-settings-value">0.1.0</span>
      </div>
    </div>
  `;

  panel.querySelector('[data-settings-close]')?.addEventListener('click', () => onClose?.());
  panel.querySelector('[data-settings-signout]')?.addEventListener('click', () => onSignOut?.());

  const notificationButton = panel.querySelector('[data-settings-notifications]');
  notificationButton?.addEventListener('click', async () => {
    const notice = panel.querySelector('[data-settings-notification-notice]');
    notificationButton.disabled = true;
    if (notice) {
      notice.classList.remove('is-error');
      notice.textContent = notificationButton.dataset.notificationAction === 'disable'
        ? 'Turning notifications off…'
        : 'Connecting this device…';
    }

    try {
      if (notificationButton.dataset.notificationAction === 'disable') {
        await disablePausePushNotifications();
      } else {
        await enablePausePushNotifications();
      }
      if (notice) notice.textContent = '';
    } catch (error) {
      if (notice) {
        notice.classList.add('is-error');
        notice.textContent = String(error?.message || 'PAUSE could not change notifications on this device.');
      }
    }
    await updatePauseNotificationRow(panel);
  });

  const privacyButton = panel.querySelector('[data-settings-privacy]');
  const privacyCopy = panel.querySelector('[data-settings-privacy-copy]');
  privacyButton?.addEventListener('click', () => {
    const isVisible = privacyCopy?.classList.toggle('is-visible') === true;
    privacyButton.setAttribute('aria-expanded', isVisible ? 'true' : 'false');
    const chevron = privacyButton.querySelector('.pause-settings-chevron');
    if (chevron) chevron.textContent = isVisible ? '⌄' : '›';
  });

  backdrop.addEventListener('pointerdown', (event) => {
    if (event.target === backdrop) onClose?.();
  });

  void updatePauseNotificationRow(panel);
  backdrop.appendChild(panel);
  return backdrop;
}
