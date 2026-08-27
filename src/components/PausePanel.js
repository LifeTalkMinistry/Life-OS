import { restInsights } from '../restState.js';

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
      gap: 11px;
    }

    .pause-rhythm-day {
      display: grid;
      grid-template-columns: 68px 1fr 62px;
      align-items: center;
      gap: 10px;
      color: #a79fac;
      font-size: .69rem;
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

    .pause-rhythm-duration {
      text-align: right;
      color: #c1b7cb;
      white-space: nowrap;
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
      gap: 16px;
      padding: 13px 2px;
      border-bottom: 1px solid rgba(153, 124, 202, .11);
    }

    .pause-history-row > div {
      display: grid;
      gap: 4px;
    }

    .pause-history-row strong {
      color: #e8e2ee;
      font-size: .84rem;
      font-weight: 500;
    }

    .pause-history-row small {
      color: #837b8b;
      font-size: .68rem;
    }

    .pause-history-row > span {
      color: #b792f4;
      font-size: .74rem;
      white-space: nowrap;
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
      .pause-rhythm-day { grid-template-columns: 62px 1fr 58px; gap: 8px; }
      .pause-weekday-rank-row { grid-template-columns: 20px 64px 1fr 62px; gap: 7px; }
    }
  `;
  document.head.appendChild(style);
}

function panelHeader(title, eyebrow = 'PAUSE') {
  return `
    <div class="system-panel-header">
      <div>
        <p class="system-panel-eyebrow">${escapeHtml(eyebrow)}</p>
        <h2>${escapeHtml(title)}</h2>
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

function insightsContent(state) {
  const insights = restInsights(state);
  const maxDaily = Math.max(1, ...insights.daily.map((day) => day.totalMs));
  const dailyRows = insights.daily.map((day) => {
    const width = day.totalMs > 0 ? Math.max(7, Math.round((day.totalMs / maxDaily) * 100)) : 0;
    return `
      <div class="pause-rhythm-day">
        <div class="pause-rhythm-day-label">
          <strong>${escapeHtml(day.label)}</strong>
          <small>${escapeHtml(day.dateLabel)}</small>
        </div>
        <div class="pause-rhythm-track" aria-hidden="true"><span class="pause-rhythm-fill" style="width:${width}%"></span></div>
        <span class="pause-rhythm-duration">${day.totalMs ? escapeHtml(formatInsightDuration(day.totalMs)) : '—'}</span>
      </div>
    `;
  }).join('');

  const historyRows = state.history.slice(0, 20).map((entry) => {
    const date = new Date(Number(entry.endedAt || entry.startAt));
    const stamp = date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return `
      <div class="pause-history-row">
        <div><strong>Rest</strong><small>${escapeHtml(stamp)}</small></div>
        <span>${escapeHtml(formatInsightDuration(entry.durationMs))}</span>
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
      <p class="pause-insight-section-copy">Recent timeline · Today stays first so you can see what happened day by day.</p>
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
      <div class="pause-history-list">${historyRows || '<p class="pause-empty">No rests yet. Tap the ORB when you decide to stop.</p>'}</div>
    </section>

    <p class="pause-insight-note">PAUSE reflects your recorded rest behavior. It doesn't grade or judge it.</p>
  `;
}

export function PausePanel({ state, onClose }) {
  ensureInsightStyles();

  const backdrop = document.createElement('div');
  backdrop.className = 'system-backdrop pause-backdrop';

  const panel = document.createElement('section');
  panel.className = 'system-panel pause-panel pause-view-insights';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.innerHTML = insightsContent(state);

  panel.querySelector('[data-pause-panel-action="close"]')?.addEventListener('click', () => onClose?.());
  backdrop.addEventListener('pointerdown', (event) => {
    if (event.target === backdrop) onClose?.();
  });
  backdrop.appendChild(panel);
  return backdrop;
}
