import { activityIconSvgMarkup } from './activity-icons.js';

const SETUP_DAY_NAMES = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday'
};

function summaryParseTime(time) {
  const [hour, minute] = String(time || '00:00').split(':').map(Number);
  return (hour * 60) + minute;
}

function summaryFormatTime(time) {
  const [hourValue, minuteValue] = String(time || '00:00').split(':').map(Number);
  const suffix = hourValue >= 12 ? 'PM' : 'AM';
  const hour = hourValue % 12 || 12;
  return `${hour}:${String(minuteValue || 0).padStart(2, '0')} ${suffix}`;
}

function summaryFixedLabel(kind) {
  if (kind === 'school') return 'School';
  if (kind === 'both') return 'Work + school';
  return 'Work';
}

function summaryBlocksForDay(profile, day) {
  const blocks = [];

  if (profile.sleepStart && profile.sleepEnd) {
    blocks.push({
      id: 'sleep',
      label: 'Sleep',
      icon: 'sleep',
      start: profile.sleepStart,
      end: profile.sleepEnd
    });
  }

  if (
    profile.hasFixedSchedule
    && profile.fixedDays?.includes(day)
    && profile.fixedStart
    && profile.fixedEnd
  ) {
    blocks.push({
      id: 'fixed',
      label: summaryFixedLabel(profile.fixedKind),
      icon: 'fixed',
      start: profile.fixedStart,
      end: profile.fixedEnd
    });
  }

  (profile.activities || [])
    .filter((activity) => activity.days?.includes(day))
    .forEach((activity) => blocks.push({
      id: activity.id,
      label: activity.name,
      icon: activity.icon || 'general',
      start: activity.start,
      end: activity.end
    }));

  return blocks.sort((a, b) => summaryParseTime(a.start) - summaryParseTime(b.start));
}

function summaryStateKey(profile, day) {
  return JSON.stringify({
    day,
    sleepStart: profile.sleepStart,
    sleepEnd: profile.sleepEnd,
    hasFixedSchedule: profile.hasFixedSchedule,
    fixedKind: profile.fixedKind,
    fixedDays: profile.fixedDays,
    fixedStart: profile.fixedStart,
    fixedEnd: profile.fixedEnd,
    activities: (profile.activities || []).filter((activity) => activity.days?.includes(day))
  });
}

function buildDaySummary(profile, day) {
  const panel = document.createElement('section');
  panel.className = 'setup-day-summary';
  panel.dataset.stateKey = summaryStateKey(profile, day);
  panel.setAttribute('aria-label', `${SETUP_DAY_NAMES[day] || 'Day'} schedule summary`);

  const title = document.createElement('h2');
  title.className = 'setup-day-summary-title';
  title.textContent = SETUP_DAY_NAMES[day] || 'Day';
  panel.appendChild(title);

  const blocks = summaryBlocksForDay(profile, day);
  const list = document.createElement('div');
  list.className = 'setup-day-summary-list';

  if (!blocks.length) {
    const empty = document.createElement('p');
    empty.className = 'setup-day-summary-empty';
    empty.textContent = 'Nothing added yet.';
    list.appendChild(empty);
  } else {
    blocks.forEach((block) => {
      const row = document.createElement('div');
      row.className = 'setup-day-summary-row';

      const icon = document.createElement('span');
      icon.className = 'setup-day-summary-icon';
      icon.innerHTML = activityIconSvgMarkup(block.icon);

      const name = document.createElement('span');
      name.className = 'setup-day-summary-name';
      name.textContent = block.label;

      const time = document.createElement('span');
      time.className = 'setup-day-summary-time';
      time.textContent = `${summaryFormatTime(block.start)} → ${summaryFormatTime(block.end)}`;

      row.append(icon, name, time);
      list.appendChild(row);
    });
  }

  panel.appendChild(list);
  return panel;
}

function renderDaySummary() {
  const shell = document.querySelector('.setup-step-activities, .setup-step-activity-end');
  if (!shell) return;

  const state = window.__LIFE_OS__?.getState?.();
  const profile = state?.lifeProfile;
  const day = state?.setupActivityDay;
  if (!profile || day === undefined || day === null) return;

  const key = summaryStateKey(profile, day);
  const existing = shell.querySelector(':scope > .setup-day-summary');
  if (existing?.dataset.stateKey === key) return;
  existing?.remove();
  shell.appendChild(buildDaySummary(profile, day));
}

let summaryRenderQueued = false;
function queueDaySummaryRender() {
  if (summaryRenderQueued) return;
  summaryRenderQueued = true;
  requestAnimationFrame(() => {
    summaryRenderQueued = false;
    renderDaySummary();
  });
}

const summaryAppRoot = document.querySelector('#app');
if (summaryAppRoot) {
  const observer = new MutationObserver(queueDaySummaryRender);
  observer.observe(summaryAppRoot, { childList: true, subtree: true });
}

queueDaySummaryRender();
