/* PAUSE Activity Insights parity layer.
 * Keeps Activity tracking logic unchanged while matching the visual/reporting
 * hierarchy used by Rest Insights: status -> 7-day rhythm -> streak -> weekday pattern.
 */
(() => {
  const STYLE_ID = 'pause-activity-insights-parity-style';
  const PREFIX = 'pause-activity-commitments-v1';
  const USER_KEY = 'pause_backend_user_v1';
  const DAY_MS = 86_400_000;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function accountId() {
    try {
      const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
      return String(user?.id ?? user?.user_id ?? user?.userId ?? 'guest').trim() || 'guest';
    } catch {
      return 'guest';
    }
  }

  function readState() {
    try {
      const value = JSON.parse(localStorage.getItem(`${PREFIX}:account:${accountId()}`) || 'null');
      return {
        activities: Array.isArray(value?.activities) ? value.activities : [],
        sessions: Array.isArray(value?.sessions) ? value.sessions : [],
        active: value?.active || null
      };
    } catch {
      return { activities: [], sessions: [], active: null };
    }
  }

  function manilaKey(ms = Date.now()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function dayStart(key) {
    const [year, month, day] = String(key).split('-').map(Number);
    return Date.UTC(year, month - 1, day, -8, 0, 0, 0);
  }

  function addDays(key, days) {
    return manilaKey(dayStart(key) + Number(days || 0) * DAY_MS);
  }

  function weekdayName(key) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila', weekday: 'long'
    }).format(new Date(dayStart(key) + 12 * 3_600_000));
  }

  function duration(ms) {
    const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
    if (totalSeconds < 60) return `${totalSeconds} sec`;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (!hours) return `${minutes} min`;
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  function sessionsFor(state, activityId, now = Date.now()) {
    const completed = state.sessions
      .filter((session) => String(session?.activityId) === String(activityId))
      .map((session) => ({
        startAt: Number(session.startAt),
        endAt: Number(session.endAt)
      }))
      .filter((session) => Number.isFinite(session.startAt) && Number.isFinite(session.endAt) && session.endAt >= session.startAt);

    if (String(state.active?.activityId) === String(activityId) && Number(state.active?.startAt)) {
      completed.push({ startAt: Number(state.active.startAt), endAt: now });
    }
    return completed;
  }

  function overlap(startAt, endAt, rangeStart, rangeEnd) {
    return Math.max(0, Math.min(endAt, rangeEnd) - Math.max(startAt, rangeStart));
  }

  function totalForDay(sessions, key, now = Date.now()) {
    const start = dayStart(key);
    const end = Math.min(start + DAY_MS, now);
    if (end <= start) return 0;
    return sessions.reduce((sum, session) => sum + overlap(session.startAt, session.endAt, start, end), 0);
  }

  function activityAnalysis(activityId, now = Date.now()) {
    const state = readState();
    const activity = state.activities.find((item) => String(item?.id) === String(activityId));
    if (!activity) return null;

    const sessions = sessionsFor(state, activityId, now);
    const today = manilaKey(now);
    const createdKey = manilaKey(Number(activity.createdAt) || now);
    const earliestLookback = addDays(today, -27);
    const firstKey = createdKey > earliestLookback ? createdKey : earliestLookback;
    const days = [];

    for (let key = firstKey; key <= today; key = addDays(key, 1)) {
      if (activity.endDate && key > activity.endDate) break;
      days.push({ key, totalMs: totalForDay(sessions, key, now) });
    }

    const buckets = new Map(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((label) => [label, { label, totalMs: 0, occurrences: 0 }]));
    days.forEach((day) => {
      const label = weekdayName(day.key);
      const bucket = buckets.get(label);
      if (!bucket) return;
      bucket.totalMs += day.totalMs;
      bucket.occurrences += 1;
    });

    const ranked = [...buckets.values()]
      .map((bucket) => ({
        ...bucket,
        averageMs: bucket.occurrences ? bucket.totalMs / bucket.occurrences : 0
      }))
      .sort((a, b) => b.averageMs - a.averageMs || a.label.localeCompare(b.label))
      .map((day, index) => ({ ...day, rank: index + 1 }));

    const activityDaysObserved = days.filter((day) => day.totalMs > 0).length;
    const ready = days.length >= 14 && activityDaysObserved >= 4;

    let streak = 0;
    let cursor = today;
    if (totalForDay(sessions, today, now) <= 0) cursor = addDays(today, -1);
    for (let index = 0; index < 365 && cursor >= createdKey; index += 1) {
      if (activity.endDate && cursor > activity.endDate) {
        cursor = addDays(cursor, -1);
        continue;
      }
      if (totalForDay(sessions, cursor, now) <= 0) break;
      streak += 1;
      cursor = addDays(cursor, -1);
    }

    const currentStart = addDays(today, -6);
    const previousStart = addDays(today, -13);
    const previousEnd = addDays(today, -7);
    const aggregate = (startKey, endKey) => {
      let totalMs = 0;
      let activeDays = 0;
      for (let key = startKey; key <= endKey; key = addDays(key, 1)) {
        if (key < createdKey || (activity.endDate && key > activity.endDate)) continue;
        const dayTotal = totalForDay(sessions, key, now);
        totalMs += dayTotal;
        if (dayTotal > 0) activeDays += 1;
      }
      return { totalMs, activeDays };
    };
    const current = aggregate(currentStart, today);
    const previous = aggregate(previousStart, previousEnd);

    const timeBuckets = { Morning: 0, Afternoon: 0, Evening: 0, 'Late night': 0 };
    sessions.forEach((session) => {
      if (session.startAt < dayStart(earliestLookback)) return;
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila', hour: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date(session.startAt)).map((part) => [part.type, part.value]));
      const hour = Number(parts.hour);
      const label = hour >= 5 && hour < 12 ? 'Morning'
        : hour >= 12 && hour < 17 ? 'Afternoon'
          : hour >= 17 && hour < 21 ? 'Evening'
            : 'Late night';
      timeBuckets[label] += Math.max(0, session.endAt - session.startAt);
    });
    const mostCommonTime = Object.entries(timeBuckets).sort((a, b) => b[1] - a[1])[0]?.[1] > 0
      ? Object.entries(timeBuckets).sort((a, b) => b[1] - a[1])[0][0]
      : 'Not enough data';

    return {
      activity,
      ready,
      daysObserved: days.length,
      activityDaysObserved,
      ranked,
      strongest: ranked[0],
      streak,
      mostCommonTime,
      activityDayChange: current.activeDays - previous.activeDays,
      totalMsChange: current.totalMs - previous.totalMs
    };
  }

  function changeCopy(value) {
    if (value > 0) return `+${value} activity day${value === 1 ? '' : 's'} vs last week`;
    if (value < 0) return `${Math.abs(value)} fewer activity day${Math.abs(value) === 1 ? '' : 's'} vs last week`;
    return 'Same activity days as last week';
  }

  function weekdayMarkup(analysis) {
    if (!analysis.ready) {
      return `
        <div class="activity-weekday-learning">
          <strong>LEARNING YOUR ACTIVITY PATTERN</strong>
          <p>PAUSE won't rank weekdays from only a few sessions. Keep tracking this activity and it will learn which days you consistently give it the most time.</p>
          <div class="activity-weekday-progress">
            <span>${Math.min(analysis.daysObserved, 14)} / 14 days observed</span>
            <span>${Math.min(analysis.activityDaysObserved, 4)} / 4 activity days</span>
          </div>
        </div>`;
    }

    const maxAverage = Math.max(1, ...analysis.ranked.map((day) => day.averageMs));
    const rows = analysis.ranked.map((day) => {
      const width = day.averageMs > 0 ? Math.max(5, Math.round((day.averageMs / maxAverage) * 100)) : 0;
      return `<div class="activity-weekday-row">
        <span class="activity-weekday-rank">#${day.rank}</span>
        <span class="activity-weekday-name">${esc(day.label)}</span>
        <div class="activity-weekday-track" aria-hidden="true"><span class="activity-weekday-fill" style="width:${width}%"></span></div>
        <span class="activity-weekday-average">${esc(duration(day.averageMs))}</span>
      </div>`;
    }).join('');

    return `
      <div class="activity-weekday-summary">
        <small>YOUR STRONGEST ACTIVITY DAY</small>
        <strong>${esc(analysis.strongest.label)}</strong>
        <span>${esc(duration(analysis.strongest.averageMs))} average per ${esc(analysis.strongest.label)}</span>
      </div>
      <div class="activity-weekday-list">${rows}</div>`;
  }

  function ensureStyles() {
    if (document.querySelector(`#${STYLE_ID}`)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .activity-panel[data-activity-report-view] .activity-rhythm-card {
        box-sizing:border-box;width:100%;margin:18px 0 20px;padding:18px 16px 14px;
        border:1px solid rgba(174,126,255,.22);border-radius:16px;
        background:linear-gradient(180deg,rgba(43,25,72,.48),rgba(14,9,29,.6));
        box-shadow:inset 0 0 30px rgba(111,72,179,.035)
      }
      .activity-panel[data-activity-report-view] .activity-rhythm-card>.activity-report-label{margin-top:0;text-align:center}
      .activity-panel[data-activity-report-view] .activity-rhythm-card>.activity-report-copy{display:none}
      .activity-panel[data-activity-report-view] .activity-rhythm-card>.activity-rhythm-days{margin-top:4px}

      .activity-streak-card{position:relative;margin:4px 0 18px;padding:18px;border:1px solid rgba(177,133,242,.18);border-radius:16px;background:linear-gradient(180deg,rgba(67,38,111,.12),rgba(16,10,31,.28))}
      .activity-streak-summary{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;text-align:center}
      .activity-streak-summary strong{margin:0;color:#f0e9f6;font-size:1.22rem;font-weight:470;line-height:1.2}
      .activity-insight-info{display:inline-grid;place-items:center;flex:0 0 18px;width:18px;height:18px;border:1px solid rgba(175,136,235,.34);border-radius:50%;color:#9b8aaa;font-size:.62rem;font-weight:650;line-height:1;cursor:help}

      .activity-pattern-card{box-sizing:border-box;width:100%;margin:18px 0 20px;padding:18px 16px 16px;border:1px solid rgba(174,126,255,.22);border-radius:16px;background:rgba(24,14,43,.58);box-shadow:inset 0 0 30px rgba(111,72,179,.035)}
      .activity-pattern-title{display:flex;align-items:center;justify-content:center;gap:7px;margin:0 0 14px;color:#92899d;font-size:.58rem;font-weight:650;letter-spacing:.12em;text-align:center}
      .activity-weekday-summary{display:grid;gap:5px;justify-items:center;margin-bottom:14px;padding:15px 16px;border:1px solid rgba(174,126,255,.18);border-radius:15px;background:linear-gradient(180deg,rgba(75,38,123,.12),rgba(20,12,39,.22));text-align:center}
      .activity-weekday-summary small{color:#81768d;font-size:.58rem;font-weight:650;letter-spacing:.12em}.activity-weekday-summary strong{color:#efe8f6;font-size:1.08rem;font-weight:480}.activity-weekday-summary span{color:#9b90a7;font-size:.69rem}
      .activity-weekday-list{display:grid;gap:11px}.activity-weekday-row{display:grid;grid-template-columns:24px 72px 1fr 68px;align-items:center;gap:8px;min-width:0}.activity-weekday-rank{color:#746b7d;font-size:.63rem}.activity-weekday-name{overflow:hidden;color:#c7bfce;font-size:.69rem;font-weight:510;text-overflow:ellipsis;white-space:nowrap}.activity-weekday-track{height:5px;overflow:hidden;border-radius:999px;background:rgba(151,119,201,.1)}.activity-weekday-fill{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,rgba(104,91,255,.8),rgba(210,88,221,.88));box-shadow:0 0 10px rgba(154,91,255,.18)}.activity-weekday-average{color:#baafc5;font-size:.66rem;text-align:right;white-space:nowrap}
      .activity-weekday-learning{padding:17px 16px;border:1px solid rgba(164,121,226,.15);border-radius:15px;background:rgba(20,12,40,.34)}.activity-weekday-learning strong{display:block;margin-bottom:7px;color:#dcd3e7;font-size:.8rem;font-weight:540;letter-spacing:.04em}.activity-weekday-learning p{margin:0;color:#8f8798;font-size:.72rem;line-height:1.55}.activity-weekday-progress{display:flex;gap:14px;margin-top:12px;color:#a496b3;font-size:.66rem}
      .activity-pattern-subtitle{margin:26px 0 5px;color:#81778b;font-size:.58rem;font-weight:650;letter-spacing:.12em}.activity-pattern-row{display:flex;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid rgba(153,124,202,.11)}.activity-pattern-row:last-child{border-bottom:0}.activity-pattern-row span{color:#91899b;font-size:.72rem}.activity-pattern-row strong{color:#ddd5e6;font-size:.76rem;font-weight:520;text-align:right}
      .activity-insight-note{margin:22px 0 2px;color:#8f8798;font-size:.75rem;line-height:1.5;text-align:center}

      @media(max-width:390px){
        .activity-panel[data-activity-report-view] .activity-rhythm-card,.activity-pattern-card{padding:16px 13px 12px}
        .activity-weekday-row{grid-template-columns:20px 64px 1fr 62px;gap:7px}
      }
    `;
    document.head.appendChild(style);
  }

  function enhance() {
    const panel = document.querySelector('.activity-panel[data-activity-report-view][data-activity-report-id]');
    if (!panel) return;
    const label = panel.querySelector('.activity-report-heading small')?.textContent?.trim();
    if (label !== 'ACTIVITY REPORT') return;

    ensureStyles();

    panel.querySelector('[data-activity-weekly]')?.remove();
    const sections = [...panel.querySelectorAll(':scope > .activity-report-section')];
    const rhythm = sections.find((section) => section.querySelector(':scope > .activity-rhythm-days'));
    const recent = sections.find((section) => section.querySelector(':scope > .activity-report-label')?.textContent?.trim() === 'RECENT SESSIONS');
    recent?.remove();
    if (!rhythm) return;

    rhythm.classList.add('activity-rhythm-card');
    if (!rhythm.dataset.activityParityOrder) {
      const days = rhythm.querySelector('.activity-rhythm-days');
      if (days) [...days.children].reverse().forEach((row) => days.appendChild(row));
      rhythm.dataset.activityParityOrder = 'newest-first';
    }

    const activityId = panel.dataset.activityReportId;
    const analysis = activityAnalysis(activityId);
    if (!analysis) return;

    let streakCard = panel.querySelector('[data-activity-streak-card]');
    if (!streakCard) {
      streakCard = document.createElement('section');
      streakCard.className = 'activity-streak-card';
      streakCard.dataset.activityStreakCard = 'true';
      rhythm.insertAdjacentElement('afterend', streakCard);
    }
    const streakText = analysis.streak === 0
      ? 'No active activity streak yet'
      : analysis.streak === 1
        ? '1 activity day in a row'
        : `${analysis.streak} activity days in a row`;
    streakCard.innerHTML = `<div class="activity-streak-summary"><strong>${esc(streakText)}</strong><span class="activity-insight-info" title="An activity day counts when this activity has at least one tracked session on that Manila calendar day.">i</span></div>`;

    let pattern = panel.querySelector('[data-activity-pattern-card]');
    if (!pattern) {
      pattern = document.createElement('section');
      pattern.className = 'activity-pattern-card';
      pattern.dataset.activityPatternCard = 'true';
      streakCard.insertAdjacentElement('afterend', pattern);
    }
    const delta = analysis.totalMsChange === 0
      ? 'Same activity time'
      : `${analysis.totalMsChange > 0 ? '+' : '−'}${duration(Math.abs(analysis.totalMsChange))}`;
    pattern.innerHTML = `
      <p class="activity-pattern-title">YOUR ACTIVITY PATTERN · BY WEEKDAY <span class="activity-insight-info" title="Learned from up to the last 4 weeks. Once enough history exists, weekdays rank from your highest average activity time to your lowest.">i</span></p>
      ${weekdayMarkup(analysis)}
      <p class="activity-pattern-subtitle">PATTERN</p>
      <div class="activity-pattern-row"><span>You do this most often</span><strong>${esc(analysis.mostCommonTime)}</strong></div>
      <div class="activity-pattern-row"><span>Activity-day consistency</span><strong>${esc(changeCopy(analysis.activityDayChange))}</strong></div>
      <div class="activity-pattern-row"><span>Compared with last week</span><strong>${esc(delta)}</strong></div>`;

    let note = panel.querySelector('[data-activity-insight-note]');
    if (!note) {
      note = document.createElement('p');
      note.className = 'activity-insight-note';
      note.dataset.activityInsightNote = 'true';
      pattern.insertAdjacentElement('afterend', note);
    }
    note.textContent = 'PAUSE reflects your recorded activity behavior. It doesn’t grade or judge it.';
  }

  function queueEnhance() {
    queueMicrotask(enhance);
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', queueEnhance);
    document.addEventListener('change', queueEnhance);
    window.addEventListener('pause:activities-changed', queueEnhance);
    window.addEventListener('storage', queueEnhance);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queueEnhance, { once: true });
    else queueEnhance();
  }
})();
