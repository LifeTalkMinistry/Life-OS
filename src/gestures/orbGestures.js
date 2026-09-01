export function createOrbGestureController({
  onSingleTap,
  onDoubleTap,
  onHoldStart,
  onHoldEnd,
  holdDelay = 520,
  doubleTapDelay = 280
}) {
  let holdTimer = null;
  let singleTapTimer = null;
  let holding = false;
  let lastTapAt = 0;
  let releaseListenersAttached = false;
  let activeDragTarget = null;

  const clearHoldTimer = () => {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
  };

  const clearSingleTimer = () => {
    if (singleTapTimer) clearTimeout(singleTapTimer);
    singleTapTimer = null;
  };

  const clearDragTarget = () => {
    activeDragTarget?.classList.remove('is-drag-target');
    activeDragTarget = null;
  };

  const dragTargetAt = (event) => {
    if (!holding || typeof document === 'undefined' || !event) return null;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const candidate = element?.closest?.('.pause-menu-node, .today-system-button') ?? null;
    if (candidate?.disabled || candidate?.getAttribute?.('aria-disabled') === 'true') return null;
    return candidate;
  };

  const handleGlobalMove = (event) => {
    if (!holding) return;
    const target = dragTargetAt(event);
    if (target === activeDragTarget) return;
    clearDragTarget();
    activeDragTarget = target;
    activeDragTarget?.classList.add('is-drag-target');
  };

  const detachReleaseListeners = () => {
    if (!releaseListenersAttached || typeof window === 'undefined') return;
    window.removeEventListener('pointermove', handleGlobalMove);
    window.removeEventListener('pointerup', handleGlobalRelease);
    window.removeEventListener('pointercancel', handleGlobalCancel);
    window.removeEventListener('blur', handleGlobalCancel);
    releaseListenersAttached = false;
  };

  const finishHold = (event, allowSelection = true) => {
    if (!holding) return false;

    const selected = allowSelection ? (dragTargetAt(event) || activeDragTarget) : null;

    holding = false;
    lastTapAt = 0;
    clearHoldTimer();
    clearSingleTimer();
    detachReleaseListeners();
    clearDragTarget();

    // A hold is a temporary radial gesture. Releasing over a target selects it.
    // Releasing anywhere else simply ends the hold and lets PAUSE return to the orb.
    if (selected) selected.click();
    onHoldEnd?.({
      selected: Boolean(selected),
      target: selected || null
    });

    return true;
  };

  function handleGlobalRelease(event) {
    finishHold(event, true);
  }

  function handleGlobalCancel(event) {
    finishHold(event, false);
  }

  const attachReleaseListeners = () => {
    if (releaseListenersAttached || typeof window === 'undefined') return;
    releaseListenersAttached = true;
    // The hold view replaces the original orb while the pointer is still down,
    // so movement and release must be tracked globally.
    window.addEventListener('pointermove', handleGlobalMove, { passive: true });
    window.addEventListener('pointerup', handleGlobalRelease);
    window.addEventListener('pointercancel', handleGlobalCancel);
    window.addEventListener('blur', handleGlobalCancel);
  };

  return {
    pointerDown() {
      clearHoldTimer();
      clearDragTarget();
      holding = false;
      holdTimer = setTimeout(() => {
        holding = true;
        clearSingleTimer();
        attachReleaseListeners();
        onHoldStart?.();
      }, holdDelay);
    },

    pointerUp() {
      clearHoldTimer();
      if (finishHold(null, false)) return;

      const now = Date.now();
      if (lastTapAt && now - lastTapAt <= doubleTapDelay) {
        lastTapAt = 0;
        clearSingleTimer();
        onDoubleTap?.();
        return;
      }

      lastTapAt = now;
      clearSingleTimer();
      singleTapTimer = setTimeout(() => {
        lastTapAt = 0;
        onSingleTap?.();
      }, doubleTapDelay);
    },

    cancel() {
      clearHoldTimer();
      clearSingleTimer();
      detachReleaseListeners();
      clearDragTarget();
      holding = false;
      lastTapAt = 0;
    },

    destroy() {
      this.cancel();
    }
  };
}
