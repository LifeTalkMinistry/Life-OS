const TIMEFRAMES = ['daily', 'weekly', 'monthly', 'custom'];

function ensurePauseScoreStyles() {
  if (document.querySelector('#pause-score-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-score-style';
  style.textContent = `
    .pause-score-shell {
      position: absolute;
      top: 24.2svh;
      left: var(--pause-center-x, 50%);
      z-index: 12;
      width: min(72vw, 270px);
      transform: translateX(-50%);
      text-align: center;
    }

    .pause-score-trigger {
      appearance: none;
      display: inline-grid;
      justify-items: center;
      gap: 4px;
      min-width: 116px;
      padding: 3px 14px 7px;
      border: 0;
      border-radius: 16px;
      background: transparent;
      color: #f4effa;
      text-align: center;
      cursor: pointer;
    }

    .pause-score-trigger:hover,
    .pause-score-trigger:focus-visible,
    .pause-score-trigger[aria-expanded='true'] {
      background: rgba(111, 73, 180, .08);
      outline: none;
    }

    .pause-score-value {
      display: block;
      min-width: 2ch;
      color: #f5effb;
      font-size: clamp(2.65rem, 12.5vw, 4rem);
      font-weight: 310;
      font-variant-numeric: tabular-nums;
      letter-spacing: -.045em;
      line-height: .95;
      text-shadow: 0 0 22px rgba(162, 108, 255, .18);
    }

    .pause-score-label {
      color: #968da1;
      font-size: clamp(.59rem, 2.4vw, .69rem);
      font-weight: 650;
      letter-spacing: .17em;
      line-height: 1.2;
    }

    .pause-score-popover {
      position: absolute;
      top: calc(100% + 8px);
      left: 50%;
      width: min(86vw, 292px);
      padding: 10px;
      border: 1px solid rgba(166, 126, 231, .22);
      border-radius: 16px;
      background: rgba(8, 6, 18, .97);
      box-shadow: 0 16px 38px rgba(0, 0, 0, .46), 0 0 28px rgba(94, 55, 190, .1);
      transform: translateX(-50%);
      backdrop-filter: blur(18px);
    }

    .pause-score-popover[hidden] { display: none; }

    .pause-score-timeframes {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 5px;
    }

    .pause-score-timeframe {
      appearance: none;
      min-height: 37px;
      padding: 0 7px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      color: #91889c;
      font-size: .66rem;
      cursor: pointer;
    }

    .pause-score-timeframe:hover,
    .pause-score-timeframe:focus-visible,
    .pause-score-timeframe.is-selected {
      border-color: rgba(174, 132, 245, .22);
      background: rgba(109, 69, 190, .14);
      color: #eee7f6;
      outline: none;
    }

    .pause-score-custom {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(157, 118, 223, .12);
      text-align: left;
    }

    .pause-score-custom[hidden] { display: none; }

    .pause-score-custom label {
      display: grid;
      gap: 5px;
      min-width: 0;
    }

    .pause-score-custom label span {
      color: #776f80;
      font-size: .58rem;
      font-weight: 650;
      letter-spacing: .09em;
      text-transform: uppercase;
    }

    .pause-score-custom input {
      width: 100%;
      min-width: 0;
      min-height: 38px;
      border: 1px solid rgba(162, 123, 222, .2);
      border-radius: 9px;
      padding: 0 8px;
      background: rgba(16, 11, 31, .86);
      color: #e9e2f0;
      font-size: .7rem;
      outline: none;
    }

    .pause-score-custom button {
      grid-column: 1 / -1;
      min-height: 38px;
      border: 1px solid rgba(177, 135, 247, .25);
      border-radius: 10px;
      background: rgba(105, 67, 186, .16);
      color: #e6dcf2;
      font-size: .68rem;
      font-weight: 600;
      letter-spacing: .08em;
      text-transform: uppercase;
      cursor: pointer;
    }

    .pause-score-error {
      grid-column: 1 / -1;
      margin: 0;
      color: #c4a7d6;
      font-size: .62rem;
      text-align: center;
    }

    @media (max-width: 360px), (max-height: 650px) {
      .pause-score-shell { top: 23.4svh; }
      .pause-score-value { font-size: clamp(2.35rem, 11.7vw, 3.45rem); }
      .pause-score-timeframes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `;
  document.head.appendChild(style);
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setHours(0, 0, 0, 0);
  return Number.isFinite(date.getTime()) ? date : null;
}

function startOfToday(now = Date.now()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function scoreForRestMs(ms) {
  const hours = Math.max(0, Number(ms || 0)) / 3_600_000;
  const points = [
    [0, 0],
    [1, 25],
    [3, 55],
    [5, 80],
    [6, 90],
    [8, 100]
  ];

  if (hours >= 8) return 100;

  for (let index = 1; index < points.length; index += 1) {
    const [rightHours, rightScore] = points[index];
    const [leftHours, leftScore] = points[index - 1];
    if (hours <= rightHours) {
      const progress = (hours - leftHours) / (rightHours - leftHours);
      return Math.round(leftScore + progress * (rightScore - leftScore));
    }
  }

  return 100;
}

function sessionBounds(entry) {
  const start = Number(entry?.startAt || entry?.endedAt);
  if (!Number.isFinite(start)) return null;

  const explicitEnd = Number(entry?.endedAt);
  const duration = Math.max(0, Number(entry?.durationMs || 0));
  const end = Number.isFinite(explicitEnd) && explicitEnd >= start
    ? explicitEnd
    : start + duration;

  if (!Number.isFinite(end) || end < start) return null;
  return { start, end };
}

function restMsForDay(history, dayStart) {
  const start = dayStart.getTime();
  const end = addDays(dayStart, 1).getTime();

  return history.reduce((total, entry) => {
    const bounds = sessionBounds(entry);
    if (!bounds) return total;
    const overlap = Math.max(0, Math.min(bounds.end, end) - Math.max(bounds.start, start));
    return total + overlap;
  }, 0);
}

function resolveRange(timeframe, customRange, now = Date.now()) {
  const today = startOfToday(now);

  if (timeframe === 'daily') return { start: today, end: today };

  if (timeframe === 'monthly') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    return { start, end: today };
  }

  if (timeframe === 'custom') {
    const requestedStart = parseLocalDate(customRange?.start);
    const requestedEnd = parseLocalDate(customRange?.end);
    if (requestedStart && requestedEnd) {
      const start = requestedStart <= requestedEnd ? requestedStart : requestedEnd;
      const requestedFinal = requestedStart <= requestedEnd ? requestedEnd : requestedStart;
      const end = requestedFinal > today ? today : requestedFinal;
      if (start <= end) return { start, end };
    }
  }

  return { start: addDays(today, -6), end: today };
}

export function calculatePauseScore(state, timeframe = 'weekly', customRange = null, now = Date.now()) {
  const history = Array.isArray(state?.history) ? state.history : [];
  const range = resolveRange(timeframe, customRange, now);
  const days = [];

  for (let cursor = new Date(range.start); cursor <= range.end; cursor = addDays(cursor, 1)) {
    const restMs = restMsForDay(history, cursor);
    days.push({
      key: localDateKey(cursor),
      restMs,
      score: scoreForRestMs(restMs)
    });
  }

  const score = days.length
    ? Math.round(days.reduce((sum, day) => sum + day.score, 0) / days.length)
    : 0;

  return { score, days, start: range.start, end: range.end };
}

function defaultCustomRange(now = Date.now()) {
  const today = startOfToday(now);
  return {
    start: localDateKey(addDays(today, -6)),
    end: localDateKey(today)
  };
}

export function PauseScore({ state, timeframe = 'weekly', customRange = null, onChange }) {
  ensurePauseScoreStyles();
  const scoreData = calculatePauseScore(state, timeframe, customRange);
  const wrapper = document.createElement('section');
  wrapper.className = 'pause-score-shell';
  wrapper.setAttribute('aria-label', 'PAUSE Score');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'pause-score-trigger';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-label', `PAUSE Score ${scoreData.score}. Tap to change timeframe.`);
  trigger.innerHTML = `
    <strong class="pause-score-value">${scoreData.score}</strong>
    <span class="pause-score-label">PAUSE SCORE</span>
  `;

  const popover = document.createElement('div');
  popover.className = 'pause-score-popover';
  popover.hidden = true;

  const timeframeRow = document.createElement('div');
  timeframeRow.className = 'pause-score-timeframes';
  timeframeRow.setAttribute('role', 'group');
  timeframeRow.setAttribute('aria-label', 'PAUSE Score timeframe');

  TIMEFRAMES.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pause-score-timeframe${timeframe === option ? ' is-selected' : ''}`;
    button.textContent = option[0].toUpperCase() + option.slice(1);
    button.dataset.scoreTimeframe = option;
    timeframeRow.appendChild(button);
  });

  const range = customRange?.start && customRange?.end ? customRange : defaultCustomRange();
  const customForm = document.createElement('form');
  customForm.className = 'pause-score-custom';
  customForm.hidden = timeframe !== 'custom';
  customForm.innerHTML = `
    <label><span>From</span><input type="date" name="start" value="${range.start}"></label>
    <label><span>To</span><input type="date" name="end" value="${range.end}"></label>
    <button type="submit">Apply</button>
    <p class="pause-score-error" aria-live="polite"></p>
  `;

  const setOpen = (open) => {
    popover.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(popover.hidden);
  });

  timeframeRow.querySelectorAll('[data-score-timeframe]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.scoreTimeframe;
      if (next === 'custom') {
        timeframeRow.querySelectorAll('.pause-score-timeframe').forEach((item) => item.classList.remove('is-selected'));
        button.classList.add('is-selected');
        customForm.hidden = false;
        customForm.querySelector('input')?.focus();
        return;
      }

      setOpen(false);
      onChange?.({ timeframe: next, customRange });
    });
  });

  customForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(customForm);
    const start = String(form.get('start') || '');
    const end = String(form.get('end') || '');
    const startDate = parseLocalDate(start);
    const endDate = parseLocalDate(end);
    const error = customForm.querySelector('.pause-score-error');

    if (!startDate || !endDate) {
      if (error) error.textContent = 'Choose both dates.';
      return;
    }
    if (startDate > endDate) {
      if (error) error.textContent = 'Start date must be before end date.';
      return;
    }

    setOpen(false);
    onChange?.({ timeframe: 'custom', customRange: { start, end } });
  });

  popover.addEventListener('click', (event) => event.stopPropagation());
  popover.append(timeframeRow, customForm);
  wrapper.append(trigger, popover);
  return wrapper;
}
