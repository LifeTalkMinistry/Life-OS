/* Previous-day onboarding shortcut.
 * Every day after Monday can reuse the custom activities from the day that was
 * just mapped. Copies are independent so later edits never change the source.
 * Fixed anchors (work, sleep, travel home, preparation blocks) are already
 * shared by the profile and are intentionally not duplicated here.
 */
const COPY_DAY_SEQUENCE = [1, 2, 3, 4, 5, 6, 0];
const COPY_DAY_NAMES = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday'
};

function copyDayPreviousDay(targetDay) {
  const targetIndex = COPY_DAY_SEQUENCE.indexOf(targetDay);
  if (targetIndex <= 0) return false;

  const sourceDay = COPY_DAY_SEQUENCE[targetIndex - 1];
  const sourceActivities = lifeProfile.activities
    .filter((activity) => !isAnchorActivity(activity) && activity.days.includes(sourceDay))
    .sort((a, b) => a.start.localeCompare(b.start));

  if (!sourceActivities.length) return false;

  const targetActivities = lifeProfile.activities.filter(
    (activity) => !isAnchorActivity(activity) && activity.days.includes(targetDay)
  );
  if (targetActivities.length) return false;

  const stamp = Date.now();
  const copies = sourceActivities.map((activity, index) => ({
    ...activity,
    id: `activity-copy-${targetDay}-${stamp}-${index + 1}`,
    days: [targetDay]
  }));

  lifeProfile = {
    ...lifeProfile,
    activities: [...lifeProfile.activities, ...copies]
  };

  setupActivityDay = targetDay;
  setupActivityCursor = activityCursorForDay(targetDay);
  resetActivityDraft(setupActivityCursor);
  render();
  return true;
}

function installPreviousDayCopyShortcut() {
  if (screen !== 'setup' || setupStep !== 'activities') return;

  const targetDay = setupActivityDay;
  const targetIndex = COPY_DAY_SEQUENCE.indexOf(targetDay);
  if (targetIndex <= 0) return;

  const sourceDay = COPY_DAY_SEQUENCE[targetIndex - 1];
  const sourceName = COPY_DAY_NAMES[sourceDay];
  const targetName = COPY_DAY_NAMES[targetDay];

  const builder = document.querySelector('.setup-step-activities .setup-day-builder:not(.setup-day-complete)');
  if (!builder || builder.querySelector('[data-copy-previous-day]')) return;

  const sourceActivities = lifeProfile.activities.filter(
    (activity) => !isAnchorActivity(activity) && activity.days.includes(sourceDay)
  );
  const targetActivities = lifeProfile.activities.filter(
    (activity) => !isAnchorActivity(activity) && activity.days.includes(targetDay)
  );

  if (!sourceActivities.length || targetActivities.length) return;

  const shortcut = document.createElement('button');
  shortcut.type = 'button';
  shortcut.className = 'setup-copy-day-button';
  shortcut.dataset.copyPreviousDay = String(sourceDay);
  shortcut.textContent = `Same as ${sourceName}`;
  shortcut.setAttribute('aria-label', `Copy ${sourceName} activities to ${targetName}`);

  shortcut.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    copyDayPreviousDay(targetDay);
  });

  const activityRow = builder.querySelector('.setup-activity-name-row');
  if (activityRow) builder.insertBefore(shortcut, activityRow);
  else builder.appendChild(shortcut);
}

function installFinishCurrentDayShortcut() {
  if (screen !== 'setup' || setupStep !== 'activities') return;

  const builder = document.querySelector('.setup-step-activities .setup-day-builder:not(.setup-day-complete)');
  if (!builder || builder.querySelector('[data-finish-current-day]')) return;

  const dayName = COPY_DAY_NAMES[setupActivityDay] || 'Day';
  const finishButton = document.createElement('button');
  finishButton.type = 'button';
  finishButton.className = 'setup-finish-day-button';
  finishButton.dataset.finishCurrentDay = String(setupActivityDay);
  finishButton.textContent = `Finish ${dayName}`;
  finishButton.setAttribute('aria-label', `Finish ${dayName} and leave remaining time open`);

  finishButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleSetupAction({ setupAction: 'activity-day-next' });
  });

  const backButton = builder.querySelector(':scope > .setup-back');
  if (backButton) builder.insertBefore(finishButton, backButton);
  else builder.appendChild(finishButton);
}

let copyDayFrame = null;
function queuePreviousDayCopyShortcut() {
  if (copyDayFrame !== null) cancelAnimationFrame(copyDayFrame);
  copyDayFrame = requestAnimationFrame(() => {
    copyDayFrame = null;
    installPreviousDayCopyShortcut();
    installFinishCurrentDayShortcut();
  });
}

const copyDayAppRoot = document.querySelector('#app');
if (copyDayAppRoot) {
  const copyDayObserver = new MutationObserver(queuePreviousDayCopyShortcut);
  copyDayObserver.observe(copyDayAppRoot, { childList: true, subtree: true });
}

queuePreviousDayCopyShortcut();
