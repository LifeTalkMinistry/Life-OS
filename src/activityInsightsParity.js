/* PAUSE Activity Insights parity layer.
 * Reuses the same visual primitives as Rest Insights so Activity reports stay
 * structurally identical wherever the semantics allow it.
 */
(() => {
  const STYLE_ID = 'pause-activity-insights-parity-style';
  const PREFIX = 'pause-activity-commitments-v1';
  const USER_KEY = 'pause_backend_user_v1';
  const DAY_MS = 86_400_000;
  const panelSelections = new WeakMap();
  let statusTick = null;

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
    if (![year, month, day].every(Number.isFinite)) return NaN;
    return Date.UTC(year, month - 1, day, -8, 0, 0, 0);
  }

  function addDays(key, days) {
    const start = dayStart(key);
    return Number.isFinite(start) ? manilaKey(start + Number(days || 0) * DAY_MS) : '';
  }

  function validKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && Number.isFinite(dayStart(value));
  }

  function weekdayName(key) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila', weekday: 'long'
    }).format(new Date(dayStart(key) + 12 * 3_600_000));
  }

  function shortDate(key, withYear = false) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila', month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {})
    }).format(new Date(dayStart(key) + 12 * 3_600_000));
  }

  function statusDuration(ms) {
    const totalMinutes = Math.max(0, Math.round(Number(ms || 0) / 60_000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (!hours) return `${minutes}m`;
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  function insightDuration(ms) {
    const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
    if (totalSeconds < 60) return `${totalSeconds} sec`;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
    if (seconds === 0) return `${minutes} min`;
    return `${minutes}m ${seconds}s`;
  }

  function sessionsFor(state, activityId, now = Date.now()) {
    const completed = state.sessions
      .filter((session) => String(session?.activityId) === String(activityId))
      .map((session) => ({ startAt: Number(session.startAt), endAt: Number(session.endAt) }))
      .filter((session) => Number.isFinite(session.startAt) && Number.isFinite(session.endAt) && session.endAt >= session.startAt);
    if (String(state.active?.activityId) === String(activityId) && Number(state.active?.startAt)) {
      completed.push({ startAt: Number(state.active.startAt), endAt: now });
    }
    return completed;
  }

  function overlap(startAt, endAt, rangeStart, rangeEnd) {
    return Math.max(0, Math.min(endAt, rangeEnd) - Math.max(startAt, rangeStart));
  }

  function totalForRange(sessions, startAt, endAt) {
    return sessions.reduce((sum, session) => sum + overlap(session.startAt, session.endAt, startAt, endAt), 0);
  }

  function totalForDay(sessions, key, now = Date.now()) {
    const start = dayStart(key);
    const end = Math.min(start + DAY_MS, now);
    return end > start ? totalForRange(sessions, start, end) : 0;
  }

  function selectionForPanel(panel, activityId) {
    const today = manilaKey();
    let selection = panelSelections.get(panel);
    if (!selection || selection.activityId !== String(activityId)) {
      selection = {
        activityId: String(activityId),
        mode: 'quick',
        days: 7,
        customStart: addDays(today, -6),
        customEnd: today,
        menuOpen: false,
        customOpen: false
      };
      panelSelections.set(panel, selection);
    }
    return selection;
  }

  function selectedRange(selection, now = Date.now()) {
    const today = manilaKey(now);
    if (selection.mode === 'custom' && validKey(selection.customStart) && validKey(selection.customEnd)) {
      const startKey = selection.customStart <= selection.customEnd ? selection.customStart : selection.customEnd;
      const requestedEnd = selection.customStart <= selection.customEnd ? selection.customEnd : selection.customStart;
      const endKey = requestedEnd > today ? today : requestedEnd;
      return { startKey, endKey };
    }
    const days = Math.max(1, Number(selection.days) || 7);
    return { startKey: addDays(today, -(days - 1)), endKey: today };
  }

  function rangeCaption(range) {
    if (range.startKey === range.endKey) return shortDate(range.startKey, true);
    const sameYear = range.startKey.slice(0, 4) === range.endKey.slice(0, 4);
    return sameYear
      ? `${shortDate(range.startKey)} – ${shortDate(range.endKey, true)}`
      : `${shortDate(range.startKey, true)} – ${shortDate(range.endKey, true)}`;
  }

  function selectorLabel(selection) {
    if (selection.mode === 'custom') return 'CUSTOM RANGE';
    if (selection.days === 1) return 'TODAY';
    return `LAST ${selection.days} DAYS`;
  }

  function effectiveDays(activity, range) {
    const createdKey = manilaKey(Number(activity.createdAt) || dayStart(range.startKey));
    const firstKey = createdKey > range.startKey ? createdKey : range.startKey;
    const lastKey = activity.endDate && activity.endDate < range.endKey ? activity.endDate : range.endKey;
    if (firstKey > lastKey) return 0;
    return Math.max(1, Math.floor((dayStart(lastKey) - dayStart(firstKey)) / DAY_MS) + 1);
  }

  function passingMinutes(activity) {
    const explicit = Number(activity.passingTargetMinutes);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const target = Number(activity.targetMinutes);
    return Number.isFinite(target) && target > 0 ? Math.round(target * .9) : 0;
  }

  function activityStatus(activityId, selection, now = Date.now()) {
    const state = readState();
    const activity = state.activities.find((item) => String(item?.id) === String(activityId));
    if (!activity) return null;
    const sessions = sessionsFor(state, activityId, now);
    const range = selectedRange(selection, now);
    const rangeStart = dayStart(range.startKey);
    const rangeEnd = Math.min(dayStart(addDays(range.endKey, 1)), now);
    const totalMs = totalForRange(sessions, rangeStart, rangeEnd);
    const dayCount = effectiveDays(activity, range);
    const averageMs = dayCount ? totalMs / dayCount : 0;
    const targetMs = Math.max(0, Number(activity.targetMinutes || 0) * 60_000);
    const passMs = Math.max(0, passingMinutes(activity) * 60_000);
    const mode = String(activity.targetMode || 'track');

    if (mode === 'track' || !targetMs) {
      return {
        state, activity, sessions, range, totalMs, averageMs, scored: false,
        status: 'TRACKED', percent: null, targetLabel: 'TRACKING MODE', targetValue: 'Track only'
      };
    }

    let basisMs = totalMs;
    let targetLabel = 'TARGET';
    let targetValue = statusDuration(targetMs);
    if (mode === 'daily') {
      basisMs = averageMs;
      targetLabel = 'DAILY TARGET';
    } else if (mode === 'weekly') {
      const weeks = Math.max(1, dayCount / 7);
      basisMs = totalMs / weeks;
      targetLabel = 'WEEKLY TARGET';
    } else if (mode === 'total') {
      targetLabel = 'TOTAL TARGET';
    }

    const rawPercent = targetMs ? Math.round((basisMs / targetMs) * 100) : 0;
    const percent = Math.max(0, Math.min(100, rawPercent));
    const status = basisMs >= targetMs ? 'TARGET MET' : basisMs >= passMs ? 'PASS' : 'SHORT';
    return {
      state, activity, sessions, range, totalMs, averageMs, scored: true,
      status, percent, rawPercent, targetLabel, targetValue
    };
  }

  function activityStatusMarkup(activityId, selection) {
    const data = activityStatus(activityId, selection);
    if (!data) return '';
    const today = manilaKey();
    const statusCopy = data.scored
      ? `Based on your selected range, PAUSE compares your recorded activity time with the target you declared.`
      : 'Track-only activities record time without assigning a score.';
    return `
      <div class="pause-recovery-status-head">
        <p class="pause-recovery-status-kicker">ACTIVITY STATUS</p>
        <button type="button" class="pause-recovery-range-trigger" data-activity-range-trigger aria-expanded="${selection.menuOpen ? 'true' : 'false'}">
          ${esc(selectorLabel(selection))} &nbsp;⌄
        </button>
        <p class="pause-recovery-range-caption">${esc(rangeCaption(data.range))}</p>
      </div>

      <div class="pause-recovery-range-menu" data-activity-range-menu ${selection.menuOpen ? '' : 'hidden'}>
        <div class="pause-recovery-quick-ranges" role="group" aria-label="Activity timeframe">
          <button type="button" class="pause-recovery-range-option${selection.mode === 'quick' && selection.days === 1 ? ' is-selected' : ''}" data-activity-days="1">1 DAY</button>
          <button type="button" class="pause-recovery-range-option${selection.mode === 'quick' && selection.days === 3 ? ' is-selected' : ''}" data-activity-days="3">3 DAYS</button>
          <button type="button" class="pause-recovery-range-option${selection.mode === 'quick' && selection.days === 7 ? ' is-selected' : ''}" data-activity-days="7">7 DAYS</button>
          <button type="button" class="pause-recovery-range-option${selection.mode === 'custom' ? ' is-selected' : ''}" data-activity-custom-toggle>CUSTOM</button>
        </div>
        <form class="pause-recovery-custom-form" data-activity-custom-form ${selection.customOpen ? '' : 'hidden'}>
          <label><span>From</span><input type="date" name="start" max="${today}" value="${esc(selection.customStart)}"></label>
          <label><span>To</span><input type="date" name="end" max="${today}" value="${esc(selection.customEnd)}"></label>
          <button type="submit" class="pause-recovery-custom-apply">APPLY RANGE</button>
          <p class="pause-recovery-custom-error" data-activity-custom-error aria-live="polite"></p>
        </form>
      </div>

      <div class="pause-recovery-status-main">
        <strong class="pause-recovery-status-value" data-activity-parity-total>${esc(statusDuration(data.totalMs))}</strong>
        <span class="pause-recovery-status-label" data-activity-parity-state>${esc(data.status)}</span>
        <p class="pause-recovery-status-copy">${esc(statusCopy)}</p>
      </div>

      ${data.scored ? `<div class="pause-recovery-progress-row" aria-label="${data.percent}% of activity target recorded">
        <div class="pause-recovery-progress-track" aria-hidden="true"><span class="pause-recovery-progress-fill" data-activity-parity-fill style="width:${data.percent}%"></span></div>
        <span class="pause-recovery-progress-pct" data-activity-parity-percent>${data.percent}%</span>
      </div>` : ''}

      <div class="pause-recovery-status-stats">
        <div class="pause-recovery-status-stat"><small>AVERAGE / DAY</small><strong data-activity-parity-average>${esc(statusDuration(data.averageMs))}</strong></div>
        <div class="pause-recovery-status-stat"><small>${esc(data.targetLabel)}</small><strong>${esc(data.targetValue)}</strong></div>
      </div>`;
  }

  function bindStatusCard(card, panel, activityId) {
    const selection = selectionForPanel(panel, activityId);
    card.querySelector('[data-activity-range-trigger]')?.addEventListener('click', () => {
      selection.menuOpen = !selection.menuOpen;
      renderStatusCard(card, panel, activityId);
    });
    card.querySelectorAll('[data-activity-days]').forEach((button) => button.addEventListener('click', () => {
      selection.mode = 'quick';
      selection.days = Number(button.dataset.activityDays) || 7;
      selection.menuOpen = false;
      selection.customOpen = false;
      const range = selectedRange(selection);
      selection.customStart = range.startKey;
      selection.customEnd = range.endKey;
      renderStatusCard(card, panel, activityId);
    }));
    card.querySelector('[data-activity-custom-toggle]')?.addEventListener('click', () => {
      selection.customOpen = !selection.customOpen;
      selection.menuOpen = true;
      renderStatusCard(card, panel, activityId);
      if (selection.customOpen) card.querySelector('[data-activity-custom-form] input')?.focus();
    });
    card.querySelector('[data-activity-custom-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const start = String(form.get('start') || '');
      const end = String(form.get('end') || '');
      const error = card.querySelector('[data-activity-custom-error]');
      const today = manilaKey();
      if (!validKey(start) || !validKey(end)) {
        if (error) error.textContent = 'Choose both dates.';
        return;
      }
      if (start > end) {
        if (error) error.textContent = 'Start date must be before end date.';
        return;
      }
      if (end > today) {
        if (error) error.textContent = 'The range cannot include future dates.';
        return;
      }
      selection.mode = 'custom';
      selection.customStart = start;
      selection.customEnd = end;
      selection.menuOpen = false;
      selection.customOpen = false;
      renderStatusCard(card, panel, activityId);
    });
  }

  function renderStatusCard(card, panel, activityId) {
    const selection = selectionForPanel(panel, activityId);
    card.innerHTML = activityStatusMarkup(activityId, selection);
    bindStatusCard(card, panel, activityId);
  }

  function updateLiveStatus(panel, activityId) {
    const selection = selectionForPanel(panel, activityId);
    const data = activityStatus(activityId, selection);
    if (!data) return;
    const total = panel.querySelector('[data-activity-parity-total]');
    const state = panel.querySelector('[data-activity-parity-state]');
    const average = panel.querySelector('[data-activity-parity-average]');
    const fill = panel.querySelector('[data-activity-parity-fill]');
    const percent = panel.querySelector('[data-activity-parity-percent]');
    if (total) total.textContent = statusDuration(data.totalMs);
    if (state) state.textContent = data.status;
    if (average) average.textContent = statusDuration(data.averageMs);
    if (fill && data.scored) fill.style.width = `${data.percent}%`;
    if (percent && data.scored) percent.textContent = `${data.percent}%`;
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
      const bucket = buckets.get(weekdayName(day.key));
      if (!bucket) return;
      bucket.totalMs += day.totalMs;
      bucket.occurrences += 1;
    });
    const ranked = [...buckets.values()]
      .map((bucket) => ({ ...bucket, averageMs: bucket.occurrences ? bucket.totalMs / bucket.occurrences : 0 }))
      .sort((a, b) => b.averageMs - a.averageMs || a.label.localeCompare(b.label))
      .map((day, index) => ({ ...day, rank: index + 1 }));
    const activityDaysObserved = days.filter((day) => day.totalMs > 0).length;
    const ready = days.length >= 14 && activityDaysObserved >= 4;

    let streak = 0;
    let cursor = totalForDay(sessions, today, now) > 0 ? today : addDays(today, -1);
    for (let index = 0; index < 365 && cursor >= createdKey; index += 1) {
      if (activity.endDate && cursor > activity.endDate) { cursor = addDays(cursor, -1); continue; }
      if (totalForDay(sessions, cursor, now) <= 0) break;
      streak += 1;
      cursor = addDays(cursor, -1);
    }

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
    const current = aggregate(addDays(today, -6), today);
    const previous = aggregate(addDays(today, -13), addDays(today, -7));

    const timeBuckets = { Morning: 0, Afternoon: 0, Evening: 0, 'Late night': 0 };
    sessions.forEach((session) => {
      if (session.startAt < dayStart(earliestLookback)) return;
      const hour = Number(Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila', hour: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date(session.startAt)).map((part) => [part.type, part.value])).hour);
      const label = hour >= 5 && hour < 12 ? 'Morning' : hour >= 12 && hour < 17 ? 'Afternoon' : hour >= 17 && hour < 21 ? 'Evening' : 'Late night';
      timeBuckets[label] += Math.max(0, session.endAt - session.startAt);
    });
    const sortedTimes = Object.entries(timeBuckets).sort((a, b) => b[1] - a[1]);
    return {
      activity, sessions, ready, daysObserved: days.length, activityDaysObserved, ranked,
      strongest: ranked[0], streak,
      mostCommonTime: sortedTimes[0]?.[1] > 0 ? sortedTimes[0][0] : 'Not enough data',
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
      return `<div class="pause-weekday-learning">
        <strong>LEARNING YOUR ACTIVITY PATTERN</strong>
        <p>PAUSE won't rank weekdays from only a few sessions. Keep tracking this activity and it will learn which days you consistently give it the most time.</p>
        <div class="pause-weekday-progress"><span>${Math.min(analysis.daysObserved, 14)} / 14 days observed</span><span>${Math.min(analysis.activityDaysObserved, 4)} / 4 activity days</span></div>
      </div>`;
    }
    const maxAverage = Math.max(1, ...analysis.ranked.map((day) => day.averageMs));
    return `<div class="pause-weekday-summary">
      <small>YOUR STRONGEST ACTIVITY DAY</small>
      <strong>${esc(analysis.strongest.label)}</strong>
      <span>${esc(insightDuration(analysis.strongest.averageMs))} average per ${esc(analysis.strongest.label)}</span>
    </div>
    <div class="pause-weekday-rank-list">${analysis.ranked.map((day) => {
      const width = day.averageMs > 0 ? Math.max(5, Math.round((day.averageMs / maxAverage) * 100)) : 0;
      return `<div class="pause-weekday-rank-row"><span class="pause-weekday-rank">#${day.rank}</span><span class="pause-weekday-name">${esc(day.label)}</span><div class="pause-weekday-track" aria-hidden="true"><span class="pause-weekday-fill" style="width:${width}%"></span></div><span class="pause-weekday-average">${esc(insightDuration(day.averageMs))}</span></div>`;
    }).join('')}</div>`;
  }

  function ensureStyles() {
    if (document.querySelector(`#${STYLE_ID}`)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .activity-backdrop.system-backdrop{z-index:90;background:rgba(1,1,6,.62);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
      .activity-panel.system-panel.pause-view-insights{box-sizing:border-box;width:min(91vw,390px);max-height:min(84svh,780px);overflow-y:auto;padding:24px 22px 22px;border:1px solid rgba(198,170,255,.25);border-radius:26px;background:radial-gradient(circle at 16% 5%,rgba(93,58,180,.12),transparent 28%),linear-gradient(150deg,rgba(14,12,25,.98),rgba(5,4,12,.995));box-shadow:0 24px 74px rgba(0,0,0,.62),0 0 34px rgba(88,48,190,.1)}
      .activity-panel.pause-view-insights .pause-recovery-status-card{margin:4px 0 19px}
      .activity-panel.pause-view-insights .pause-insight-note{margin:22px 0 2px}
    `;
    document.head.appendChild(style);
  }

  function transformHeader(panel) {
    const header = panel.querySelector('.activity-report-top');
    if (!header || header.dataset.activitySharedHeader) return;
    const back = header.querySelector('[data-activity-report-back]');
    const heading = header.querySelector('.activity-report-heading');
    const close = header.querySelector('[data-activity-directory-close]');
    if (!back || !heading || !close) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'pause-panel-heading';
    back.className = 'pause-audit-back';
    heading.className = '';
    const eyebrow = heading.querySelector('small');
    if (eyebrow) eyebrow.className = 'system-panel-eyebrow';
    close.className = 'system-panel-close activity-close';
    wrapper.append(back, heading);
    header.className = 'system-panel-header';
    header.dataset.activitySharedHeader = 'true';
    header.replaceChildren(wrapper, close);
  }

  function transformRhythm(panel, analysis) {
    const row = panel.querySelector('[data-activity-day]');
    const rhythm = row?.closest('section');
    if (!rhythm) return null;
    rhythm.className = 'pause-insight-section';
    rhythm.dataset.activityRhythmSection = 'true';
    const title = rhythm.querySelector('.activity-report-label, .pause-insight-section-title');
    if (title) title.className = 'pause-insight-section-title';
    const copy = rhythm.querySelector('.activity-report-copy, .pause-insight-section-copy');
    if (copy) copy.className = 'pause-insight-section-copy';
    const days = rhythm.querySelector('.activity-rhythm-days, .pause-rhythm-days');
    if (!days) return rhythm;
    days.className = 'pause-rhythm-days';
    if (!days.dataset.activityParityOrder) {
      [...days.children].reverse().forEach((item) => days.appendChild(item));
      days.dataset.activityParityOrder = 'newest-first';
    }
    const today = manilaKey();
    const yesterday = addDays(today, -1);
    [...days.querySelectorAll('[data-activity-day]')].forEach((button) => {
      const key = button.dataset.activityDay;
      button.className = 'pause-rhythm-day pause-rhythm-day-button';
      const label = button.querySelector('.activity-rhythm-label, .pause-rhythm-day-label');
      if (label) {
        label.className = 'pause-rhythm-day-label';
        const small = label.querySelector('small');
        if (small) small.textContent = `${shortDate(key)}${key === today ? ' - Today' : key === yesterday ? ' - Yesterday' : ''}`;
      }
      const track = button.querySelector('.activity-rhythm-track, .pause-rhythm-track');
      if (track) track.className = 'pause-rhythm-track';
      const fill = button.querySelector('.activity-rhythm-fill, .pause-rhythm-fill');
      if (fill) fill.className = 'pause-rhythm-fill';
      const tail = button.querySelector('.activity-rhythm-tail, .pause-rhythm-day-tail');
      if (tail) {
        tail.className = 'pause-rhythm-day-tail';
        const value = tail.querySelector('span');
        const chevron = tail.querySelector('i, .pause-rhythm-chevron');
        if (value) {
          value.className = 'pause-rhythm-duration';
          const dayMs = totalForDay(analysis.sessions, key);
          value.textContent = dayMs > 0 ? insightDuration(dayMs) : '—';
        }
        if (chevron) { chevron.className = 'pause-rhythm-chevron'; chevron.textContent = '›'; }
      }
    });
    return rhythm;
  }

  function buildStreak(rhythm, analysis) {
    let card = rhythm.nextElementSibling?.matches?.('[data-activity-streak-card]') ? rhythm.nextElementSibling : null;
    if (!card) {
      card = document.createElement('section');
      card.dataset.activityStreakCard = 'true';
      rhythm.insertAdjacentElement('afterend', card);
    }
    card.className = 'pause-sleep-routine-streak is-compact';
    card.dataset.pauseSleepRoutineStreak = '';
    const streakText = analysis.streak === 0 ? 'No active activity streak yet' : analysis.streak === 1 ? '1 activity day in a row' : `${analysis.streak} activity days in a row`;
    card.innerHTML = `<div class="pause-sleep-streak-summary"><strong>${esc(streakText)}</strong><button type="button" class="pause-sleep-streak-info-button" data-pause-sleep-streak-info aria-label="How Activity Streak works" aria-expanded="false">i</button></div><div class="pause-sleep-streak-info-popover" data-pause-sleep-streak-popover hidden>An activity day counts when this activity has at least one tracked session on that Manila calendar day. Consecutive tracked days build this streak.</div>`;
    return card;
  }

  function buildPattern(streakCard, analysis) {
    let weekdaySection = streakCard.nextElementSibling?.matches?.('[data-activity-pattern-weekday]') ? streakCard.nextElementSibling : null;
    if (!weekdaySection) {
      weekdaySection = document.createElement('section');
      weekdaySection.dataset.activityPatternWeekday = 'true';
      streakCard.insertAdjacentElement('afterend', weekdaySection);
    }
    weekdaySection.className = 'pause-insight-section';
    weekdaySection.innerHTML = `<p class="pause-insight-section-title pause-weekday-title-row">YOUR ACTIVITY PATTERN · BY WEEKDAY <button type="button" class="pause-weekday-info-button" data-pause-weekday-info aria-label="How weekday activity patterns work" aria-expanded="false">i</button><span class="pause-weekday-info-popover" data-pause-weekday-info-popover hidden>Learned from up to the last 4 weeks. Once enough history exists, weekdays rank from your highest average activity time to your lowest.</span></p>${weekdayMarkup(analysis)}`;

    let patternSection = weekdaySection.nextElementSibling?.matches?.('[data-activity-pattern-detail]') ? weekdaySection.nextElementSibling : null;
    if (!patternSection) {
      patternSection = document.createElement('section');
      patternSection.dataset.activityPatternDetail = 'true';
      weekdaySection.insertAdjacentElement('afterend', patternSection);
    }
    patternSection.className = 'pause-insight-section';
    const delta = analysis.totalMsChange === 0 ? 'Same activity time' : `${analysis.totalMsChange > 0 ? '+' : '−'}${insightDuration(Math.abs(analysis.totalMsChange))}`;
    patternSection.innerHTML = `<p class="pause-insight-section-title">PATTERN</p><div class="pause-pattern-row"><span>You do this most often</span><strong>${esc(analysis.mostCommonTime)}</strong></div><div class="pause-pattern-row"><span>Activity-day consistency</span><strong>${esc(changeCopy(analysis.activityDayChange))}</strong></div><div class="pause-pattern-row"><span>Compared with last week</span><strong>${esc(delta)}</strong></div>`;
    return patternSection;
  }

  function cleanupDirectory() {
    const panel = document.querySelector('.activity-panel');
    if (panel && !panel.dataset.activityReportView) {
      panel.classList.remove('system-panel', 'pause-view-insights');
      panel.closest('.activity-backdrop')?.classList.remove('system-backdrop');
      clearInterval(statusTick);
      statusTick = null;
    }
  }

  function enhance() {
    const panel = document.querySelector('.activity-panel[data-activity-report-view][data-activity-report-id]');
    if (!panel) return cleanupDirectory();
    const label = panel.querySelector('.activity-report-heading small, .system-panel-eyebrow')?.textContent?.trim();
    if (label !== 'ACTIVITY REPORT') return;

    ensureStyles();
    panel.classList.add('system-panel', 'pause-view-insights');
    panel.closest('.activity-backdrop')?.classList.add('system-backdrop');
    transformHeader(panel);

    const activityId = panel.dataset.activityReportId;
    const analysis = activityAnalysis(activityId);
    if (!analysis) return;

    const oldStatus = panel.querySelector('.activity-status-card');
    let statusCard = panel.querySelector('[data-activity-parity-status]');
    if (!statusCard) {
      statusCard = document.createElement('section');
      statusCard.className = 'pause-recovery-status-card';
      statusCard.dataset.activityParityStatus = 'true';
      oldStatus?.replaceWith(statusCard);
    }
    renderStatusCard(statusCard, panel, activityId);

    panel.querySelector('[data-activity-weekly]')?.remove();
    [...panel.querySelectorAll(':scope > .activity-report-section')].find((section) => section.querySelector(':scope > .activity-report-label')?.textContent?.trim() === 'RECENT SESSIONS')?.remove();

    const rhythm = transformRhythm(panel, analysis);
    if (!rhythm) return;
    const streak = buildStreak(rhythm, analysis);
    const patternEnd = buildPattern(streak, analysis);

    let note = panel.querySelector('[data-activity-insight-note]');
    if (!note) {
      note = document.createElement('p');
      note.dataset.activityInsightNote = 'true';
      patternEnd.insertAdjacentElement('afterend', note);
    }
    note.className = 'pause-insight-note';
    note.textContent = 'PAUSE reflects your recorded activity behavior. It doesn’t grade or judge it.';

    clearInterval(statusTick);
    statusTick = null;
    if (String(analysis.state?.active?.activityId || readState().active?.activityId) === String(activityId)) {
      statusTick = setInterval(() => {
        if (!panel.isConnected || panel.dataset.activityReportId !== String(activityId)) return;
        updateLiveStatus(panel, activityId);
      }, 1000);
    }
  }

  function queueEnhance() { queueMicrotask(enhance); }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', queueEnhance);
    document.addEventListener('change', queueEnhance);
    window.addEventListener('pause:activities-changed', queueEnhance);
    window.addEventListener('storage', queueEnhance);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queueEnhance, { once: true });
    else queueEnhance();
  }
})();
