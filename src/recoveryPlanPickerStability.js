export function shouldCreateRecoveryPlanOverlay(hasOverlay) {
  return !Boolean(hasOverlay);
}

if (typeof showOverlay === 'function') {
  const pauseRecoveryPlanBaseShowOverlay = showOverlay;

  showOverlay = function pauseRecoveryPlanStableShowOverlay() {
    if (!shouldCreateRecoveryPlanOverlay(Boolean(overlay))) return overlay;
    return pauseRecoveryPlanBaseShowOverlay();
  };
}
