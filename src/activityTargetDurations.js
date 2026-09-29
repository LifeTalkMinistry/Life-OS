export function durationToMinutes(value, unit) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return unit === 'hours' ? Math.round(numeric * 60) : Math.round(numeric);
}

export function activityDisplayUnit(unit, minutes) {
  if (unit === 'hours' || unit === 'minutes') return unit;
  const numeric = Number(minutes);
  return Number.isFinite(numeric) && numeric >= 60 && numeric % 60 === 0 ? 'hours' : 'minutes';
}

export function minutesToDisplay(minutes, unit) {
  const numeric = Number(minutes);
  if (!Number.isFinite(numeric)) return '';
  return unit === 'hours' ? numeric / 60 : numeric;
}

export function repairKnownActivityTarget(activity) {
  if (!activity || typeof activity !== 'object') return activity;
  if (
    activity.name === 'Practice Spanish Listening'
    && activity.targetMode === 'daily'
    && Number(activity.targetMinutes) === 1
    && Number(activity.passingTargetMinutes) === 30
  ) {
    return {
      ...activity,
      targetMinutes: 60,
      passingTargetMinutes: 30,
      targetDisplayUnit: 'hours',
      passingDisplayUnit: 'minutes'
    };
  }
  return activity;
}
