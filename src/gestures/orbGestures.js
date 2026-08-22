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

  const clearHoldTimer = () => {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
  };

  const clearSingleTimer = () => {
    if (singleTapTimer) clearTimeout(singleTapTimer);
    singleTapTimer = null;
  };

  const detachReleaseListeners = () => {
    if (!releaseListenersAttached || typeof window === 'undefined') return;
    window.removeEventListener('pointerup', handleGlobalRelease);
    window.removeEventListener('pointercancel', handleGlobalRelease);
    window.removeEventListener('blur', handleGlobalRelease);
    releaseListenersAttached = false;
  };

  const returnRenderedHoldViewToIdle = () => {
    if (typeof document === 'undefined') return;
    const todayOrb = document.querySelector('.main-screen.is-today .orb');
    todayOrb?.click();
  };

  const finishHold = () => {
    if (!holding) return false;
    holding = false;
    lastTapAt = 0;
    clearHoldTimer();
    clearSingleTimer();
    detachReleaseListeners();
    onHoldEnd?.();

    // onHoldStart renders the Today view, replacing the element that received
    // pointerdown. If the app-level hold-end callback has not already restored
    // idle mode, close that rendered hold view through its normal orb action.
    returnRenderedHoldViewToIdle();
    return true;
  };

  function handleGlobalRelease() {
    finishHold();
  }

  const attachReleaseListeners = () => {
    if (releaseListenersAttached || typeof window === 'undefined') return;
    releaseListenersAttached = true;
    // The hold view can re-render and remove the original orb while the
    // pointer is still down. Listen at window level so release is still
    // observed and the UI can return to its idle state.
    window.addEventListener('pointerup', handleGlobalRelease);
    window.addEventListener('pointercancel', handleGlobalRelease);
    window.addEventListener('blur', handleGlobalRelease);
  };

  return {
    pointerDown() {
      clearHoldTimer();
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
      if (finishHold()) return;

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
      holding = false;
      lastTapAt = 0;
    },

    destroy() {
      this.cancel();
    }
  };
}
