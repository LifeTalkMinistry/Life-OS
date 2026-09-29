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
  const isKnownSpanishListening = activity.name === 'Practice Spanish Listening'
    && activity.targetMode === 'daily';
  const targetMinutes = Number(activity.targetMinutes);
  const passingTargetMinutes = Number(activity.passingTargetMinutes);
  const isOriginalCorruption = targetMinutes === 1 && passingTargetMinutes === 30;
  const isDerivedDisplayCorruption = targetMinutes === 60 && passingTargetMinutes === 1800;

  if (isKnownSpanishListening && (isOriginalCorruption || isDerivedDisplayCorruption)) {
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
