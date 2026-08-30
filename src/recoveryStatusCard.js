import {
  addManilaDays,
  formatManilaDate,
  manilaDateKey,
  manilaDateKeyToStartMs,
  parseManilaDateKey
} from './manilaTime.js';
import { restAuditForDay } from './restState.js';

export const RECOVERY_DAILY_TARGET_MS = 7 * 60 * 60 * 1000;

const panelSelections = new WeakMap();
let recoveryObserver = null;
let scanQueued = false;

function normalizedRange(startKey, endKey, now = Date.now()) {
  const todayKey = manilaDateKey(now);
  const parsedStart = parseManilaDateKey(startKey)?.key;
  const parsedEnd = parseManilaDateKey(endKey)?.key;
  if (!parsedStart || !parsedEnd) return null;

  const first = parsedStart <= parsedEnd ? parsedStart : parsedEnd;
  const requestedLast = parsedStart <= parsedEnd ? parsedEnd : parsedStart;
  const last = requestedLast > todayKey ? todayKey : requestedLast;
  if (first > last) return null;
  return { startKey: first, endKey: last };
}

function firstRecordedRestDayKey(state, now = Date.now()) {
  const todayKey = manilaDateKey(now);
  let firstKey = null;

  for (const entry of Array.isArray(state?.history) ? state.history : []) {
    const startAt = Number(entry?.startAt);
    const endedAt = Number(entry?.endedAt);
    const timestamp = Number.isFinite(startAt) ? startAt : endedAt;
    if (!Number.isFinite(timestamp)) continue;

    const key = manilaDateKey(timestamp);
    if (key > todayKey) continue;
    if (!firstKey || key < firstKey) firstKey = key;
  }

  return firstKey;
}

export function recoveryRangeForDays(days = 7, now = Date.now()) {
  const count = Math.max(1, Math.round(Number(days) || 7));
  const endKey = manilaDateKey(now);
  return {
    startKey: addManilaDays(endKey, -(count - 1)),
    endKey
  };
}

export function buildRecoverySummary(
  state,
  startKey,
  endKey,
  now = Date.now(),
  dailyTargetMs = RECOVERY_DAILY_TARGET_MS
) {
  const range = normalizedRange(startKey, endKey, now);
  if (!range) {
    return {
      startKey: null,
      endKey: null,
      observedStartKey: null,
      observedEndKey: null,
      days: 0,
      totalMs: 0,
      targetMs: 0,
      averageMs: 0,
      differenceMs: 0,
      progressPct: 0
    };
  }

  const firstTrackedKey = firstRecordedRestDayKey(state, now);
  if (!firstTrackedKey || firstTrackedKey > range.endKey) {
    return {
      ...range,
      observedStartKey: null,
      observedEndKey: null,
      days: 0,
      totalMs: 0,
      targetMs: 0,
      averageMs: 0,
      differenceMs: 0,
      progressPct: 0
    };
  }

  // A selected window may reach further back than PAUSE has actual history.
  // Do not penalize the user for days before their first recorded rest.
  // Once tracking has begun, every calendar day counts, including a zero-rest day.
  const observedStartKey = firstTrackedKey > range.startKey ? firstTrackedKey : range.startKey;
  const observedEndKey = range.endKey;

  let totalMs = 0;
  let days = 0;
  for (
    let cursorKey = observedStartKey;
    cursorKey && cursorKey <= observedEndKey;
    cursorKey = addManilaDays(cursorKey, 1)
  ) {
    totalMs += restAuditForDay(state, cursorKey, now).totalMs;
    days += 1;
  }

  const targetPerDay = Math.max(0, Number(dailyTargetMs || 0));
  const targetMs = days * targetPerDay;
  const averageMs = days ? totalMs / days : 0;
  const differenceMs = totalMs - targetMs;
  const progressPct = targetMs > 0 ? (totalMs / targetMs) * 100 : 0;

  return {
    ...range,
    observedStartKey,
    observedEndKey,
    days,
    totalMs,
    targetMs,
    averageMs,
    differenceMs,
    progressPct
  };
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.round(Number(ms || 0) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) return `${minutes}m`;
  const hoursText = hours.toLocaleString('en-US');
  return minutes ? `${hoursText}h ${minutes}m` : `${hoursText}h`;
}

function rangeCaption(startKey, endKey) {
  const startMs = manilaDateKeyToStartMs(startKey);
  const endMs = manilaDateKeyToStartMs(endKey);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return '';

  if (startKey === endKey) {
    return formatManilaDate(startMs, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const startYear = String(startKey).slice(0, 4);
  const endYear = String(endKey).slice(0, 4);
  if (startYear === endYear) {
    const start = formatManilaDate(startMs, { month: 'short', day: 'numeric' });
    const end = formatManilaDate(endMs, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} – ${end}`;
  }

  const start = formatManilaDate(startMs, { month: 'short', day: 'numeric', year: 'numeric' });
  const end = formatManilaDate(endMs, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${start} – ${end}`;
}

function selectedRange(selection, now = Date.now()) {
  if (selection.mode === 'custom') {
    return normalizedRange(selection.customStart, selection.customEnd, now) || recoveryRangeForDays(7, now);
  }
  return recoveryRangeForDays(selection.days, now);
}

function selectorLabel(selection) {
  if (selection.mode === 'custom') return 'CUSTOM RANGE';
  if (selection.days === 1) return 'TODAY';
  return `LAST ${selection.days} DAYS`;
}

function ensureRecoveryStyles() {
  if (document.querySelector('#pause-recovery-status-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-recovery-status-style';
  style.textContent = `
    .pause-recovery-status-card {
      position: relative;
      margin: 4px 0 19px;
      padding: 18px 18px 17px;
      border: 1px solid rgba(174, 126, 255, .21);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(74, 37, 124, .14), rgba(17, 10, 33, .27));
    }

    .pause-recovery-status-head {
      display: grid;
      justify-items: center;
      gap: 7px;
      text-align: center;
    }

    .pause-recovery-status-kicker {
      margin: 0;
      color: #92899d;
      font-size: .61rem;
      font-weight: 700;
      letter-spacing: .15em;
    }

    .pause-recovery-range-trigger {
      appearance: none;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid rgba(167, 124, 232, .17);
      border-radius: 10px;
      background: rgba(94, 56, 156, .08);
      color: #d8cfdf;
      font-size: .66rem;
      font-weight: 650;
      letter-spacing: .09em;
      cursor: pointer;
    }

    .pause-recovery-range-trigger:hover,
    .pause-recovery-range-trigger:focus-visible,
    .pause-recovery-range-trigger[aria-expanded='true'] {
      border-color: rgba(181, 137, 247, .34);
      background: rgba(103, 62, 172, .16);
      color: #f1eaf7;
      outline: none;
    }

    .pause-recovery-range-caption {
      margin: -1px 0 0;
      color: #776f80;
      font-size: .64rem;
    }

    .pause-recovery-range-menu {
      position: absolute;
      top: 82px;
      left: 18px;
      right: 18px;
      z-index: 8;
      padding: 10px;
      border: 1px solid rgba(170, 128, 237, .23);
      border-radius: 14px;
      background: rgba(9, 6, 19, .98);
      box-shadow: 0 15px 36px rgba(0, 0, 0, .42);
      backdrop-filter: blur(16px);
    }

    .pause-recovery-range-menu[hidden] { display: none; }

    .pause-recovery-quick-ranges {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 5px;
    }

    .pause-recovery-range-option {
      appearance: none;
      min-height: 36px;
      padding: 0 6px;
      border: 1px solid transparent;
      border-radius: 9px;
      background: transparent;
      color: #8f8599;
      font-size: .61rem;
      cursor: pointer;
    }

    .pause-recovery-range-option:hover,
    .pause-recovery-range-option:focus-visible,
    .pause-recovery-range-option.is-selected {
      border-color: rgba(177, 134, 244, .23);
      background: rgba(108, 67, 187, .14);
      color: #eee7f5;
      outline: none;
    }

    .pause-recovery-custom-form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(156, 117, 219, .12);
    }

    .pause-recovery-custom-form[hidden] { display: none; }

    .pause-recovery-custom-form label {
      display: grid;
      gap: 5px;
      min-width: 0;
    }

    .pause-recovery-custom-form label span {
      color: #756c7e;
      font-size: .56rem;
      font-weight: 650;
      letter-spacing: .09em;
      text-transform: uppercase;
    }

    .pause-recovery-custom-form input {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      min-height: 38px;
      padding: 0 7px;
      border: 1px solid rgba(162, 123, 222, .2);
      border-radius: 9px;
      background: rgba(16, 11, 31, .9);
      color: #e9e2f0;
      color-scheme: dark;
      font-size: .67rem;
      outline: none;
    }

    .pause-recovery-custom-apply {
      grid-column: 1 / -1;
      min-height: 37px;
      border: 1px solid rgba(177, 135, 247, .25);
      border-radius: 9px;
      background: rgba(105, 67, 186, .16);
      color: #e6dcf2;
      font-size: .61rem;
      font-weight: 700;
      letter-spacing: .08em;
      cursor: pointer;
    }

    .pause-recovery-custom-error {
      grid-column: 1 / -1;
      min-height: 1em;
      margin: 0;
      color: #c4a7d6;
      font-size: .59rem;
      text-align: center;
    }

    .pause-recovery-status-main {
      display: grid;
      justify-items: center;
      gap: 4px;
      margin-top: 18px;
      text-align: center;
    }

    .pause-recovery-status-value {
      color: #f3edf9;
      font-size: clamp(2.25rem, 10.8vw, 3.35rem);
      font-weight: 330;
      font-variant-numeric: tabular-nums;
      letter-spacing: -.035em;
      line-height: 1;
    }

    .pause-recovery-status-label {
      color: #b99adc;
      font-size: .66rem;
      font-weight: 750;
      letter-spacing: .17em;
    }

    .pause-recovery-status-copy {
      max-width: 270px;
      margin: 8px 0 0;
      color: #91879c;
      font-size: .69rem;
      line-height: 1.5;
    }

    .pause-recovery-progress-row {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 10px;
      margin-top: 16px;
    }

    .pause-recovery-progress-track {
      height: 5px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(151, 119, 201, .11);
    }

    .pause-recovery-progress-fill {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, rgba(104, 91, 255, .82), rgba(210, 88, 221, .9));
      box-shadow: 0 0 10px rgba(154, 91, 255, .2);
    }

    .pause-recovery-progress-pct {
      color: #8f839b;
      font-size: .61rem;
      font-variant-numeric: tabular-nums;
    }

    .pause-recovery-status-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 9px;
      margin-top: 15px;
      padding-top: 14px;
      border-top: 1px solid rgba(155, 120, 219, .11);
    }

    .pause-recovery-status-stat {
      display: grid;
      gap: 5px;
      min-width: 0;
      text-align: center;
    }

    .pause-recovery-status-stat small {
      color: #81798a;
      font-size: .56rem;
      font-weight: 650;
      letter-spacing: .1em;
    }

    .pause-recovery-status-stat strong {
      color: #e8e0ee;
      font-size: .91rem;
      font-weight: 520;
    }

    @media (max-width: 390px) {
      .pause-recovery-quick-ranges { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .pause-recovery-range-menu { top: 82px; }
    }
  `;
  document.head.appendChild(style);
}

function selectionForPanel(panel) {
  let selection = panelSelections.get(panel);
  if (selection) return selection;

  const defaultRange = recoveryRangeForDays(7);
  selection = {
    mode: 'quick',
    days: 7,
    customStart: defaultRange.startKey,
    customEnd: defaultRange.endKey,
    menuOpen: false,
    customOpen: false
  };
  panelSelections.set(panel, selection);
  return selection;
}

function recoveryStatusMarkup(selection, summary) {
  const diff = summary.differenceMs;
  const threshold = 60_000;
  const hasData = summary.days > 0;
  let statusValue = hasData ? 'ON TARGET' : 'NO DATA YET';
  let statusLabel = '';

  if (hasData && diff < -threshold) {
    statusValue = formatDuration(Math.abs(diff));
    statusLabel = 'SHORT';
  } else if (hasData && diff > threshold) {
    statusValue = formatDuration(diff);
    statusLabel = 'ABOVE TARGET';
  }

  const displayPct = hasData ? Math.max(0, Math.round(summary.progressPct)) : 0;
  const barPct = hasData ? Math.max(0, Math.min(100, summary.progressPct)) : 0;
  const todayKey = manilaDateKey();
  const range = selectedRange(selection);
  const dayWord = summary.days === 1 ? 'day' : 'days';
  const statusCopy = hasData
    ? `Based on <strong>${summary.days} available ${dayWord}</strong>, you recorded <strong>${formatDuration(summary.totalMs)}</strong> of your <strong>${formatDuration(summary.targetMs)}</strong> recovery target.`
    : 'Complete your first rest to start your recovery status.';

  return `
    <div class="pause-recovery-status-head">
      <p class="pause-recovery-status-kicker">RECOVERY STATUS</p>
      <button type="button" class="pause-recovery-range-trigger" data-recovery-range-trigger aria-expanded="${selection.menuOpen ? 'true' : 'false'}">
        ${selectorLabel(selection)} &nbsp;⌄
      </button>
      <p class="pause-recovery-range-caption">${rangeCaption(range.startKey, range.endKey)}</p>
    </div>

    <div class="pause-recovery-range-menu" data-recovery-range-menu ${selection.menuOpen ? '' : 'hidden'}>
      <div class="pause-recovery-quick-ranges" role="group" aria-label="Recovery timeframe">
        <button type="button" class="pause-recovery-range-option${selection.mode === 'quick' && selection.days === 1 ? ' is-selected' : ''}" data-recovery-days="1">1 DAY</button>
        <button type="button" class="pause-recovery-range-option${selection.mode === 'quick' && selection.days === 3 ? ' is-selected' : ''}" data-recovery-days="3">3 DAYS</button>
        <button type="button" class="pause-recovery-range-option${selection.mode === 'quick' && selection.days === 7 ? ' is-selected' : ''}" data-recovery-days="7">7 DAYS</button>
        <button type="button" class="pause-recovery-range-option${selection.mode === 'custom' ? ' is-selected' : ''}" data-recovery-custom-toggle>CUSTOM</button>
      </div>
      <form class="pause-recovery-custom-form" data-recovery-custom-form ${selection.customOpen ? '' : 'hidden'}>
        <label><span>From</span><input type="date" name="start" max="${todayKey}" value="${selection.customStart}"></label>
        <label><span>To</span><input type="date" name="end" max="${todayKey}" value="${selection.customEnd}"></label>
        <button type="submit" class="pause-recovery-custom-apply">APPLY RANGE</button>
        <p class="pause-recovery-custom-error" data-recovery-custom-error aria-live="polite"></p>
      </form>
    </div>

    <div class="pause-recovery-status-main">
      <strong class="pause-recovery-status-value">${statusValue}</strong>
      ${statusLabel ? `<span class="pause-recovery-status-label">${statusLabel}</span>` : ''}
      <p class="pause-recovery-status-copy">${statusCopy}</p>
    </div>

    <div class="pause-recovery-progress-row" aria-label="${displayPct}% of recovery target recorded">
      <div class="pause-recovery-progress-track" aria-hidden="true"><span class="pause-recovery-progress-fill" style="width:${barPct}%"></span></div>
      <span class="pause-recovery-progress-pct">${displayPct}%</span>
    </div>

    <div class="pause-recovery-status-stats">
      <div class="pause-recovery-status-stat"><small>AVERAGE / DAY</small><strong>${hasData ? formatDuration(summary.averageMs) : '—'}</strong></div>
      <div class="pause-recovery-status-stat"><small>DAILY TARGET</small><strong>${formatDuration(RECOVERY_DAILY_TARGET_MS)}</strong></div>
    </div>
  `;
}

function renderRecoveryCard(card, panel) {
  const selection = selectionForPanel(panel);
  const range = selectedRange(selection);
  const pauseState = window.__PAUSE__?.getState?.().pauseState || { history: [] };
  const summary = buildRecoverySummary(pauseState, range.startKey, range.endKey);
  card.innerHTML = recoveryStatusMarkup(selection, summary);

  card.querySelector('[data-recovery-range-trigger]')?.addEventListener('click', () => {
    selection.menuOpen = !selection.menuOpen;
    renderRecoveryCard(card, panel);
  });

  card.querySelectorAll('[data-recovery-days]').forEach((button) => {
    button.addEventListener('click', () => {
      selection.mode = 'quick';
      selection.days = Number(button.dataset.recoveryDays) || 7;
      selection.menuOpen = false;
      selection.customOpen = false;
      const nextRange = recoveryRangeForDays(selection.days);
      selection.customStart = nextRange.startKey;
      selection.customEnd = nextRange.endKey;
      renderRecoveryCard(card, panel);
    });
  });

  card.querySelector('[data-recovery-custom-toggle]')?.addEventListener('click', () => {
    selection.customOpen = !selection.customOpen;
    selection.menuOpen = true;
    renderRecoveryCard(card, panel);
    if (selection.customOpen) card.querySelector('[data-recovery-custom-form] input')?.focus();
  });

  card.querySelector('[data-recovery-custom-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const start = parseManilaDateKey(String(form.get('start') || ''))?.key;
    const end = parseManilaDateKey(String(form.get('end') || ''))?.key;
    const error = card.querySelector('[data-recovery-custom-error]');
    const todayKey = manilaDateKey();

    if (!start || !end) {
      if (error) error.textContent = 'Choose both dates.';
      return;
    }
    if (start > end) {
      if (error) error.textContent = 'Start date must be before end date.';
      return;
    }
    if (end > todayKey) {
      if (error) error.textContent = 'The range cannot include future dates.';
      return;
    }

    selection.mode = 'custom';
    selection.customStart = start;
    selection.customEnd = end;
    selection.menuOpen = false;
    selection.customOpen = false;
    renderRecoveryCard(card, panel);
  });
}

function mountRecoveryCard(panel) {
  if (!panel || panel.querySelector('.pause-recovery-status-card')) return;
  const oldHero = panel.querySelector('.pause-rhythm-hero');
  if (!oldHero) return;

  const card = document.createElement('section');
  card.className = 'pause-recovery-status-card';
  card.setAttribute('aria-label', 'Recovery status');
  oldHero.replaceWith(card);
  panel.querySelector('.pause-detailed-grid')?.remove();
  renderRecoveryCard(card, panel);
}

function scanForRestInsights() {
  document.querySelectorAll('.pause-view-insights').forEach((panel) => {
    if (panel.querySelector('.pause-rhythm-hero')) mountRecoveryCard(panel);
  });
}

function queueRecoveryScan() {
  if (scanQueued) return;
  scanQueued = true;
  queueMicrotask(() => {
    scanQueued = false;
    scanForRestInsights();
  });
}

export function initializeRecoveryStatusCard() {
  if (typeof document === 'undefined' || recoveryObserver) return;
  ensureRecoveryStyles();
  recoveryObserver = new MutationObserver(queueRecoveryScan);
  recoveryObserver.observe(document.documentElement, { childList: true, subtree: true });
  queueRecoveryScan();
}

if (typeof document !== 'undefined') initializeRecoveryStatusCard();
