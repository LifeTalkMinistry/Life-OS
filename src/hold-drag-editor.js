import { activityIconOptions } from './activity-icons.js';
import {
  LIFE_PROFILE_STORAGE_KEY,
  findTimeConflict,
  fixedKindLabel,
  normalizeLifeProfile
} from './state/lifeProfile.js';

/* Focused editor opened by releasing the hold-drag gesture on an activity.
 * In the production bundle this file shares app scope and can update LIFE OS
 * immediately. In unbundled module development it falls back to persisting
 * the profile and reloading once, keeping the behavior functional there too.
 */
let holdEditBackdrop = null;

function holdEditEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function holdEditCurrentProfile() {
  return window.__LIFE_OS__?.getState?.().lifeProfile ?? null;
}

function holdEditResolve(profile, activityId) {
  if (!profile) return null;

  if (activityId === 'sleep') {
    return {
      id: 'sleep',
      type: 'sleep',
      name: 'Sleep',
      icon: 'sleep',
      start: profile.sleepStart,
      end: profile.sleepEnd,
      editableName: false,
      eyebrow: 'PROTECTED RECOVERY'
    };
  }

  if (activityId === 'fixed-schedule') {
    return {
      id: 'fixed-schedule',
      type: 'fixed',
      name: fixedKindLabel(profile.fixedKind),
      icon: 'work',
      start: profile.fixedStart,
      end: profile.fixedEnd,
      editableName: false,
      eyebrow: 'FIXED REALITY'
    };
  }

  const activity = profile.activities.find((item) => item.id === activityId);
  if (!activity) return null;

  return {
    id: activity.id,
    type: 'activity',
    name: activity.name,
    icon: activity.icon || 'general',
    start: activity.start,
    end: activity.end,
    editableName: true,
    eyebrow: 'ACTIVITY'
  };
}

function holdEditIconOptions(selected) {
  return activityIconOptions.map((option) => `
    <option value="${holdEditEscape(option.id)}"${option.id === selected ? ' selected' : ''}>${holdEditEscape(option.label)}</option>
  `).join('');
}

function holdEditMarkup(item) {
  const nameControl = item.editableName
    ? `<input class="hold-edit-input" type="text" maxlength="48" value="${holdEditEscape(item.name)}" data-hold-edit-name aria-label="Activity name">`
    : `<input class="hold-edit-input" type="text" value="${holdEditEscape(item.name)}" disabled aria-label="Activity name">`;

  const iconControl = item.type === 'activity'
    ? `
      <label class="hold-edit-field">
        <span>Icon</span>
        <select class="hold-edit-select" data-hold-edit-icon aria-label="Activity icon">
          ${holdEditIconOptions(item.icon)}
        </select>
      </label>
    `
    : '';

  return `
    <section class="hold-edit-panel" role="dialog" aria-modal="true" aria-label="Edit ${holdEditEscape(item.name)}">
      <header class="hold-edit-header">
        <div>
          <p>${holdEditEscape(item.eyebrow)}</p>
          <h2>Edit ${holdEditEscape(item.name)}</h2>
        </div>
        <button type="button" class="hold-edit-close" data-hold-edit-close aria-label="Close">×</button>
      </header>

      <div class="hold-edit-fields">
        <label class="hold-edit-field">
          <span>Name</span>
          ${nameControl}
        </label>
        ${iconControl}
        <div class="hold-edit-time-grid">
          <label class="hold-edit-field">
            <span>Start</span>
            <input class="hold-edit-input" type="time" value="${holdEditEscape(item.start)}" data-hold-edit-start aria-label="Start time">
          </label>
          <label class="hold-edit-field">
            <span>End</span>
            <input class="hold-edit-input" type="time" value="${holdEditEscape(item.end)}" data-hold-edit-end aria-label="End time">
          </label>
        </div>
      </div>

      <p class="hold-edit-error" data-hold-edit-error aria-live="polite"></p>
      <div class="hold-edit-actions">
        <button type="button" class="hold-edit-cancel" data-hold-edit-close>Cancel</button>
        <button type="button" class="hold-edit-save" data-hold-edit-save>Save changes</button>
      </div>
    </section>
  `;
}

function holdEditClose() {
  holdEditBackdrop?.remove();
  holdEditBackdrop = null;
}

function holdEditConflictMessage(nextProfile) {
  for (const activity of nextProfile.activities) {
    for (const day of activity.days) {
      const conflict = findTimeConflict(nextProfile, day, activity.start, activity.end, activity.id);
      if (conflict) return `${activity.name} overlaps ${conflict.label}. Choose another time.`;
    }
  }
  return '';
}

function holdEditBuildProfile(profile, item, values) {
  if (item.type === 'sleep') {
    return normalizeLifeProfile({
      ...profile,
      setupComplete: true,
      sleepStart: values.start,
      sleepEnd: values.end
    });
  }

  if (item.type === 'fixed') {
    return normalizeLifeProfile({
      ...profile,
      setupComplete: true,
      fixedStart: values.start,
      fixedEnd: values.end
    });
  }

  return normalizeLifeProfile({
    ...profile,
    setupComplete: true,
    activities: profile.activities.map((activity) => activity.id === item.id
      ? {
          ...activity,
          name: values.name,
          icon: values.icon,
          start: values.start,
          end: values.end
        }
      : activity)
  });
}

function holdEditApplyProfile(nextProfile) {
  try {
    localStorage.setItem(LIFE_PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
  } catch {}

  const canReachBundledAppScope =
    typeof lifeProfile !== 'undefined'
    && typeof createLifeStateFromProfile === 'function'
    && typeof render === 'function';

  if (canReachBundledAppScope) {
    lifeProfile = nextProfile;
    hasCompletedSetup = true;
    lifeState = createLifeStateFromProfile(lifeProfile);
    screen = 'now';
    orbMode = 'now';
    whyOpen = false;
    systemView = null;
    hintVisible = true;
    render();
    return;
  }

  window.location.reload();
}

function holdEditSave(item, profile, panel) {
  const error = panel.querySelector('[data-hold-edit-error]');
  const name = item.editableName
    ? panel.querySelector('[data-hold-edit-name]')?.value.trim() || ''
    : item.name;
  const icon = panel.querySelector('[data-hold-edit-icon]')?.value || item.icon;
  const start = panel.querySelector('[data-hold-edit-start]')?.value || '';
  const end = panel.querySelector('[data-hold-edit-end]')?.value || '';

  if (!name) {
    if (error) error.textContent = 'Give this activity a name.';
    return;
  }
  if (!start || !end || start === end) {
    if (error) error.textContent = 'Start and end times must be different.';
    return;
  }

  const nextProfile = holdEditBuildProfile(profile, item, { name, icon, start, end });
  const conflict = holdEditConflictMessage(nextProfile);
  if (conflict) {
    if (error) error.textContent = conflict;
    return;
  }

  holdEditClose();
  holdEditApplyProfile(nextProfile);
}

function holdEditOpen(activityId) {
  holdEditClose();

  const profile = holdEditCurrentProfile();
  const item = holdEditResolve(profile, activityId);
  if (!profile || !item) return;

  /* Activity selection exits the temporary Today peek before presenting the
   * persistent edit surface. */
  document.querySelector('.main-screen.is-today .orb')?.click();

  const backdrop = document.createElement('div');
  backdrop.className = 'hold-edit-backdrop';
  backdrop.innerHTML = holdEditMarkup(item);
  holdEditBackdrop = backdrop;

  const panel = backdrop.querySelector('.hold-edit-panel');
  panel?.querySelectorAll('[data-hold-edit-close]').forEach((button) => {
    button.addEventListener('click', holdEditClose);
  });
  panel?.querySelector('[data-hold-edit-save]')?.addEventListener('click', () => {
    holdEditSave(item, profile, panel);
  });

  backdrop.addEventListener('pointerdown', (event) => {
    if (event.target === backdrop) holdEditClose();
  });

  document.body.appendChild(backdrop);
  panel?.querySelector(item.editableName ? '[data-hold-edit-name]' : '[data-hold-edit-start]')?.focus();
}

document.addEventListener('life-os:activity-edit', (event) => {
  const activityId = event.detail?.activityId;
  if (activityId) holdEditOpen(activityId);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && holdEditBackdrop) holdEditClose();
});
