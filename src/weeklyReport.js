import {
  addManilaDays,
  formatManilaDate,
  manilaDateKey,
  manilaDateKeyToStartMs
} from './manilaTime.js';

const PAUSE_WEEKLY_STORAGE_KEY = 'pause-weekly-reports-v1';
const PAUSE_WEEKLY_MAX_RECORDS = 52;
const PAUSE_WEEKLY_DAY_MS = 24 * 60 * 60 * 1000;

let pauseWeeklyOverlay = null;
let pauseWeeklyOverlayView = null;
let pauseWeeklyOverlayWeekKey = null;
let pauseWeeklyReturnView = 'insights';
let pauseWeeklyQueued = false;

function pauseWeeklyEscapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function pauseWeeklyFiniteTimestamp(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pauseWeeklyKeyWeekday(key) {
  const match = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
}

function pauseWeeklyFormatDuration(ms) {
  const totalMinutes = Math.max(0, Math.round(Number(ms || 0) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function pauseWeeklyDateRangeLabel(startKey) {
  const startMs = manilaDateKeyToStartMs(startKey);
  const endKey = addManilaDays(startKey, 6);
  const endMs = manilaDateKeyToStartMs(endKey);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return '';
  const start = formatManilaDate(startMs, { month: 'short', day: 'numeric' });
  const end = formatManilaDate(endMs, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${start} – ${end}`;
}

export function pauseWeeklyLatestCompletedWeek(nowValue = Date.now()) {
  const now = pauseWeeklyFiniteTimestamp(nowValue) ?? Date.now();
  const todayKey = manilaDateKey(now);
  const weekday = pauseWeeklyKeyWeekday(todayKey);
  if (weekday === null) return null;
  const daysSinceMonday = (weekday + 6) % 7;
  const currentMonday = addManilaDays(todayKey, -daysSinceMonday);
  const startKey = addManilaDays(currentMonday, -7);
  const endKey = addManilaDays(startKey, 6);
  const startMs = manilaDateKeyToStartMs(startKey);
  const endExclusiveMs = manilaDateKeyToStartMs(addManilaDays(startKey, 7));
  return { startKey, endKey, startMs, endExclusiveMs };
}

function pauseWeeklyNormalizePlanSnapshot(value = {}) {
  const workDays = [...new Set((Array.isArray(value.workDays) ? value.workDays : [])
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  const recoveryMinutes = Math.max(0, Math.min(720, Math.round(Number(value.recoveryMinutes) || 0)));
  return {
    setupComplete: value.setupComplete === true,
    workDays,
    recoveryMinutes,
    sleepStart: /^\d{2}:\d{2}$/.test(String(value.sleepStart || '')) ? String(value.sleepStart) : ''
  };
}

export function normalizePauseWeeklyReportStore(value = {}) {
  const records = (Array.isArray(value.records) ? value.records : [])
    .filter((record) => record && /^\d{4}-\d{2}-\d{2}$/.test(String(record.weekStartKey || '')))
    .map((record) => ({
      weekStartKey: String(record.weekStartKey),
      generatedAt: pauseWeeklyFiniteTimestamp(record.generatedAt),
      viewedAt: pauseWeeklyFiniteTimestamp(record.viewedAt),
      ignoredAt: pauseWeeklyFiniteTimestamp(record.ignoredAt),
      note: String(record.note || '').trim().slice(0, 500),
      planSnapshot: pauseWeeklyNormalizePlanSnapshot(record.planSnapshot || {})
    }))
    .sort((a, b) => String(b.weekStartKey).localeCompare(String(a.weekStartKey)))
    .slice(0, PAUSE_WEEKLY_MAX_RECORDS);

  return {
    version: 1,
    trackingStartedAt: pauseWeeklyFiniteTimestamp(value.trackingStartedAt),
    records
  };
}

function pauseWeeklyStorageKey(accountId) {
  return `${PAUSE_WEEKLY_STORAGE_KEY}:account:${String(accountId)}`;
}

function pauseWeeklyLoadStore(accountId) {
  try {
    const raw = localStorage.getItem(pauseWeeklyStorageKey(accountId));
    return normalizePauseWeeklyReportStore(raw ? JSON.parse(raw) : {});
  } catch {
    return normalizePauseWeeklyReportStore();
  }
}

function pauseWeeklySaveStore(accountId, value) {
  const normalized = normalizePauseWeeklyReportStore(value);
  try {
    localStorage.setItem(pauseWeeklyStorageKey(accountId), JSON.stringify(normalized));
  } catch {}
  window.dispatchEvent(new CustomEvent('pause:weekly-reports-changed', { detail: normalized }));
  return normalized;
}

function pauseWeeklyOldestEvidenceAt(pauseState, thiefLogs) {
  const stamps = [];
  (Array.isArray(pauseState?.history) ? pauseState.history : []).forEach((entry) => {
    const stamp = pauseWeeklyFiniteTimestamp(entry?.startAt ?? entry?.endedAt);
    if (stamp !== null) stamps.push(stamp);
  });
  (Array.isArray(thiefLogs) ? thiefLogs : []).forEach((entry) => {
    const stamp = pauseWeeklyFiniteTimestamp(entry?.plannedSleepStartAt ?? entry?.observedAt);
    if (stamp !== null) stamps.push(stamp);
  });
  return stamps.length ? Math.min(...stamps) : null;
}

function pauseWeeklyEnsureTrackingStore(accountId, pauseState, thiefLogs, plan) {
  let store = pauseWeeklyLoadStore(accountId);
  if (!plan?.setupComplete || store.trackingStartedAt !== null) return store;
  const oldestEvidence = pauseWeeklyOldestEvidenceAt(pauseState, thiefLogs);
  store = pauseWeeklySaveStore(accountId, {
    ...store,
    trackingStartedAt: oldestEvidence ?? Date.now()
  });
  return store;
}

function pauseWeeklyRecordFor(store, weekStartKey) {
  return store.records.find((record) => record.weekStartKey === weekStartKey) || null;
}

function pauseWeeklyUpsertRecord(accountId, store, weekStartKey, patch = {}) {
  const existing = pauseWeeklyRecordFor(store, weekStartKey);
  const next = {
    weekStartKey,
    generatedAt: existing?.generatedAt ?? Date.now(),
    viewedAt: existing?.viewedAt ?? null,
    ignoredAt: existing?.ignoredAt ?? null,
    note: existing?.note || '',
    planSnapshot: existing?.planSnapshot || pauseWeeklyNormalizePlanSnapshot(),
    ...patch
  };
  return pauseWeeklySaveStore(accountId, {
    ...store,
    records: [next, ...store.records.filter((record) => record.weekStartKey !== weekStartKey)]
  });
}

function pauseWeeklyEnsureLatestRecord(accountId, pauseState, thiefLogs, plan) {
  let store = pauseWeeklyEnsureTrackingStore(accountId, pauseState, thiefLogs, plan);
  if (!plan?.setupComplete || store.trackingStartedAt === null) return { store, record: null };
  const week = pauseWeeklyLatestCompletedWeek();
  if (!week || store.trackingStartedAt > week.startMs) return { store, record: null };

  let record = pauseWeeklyRecordFor(store, week.startKey);
  if (!record) {
    store = pauseWeeklyUpsertRecord(accountId, store, week.startKey, {
      generatedAt: Date.now(),
      planSnapshot: pauseWeeklyNormalizePlanSnapshot(plan)
    });
    record = pauseWeeklyRecordFor(store, week.startKey);
  }
  return { store, record };
}

function pauseWeeklyEntryWindow(entry) {
  const startAt = pauseWeeklyFiniteTimestamp(entry?.startAt ?? entry?.endedAt);
  if (startAt === null) return null;
  const explicitEnd = pauseWeeklyFiniteTimestamp(entry?.endedAt);
  const durationMs = Math.max(0, Number(entry?.durationMs || entry?.sessionDurationMs || 0));
  const endedAt = explicitEnd !== null && explicitEnd >= startAt ? explicitEnd : startAt + durationMs;
  if (!Number.isFinite(endedAt) || endedAt < startAt) return null;
  return { startAt, endedAt };
}

function pauseWeeklyOverlapMs(startAt, endedAt, rangeStart, rangeEnd) {
  return Math.max(0, Math.min(endedAt, rangeEnd) - Math.max(startAt, rangeStart));
}

function pauseWeeklyIsSleepEntry(entry) {
  return /\bsleep\b/i.test(String(entry?.label || ''));
}

export function derivePauseWeeklyReport({ pauseState = {}, plan = {}, thiefLogs = [], weekStartKey }) {
  const startKey = String(weekStartKey || '');
  const startMs = manilaDateKeyToStartMs(startKey);
  const endExclusiveMs = manilaDateKeyToStartMs(addManilaDays(startKey, 7));
  if (!Number.isFinite(startMs) || !Number.isFinite(endExclusiveMs)) return null;

  const normalizedPlan = pauseWeeklyNormalizePlanSnapshot(plan);
  const history = Array.isArray(pauseState?.history) ? pauseState.history : [];
  const days = Array.from({ length: 7 }, (_, index) => {
    const key = addManilaDays(startKey, index);
    const dayStart = manilaDateKeyToStartMs(key);
    const dayEnd = dayStart + PAUSE_WEEKLY_DAY_MS;
    const weekday = pauseWeeklyKeyWeekday(key);
    const dateLabel = formatManilaDate(dayStart, { month: 'short', day: 'numeric' });
    const label = formatManilaDate(dayStart, { weekday: 'short' });
    let totalMs = 0;
    let sleepMs = 0;
    let sessions = 0;

    history.forEach((entry) => {
      const window = pauseWeeklyEntryWindow(entry);
      if (!window) return;
      const overlap = pauseWeeklyOverlapMs(window.startAt, window.endedAt, dayStart, dayEnd);
      if (overlap <= 0) return;
      totalMs += overlap;
      if (pauseWeeklyIsSleepEntry(entry)) sleepMs += overlap;
      sessions += 1;
    });

    return {
      key,
      label,
      dateLabel,
      weekday,
      totalMs,
      sleepMs,
      sessions,
      plannedSleep: normalizedPlan.setupComplete && normalizedPlan.workDays.includes(weekday)
    };
  });

  const totalRestMs = days.reduce((sum, day) => sum + day.totalMs, 0);
  const recordedSleepMs = days.reduce((sum, day) => sum + day.sleepMs, 0);
  const restDays = days.filter((day) => day.totalMs > 0).length;
  const sleepRecordDays = days.filter((day) => day.sleepMs > 0).length;
  const plannedSleepDays = days.filter((day) => day.plannedSleep).length;
  const plannedSleepMs = normalizedPlan.recoveryMinutes * 60_000 * plannedSleepDays;

  const weeklyThieves = (Array.isArray(thiefLogs) ? thiefLogs : [])
    .filter((entry) => {
      const stamp = pauseWeeklyFiniteTimestamp(entry?.plannedSleepStartAt ?? entry?.observedAt);
      return stamp !== null && stamp >= startMs && stamp < endExclusiveMs;
    });

  const thiefCounts = new Map();
  weeklyThieves.forEach((entry) => {
    const thief = String(entry?.thief || '').trim() || 'Other';
    thiefCounts.set(thief, (thiefCounts.get(thief) || 0) + 1);
  });
  const thieves = [...thiefCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const delayValues = weeklyThieves
    .map((entry) => Number(entry?.observedDelayMinutes))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const averageDelayMinutes = delayValues.length
    ? Math.round(delayValues.reduce((sum, value) => sum + value, 0) / delayValues.length)
    : 0;

  const recordedDays = days.filter((day) => day.totalMs > 0).sort((a, b) => b.totalMs - a.totalMs);
  const strongestDay = recordedDays[0] || null;
  const shortestRecordedDay = recordedDays.length > 1 ? [...recordedDays].sort((a, b) => a.totalMs - b.totalMs)[0] : null;
  const unrecordedDays = days.filter((day) => day.totalMs === 0).length;

  let conclusion = 'No completed rest was recorded for this week.';
  if (recordedSleepMs > 0 && plannedSleepMs > 0) {
    const ratio = recordedSleepMs / plannedSleepMs;
    if (ratio >= 0.9) conclusion = 'Your recorded sleep stayed close to your Sleep Routine this week.';
    else if (ratio >= 0.7) conclusion = 'Your recorded sleep fell somewhat short of your Sleep Routine this week.';
    else conclusion = 'Your recorded sleep was well below your Sleep Routine target this week.';
  } else if (totalRestMs > 0) {
    conclusion = `You recorded ${pauseWeeklyFormatDuration(totalRestMs)} of intentional rest this week.`;
  }

  const noticed = [];
  if (strongestDay) noticed.push(`Most recorded rest: ${strongestDay.label} · ${pauseWeeklyFormatDuration(strongestDay.totalMs)}.`);
  if (shortestRecordedDay && shortestRecordedDay.key !== strongestDay?.key) {
    noticed.push(`Shortest recorded rest day: ${shortestRecordedDay.label} · ${pauseWeeklyFormatDuration(shortestRecordedDay.totalMs)}.`);
  }
  if (unrecordedDays > 0) noticed.push(`No completed rest was recorded on ${unrecordedDays} day${unrecordedDays === 1 ? '' : 's'}.`);
  if (thieves[0]) noticed.push(`Most common logged sleep delay: ${thieves[0].label} · ${thieves[0].count} time${thieves[0].count === 1 ? '' : 's'}.`);
  if (weeklyThieves.length && averageDelayMinutes > 0) {
    noticed.push(`Logged delays were observed about ${averageDelayMinutes} min past planned sleep start on average.`);
  }

  return {
    weekStartKey: startKey,
    weekEndKey: addManilaDays(startKey, 6),
    startMs,
    endExclusiveMs,
    dateRangeLabel: pauseWeeklyDateRangeLabel(startKey),
    plan: normalizedPlan,
    plannedSleepDays,
    plannedSleepMs,
    totalRestMs,
    recordedSleepMs,
    restDays,
    sleepRecordDays,
    days,
    delayLogs: weeklyThieves.length,
    averageDelayMinutes,
    thieves,
    noticed,
    conclusion
  };
}

function pauseWeeklyReportStatus(record) {
  if (record?.viewedAt) return 'Viewed';
  if (record?.ignoredAt) return 'Ignored';
  return 'Not opened';
}

function pauseWeeklyEnsureStyles() {
  if (document.querySelector('#pause-weekly-report-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-weekly-report-style';
  style.textContent = `
    .pause-weekly-banner {
      margin: 0 0 18px;
      padding: 16px;
      border: 1px solid rgba(175, 130, 241, .2);
      border-radius: 16px;
      background: linear-gradient(135deg, rgba(83, 54, 173, .17), rgba(188, 61, 177, .08));
    }
    .pause-weekly-banner small,
    .pause-weekly-section-title,
    .pause-weekly-stat small,
    .pause-weekly-archive-label {
      color: #9b83bd;
      font-size: .6rem;
      font-weight: 720;
      letter-spacing: .13em;
    }
    .pause-weekly-banner strong {
      display: block;
      margin: 5px 0 4px;
      color: #eee7f5;
      font-size: .94rem;
      font-weight: 540;
    }
    .pause-weekly-banner p {
      margin: 0;
      color: #91879b;
      font-size: .68rem;
      line-height: 1.45;
    }
    .pause-weekly-banner-actions {
      display: flex;
      gap: 8px;
      margin-top: 13px;
    }
    .pause-weekly-banner button,
    .pause-weekly-archive-link,
    .pause-weekly-done,
    .pause-weekly-note-save,
    .pause-weekly-header-button,
    .pause-weekly-archive-row {
      appearance: none;
      cursor: pointer;
      font: inherit;
    }
    .pause-weekly-banner button {
      min-height: 38px;
      padding: 0 13px;
      border-radius: 10px;
      font-size: .64rem;
      font-weight: 700;
    }
    .pause-weekly-view-button {
      border: 1px solid rgba(183, 139, 249, .32);
      background: rgba(108, 67, 187, .24);
      color: #f0e8f7;
    }
    .pause-weekly-ignore-button {
      border: 1px solid rgba(151, 121, 195, .12);
      background: transparent;
      color: #8c8296;
    }
    .pause-weekly-archive-link {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 2px 0 18px;
      padding: 13px 2px;
      border: 0;
      border-bottom: 1px solid rgba(153, 124, 202, .11);
      background: transparent;
      color: #aaa0b5;
      text-align: left;
    }
    .pause-weekly-archive-link span:last-child { color: #6e6478; font-size: 1rem; }

    .pause-weekly-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1450;
      display: grid;
      place-items: center;
      padding: 0;
      background: rgba(1, 1, 5, .88);
      backdrop-filter: blur(16px);
    }
    .pause-weekly-page {
      box-sizing: border-box;
      width: min(100%, 560px);
      height: 100dvh;
      overflow-y: auto;
      padding: max(18px, env(safe-area-inset-top)) 18px max(28px, env(safe-area-inset-bottom));
      background:
        radial-gradient(circle at 18% 0%, rgba(87, 71, 224, .13), transparent 31%),
        radial-gradient(circle at 88% 100%, rgba(207, 70, 184, .09), transparent 29%),
        #06050b;
      color: #eee8f4;
    }
    .pause-weekly-header {
      position: sticky;
      top: calc(-1 * max(18px, env(safe-area-inset-top)));
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 0 -2px 26px;
      padding: max(18px, env(safe-area-inset-top)) 2px 12px;
      background: linear-gradient(180deg, #06050b 72%, rgba(6, 5, 11, 0));
    }
    .pause-weekly-header-button {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      padding: 0;
      border: 1px solid rgba(164, 124, 224, .14);
      border-radius: 50%;
      background: rgba(65, 42, 103, .08);
      color: #b8adbf;
      font-size: 1rem;
    }
    .pause-weekly-header-center { min-width: 0; text-align: center; }
    .pause-weekly-header-center small {
      display: block;
      color: #867a91;
      font-size: .57rem;
      font-weight: 700;
      letter-spacing: .13em;
    }
    .pause-weekly-header-center strong {
      display: block;
      margin-top: 3px;
      color: #dcd4e4;
      font-size: .76rem;
      font-weight: 520;
    }
    .pause-weekly-hero {
      padding: 4px 2px 25px;
      border-bottom: 1px solid rgba(158, 122, 210, .12);
    }
    .pause-weekly-hero h1 {
      margin: 7px 0 9px;
      color: #f3edf8;
      font-size: clamp(1.65rem, 7vw, 2.25rem);
      font-weight: 410;
      line-height: 1.15;
      letter-spacing: -.025em;
    }
    .pause-weekly-hero p {
      margin: 0;
      color: #8e8498;
      font-size: .72rem;
      line-height: 1.55;
    }
    .pause-weekly-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 9px;
      margin-top: 20px;
    }
    .pause-weekly-stat {
      padding: 15px;
      border: 1px solid rgba(157, 120, 217, .14);
      border-radius: 14px;
      background: rgba(18, 12, 32, .4);
    }
    .pause-weekly-stat strong {
      display: block;
      margin-top: 7px;
      color: #eee7f4;
      font-size: 1.18rem;
      font-weight: 440;
    }
    .pause-weekly-stat span {
      display: block;
      margin-top: 5px;
      color: #746b7d;
      font-size: .6rem;
      line-height: 1.35;
    }
    .pause-weekly-section {
      margin-top: 30px;
    }
    .pause-weekly-section-title {
      margin: 0 0 12px;
    }
    .pause-weekly-day-list { display: grid; gap: 10px; }
    .pause-weekly-day-row {
      display: grid;
      grid-template-columns: 62px 1fr 70px;
      align-items: center;
      gap: 10px;
      color: #aaa0b4;
      font-size: .68rem;
    }
    .pause-weekly-day-row small { display: block; color: #6f6777; font-size: .56rem; margin-top: 2px; }
    .pause-weekly-day-track { height: 5px; border-radius: 999px; background: rgba(147, 114, 196, .1); overflow: hidden; }
    .pause-weekly-day-fill { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, rgba(106, 94, 255, .8), rgba(208, 83, 215, .86)); }
    .pause-weekly-day-value { text-align: right; color: #beb3c8; white-space: nowrap; }
    .pause-weekly-info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .pause-weekly-info-grid div {
      min-width: 0;
      padding: 13px 10px;
      border: 1px solid rgba(157, 120, 217, .12);
      border-radius: 13px;
      background: rgba(17, 11, 30, .34);
      text-align: center;
    }
    .pause-weekly-info-grid small { color: #716779; font-size: .53rem; letter-spacing: .08em; }
    .pause-weekly-info-grid strong { display: block; margin-top: 6px; color: #ded6e6; font-size: .88rem; font-weight: 500; }
    .pause-weekly-explainer { margin: 10px 0 0; color: #716979; font-size: .62rem; line-height: 1.5; }
    .pause-weekly-thief-list,
    .pause-weekly-noticed-list { display: grid; }
    .pause-weekly-thief-row,
    .pause-weekly-noticed-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 1px;
      border-bottom: 1px solid rgba(153, 124, 202, .1);
      color: #998fa4;
      font-size: .7rem;
      line-height: 1.45;
    }
    .pause-weekly-thief-row strong { color: #d8cfdf; font-weight: 520; }
    .pause-weekly-noticed-row { display: block; color: #aaa0b4; }
    .pause-weekly-empty { margin: 0; color: #756d7d; font-size: .69rem; line-height: 1.5; }
    .pause-weekly-note {
      box-sizing: border-box;
      width: 100%;
      min-height: 105px;
      resize: vertical;
      padding: 12px 13px;
      border: 1px solid rgba(163, 124, 224, .16);
      border-radius: 13px;
      background: rgba(12, 8, 22, .64);
      color: #e8e1ef;
      font: inherit;
      font-size: .72rem;
      line-height: 1.5;
      outline: none;
    }
    .pause-weekly-note:focus { border-color: rgba(183, 139, 248, .36); }
    .pause-weekly-note-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
    .pause-weekly-note-save,
    .pause-weekly-done {
      min-height: 40px;
      padding: 0 14px;
      border: 1px solid rgba(182, 138, 248, .25);
      border-radius: 11px;
      background: rgba(104, 64, 180, .18);
      color: #e9e0f2;
      font-size: .64rem;
      font-weight: 700;
    }
    .pause-weekly-disclaimer { margin: 28px 0 14px; color: #69616f; font-size: .61rem; line-height: 1.55; text-align: center; }
    .pause-weekly-done { width: 100%; min-height: 46px; }

    .pause-weekly-archive-title { margin: 0 0 8px; font-size: 1.7rem; font-weight: 420; color: #f1eaf6; }
    .pause-weekly-archive-copy { margin: 0 0 24px; color: #80768a; font-size: .72rem; line-height: 1.5; }
    .pause-weekly-archive-list { display: grid; }
    .pause-weekly-archive-row {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 15px 2px;
      border: 0;
      border-bottom: 1px solid rgba(153, 124, 202, .11);
      background: transparent;
      color: #ddd5e5;
      text-align: left;
    }
    .pause-weekly-archive-row strong { display: block; font-size: .8rem; font-weight: 520; }
    .pause-weekly-archive-row small { display: block; margin-top: 4px; color: #716978; font-size: .59rem; }
    .pause-weekly-archive-status { color: #9b8ba7; font-size: .63rem; white-space: nowrap; }

    @media (min-width: 600px) {
      .pause-weekly-backdrop { padding: 4dvh 18px; }
      .pause-weekly-page { height: auto; max-height: 92dvh; border: 1px solid rgba(164, 124, 224, .17); border-radius: 24px; }
    }
    @media (max-width: 370px) {
      .pause-weekly-info-grid { grid-template-columns: 1fr; }
      .pause-weekly-day-row { grid-template-columns: 56px 1fr 62px; gap: 8px; }
    }
  `;
  document.head.appendChild(style);
}

function pauseWeeklyCurrentContext() {
  const pause = window.__PAUSE__?.getState?.();
  if (!pause || pause.authStatus !== 'authenticated' || !pause.user?.id) return null;
  const plan = window.__PAUSE_RECOVERY_PLAN__?.getPlan?.() || {};
  const thiefLogs = window.__PAUSE_RECOVERY_THIEVES__?.getLogs?.() || [];
  return {
    accountId: String(pause.user.id),
    pause,
    pauseState: pause.pauseState || {},
    plan,
    thiefLogs
  };
}

function pauseWeeklyGetReportContext(weekStartKey) {
  const context = pauseWeeklyCurrentContext();
  if (!context) return null;
  const store = pauseWeeklyLoadStore(context.accountId);
  const record = pauseWeeklyRecordFor(store, weekStartKey);
  if (!record) return null;
  const plan = record.planSnapshot?.setupComplete ? record.planSnapshot : context.plan;
  const report = derivePauseWeeklyReport({
    pauseState: context.pauseState,
    plan,
    thiefLogs: context.thiefLogs,
    weekStartKey
  });
  return { ...context, store, record, report };
}

function pauseWeeklyReportMarkup(report, record) {
  const maxDay = Math.max(1, ...report.days.map((day) => day.totalMs));
  const dayRows = report.days.map((day) => {
    const width = day.totalMs > 0 ? Math.max(6, Math.round((day.totalMs / maxDay) * 100)) : 0;
    return `
      <div class="pause-weekly-day-row">
        <div><strong>${pauseWeeklyEscapeHtml(day.label)}</strong><small>${pauseWeeklyEscapeHtml(day.dateLabel)}</small></div>
        <div class="pause-weekly-day-track" aria-hidden="true"><span class="pause-weekly-day-fill" style="width:${width}%"></span></div>
        <span class="pause-weekly-day-value">${day.totalMs ? pauseWeeklyEscapeHtml(pauseWeeklyFormatDuration(day.totalMs)) : '—'}</span>
      </div>
    `;
  }).join('');

  const thiefRows = report.thieves.map((item) => `
    <div class="pause-weekly-thief-row"><span>${pauseWeeklyEscapeHtml(item.label)}</span><strong>${item.count}</strong></div>
  `).join('');
  const noticedRows = report.noticed.map((item) => `<div class="pause-weekly-noticed-row">${pauseWeeklyEscapeHtml(item)}</div>`).join('');
  const plannedSleepValue = report.plannedSleepMs > 0 ? pauseWeeklyFormatDuration(report.plannedSleepMs) : '—';
  const recordedSleepValue = report.recordedSleepMs > 0 ? pauseWeeklyFormatDuration(report.recordedSleepMs) : '—';

  return `
    <div class="pause-weekly-header">
      <button type="button" class="pause-weekly-header-button" data-pause-weekly-back aria-label="Back">←</button>
      <div class="pause-weekly-header-center"><small>WEEKLY REPORT</small><strong>${pauseWeeklyEscapeHtml(report.dateRangeLabel)}</strong></div>
      <button type="button" class="pause-weekly-header-button" data-pause-weekly-close aria-label="Close">×</button>
    </div>

    <section class="pause-weekly-hero">
      <span class="pause-weekly-archive-label">YOUR WEEK</span>
      <h1>${pauseWeeklyEscapeHtml(report.conclusion)}</h1>
      <p>Built from your completed rest records, Sleep Routine, and sleep-delay logs.</p>
    </section>

    <div class="pause-weekly-stats">
      <article class="pause-weekly-stat"><small>PLANNED SLEEP</small><strong>${pauseWeeklyEscapeHtml(plannedSleepValue)}</strong><span>${report.plannedSleepDays ? `${report.plannedSleepDays} routine day${report.plannedSleepDays === 1 ? '' : 's'}` : 'No routine target available'}</span></article>
      <article class="pause-weekly-stat"><small>RECORDED SLEEP</small><strong>${pauseWeeklyEscapeHtml(recordedSleepValue)}</strong><span>${report.recordedSleepMs ? `${report.sleepRecordDays} day${report.sleepRecordDays === 1 ? '' : 's'} with sleep-specific records` : 'No sleep-specific records'}</span></article>
      <article class="pause-weekly-stat"><small>TOTAL RECORDED REST</small><strong>${pauseWeeklyEscapeHtml(pauseWeeklyFormatDuration(report.totalRestMs))}</strong><span>All completed intentional rests</span></article>
      <article class="pause-weekly-stat"><small>REST DAYS</small><strong>${report.restDays} / 7</strong><span>Days with at least one completed rest</span></article>
    </div>

    <section class="pause-weekly-section">
      <p class="pause-weekly-section-title">MONDAY → SUNDAY</p>
      <div class="pause-weekly-day-list">${dayRows}</div>
    </section>

    <section class="pause-weekly-section">
      <p class="pause-weekly-section-title">SLEEP TIMING</p>
      <div class="pause-weekly-info-grid">
        <div><small>ROUTINE DAYS</small><strong>${report.plannedSleepDays}</strong></div>
        <div><small>DELAY LOGS</small><strong>${report.delayLogs}</strong></div>
        <div><small>AVG OBSERVED DELAY</small><strong>${report.delayLogs ? `${report.averageDelayMinutes}m` : '—'}</strong></div>
      </div>
      <p class="pause-weekly-explainer">A delay log means PAUSE observed app use after your planned sleep start. It is not a measurement of actual sleep onset.</p>
    </section>

    <section class="pause-weekly-section">
      <p class="pause-weekly-section-title">WHAT GOT IN THE WAY</p>
      <div class="pause-weekly-thief-list">${thiefRows || '<p class="pause-weekly-empty">No sleep-delay reason was logged for this week.</p>'}</div>
    </section>

    <section class="pause-weekly-section">
      <p class="pause-weekly-section-title">PAUSE NOTICED</p>
      <div class="pause-weekly-noticed-list">${noticedRows || '<p class="pause-weekly-empty">There is not enough recorded activity to identify a weekly pattern yet.</p>'}</div>
    </section>

    <section class="pause-weekly-section">
      <p class="pause-weekly-section-title">YOUR NOTE</p>
      <textarea class="pause-weekly-note" maxlength="500" data-pause-weekly-note placeholder="Optional context about this week…">${pauseWeeklyEscapeHtml(record.note || '')}</textarea>
      <div class="pause-weekly-note-actions"><button type="button" class="pause-weekly-note-save" data-pause-weekly-save-note>Save Note</button></div>
    </section>

    <p class="pause-weekly-disclaimer">PAUSE reports only what you recorded or explicitly told it. Missing records are not treated as proof that you did not rest or sleep.</p>
    <button type="button" class="pause-weekly-done" data-pause-weekly-close>Done with this report</button>
  `;
}

function pauseWeeklyArchiveMarkup(store) {
  const rows = store.records.map((record) => `
    <button type="button" class="pause-weekly-archive-row" data-pause-weekly-open-report="${pauseWeeklyEscapeHtml(record.weekStartKey)}">
      <span><strong>${pauseWeeklyEscapeHtml(pauseWeeklyDateRangeLabel(record.weekStartKey))}</strong><small>Monday – Sunday</small></span>
      <span class="pause-weekly-archive-status">${pauseWeeklyEscapeHtml(pauseWeeklyReportStatus(record))} ›</span>
    </button>
  `).join('');
  return `
    <div class="pause-weekly-header">
      <button type="button" class="pause-weekly-header-button" data-pause-weekly-close aria-label="Back to Rest Insights">←</button>
      <div class="pause-weekly-header-center"><small>PAUSE</small><strong>Weekly Reports</strong></div>
      <button type="button" class="pause-weekly-header-button" data-pause-weekly-close aria-label="Close">×</button>
    </div>
    <h1 class="pause-weekly-archive-title">Weekly Reports</h1>
    <p class="pause-weekly-archive-copy">Your completed Monday–Sunday reports stay here even when you ignore the banner.</p>
    <div class="pause-weekly-archive-list">${rows || '<p class="pause-weekly-empty">Your first weekly report will appear after a complete Monday–Sunday cycle.</p>'}</div>
  `;
}

function pauseWeeklyRenderOverlay() {
  if (!pauseWeeklyOverlay) return;
  pauseWeeklyEnsureStyles();
  const page = pauseWeeklyOverlay.querySelector('.pause-weekly-page');
  if (!page) return;

  if (pauseWeeklyOverlayView === 'archive') {
    const context = pauseWeeklyCurrentContext();
    const store = context ? pauseWeeklyLoadStore(context.accountId) : normalizePauseWeeklyReportStore();
    page.innerHTML = pauseWeeklyArchiveMarkup(store);
    page.scrollTop = 0;
    return;
  }

  const context = pauseWeeklyGetReportContext(pauseWeeklyOverlayWeekKey);
  if (!context?.report) {
    pauseWeeklyCloseOverlay();
    return;
  }
  page.innerHTML = pauseWeeklyReportMarkup(context.report, context.record);
  page.scrollTop = 0;
}

function pauseWeeklyOpenOverlay(view, weekStartKey = null, returnView = 'insights') {
  pauseWeeklyEnsureStyles();
  pauseWeeklyOverlayView = view;
  pauseWeeklyOverlayWeekKey = weekStartKey;
  pauseWeeklyReturnView = returnView;
  if (!pauseWeeklyOverlay) {
    pauseWeeklyOverlay = document.createElement('div');
    pauseWeeklyOverlay.className = 'pause-weekly-backdrop';
    pauseWeeklyOverlay.innerHTML = '<main class="pause-weekly-page" role="dialog" aria-modal="true" aria-label="PAUSE Weekly Report"></main>';
    pauseWeeklyOverlay.addEventListener('pointerdown', (event) => {
      if (event.target === pauseWeeklyOverlay) pauseWeeklyCloseOverlay();
    });
    document.body.appendChild(pauseWeeklyOverlay);
  }
  pauseWeeklyRenderOverlay();
}

function pauseWeeklyCloseOverlay() {
  pauseWeeklyOverlay?.remove();
  pauseWeeklyOverlay = null;
  pauseWeeklyOverlayView = null;
  pauseWeeklyOverlayWeekKey = null;
  pauseWeeklyReturnView = 'insights';
}

function pauseWeeklyMarkViewed(accountId, weekStartKey) {
  const store = pauseWeeklyLoadStore(accountId);
  return pauseWeeklyUpsertRecord(accountId, store, weekStartKey, { viewedAt: Date.now() });
}

function pauseWeeklyIgnore(accountId, weekStartKey) {
  const store = pauseWeeklyLoadStore(accountId);
  return pauseWeeklyUpsertRecord(accountId, store, weekStartKey, { ignoredAt: Date.now() });
}

function pauseWeeklySaveNote(accountId, weekStartKey, note) {
  const store = pauseWeeklyLoadStore(accountId);
  return pauseWeeklyUpsertRecord(accountId, store, weekStartKey, {
    note: String(note || '').trim().slice(0, 500)
  });
}

function pauseWeeklyInjectInsights(context, store, latestRecord) {
  const panel = document.querySelector('.pause-view-insights');
  if (!panel || panel.querySelector('[data-pause-panel-action="back"]')) return;
  const title = panel.querySelector('.system-panel-header h2')?.textContent?.trim();
  if (title !== 'Rest Insights') return;

  const pending = latestRecord && !latestRecord.viewedAt && !latestRecord.ignoredAt;
  if (pending && !panel.querySelector('[data-pause-weekly-banner]')) {
    const anchor = panel.querySelector('.pause-rhythm-hero');
    if (anchor) {
      const banner = document.createElement('section');
      banner.className = 'pause-weekly-banner';
      banner.dataset.pauseWeeklyBanner = latestRecord.weekStartKey;
      banner.innerHTML = `
        <small>YOUR WEEK IS READY</small>
        <strong>${pauseWeeklyEscapeHtml(pauseWeeklyDateRangeLabel(latestRecord.weekStartKey))}</strong>
        <p>Your Monday–Sunday recovery report is ready.</p>
        <div class="pause-weekly-banner-actions">
          <button type="button" class="pause-weekly-view-button" data-pause-weekly-view="${pauseWeeklyEscapeHtml(latestRecord.weekStartKey)}">View Report</button>
          <button type="button" class="pause-weekly-ignore-button" data-pause-weekly-ignore="${pauseWeeklyEscapeHtml(latestRecord.weekStartKey)}">Ignore This Week</button>
        </div>
      `;
      anchor.before(banner);
    }
  }

  if (store.records.length && !panel.querySelector('[data-pause-weekly-archive]')) {
    const firstSection = panel.querySelector('.pause-insight-section');
    if (firstSection) {
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'pause-weekly-archive-link';
      link.dataset.pauseWeeklyArchive = 'true';
      link.innerHTML = '<span>WEEKLY REPORTS</span><span aria-hidden="true">›</span>';
      firstSection.before(link);
    }
  }
}

function pauseWeeklyReconcile() {
  if (pauseWeeklyQueued) return;
  pauseWeeklyQueued = true;
  queueMicrotask(() => {
    pauseWeeklyQueued = false;
    const context = pauseWeeklyCurrentContext();
    if (!context) return;
    const { store, record } = pauseWeeklyEnsureLatestRecord(
      context.accountId,
      context.pauseState,
      context.thiefLogs,
      context.plan
    );
    pauseWeeklyEnsureStyles();
    if (context.pause.panelView === 'insights') pauseWeeklyInjectInsights(context, store, record);
  });
}

function pauseWeeklyHandleClick(event) {
  const context = pauseWeeklyCurrentContext();
  if (!context) return;

  const view = event.target.closest('[data-pause-weekly-view]');
  if (view?.dataset.pauseWeeklyView) {
    const weekStartKey = view.dataset.pauseWeeklyView;
    pauseWeeklyMarkViewed(context.accountId, weekStartKey);
    pauseWeeklyOpenOverlay('report', weekStartKey, 'insights');
    event.preventDefault();
    return;
  }

  const ignore = event.target.closest('[data-pause-weekly-ignore]');
  if (ignore?.dataset.pauseWeeklyIgnore) {
    const weekStartKey = ignore.dataset.pauseWeeklyIgnore;
    pauseWeeklyIgnore(context.accountId, weekStartKey);
    document.querySelector(`[data-pause-weekly-banner="${CSS.escape(weekStartKey)}"]`)?.remove();
    event.preventDefault();
    return;
  }

  if (event.target.closest('[data-pause-weekly-archive]')) {
    pauseWeeklyOpenOverlay('archive');
    event.preventDefault();
    return;
  }

  const openReport = event.target.closest('[data-pause-weekly-open-report]');
  if (openReport?.dataset.pauseWeeklyOpenReport) {
    const weekStartKey = openReport.dataset.pauseWeeklyOpenReport;
    pauseWeeklyMarkViewed(context.accountId, weekStartKey);
    pauseWeeklyOpenOverlay('report', weekStartKey, 'archive');
    event.preventDefault();
    return;
  }

  if (event.target.closest('[data-pause-weekly-save-note]') && pauseWeeklyOverlayWeekKey) {
    const note = pauseWeeklyOverlay?.querySelector('[data-pause-weekly-note]')?.value || '';
    pauseWeeklySaveNote(context.accountId, pauseWeeklyOverlayWeekKey, note);
    const button = event.target.closest('[data-pause-weekly-save-note]');
    if (button) {
      button.textContent = 'Saved';
      setTimeout(() => { if (button.isConnected) button.textContent = 'Save Note'; }, 900);
    }
    event.preventDefault();
    return;
  }

  if (event.target.closest('[data-pause-weekly-back]')) {
    if (pauseWeeklyReturnView === 'archive') {
      pauseWeeklyOverlayView = 'archive';
      pauseWeeklyOverlayWeekKey = null;
      pauseWeeklyRenderOverlay();
    } else {
      pauseWeeklyCloseOverlay();
    }
    event.preventDefault();
    return;
  }

  if (event.target.closest('[data-pause-weekly-close]')) {
    pauseWeeklyCloseOverlay();
    event.preventDefault();
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.__PAUSE_WEEKLY_REPORTS__ = {
    getStore: () => {
      const accountId = window.__PAUSE__?.getState?.().user?.id;
      return accountId ? pauseWeeklyLoadStore(accountId) : normalizePauseWeeklyReportStore();
    },
    openArchive: () => pauseWeeklyOpenOverlay('archive'),
    openReport: (weekStartKey) => {
      const context = pauseWeeklyCurrentContext();
      if (!context || !pauseWeeklyRecordFor(pauseWeeklyLoadStore(context.accountId), weekStartKey)) return false;
      pauseWeeklyMarkViewed(context.accountId, weekStartKey);
      pauseWeeklyOpenOverlay('report', weekStartKey, 'insights');
      return true;
    }
  };

  document.addEventListener('click', pauseWeeklyHandleClick);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !pauseWeeklyOverlay) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pauseWeeklyCloseOverlay();
  }, true);
  const pauseWeeklyObserver = new MutationObserver(pauseWeeklyReconcile);
  pauseWeeklyObserver.observe(document.documentElement, { childList: true, subtree: true });
  const pauseWeeklyInterval = setInterval(pauseWeeklyReconcile, 1200);
  pauseWeeklyInterval.unref?.();
  window.addEventListener('pause:state-changed', pauseWeeklyReconcile);
  window.addEventListener('pause:recovery-thief-changed', pauseWeeklyReconcile);
  window.addEventListener('focus', pauseWeeklyReconcile);
  pauseWeeklyReconcile();
}
