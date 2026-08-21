import { findTimeConflict, fixedKindLabel } from '../state/lifeProfile.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function panelHeader(title, eyebrow = 'LIFE OS') {
  return `
    <div class="system-panel-header">
      <div>
        <p class="system-panel-eyebrow">${escapeHtml(eyebrow)}</p>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <button type="button" class="system-panel-close" data-system-action="close" aria-label="Close">×</button>
    </div>
  `;
}

function settingsHome() {
  return `
    ${panelHeader('Settings')}
    <div class="system-menu" role="list">
      <button type="button" class="system-menu-row" data-system-nav="activity-times">
        <span class="system-menu-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>
        </span>
        <span class="system-menu-copy">
          <strong>Edit Activity Times</strong>
          <small>Change the time of an existing activity.</small>
        </span>
        <span class="system-menu-chevron" aria-hidden="true">›</span>
      </button>

      <button type="button" class="system-menu-row system-menu-row-danger" data-system-nav="reset-confirm">
        <span class="system-menu-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M5 8a8 8 0 1 1-1 7"/><path d="M5 3v5h5"/></svg>
        </span>
        <span class="system-menu-copy">
          <strong>Reset Life Setup</strong>
          <small>Clear the current setup and start again.</small>
        </span>
        <span class="system-menu-chevron" aria-hidden="true">›</span>
      </button>

      <button type="button" class="system-menu-row" disabled aria-disabled="true">
        <span class="system-menu-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M10 5H5v14h5"/><path d="M14 8l4 4-4 4M8 12h10"/></svg>
        </span>
        <span class="system-menu-copy">
          <strong>Log Out</strong>
          <small>Available when account sign-in is connected.</small>
        </span>
      </button>
    </div>
  `;
}

function timeEditor(profile) {
  const fixed = profile.hasFixedSchedule
    ? `
      <div class="system-time-row">
        <div class="system-time-label">
          <strong>${escapeHtml(fixedKindLabel(profile.fixedKind))}</strong>
          <small>Fixed reality</small>
        </div>
        <div class="system-time-pair">
          <label><span>Start</span><span class="system-time-control"><input type="time" data-time-scope="fixed" data-time-field="start" value="${escapeHtml(profile.fixedStart)}"></span></label>
          <label><span>End</span><span class="system-time-control"><input type="time" data-time-scope="fixed" data-time-field="end" value="${escapeHtml(profile.fixedEnd)}"></span></label>
        </div>
      </div>
    `
    : '';

  const sleep = `
    <div class="system-time-row">
      <div class="system-time-label">
        <strong>Sleep</strong>
        <small>Protected recovery</small>
      </div>
      <div class="system-time-pair">
        <label><span>Start</span><span class="system-time-control"><input type="time" data-time-scope="sleep" data-time-field="start" value="${escapeHtml(profile.sleepStart)}"></span></label>
        <label><span>End</span><span class="system-time-control"><input type="time" data-time-scope="sleep" data-time-field="end" value="${escapeHtml(profile.sleepEnd)}"></span></label>
      </div>
    </div>
  `;

  const activities = profile.activities.map((activity) => `
    <div class="system-time-row">
      <div class="system-time-label">
        <strong>${escapeHtml(activity.name)}</strong>
        <small>Activity</small>
      </div>
      <div class="system-time-pair">
        <label><span>Start</span><span class="system-time-control"><input type="time" data-time-scope="activity" data-time-id="${escapeHtml(activity.id)}" data-time-field="start" value="${escapeHtml(activity.start)}"></span></label>
        <label><span>End</span><span class="system-time-control"><input type="time" data-time-scope="activity" data-time-id="${escapeHtml(activity.id)}" data-time-field="end" value="${escapeHtml(activity.end)}"></span></label>
      </div>
    </div>
  `).join('');

  return `
    ${panelHeader('Activity Times', 'SETTINGS')}
    <button type="button" class="system-panel-back" data-system-nav="settings">← Settings</button>
    <p class="system-panel-intro">Change only the timing. Your activity names and days stay the same.</p>
    <div class="system-time-list">
      ${fixed}
      ${sleep}
      ${activities}
    </div>
    <p class="system-form-error" data-system-error aria-live="polite"></p>
    <div class="system-panel-actions">
      <button type="button" class="system-primary-action" data-system-action="save-times">Save Changes</button>
    </div>
  `;
}

function resetConfirm() {
  return `
    ${panelHeader('Reset Life Setup', 'SETTINGS')}
    <div class="system-confirm">
      <div class="system-confirm-icon" aria-hidden="true">↻</div>
      <p>This clears your current LIFE OS setup on this device and takes you through Life Setup again.</p>
      <p class="system-confirm-note">This does not delete an account.</p>
      <div class="system-confirm-actions">
        <button type="button" class="system-secondary-action" data-system-nav="settings">Cancel</button>
        <button type="button" class="system-danger-action" data-system-action="reset">Reset Setup</button>
      </div>
    </div>
  `;
}

function infoContent() {
  return `
    ${panelHeader('About LIFE OS', 'INFO')}
    <div class="system-info-sections">
      <section>
        <h3>What LIFE OS is</h3>
        <p>LIFE OS is a personal operating system that understands your commitments, priorities, goals, and real-life capacity so it can help you decide what deserves your attention.</p>
      </section>
      <section>
        <h3>Creator Statement</h3>
        <p>LIFE OS began with a simple problem: a person can be busy all day and still neglect what matters most. It exists to help you direct your time, energy, and attention intentionally — not to squeeze more productivity out of every minute.</p>
      </section>
      <section>
        <h3>App Policy</h3>
        <p>The current V1 build stores your Life Setup in this browser on this device. A formal public privacy and app policy should be published before wider release.</p>
      </section>
      <section class="system-version-row">
        <h3>Version</h3>
        <p>LIFE OS V1</p>
      </section>
    </div>
  `;
}

function collectTimeChanges(root, profile) {
  const valueFor = (selector, fallback) => root.querySelector(selector)?.value || fallback;

  const next = {
    fixedStart: profile.fixedStart,
    fixedEnd: profile.fixedEnd,
    sleepStart: valueFor('[data-time-scope="sleep"][data-time-field="start"]', profile.sleepStart),
    sleepEnd: valueFor('[data-time-scope="sleep"][data-time-field="end"]', profile.sleepEnd),
    activities: profile.activities.map((activity) => ({
      ...activity,
      start: valueFor(`[data-time-scope="activity"][data-time-id="${CSS.escape(activity.id)}"][data-time-field="start"]`, activity.start),
      end: valueFor(`[data-time-scope="activity"][data-time-id="${CSS.escape(activity.id)}"][data-time-field="end"]`, activity.end)
    }))
  };

  if (profile.hasFixedSchedule) {
    next.fixedStart = valueFor('[data-time-scope="fixed"][data-time-field="start"]', profile.fixedStart);
    next.fixedEnd = valueFor('[data-time-scope="fixed"][data-time-field="end"]', profile.fixedEnd);
  }

  return next;
}

function hasInvalidTimeRange(next, profile) {
  if (!next.sleepStart || !next.sleepEnd || next.sleepStart === next.sleepEnd) return true;
  if (profile.hasFixedSchedule && (!next.fixedStart || !next.fixedEnd || next.fixedStart === next.fixedEnd)) return true;
  return next.activities.some((activity) => !activity.start || !activity.end || activity.start === activity.end);
}

function scheduleConflictMessage(next, profile) {
  const nextProfile = { ...profile, ...next };
  for (const activity of next.activities) {
    for (const day of activity.days) {
      const conflict = findTimeConflict(nextProfile, day, activity.start, activity.end, activity.id);
      if (conflict) return `${activity.name} overlaps ${conflict.label}. Choose another time.`;
    }
  }
  return '';
}

export function SystemPanel({ view = 'settings', profile, onClose, onNavigate, onSaveTimes, onReset }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'system-backdrop';

  const panel = document.createElement('section');
  panel.className = `system-panel system-view-${view}`;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', view === 'info' ? 'LIFE OS information' : 'LIFE OS settings');

  if (view === 'activity-times') panel.innerHTML = timeEditor(profile);
  else if (view === 'reset-confirm') panel.innerHTML = resetConfirm();
  else if (view === 'info') panel.innerHTML = infoContent();
  else panel.innerHTML = settingsHome();

  panel.querySelectorAll('[data-system-nav]').forEach((button) => {
    button.addEventListener('click', () => onNavigate?.(button.dataset.systemNav));
  });

  panel.querySelector('[data-system-action="close"]')?.addEventListener('click', () => onClose?.());
  panel.querySelector('[data-system-action="reset"]')?.addEventListener('click', () => onReset?.());
  panel.querySelector('[data-system-action="save-times"]')?.addEventListener('click', () => {
    const next = collectTimeChanges(panel, profile);
    const error = panel.querySelector('[data-system-error]');
    if (hasInvalidTimeRange(next, profile)) {
      if (error) error.textContent = 'Start and end times must be different.';
      return;
    }

    const conflictMessage = scheduleConflictMessage(next, profile);
    if (conflictMessage) {
      if (error) error.textContent = conflictMessage;
      return;
    }

    onSaveTimes?.(next);
  });

  backdrop.addEventListener('pointerdown', (event) => {
    if (event.target === backdrop) onClose?.();
  });

  backdrop.appendChild(panel);
  return backdrop;
}
