import { formatDuration, restInsights } from '../restState.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function ensureInsightStyles() {
  if (document.querySelector('#pause-detailed-insights-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-detailed-insights-style';
  style.textContent = `
    .pause-view-insights {
      max-height: min(84svh, 780px);
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

    .pause-rhythm-days {
      display: grid;
      gap: 10px;
    }

    .pause-rhythm-day {
      display: grid;
      grid-template-columns: 34px 1fr 58px;
      align-items: center;
      gap: 9px;
      color: #a79fac;
      font-size: .69rem;
    }

    .pause-rhythm-track {
      height: 5px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(151, 119, 201, .1);
    }

    .pause-rhythm-fill {
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
      .pause-rhythm-day { grid-template-columns: 30px 1fr 52px; gap: 7px; }
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

function insightsContent(state) {
  const insights = restInsights(state);
  const maxDaily = Math.max(1, ...insights.daily.map((day) => day.totalMs));
  const dailyRows = insights.daily.map((day) => {
    const width = day.totalMs > 0 ? Math.max(7, Math.round((day.totalMs / maxDaily) * 100)) : 0;
    return `
      <div class="pause-rhythm-day">
        <span>${escapeHtml(day.label)}</span>
        <div class="pause-rhythm-track" aria-hidden="true"><span class="pause-rhythm-fill" style="width:${width}%"></span></div>
        <span class="pause-rhythm-duration">${day.totalMs ? escapeHtml(formatDuration(day.totalMs)) : '—'}</span>
      </div>
    `;
  }).join('');

  const historyRows = state.history.slice(0, 20).map((entry) => {
    const date = new Date(Number(entry.endedAt || entry.startAt));
    const stamp = date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return `
      <div class="pause-history-row">
        <div><strong>Rest</strong><small>${escapeHtml(stamp)}</small></div>
        <span>${escapeHtml(formatDuration(entry.durationMs))}</span>
      </div>
    `;
  }).join('');

  return `
    ${panelHeader('Rest Insights')}
    <p class="system-panel-intro">Understand how consistently you're actually giving yourself permission to stop.</p>

    <section class="pause-rhythm-hero">
      <small>REST RHYTHM · LAST 7 DAYS</small>
      <strong class="pause-rhythm-value">${insights.restDays} / 7</strong>
      <p class="pause-rhythm-copy">days with at least one intentional pause</p>
    </section>

    <div class="pause-detailed-grid">
      <article><small>TOTAL REST</small><strong>${escapeHtml(formatDuration(insights.totalMs))}</strong></article>
      <article><small>PAUSES</small><strong>${insights.sessions}</strong></article>
      <article><small>AVERAGE REST</small><strong>${escapeHtml(formatDuration(insights.averageMs))}</strong></article>
      <article><small>LONGEST REST</small><strong>${escapeHtml(formatDuration(insights.longestMs))}</strong></article>
    </div>

    <section class="pause-insight-section">
      <p class="pause-insight-section-title">YOUR 7-DAY RHYTHM</p>
      <div class="pause-rhythm-days">${dailyRows}</div>
    </section>

    <section class="pause-insight-section">
      <p class="pause-insight-section-title">PATTERN</p>
      <div class="pause-pattern-row"><span>You pause most often</span><strong>${escapeHtml(insights.mostCommonTime)}</strong></div>
      <div class="pause-pattern-row"><span>Rest-day consistency</span><strong>${escapeHtml(changeCopy(insights.restDayChange, 'rest days'))}</strong></div>
      <div class="pause-pattern-row"><span>Compared with last week</span><strong>${insights.totalMsChange === 0 ? 'Same rest time' : `${insights.totalMsChange > 0 ? '+' : '−'}${escapeHtml(formatDuration(Math.abs(insights.totalMsChange)))}`}</strong></div>
    </section>

    <section class="pause-insight-section">
      <p class="pause-insight-section-title">RECENT RESTS</p>
      <div class="pause-history-list">${historyRows || '<p class="pause-empty">No rests yet. Tap the ORB when you decide to stop.</p>'}</div>
    </section>

    <p class="pause-insight-note">PAUSE reflects your rest behavior. It doesn't grade or judge it.</p>
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
