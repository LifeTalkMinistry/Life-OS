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

  const clearHoldTimer = () => {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
  };

  const clearSingleTimer = () => {
    if (singleTapTimer) clearTimeout(singleTapTimer);
    singleTapTimer = null;
  };

  return {
    pointerDown() {
      clearHoldTimer();
      holding = false;
      holdTimer = setTimeout(() => {
        holding = true;
        clearSingleTimer();
        onHoldStart?.();
      }, holdDelay);
    },

    pointerUp() {
      clearHoldTimer();
      if (holding) {
        holding = false;
        lastTapAt = 0;
        onHoldEnd?.();
        return;
      }

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
      holding = false;
      lastTapAt = 0;
    },

    destroy() {
      this.cancel();
    }
  };
}
