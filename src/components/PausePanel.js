import { restAuditForDay, restInsights, savePauseState } from '../restState.js';
import { scoreForRestMs } from './PauseScore.js';
import {
  formatManilaDate,
  formatManilaDateTime,
  manilaDateKey,
  manilaDateKeyToStartMs
} from '../manilaTime.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatInsightDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  if (totalSeconds < 60) return `${totalSeconds} sec`;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  if (seconds === 0) return `${minutes} min`;
  return `${minutes}m ${seconds}s`;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function manilaDateTimeInputValue(timestamp) {
  const stamp = Number(timestamp);
  if (!Number.isFinite(stamp)) return '';
  const dateKey = manilaDateKey(stamp);
  const dayStart = manilaDateKeyToStartMs(dateKey);
  if (!Number.isFinite(dayStart)) return '';
  const totalMinutes = Math.max(0, Math.min(1439, Math.floor((stamp - dayStart) / 60_000)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${dateKey}T${pad2(hours)}:${pad2(minutes)}`;
}

function parseManilaDateTimeInput(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return NaN;
  const dayStart = manilaDateKeyToStartMs(match[1]);
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (!Number.isFinite(dayStart) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
  return dayStart + hours * 3_600_000 + minutes * 60_000;
}

function historyEntryKey(entry) {
  const explicitId = String(entry?.id || '').trim();
  if (explicitId) return explicitId;

  const startAt = Number(entry?.startAt ?? entry?.endedAt);
  if (!Number.isFinite(startAt)) return '';
  const explicitEndAt = Number(entry?.endedAt);
  const durationMs = Math.max(0, Number(entry?.durationMs || entry?.sessionDurationMs || 0));
  const endedAt = Number.isFinite(explicitEndAt) && explicitEndAt >= startAt
    ? explicitEndAt
    : startAt + durationMs;
  return `rest-${startAt}-${endedAt}`;
}

function findHistoryEntry(state, entryId) {
  const id = String(entryId || '');
  return (Array.isArray(state?.history) ? state.history : []).find((entry) => historyEntryKey(entry) === id) || null;
}

function updateRestHistoryEntry(state, entryId, startAt, endedAt) {
  const id = String(entryId || '');
  const nextStartAt = Number(startAt);
  const nextEndedAt = Number(endedAt);
  if (!id || !Number.isFinite(nextStartAt) || !Number.isFinite(nextEndedAt) || nextEndedAt < nextStartAt) return state;

  let changed = false;
  const editedAt = Date.now();
  const history = (Array.isArray(state?.history) ? state.history : []).map((entry) => {
    if (historyEntryKey(entry) !== id) return entry;
    if (Number(entry.startAt) === nextStartAt && Number(entry.endedAt) === nextEndedAt) return entry;
    changed = true;
    return {
      ...entry,
      originalStartAt: entry.originalStartAt ?? entry.startAt,
      originalEndedAt: entry.originalEndedAt ?? entry.endedAt,
      startAt: nextStartAt,
      endedAt: nextEndedAt,
      durationMs: Math.max(0, nextEndedAt - nextStartAt),
      manuallyEdited: true,
      editedAt
    };
  });

  if (!changed) return state;

  history.sort((a, b) => {
    const aStamp = Number(a?.endedAt ?? a?.startAt ?? 0);
    const bStamp = Number(b?.endedAt ?? b?.startAt ?? 0);
    return bStamp - aStamp;
  });

  return savePauseState({ ...state, history });
}

function ensureInsightStyles() {
  if (document.querySelector('#pause-detailed-insights-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-detailed-insights-style';
  style.textContent = `
    .pause-view-insights {
      max-height: min(84svh, 780px);
    }

    .pause-live-data-note {
      margin: -5px 0 14px;
      color: #746d7d;
      font-size: .6rem;
      font-weight: 600;
      letter-spacing: .11em;
      text-transform: uppercase;
    }

    .pause-live-data-note::before {
      content: '';
      display: inline-block;
      width: 5px;
      height: 5px;
      margin-right: 7px;
      border-radius: 50%;
      background: #a579ff;
      box-shadow: 0 0 8px rgba(165, 121, 255, .5);
      vertical-align: 1px;
    }

    .pause-rhythm-hero {
      margin: 4px 0 18px;
      padding: 20px 18px;
      border: 1px solid rgba(174, 126, 255, .2);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(74, 37, 124, .13), rgba(17, 10, 33, .25));
      text-align: center;
    }

    .pause-rhythm-hero small,
    .pause-insight-section-title {
      color: #92899d;
      font-size: .64rem;
      font-weight: 650;
      letter-spacing: .14em;
    }

    .pause-rhythm-value {
      display: block;
      margin-top: 7px;
      color: #f3edf9;
      font-size: clamp(2rem, 10vw, 3rem);
      font-weight: 360;
      line-height: 1;
      letter-spacing: -.03em;
    }

    .pause-rhythm-copy {
      margin: 8px 0 0;
      color: #afa6b9;
      font-size: .74rem;
      line-height: 1.45;
    }

    .pause-detailed-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 9px;
    }

    .pause-detailed-grid article {
      min-width: 0;
      padding: 14px;
      border: 1px solid rgba(155, 120, 219, .14);
      border-radius: 13px;
      background: rgba(16, 11, 33, .38);
      display: grid;
      gap: 7px;
    }

    .pause-detailed-grid small {
      color: #898190;
      font-size: .59rem;
      letter-spacing: .1em;
    }

    .pause-detailed-grid strong {
      color: #eee8f4;
      font-size: 1.12rem;
      font-weight: 430;
    }

    .pause-insight-section {
      margin-top: 24px;
    }

    .pause-insight-section-title {
      margin: 0 0 12px;
    }

    .pause-insight-section-copy {
      margin: -6px 0 13px;
      color: #7f7788;
      font-size: .66rem;
      line-height: 1.45;
    }

    .pause-rhythm-days {
      display: grid;
      gap: 6px;
    }

    .pause-rhythm-day {
      display: grid;
      grid-template-columns: 68px 1fr 72px;
      align-items: center;
      gap: 10px;
      min-width: 0;
      color: #a79fac;
      font-size: .69rem;
    }

    .pause-rhythm-day-button {
      appearance: none;
      width: 100%;
      min-height: 48px;
      margin: 0;
      padding: 6px 4px;
      border: 1px solid transparent;
      border-radius: 11px;
      background: transparent;
      text-align: left;
      cursor: pointer;
      transition: background .16s ease, border-color .16s ease;
    }

    .pause-rhythm-day-button:hover,
    .pause-rhythm-day-button:focus-visible {
      border-color: rgba(163, 118, 229, .14);
      background: rgba(91, 54, 148, .1);
      outline: none;
    }

    .pause-rhythm-day-label {
      min-width: 0;
      display: grid;
      gap: 2px;
    }

    .pause-rhythm-day-label strong {
      overflow: hidden;
      color: #c7bfce;
      font-size: .69rem;
      font-weight: 520;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pause-rhythm-day-label small {
      color: #706978;
      font-size: .57rem;
      letter-spacing: .02em;
    }

    .pause-rhythm-track,
    .pause-weekday-track {
      height: 5px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(151, 119, 201, .1);
    }

    .pause-rhythm-fill,
    .pause-weekday-fill {
      display: block;
      height: 100%;
      min-width: 0;
      border-radius: inherit;
      background: linear-gradient(90deg, rgba(104, 91, 255, .8), rgba(210, 88, 221, .88));
      box-shadow: 0 0 10px rgba(154, 91, 255, .18);
    }

    .pause-rhythm-day-tail {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 7px;
      min-width: 0;
    }

    .pause-rhythm-duration {
      color: #c1b7cb;
      white-space: nowrap;
    }

    .pause-rhythm-chevron {
      color: #655c6f;
      font-size: .86rem;
      line-height: 1;
    }

    .pause-weekday-learning {
      padding: 17px 16px;
      border: 1px solid rgba(164, 121, 226, .15);
      border-radius: 15px;
      background: rgba(20, 12, 40, .34);
    }

    .pause-weekday-learning strong {
      display: block;
      margin-bottom: 7px;
      color: #dcd3e7;
      font-size: .8rem;
      font-weight: 540;
      letter-spacing: .04em;
    }

    .pause-weekday-learning p {
      margin: 0;
      color: #8f8798;
      font-size: .72rem;
      line-height: 1.55;
    }

    .pause-weekday-progress {
      display: flex;
      gap: 14px;
      margin-top: 12px;
      color: #a496b3;
      font-size: .66rem;
    }

    .pause-weekday-summary {
      display: grid;
      gap: 5px;
      margin-bottom: 14px;
      padding: 15px 16px;
      border: 1px solid rgba(174, 126, 255, .18);
      border-radius: 15px;
      background: linear-gradient(180deg, rgba(75, 38, 123, .12), rgba(20, 12, 39, .22));
    }

    .pause-weekday-summary small {
      color: #81768d;
      font-size: .58rem;
      font-weight: 650;
      letter-spacing: .12em;
    }

    .pause-weekday-summary strong {
      color: #efe8f6;
      font-size: 1.08rem;
      font-weight: 480;
    }

    .pause-weekday-summary span {
      color: #9b90a7;
      font-size: .69rem;
    }

    .pause-weekday-rank-list {
      display: grid;
      gap: 11px;
    }

    .pause-weekday-rank-row {
      display: grid;
      grid-template-columns: 24px 72px 1fr 68px;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .pause-weekday-rank {
      color: #746b7d;
      font-size: .63rem;
      font-variant-numeric: tabular-nums;
    }

    .pause-weekday-name {
      overflow: hidden;
      color: #c7bfce;
      font-size: .69rem;
      font-weight: 510;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pause-weekday-average {
      color: #baafc5;
      font-size: .66rem;
      text-align: right;
      white-space: nowrap;
    }

    .pause-pattern-row {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      padding: 12px 0;
      border-bottom: 1px solid rgba(153, 124, 202, .11);
    }

    .pause-pattern-row:last-child { border-bottom: 0; }

    .pause-pattern-row span {
      color: #91899b;
      font-size: .72rem;
    }

    .pause-pattern-row strong {
      color: #ddd5e6;
      font-size: .76rem;
      font-weight: 520;
      text-align: right;
    }

    .pause-history-list {
      display: grid;
    }

    .pause-history-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 13px 2px;
      border-bottom: 1px solid rgba(153, 124, 202, .11);
    }

    .pause-history-row-main {
      min-width: 0;
      display: grid;
      gap: 4px;
    }

    .pause-history-row-main strong {
      overflow: hidden;
      color: #e8e2ee;
      font-size: .84rem;
      font-weight: 500;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pause-history-row-main small {
      color: #837b8b;
      font-size: .68rem;
    }

    .pause-history-row-tail {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      flex: 0 0 auto;
    }

    .pause-history-duration {
      color: #b792f4;
      font-size: .74rem;
      white-space: nowrap;
    }

    .pause-history-edit-button,
    .pause-audit-edit-button {
      appearance: none;
      min-height: 30px;
      padding: 0 9px;
      border: 1px solid rgba(169, 126, 235, .2);
      border-radius: 8px;
      background: rgba(92, 55, 151, .1);
      color: #a998b8;
      font-size: .56rem;
      font-weight: 700;
      letter-spacing: .09em;
      cursor: pointer;
    }

    .pause-history-edit-button:hover,
    .pause-history-edit-button:focus-visible,
    .pause-audit-edit-button:hover,
    .pause-audit-edit-button:focus-visible {
      border-color: rgba(180, 137, 247, .34);
      background: rgba(104, 63, 174, .18);
      color: #eee6f6;
      outline: none;
    }

    .pause-panel-heading {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .pause-panel-heading > div {
      min-width: 0;
    }

    .pause-audit-back {
      appearance: none;
      display: grid;
      place-items: center;
      flex: 0 0 32px;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 1px solid rgba(159, 121, 218, .15);
      border-radius: 50%;
      background: rgba(79, 47, 130, .08);
      color: #b9afc3;
      font-size: 1rem;
      cursor: pointer;
    }

    .pause-audit-back:hover,
    .pause-audit-back:focus-visible {
      border-color: rgba(170, 128, 235, .28);
      background: rgba(94, 55, 158, .16);
      color: #eee7f5;
      outline: none;
    }

    .pause-audit-score {
      margin: 4px 0 12px;
      padding: 20px 18px 18px;
      border: 1px solid rgba(174, 126, 255, .2);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(74, 37, 124, .14), rgba(17, 10, 33, .26));
      text-align: center;
    }

    .pause-audit-score small {
      color: #92899d;
      font-size: .61rem;
      font-weight: 650;
      letter-spacing: .14em;
    }

    .pause-audit-score strong {
      display: block;
      margin: 6px 0 8px;
      color: #f3edf9;
      font-size: clamp(2.6rem, 12vw, 3.65rem);
      font-weight: 330;
      line-height: 1;
    }

    .pause-audit-score p {
      margin: 0;
      color: #91879c;
      font-size: .7rem;
      line-height: 1.5;
    }

    .pause-audit-summary {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 9px;
      margin-bottom: 22px;
    }

    .pause-audit-summary article {
      display: grid;
      gap: 7px;
      min-width: 0;
      padding: 14px;
      border: 1px solid rgba(155, 120, 219, .14);
      border-radius: 13px;
      background: rgba(16, 11, 33, .38);
    }

    .pause-audit-summary small {
      color: #898190;
      font-size: .59rem;
      letter-spacing: .1em;
    }

    .pause-audit-summary strong {
      color: #eee8f4;
      font-size: 1.08rem;
      font-weight: 430;
    }

    .pause-audit-list {
      display: grid;
      gap: 9px;
    }

    .pause-audit-entry {
      padding: 14px 15px;
      border: 1px solid rgba(155, 120, 219, .13);
      border-radius: 14px;
      background: rgba(15, 10, 29, .34);
    }

    .pause-audit-entry.is-editing {
      border-color: rgba(174, 126, 255, .28);
      background: rgba(25, 15, 45, .48);
    }

    .pause-audit-entry-head,
    .pause-audit-credit {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .pause-audit-entry-head strong {
      overflow: hidden;
      color: #e9e2ef;
      font-size: .83rem;
      font-weight: 520;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pause-audit-entry-head-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 7px;
      flex: 0 0 auto;
    }

    .pause-audit-entry-status {
      color: #766d80;
      font-size: .59rem;
      font-weight: 650;
      letter-spacing: .08em;
      white-space: nowrap;
    }

    .pause-audit-range {
      margin: 7px 0 12px;
      color: #81788a;
      font-size: .68rem;
      line-height: 1.45;
    }

    .pause-audit-edited-note {
      margin: -5px 0 11px;
      color: #8d78a6;
      font-size: .59rem;
      font-weight: 650;
      letter-spacing: .06em;
      text-transform: uppercase;
    }

    .pause-audit-credit {
      padding-top: 10px;
      border-top: 1px solid rgba(150, 115, 203, .1);
    }

    .pause-audit-credit span {
      color: #91889a;
      font-size: .65rem;
    }

    .pause-audit-credit strong {
      color: #c6a8f5;
      font-size: .75rem;
      font-weight: 540;
      white-space: nowrap;
    }

    .pause-audit-split-note {
      margin: 9px 0 0;
      color: #736a7c;
      font-size: .62rem;
      line-height: 1.45;
    }

    .pause-audit-edit-form {
      display: grid;
      gap: 11px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(150, 115, 203, .12);
    }

    .pause-audit-edit-grid {
      display: grid;
      gap: 9px;
    }

    .pause-audit-edit-field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .pause-audit-edit-field > span {
      color: #82788d;
      font-size: .58rem;
      font-weight: 650;
      letter-spacing: .1em;
      text-transform: uppercase;
    }

    .pause-audit-edit-field input {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      min-height: 43px;
      padding: 0 10px;
      border: 1px solid rgba(163, 121, 226, .2);
      border-radius: 10px;
      background: rgba(12, 8, 24, .72);
      color: #eee7f5;
      font: inherit;
      font-size: .72rem;
      color-scheme: dark;
      outline: none;
    }

    .pause-audit-edit-field input:focus {
      border-color: rgba(181, 135, 246, .42);
      background: rgba(18, 11, 34, .9);
    }

    .pause-audit-edit-duration {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 0;
      border-top: 1px solid rgba(150, 115, 203, .09);
      border-bottom: 1px solid rgba(150, 115, 203, .09);
    }

    .pause-audit-edit-duration span {
      color: #91889a;
      font-size: .65rem;
    }

    .pause-audit-edit-duration strong {
      color: #c6a8f5;
      font-size: .76rem;
      font-weight: 560;
    }

    .pause-audit-edit-error {
      min-height: 1em;
      margin: -2px 0 0;
      color: #c39bc9;
      font-size: .63rem;
      line-height: 1.4;
    }

    .pause-audit-edit-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .pause-audit-edit-cancel,
    .pause-audit-edit-save {
      appearance: none;
      min-height: 38px;
      padding: 0 13px;
      border-radius: 10px;
      font-size: .62rem;
      font-weight: 700;
      letter-spacing: .07em;
      cursor: pointer;
    }

    .pause-audit-edit-cancel {
      border: 1px solid rgba(153, 119, 202, .15);
      background: transparent;
      color: #968d9f;
    }

    .pause-audit-edit-save {
      border: 1px solid rgba(182, 138, 248, .28);
      background: rgba(105, 65, 184, .2);
      color: #e9dff4;
    }

    .pause-audit-edit-cancel:hover,
    .pause-audit-edit-cancel:focus-visible,
    .pause-audit-edit-save:hover,
    .pause-audit-edit-save:focus-visible {
      outline: none;
      border-color: rgba(184, 139, 249, .4);
      color: #f3ecf8;
    }

    .pause-audit-empty {
      padding: 22px 18px;
      border: 1px solid rgba(155, 120, 219, .12);
      border-radius: 14px;
      color: #8f8798;
      background: rgba(15, 10, 29, .28);
      font-size: .73rem;
      line-height: 1.55;
      text-align: center;
    }

    .pause-insight-note,
    .pause-empty {
      color: #8f8798;
      font-size: .75rem;
      line-height: 1.5;
    }

    .pause-insight-note {
      margin: 22px 0 2px;
      text-align: center;
    }

    @media (max-width: 390px) {
      .pause-detailed-grid { grid-template-columns: 1fr 1fr; }
      .pause-rhythm-day { grid-template-columns: 62px 1fr 68px; gap: 8px; }
      .pause-weekday-rank-row { grid-template-columns: 20px 64px 1fr 62px; gap: 7px; }
      .pause-history-row { align-items: flex-start; }
      .pause-history-row-tail { flex-direction: column; align-items: flex-end; gap: 5px; }
    }
  `;
  document.head.appendChild(style);
}

function panelHeader(title, eyebrow = 'PAUSE', back = false) {
  return `
    <div class="system-panel-header">
      <div class="pause-panel-heading">
        ${back ? '<button type="button" class="pause-audit-back" data-pause-panel-action="back" aria-label="Back to Rest Insights">←</button>' : ''}
        <div>
          <p class="system-panel-eyebrow">${escapeHtml(eyebrow)}</p>
          <h2>${escapeHtml(title)}</h2>
        </div>
      </div>
      <button type="button" class="system-panel-close" data-pause-panel-action="close" aria-label="Close">×</button>
    </div>
  `;
}

function changeCopy(value, noun) {
  if (value > 0) return `+${value} ${noun} vs last week`;
  if (value < 0) return `${Math.abs(value)} fewer ${noun} vs last week`;
  return `Same ${noun} as last week`;
}

function weekdayPatternMarkup(pattern) {
  if (!pattern.ready) {
    const calendarProgress = Math.min(pattern.daysObserved, 14);
    const restDayProgress = Math.min(pattern.restDaysObserved, 4);
    return `
      <div class="pause-weekday-learning">
        <strong>LEARNING YOUR REST PATTERN</strong>
        <p>PAUSE won't rank your weekdays from only a few rests. Keep using the ORB and it will learn which days you consistently make the most room to stop.</p>
        <div class="pause-weekday-progress">
          <span>${calendarProgress} / 14 days observed</span>
          <span>${restDayProgress} / 4 rest days</span>
        </div>
      </div>
    `;
  }

  const maxAverage = Math.max(1, ...pattern.ranked.map((day) => day.averageMs));
  const rows = pattern.ranked.map((day) => {
    const width = day.averageMs > 0 ? Math.max(5, Math.round((day.averageMs / maxAverage) * 100)) : 0;
    return `
      <div class="pause-weekday-rank-row">
        <span class="pause-weekday-rank">#${day.rank}</span>
        <span class="pause-weekday-name">${escapeHtml(day.label)}</span>
        <div class="pause-weekday-track" aria-hidden="true"><span class="pause-weekday-fill" style="width:${width}%"></span></div>
        <span class="pause-weekday-average">${escapeHtml(formatInsightDuration(day.averageMs))}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="pause-weekday-summary">
      <small>YOUR STRONGEST REST DAY</small>
      <strong>${escapeHtml(pattern.strongest.label)}</strong>
      <span>${escapeHtml(formatInsightDuration(pattern.strongest.averageMs))} average rest per ${escapeHtml(pattern.strongest.label)}</span>
    </div>
    <div class="pause-weekday-rank-list">${rows}</div>
  `;
}

function auditRange(entry) {
  const startKey = manilaDateKey(entry.startAt);
  const endKey = manilaDateKey(entry.endedAt);

  if (startKey === endKey) {
    const start = formatManilaDateTime(entry.startAt, { hour: 'numeric', minute: '2-digit' });
    const end = formatManilaDateTime(entry.endedAt, { hour: 'numeric', minute: '2-digit' });
    return `${start} → ${end}`;
  }

  const start = formatManilaDateTime(entry.startAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const end = formatManilaDateTime(entry.endedAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return `${start} → ${end}`;
}

function insightsContent(state) {
  const insights = restInsights(state);
  const maxDaily = Math.max(1, ...insights.daily.map((day) => day.totalMs));
  const dailyRows = insights.daily.map((day) => {
    const width = day.totalMs > 0 ? Math.max(7, Math.round((day.totalMs / maxDaily) * 100)) : 0;
    return `
      <button type="button" class="pause-rhythm-day pause-rhythm-day-button" data-pause-day-key="${escapeHtml(day.key)}" aria-label="Open ${escapeHtml(day.label)} ${escapeHtml(day.dateLabel)} rest audit">
        <div class="pause-rhythm-day-label">
          <strong>${escapeHtml(day.label)}</strong>
          <small>${escapeHtml(day.dateLabel)}</small>
        </div>
        <div class="pause-rhythm-track" aria-hidden="true"><span class="pause-rhythm-fill" style="width:${width}%"></span></div>
        <span class="pause-rhythm-day-tail">
          <span class="pause-rhythm-duration">${day.totalMs ? escapeHtml(formatInsightDuration(day.totalMs)) : '—'}</span>
          <span class="pause-rhythm-chevron" aria-hidden="true">›</span>
        </span>
      </button>
    `;
  }).join('');

  const historyRows = state.history.slice(0, 20).map((entry) => {
    const entryId = historyEntryKey(entry);
    const stamp = formatManilaDateTime(Number(entry.endedAt || entry.startAt), {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
    const editDayKey = manilaDateKey(Number(entry.startAt || entry.endedAt));
    const editedText = entry.manuallyEdited || entry.editedAt ? ' · Edited' : '';
    return `
      <div class="pause-history-row">
        <div class="pause-history-row-main">
          <strong>${escapeHtml(entry.label || 'Rest')}</strong>
          <small>${escapeHtml(stamp)} · Manila${editedText}</small>
        </div>
        <div class="pause-history-row-tail">
          <span class="pause-history-duration">${escapeHtml(formatInsightDuration(entry.durationMs))}</span>
          ${entryId ? `<button type="button" class="pause-history-edit-button" data-pause-history-edit-id="${escapeHtml(entryId)}" data-pause-history-day-key="${escapeHtml(editDayKey)}" aria-label="Edit ${escapeHtml(entry.label || 'Rest')} rest time">EDIT</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    ${panelHeader('Rest Insights')}
    <p class="system-panel-intro">Understand how consistently you're actually giving yourself permission to stop.</p>
    <p class="pause-live-data-note">Calculated from your completed rests</p>

    <section class="pause-rhythm-hero">
      <small>REST RHYTHM · LAST 7 CALENDAR DAYS</small>
      <strong class="pause-rhythm-value">${insights.restDays} / 7</strong>
      <p class="pause-rhythm-copy">days with at least one intentional pause</p>
    </section>

    <div class="pause-detailed-grid">
      <article><small>TOTAL REST</small><strong>${escapeHtml(formatInsightDuration(insights.totalMs))}</strong></article>
      <article><small>PAUSES</small><strong>${insights.sessions}</strong></article>
      <article><small>AVERAGE REST</small><strong>${escapeHtml(formatInsightDuration(insights.averageMs))}</strong></article>
      <article><small>LONGEST REST</small><strong>${escapeHtml(formatInsightDuration(insights.longestMs))}</strong></article>
    </div>

    <section class="pause-insight-section">
      <p class="pause-insight-section-title">YOUR 7-DAY RHYTHM</p>
      <p class="pause-insight-section-copy">Tap any day to audit the exact rests credited to that Manila calendar date.</p>
      <div class="pause-rhythm-days">${dailyRows}</div>
    </section>

    <section class="pause-insight-section">
      <p class="pause-insight-section-title">YOUR REST PATTERN · BY WEEKDAY</p>
      <p class="pause-insight-section-copy">Learned from up to the last 4 weeks. Once enough history exists, weekdays rank from your highest average rest to your lowest.</p>
      ${weekdayPatternMarkup(insights.weekdayPattern)}
    </section>

    <section class="pause-insight-section">
      <p class="pause-insight-section-title">PATTERN</p>
      <div class="pause-pattern-row"><span>You pause most often</span><strong>${escapeHtml(insights.mostCommonTime)}</strong></div>
      <div class="pause-pattern-row"><span>Rest-day consistency</span><strong>${escapeHtml(changeCopy(insights.restDayChange, 'rest days'))}</strong></div>
      <div class="pause-pattern-row"><span>Compared with last week</span><strong>${insights.totalMsChange === 0 ? 'Same rest time' : `${insights.totalMsChange > 0 ? '+' : '−'}${escapeHtml(formatInsightDuration(Math.abs(insights.totalMsChange)))}`}</strong></div>
    </section>

    <section class="pause-insight-section">
      <p class="pause-insight-section-title">RECENT RESTS</p>
      <p class="pause-insight-section-copy">Edit a rest if the recorded start or end time does not match what actually happened.</p>
      <div class="pause-history-list">${historyRows || '<p class="pause-empty">No rests yet. Tap the ORB when you decide to stop.</p>'}</div>
    </section>

    <p class="pause-insight-note">PAUSE reflects your recorded rest behavior. It doesn't grade or judge it.</p>
  `;
}

function auditReason(entry) {
  if (entry.reason === 'timer-complete') return 'COMPLETED';
  if (entry.reason === 'ended') return 'ENDED';
  return 'RECORDED';
}

function auditEditForm(entry, entryId) {
  const maxValue = manilaDateTimeInputValue(Date.now());
  return `
    <form class="pause-audit-edit-form" data-pause-edit-form="${escapeHtml(entryId)}">
      <div class="pause-audit-edit-grid">
        <label class="pause-audit-edit-field">
          <span>Actual start · Manila</span>
          <input type="datetime-local" name="startAt" step="60" max="${escapeHtml(maxValue)}" value="${escapeHtml(manilaDateTimeInputValue(entry.startAt))}" data-pause-edit-start required>
        </label>
        <label class="pause-audit-edit-field">
          <span>Actual end · Manila</span>
          <input type="datetime-local" name="endedAt" step="60" max="${escapeHtml(maxValue)}" value="${escapeHtml(manilaDateTimeInputValue(entry.endedAt))}" data-pause-edit-end required>
        </label>
      </div>
      <div class="pause-audit-edit-duration">
        <span>Actual rest</span>
        <strong data-pause-edit-duration>${escapeHtml(formatInsightDuration(entry.sessionDurationMs))}</strong>
      </div>
      <p class="pause-audit-edit-error" data-pause-edit-error aria-live="polite"></p>
      <div class="pause-audit-edit-actions">
        <button type="button" class="pause-audit-edit-cancel" data-pause-panel-action="cancel-edit">Cancel</button>
        <button type="submit" class="pause-audit-edit-save">Save Changes</button>
      </div>
    </form>
  `;
}

function dayAuditContent(state, dayKey, editingEntryId = null) {
  const audit = restAuditForDay(state, dayKey);
  const score = scoreForRestMs(audit.totalMs);
  const dayStart = manilaDateKeyToStartMs(dayKey);
  const dateTitle = formatManilaDate(dayStart, { month: 'long', day: 'numeric', year: 'numeric' });
  const weekday = formatManilaDate(dayStart, { weekday: 'long' });
  const shortDate = formatManilaDate(dayStart, { month: 'short', day: 'numeric' });

  const entries = audit.entries.map((entry) => {
    const entryId = historyEntryKey(entry);
    const sourceEntry = findHistoryEntry(state, entryId);
    const isEditing = Boolean(entryId && editingEntryId === entryId);
    const wasEdited = Boolean(sourceEntry?.manuallyEdited || sourceEntry?.editedAt);

    return `
      <article class="pause-audit-entry${isEditing ? ' is-editing' : ''}">
        <div class="pause-audit-entry-head">
          <strong>${escapeHtml(entry.label)}</strong>
          <div class="pause-audit-entry-head-actions">
            <span class="pause-audit-entry-status">${escapeHtml(auditReason(entry))}</span>
            ${!isEditing && entryId ? `<button type="button" class="pause-audit-edit-button" data-pause-edit-entry-id="${escapeHtml(entryId)}" aria-label="Edit ${escapeHtml(entry.label)} rest time">EDIT</button>` : ''}
          </div>
        </div>
        ${isEditing ? auditEditForm(entry, entryId) : `
          <p class="pause-audit-range">${escapeHtml(auditRange(entry))} · Manila<br>Session total: ${escapeHtml(formatInsightDuration(entry.sessionDurationMs))}</p>
          ${wasEdited ? '<p class="pause-audit-edited-note">Edited manually</p>' : ''}
          <div class="pause-audit-credit">
            <span>Credited to ${escapeHtml(shortDate)}</span>
            <strong>${escapeHtml(formatInsightDuration(entry.creditedMs))}</strong>
          </div>
          ${entry.splitAcrossDays ? `<p class="pause-audit-split-note">This rest crossed Manila midnight. Only the portion inside ${escapeHtml(shortDate)} is included in this day's total and score.</p>` : ''}
        `}
      </article>
    `;
  }).join('');

  return `
    ${panelHeader(dateTitle, 'DAILY AUDIT · MANILA TIME', true)}
    <p class="system-panel-intro">${escapeHtml(weekday)} · Exact completed rests that produced this day's PAUSE metrics.</p>
    <p class="pause-live-data-note">Audited from completed rest history</p>

    <section class="pause-audit-score">
      <small>DAILY PAUSE SCORE</small>
      <strong>${score}</strong>
      <p>Built from ${escapeHtml(formatInsightDuration(audit.totalMs))} of rest credited specifically to ${escapeHtml(dateTitle)}.</p>
    </section>

    <div class="pause-audit-summary">
      <article><small>TOTAL REST</small><strong>${escapeHtml(formatInsightDuration(audit.totalMs))}</strong></article>
      <article><small>REST ENTRIES</small><strong>${audit.sessions}</strong></article>
    </div>

    <section class="pause-insight-section">
      <p class="pause-insight-section-title">REST BREAKDOWN</p>
      <p class="pause-insight-section-copy">These entries reconstruct the total above. Cross-midnight rests are split at Manila midnight. Edit only the real start or end time; PAUSE recalculates the duration automatically.</p>
      <div class="pause-audit-list">
        ${entries || `<div class="pause-audit-empty">No completed rests were credited to ${escapeHtml(dateTitle)}. This day's audited total is 0.</div>`}
      </div>
    </section>

    <p class="pause-insight-note">This audit uses Asia/Manila calendar boundaries, regardless of the device timezone.</p>
  `;
}

function updateEditPreview(form) {
  const startAt = parseManilaDateTimeInput(form.querySelector('[name="startAt"]')?.value);
  const endedAt = parseManilaDateTimeInput(form.querySelector('[name="endedAt"]')?.value);
  const duration = form.querySelector('[data-pause-edit-duration]');
  const error = form.querySelector('[data-pause-edit-error]');

  if (!Number.isFinite(startAt) || !Number.isFinite(endedAt)) {
    if (duration) duration.textContent = '—';
    if (error) error.textContent = 'Choose both the actual start and end time.';
    return false;
  }
  if (endedAt < startAt) {
    if (duration) duration.textContent = '—';
    if (error) error.textContent = 'End time must be after the start time.';
    return false;
  }
  if (endedAt > Date.now() + 60_000) {
    if (duration) duration.textContent = formatInsightDuration(endedAt - startAt);
    if (error) error.textContent = 'End time cannot be in the future.';
    return false;
  }

  if (duration) duration.textContent = formatInsightDuration(endedAt - startAt);
  if (error) error.textContent = '';
  return true;
}

export function PausePanel({ state, onClose }) {
  ensureInsightStyles();

  const backdrop = document.createElement('div');
  backdrop.className = 'system-backdrop pause-backdrop';

  const panel = document.createElement('section');
  panel.className = 'system-panel pause-panel pause-view-insights';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  let panelState = state;
  let selectedDayKey = null;
  let editingEntryId = null;

  const renderContent = ({ resetScroll = true } = {}) => {
    const previousScrollTop = panel.scrollTop;
    panel.innerHTML = selectedDayKey
      ? dayAuditContent(panelState, selectedDayKey, editingEntryId)
      : insightsContent(panelState);
    panel.scrollTop = resetScroll ? 0 : previousScrollTop;
  };

  const focusEditor = () => {
    panel.querySelector('[data-pause-edit-start]')?.focus();
  };

  renderContent();

  panel.addEventListener('click', (event) => {
    const action = event.target.closest('[data-pause-panel-action]')?.dataset.pausePanelAction;
    if (action === 'close') {
      onClose?.();
      return;
    }
    if (action === 'back') {
      editingEntryId = null;
      selectedDayKey = null;
      renderContent();
      return;
    }
    if (action === 'cancel-edit') {
      editingEntryId = null;
      renderContent({ resetScroll: false });
      return;
    }

    const historyEditButton = event.target.closest('[data-pause-history-edit-id]');
    if (historyEditButton?.dataset.pauseHistoryEditId) {
      editingEntryId = historyEditButton.dataset.pauseHistoryEditId;
      selectedDayKey = historyEditButton.dataset.pauseHistoryDayKey || null;
      renderContent();
      focusEditor();
      return;
    }

    const editButton = event.target.closest('[data-pause-edit-entry-id]');
    if (editButton?.dataset.pauseEditEntryId) {
      editingEntryId = editButton.dataset.pauseEditEntryId;
      renderContent({ resetScroll: false });
      focusEditor();
      return;
    }

    const dayButton = event.target.closest('[data-pause-day-key]');
    if (dayButton?.dataset.pauseDayKey) {
      editingEntryId = null;
      selectedDayKey = dayButton.dataset.pauseDayKey;
      renderContent();
    }
  });

  panel.addEventListener('input', (event) => {
    const form = event.target.closest('[data-pause-edit-form]');
    if (form) updateEditPreview(form);
  });

  panel.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-pause-edit-form]');
    if (!form) return;
    event.preventDefault();

    if (!updateEditPreview(form)) return;

    const entryId = form.dataset.pauseEditForm;
    const startAt = parseManilaDateTimeInput(form.querySelector('[name="startAt"]')?.value);
    const endedAt = parseManilaDateTimeInput(form.querySelector('[name="endedAt"]')?.value);
    const nextState = updateRestHistoryEntry(panelState, entryId, startAt, endedAt);

    panelState = nextState;
    editingEntryId = null;
    renderContent({ resetScroll: false });
  });

  backdrop.addEventListener('pointerdown', (event) => {
    if (event.target === backdrop) onClose?.();
  });
  backdrop.appendChild(panel);
  return backdrop;
}
