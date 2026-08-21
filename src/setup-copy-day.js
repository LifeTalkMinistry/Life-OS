/* Tuesday onboarding shortcut.
 * Production is built as one ordered script, so this enhancement can reuse the
 * existing setup state/actions without expanding the core component again.
 * Keep identifiers uniquely prefixed to avoid bundle-scope collisions.
 */
const COPY_DAY_SOURCE_MONDAY = 1;
const COPY_DAY_TARGET_TUESDAY = 2;

function copyDayCustomActivities(sourceDay, targetDay) {
  const sourceActivities = lifeProfile.activities
    .filter((activity) => !isAnchorActivity(activity) && activity.days.includes(sourceDay))
    .sort((a, b) => a.start.localeCompare(b.start));

  if (!sourceActivities.length) return false;

  const targetIds = new Set(
    lifeProfile.activities
      .filter((activity) => !isAnchorActivity(activity) && activity.days.includes(targetDay))
      .map((activity) => activity.id)
  );

  if (targetIds.size) return false;

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

function installTuesdayCopyShortcut() {
  if (screen !== 'setup' || setupStep !== 'activities' || setupActivityDay !== COPY_DAY_TARGET_TUESDAY) return;

  const builder = document.querySelector('.setup-step-activities .setup-day-builder:not(.setup-day-complete)');
  if (!builder || builder.querySelector('[data-copy-monday]')) return;

  const mondayActivities = lifeProfile.activities.filter(
    (activity) => !isAnchorActivity(activity) && activity.days.includes(COPY_DAY_SOURCE_MONDAY)
  );
  const tuesdayActivities = lifeProfile.activities.filter(
    (activity) => !isAnchorActivity(activity) && activity.days.includes(COPY_DAY_TARGET_TUESDAY)
  );

  if (!mondayActivities.length || tuesdayActivities.length) return;

  const shortcut = document.createElement('button');
  shortcut.type = 'button';
  shortcut.className = 'setup-copy-day-button';
  shortcut.dataset.copyMonday = 'true';
  shortcut.textContent = 'Same as Monday';
  shortcut.setAttribute('aria-label', 'Copy Monday activities to Tuesday');

  shortcut.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    copyDayCustomActivities(COPY_DAY_SOURCE_MONDAY, COPY_DAY_TARGET_TUESDAY);
  });

  const activityRow = builder.querySelector('.setup-activity-name-row');
  if (activityRow) builder.insertBefore(shortcut, activityRow);
  else builder.appendChild(shortcut);
}

let copyDayFrame = null;
function queueTuesdayCopyShortcut() {
  if (copyDayFrame !== null) cancelAnimationFrame(copyDayFrame);
  copyDayFrame = requestAnimationFrame(() => {
    copyDayFrame = null;
    installTuesdayCopyShortcut();
  });
}

const copyDayAppRoot = document.querySelector('#app');
if (copyDayAppRoot) {
  const copyDayObserver = new MutationObserver(queueTuesdayCopyShortcut);
  copyDayObserver.observe(copyDayAppRoot, { childList: true, subtree: true });
}

queueTuesdayCopyShortcut();
