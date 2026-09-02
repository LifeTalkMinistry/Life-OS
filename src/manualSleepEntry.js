import { addManilaDays, manilaDateKeyToStartMs } from './manilaTime.js';
import { savePauseState } from './restState.js';

const MANUAL_SLEEP_MAX_MS = 24 * 60 * 60 * 1000;
let selectedDayKey = null;

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseAuditTitleDayKey(panel) {
  const title = String(panel?.querySelector('.system-panel-header h2')?.textContent || '').trim();
  const match = title.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})$/);
  if (!match) return null;
  const months = {
    January: 1,
    February: 2,
    March: 3,
    April: 4,
    May: 5,
    June: 6,
    July: 7,
    August: 8,
    September: 9,
    October: 10,
    November: 11,
    December: 12
  };
  return `${match[3]}-${pad2(months[match[1]])}-${pad2(match[2])}`;
}

function manilaDateTimeMs(dateKey, timeValue) {
  const start = manilaDateKeyToStartMs(dateKey);
  const match = String(timeValue || '').match(/^(\d{2}):(\d{2})$/);
  if (!Number.isFinite(start) || !match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
  return start + hours * 3_600_000 + minutes * 60_000;
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.round(Number(ms || 0) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function sessionWindow(entry = {}) {
  const startAt = Number(entry.startAt ?? entry.endedAt);
  if (!Number.isFinite(startAt)) return null;
  const explicitEnd = Number(entry.endedAt);
  const durationMs = Math.max(0, Number(entry.durationMs || entry.sessionDurationMs || 0));
  const endedAt = Number.isFinite(explicitEnd) && explicitEnd >= startAt
    ? explicitEnd
    : startAt + durationMs;
  if (!Number.isFinite(endedAt) || endedAt < startAt) return null;
  return { startAt, endedAt };
}

function overlapsExisting(history, startAt, endedAt) {
  return (Array.isArray(history) ? history : []).some((entry) => {
    const window = sessionWindow(entry);
    if (!window) return false;
    return window.endedAt > startAt && window.startAt < endedAt;
  });
}

function ensureStyles() {
  if (document.querySelector('#pause-manual-sleep-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-manual-sleep-style';
  style.textContent = `
    .pause-manual-sleep {
      margin: 20px 0 2px;
      padding: 15px 16px;
      border: 1px solid rgba(164, 121, 226, .15);
      border-radius: 15px;
      background: rgba(20, 12, 40, .28);
    }

    .pause-manual-sleep-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }

    .pause-manual-sleep-copy {
      min-width: 0;
    }

    .pause-manual-sleep-copy strong {
      display: block;
      color: #dcd3e7;
      font-size: .72rem;
      font-weight: 650;
      letter-spacing: .08em;
    }

    .pause-manual-sleep-copy p {
      margin: 5px 0 0;
      color: #81798a;
      font-size: .65rem;
      line-height: 1.45;
    }

    .pause-manual-sleep-toggle {
      appearance: none;
      flex: 0 0 auto;
      min-height: 36px;
      padding: 0 11px;
      border: 1px solid rgba(177, 135, 247, .24);
      border-radius: 9px;
      background: rgba(105, 67, 186, .14);
      color: #e5dbef;
      font-size: .58rem;
      font-weight: 700;
      letter-spacing: .07em;
      cursor: pointer;
    }

    .pause-manual-sleep-toggle:hover,
    .pause-manual-sleep-toggle:focus-visible {
      border-color: rgba(185, 143, 250, .4);
      background: rgba(111, 70, 193, .22);
      color: #f4edf9;
      outline: none;
    }

    .pause-manual-sleep-form {
      display: grid;
      gap: 11px;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid rgba(155, 120, 219, .11);
    }

    .pause-manual-sleep-form[hidden] { display: none; }

    .pause-manual-sleep-fieldset {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 9px;
    }

    .pause-manual-sleep-field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .pause-manual-sleep-field > span {
      color: #81788a;
      font-size: .56rem;
      font-weight: 650;
      letter-spacing: .09em;
    }

    .pause-manual-sleep-field input {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      min-height: 42px;
      padding: 0 8px;
      border: 1px solid rgba(163, 121, 226, .2);
      border-radius: 9px;
      background: rgba(12, 8, 24, .76);
      color: #eee7f5;
      color-scheme: dark;
      font: inherit;
      font-size: .68rem;
      outline: none;
    }

    .pause-manual-sleep-field input:focus {
      border-color: rgba(181, 135, 246, .42);
    }

    .pause-manual-sleep-duration {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 0;
      border-top: 1px solid rgba(150, 115, 203, .09);
      border-bottom: 1px solid rgba(150, 115, 203, .09);
      color: #91889a;
      font-size: .64rem;
    }

    .pause-manual-sleep-duration strong {
      color: #c6a8f5;
      font-size: .76rem;
      font-weight: 560;
    }

    .pause-manual-sleep-note {
      margin: 0;
      color: #756c7e;
      font-size: .62rem;
      line-height: 1.45;
    }

    .pause-manual-sleep-error {
      min-height: 1em;
      margin: 0;
      color: #c39bc9;
      font-size: .63rem;
      line-height: 1.4;
    }

    .pause-manual-sleep-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .pause-manual-sleep-cancel,
    .pause-manual-sleep-save {
      appearance: none;
      min-height: 38px;
      padding: 0 13px;
      border-radius: 10px;
      font-size: .61rem;
      font-weight: 700;
      letter-spacing: .07em;
      cursor: pointer;
    }

    .pause-manual-sleep-cancel {
      border: 1px solid rgba(153, 119, 202, .15);
      background: transparent;
      color: #968d9f;
    }

    .pause-manual-sleep-save {
      border: 1px solid rgba(182, 138, 248, .28);
      background: rgba(105, 65, 184, .2);
      color: #e9dff4;
    }

    .pause-manual-sleep-cancel:hover,
    .pause-manual-sleep-cancel:focus-visible,
    .pause-manual-sleep-save:hover,
    .pause-manual-sleep-save:focus-visible {
      outline: none;
      border-color: rgba(184, 139, 249, .4);
      color: #f3ecf8;
    }

    @media (max-width: 390px) {
      .pause-manual-sleep-head { align-items: flex-start; }
      .pause-manual-sleep-fieldset { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}

function auditPanel() {
  const panel = document.querySelector('.pause-view-insights');
  if (!panel) return null;
  const eyebrow = String(panel.querySelector('.system-panel-eyebrow')?.textContent || '').trim();
  return eyebrow.startsWith('DAILY AUDIT') ? panel : null;
}

function currentDayKey(panel) {
  return selectedDayKey || parseAuditTitleDayKey(panel);
}

function manualMarkup(dayKey) {
  const nextDayKey = addManilaDays(dayKey, 1);
  return `
    <div class="pause-manual-sleep-head">
      <div class="pause-manual-sleep-copy">
        <strong>MISSED SLEEP?</strong>
        <p>Forgot to track it? Add the real sleep and wake time for this day.</p>
      </div>
      <button type="button" class="pause-manual-sleep-toggle" data-manual-sleep-toggle>ADD SLEEP</button>
    </div>
    <form class="pause-manual-sleep-form" data-manual-sleep-form hidden>
      <div class="pause-manual-sleep-fieldset">
        <label class="pause-manual-sleep-field">
          <span>SLEEP START · DATE</span>
          <input type="date" name="startDate" value="${dayKey}">
        </label>
        <label class="pause-manual-sleep-field">
          <span>SLEEP START · TIME</span>
          <input type="time" name="startTime" required>
        </label>
      </div>
      <div class="pause-manual-sleep-fieldset">
        <label class="pause-manual-sleep-field">
          <span>WAKE TIME · DATE</span>
          <input type="date" name="endDate" value="${dayKey}" min="${dayKey}" max="${nextDayKey}">
        </label>
        <label class="pause-manual-sleep-field">
          <span>WAKE TIME · TIME</span>
          <input type="time" name="endTime" required>
        </label>
      </div>
      <div class="pause-manual-sleep-duration">
        <span>Sleep duration</span>
        <strong data-manual-sleep-duration>—</strong>
      </div>
      <p class="pause-manual-sleep-note">Exact times keep cross-midnight sleep credited to the correct Manila calendar day.</p>
      <p class="pause-manual-sleep-error" data-manual-sleep-error aria-live="polite"></p>
      <div class="pause-manual-sleep-actions">
        <button type="button" class="pause-manual-sleep-cancel" data-manual-sleep-cancel>CANCEL</button>
        <button type="submit" class="pause-manual-sleep-save">SAVE SLEEP</button>
      </div>
    </form>
  `;
}

function valuesFromForm(form) {
  const data = new FormData(form);
  const startDate = String(data.get('startDate') || '');
  const startTime = String(data.get('startTime') || '');
  const endDate = String(data.get('endDate') || '');
  const endTime = String(data.get('endTime') || '');
  const startAt = manilaDateTimeMs(startDate, startTime);
  const endedAt = manilaDateTimeMs(endDate, endTime);
  return { startDate, startTime, endDate, endTime, startAt, endedAt };
}

function updateDuration(form) {
  const durationNode = form.querySelector('[data-manual-sleep-duration]');
  if (!durationNode) return;
  const { startAt, endedAt } = valuesFromForm(form);
  durationNode.textContent = Number.isFinite(startAt) && Number.isFinite(endedAt) && endedAt > startAt
    ? formatDuration(endedAt - startAt)
    : '—';
}

function reopenAudit(dayKey) {
  window.__PAUSE__?.openInsights?.();
  queueMicrotask(() => {
    const dayButton = document.querySelector(`.pause-view-insights [data-pause-day-key="${dayKey}"]`);
    dayButton?.click();
  });
}

function saveManualSleep(form, panel, dayKey) {
  const error = form.querySelector('[data-manual-sleep-error]');
  if (error) error.textContent = '';

  const { startAt, endedAt } = valuesFromForm(form);
  if (!Number.isFinite(startAt) || !Number.isFinite(endedAt)) {
    if (error) error.textContent = 'Choose both the sleep and wake times.';
    return;
  }
  if (endedAt <= startAt) {
    if (error) error.textContent = 'Wake time must be after sleep start.';
    return;
  }
  if (endedAt - startAt > MANUAL_SLEEP_MAX_MS) {
    if (error) error.textContent = 'A manual sleep entry can be up to 24 hours.';
    return;
  }
  if (endedAt > Date.now()) {
    if (error) error.textContent = 'Wake time cannot be in the future.';
    return;
  }

  const dayStart = manilaDateKeyToStartMs(dayKey);
  const dayEnd = manilaDateKeyToStartMs(addManilaDays(dayKey, 1));
  if (!Number.isFinite(dayStart) || !Number.isFinite(dayEnd) || endedAt <= dayStart || startAt >= dayEnd) {
    if (error) error.textContent = 'These times do not overlap the day you are auditing.';
    return;
  }

  const pause = window.__PAUSE__?.getState?.();
  const state = pause?.pauseState;
  if (!state) {
    if (error) error.textContent = 'PAUSE could not access your rest history. Please try again.';
    return;
  }

  if (overlapsExisting(state.history, startAt, endedAt)) {
    if (error) error.textContent = 'This overlaps an existing rest entry. Edit that entry instead so the same sleep is not counted twice.';
    return;
  }

  const createdAt = Date.now();
  const entry = {
    id: `manual-sleep-${createdAt}`,
    label: 'Sleep',
    plannedMinutes: null,
    timerExpiredAt: null,
    startAt,
    endedAt,
    durationMs: endedAt - startAt,
    reason: 'manual-entry',
    manuallyAdded: true,
    addedAt: createdAt
  };

  const history = [entry, ...(Array.isArray(state.history) ? state.history : [])]
    .sort((a, b) => Number(b?.endedAt ?? b?.startAt ?? 0) - Number(a?.endedAt ?? a?.startAt ?? 0))
    .slice(0, 500);

  savePauseState({ ...state, history });
  selectedDayKey = dayKey;
  reopenAudit(dayKey);
}

function bindManualSection(root, panel, dayKey) {
  const toggle = root.querySelector('[data-manual-sleep-toggle]');
  const form = root.querySelector('[data-manual-sleep-form]');
  const cancel = root.querySelector('[data-manual-sleep-cancel]');
  if (!toggle || !form) return;

  toggle.addEventListener('click', () => {
    form.hidden = false;
    toggle.hidden = true;
    form.querySelector('input[name="startTime"]')?.focus();
  });

  cancel?.addEventListener('click', () => {
    form.reset();
    form.querySelector('input[name="startDate"]').value = dayKey;
    form.querySelector('input[name="endDate"]').value = dayKey;
    updateDuration(form);
    form.querySelector('[data-manual-sleep-error]').textContent = '';
    form.hidden = true;
    toggle.hidden = false;
  });

  form.addEventListener('input', () => updateDuration(form));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveManualSleep(form, panel, dayKey);
  });
}

function scanAudit() {
  const panel = auditPanel();
  if (!panel || panel.querySelector('[data-manual-sleep-root]')) return;
  const dayKey = currentDayKey(panel);
  if (!dayKey) return;

  ensureStyles();
  const root = document.createElement('section');
  root.className = 'pause-manual-sleep';
  root.dataset.manualSleepRoot = '';
  root.innerHTML = manualMarkup(dayKey);

  const breakdownTitle = [...panel.querySelectorAll('.pause-insight-section-title')]
    .find((node) => String(node.textContent || '').trim() === 'REST BREAKDOWN');
  const breakdownSection = breakdownTitle?.closest('.pause-insight-section');
  const summary = panel.querySelector('.pause-audit-summary');

  if (breakdownSection) breakdownSection.insertAdjacentElement('beforebegin', root);
  else if (summary) summary.insertAdjacentElement('afterend', root);
  else return;

  bindManualSection(root, panel, dayKey);
}

function queueScan() {
  queueMicrotask(scanAudit);
}

export function initializeManualSleepEntry() {
  if (typeof document === 'undefined') return;

  document.addEventListener('click', (event) => {
    const dayButton = event.target.closest?.('[data-pause-day-key]');
    if (dayButton?.dataset.pauseDayKey) selectedDayKey = dayButton.dataset.pauseDayKey;

    const historyButton = event.target.closest?.('[data-pause-history-day-key]');
    if (historyButton?.dataset.pauseHistoryDayKey) selectedDayKey = historyButton.dataset.pauseHistoryDayKey;

    queueScan();
  });

  window.addEventListener('pause:insights-opened', queueScan);
  queueScan();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initializeManualSleepEntry();
}
