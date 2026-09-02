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
    window.removeEventListener('pointercancel', handleGlobalPointerCancel);
    window.removeEventListener('blur', handleGlobalBlur);
    releaseListenersAttached = false;
  };

  const closeTemporaryHoldMenu = () => {
    if (typeof document === 'undefined') return;
    const menuOrb = document.querySelector('.orb-mode-menu .orb');
    if (menuOrb?.isConnected) menuOrb.click();
  };

  const finishHold = (event, allowSelection = true, fallbackToHighlighted = false) => {
    if (!holding) return false;

    // Prefer the exact release position. On mobile, pointer capture / browser
    // cancellation can make the final event coordinates unreliable, so the last
    // visibly highlighted target is a safe fallback when the gesture is ending.
    const selected = allowSelection
      ? dragTargetAt(event) || (fallbackToHighlighted ? activeDragTarget : null)
      : null;

    holding = false;
    lastTapAt = 0;
    clearHoldTimer();
    clearSingleTimer();
    detachReleaseListeners();
    clearDragTarget();

    if (selected) selected.click();
    else closeTemporaryHoldMenu();

    onHoldEnd?.({
      selected: Boolean(selected),
      target: selected || null
    });

    return true;
  };

  function handleGlobalRelease(event) {
    finishHold(event, true, true);
  }

  function handleGlobalPointerCancel(event) {
    // Android browsers may emit pointercancel during a long-press/drag even when
    // the user is simply releasing. If an option is already highlighted, honor it.
    finishHold(event, true, true);
  }

  function handleGlobalBlur(event) {
    finishHold(event, false, false);
  }

  const attachReleaseListeners = () => {
    if (releaseListenersAttached || typeof window === 'undefined') return;
    releaseListenersAttached = true;
    window.addEventListener('pointermove', handleGlobalMove, { passive: true });
    window.addEventListener('pointerup', handleGlobalRelease);
    window.addEventListener('pointercancel', handleGlobalPointerCancel);
    window.addEventListener('blur', handleGlobalBlur);
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

    pointerUp(event) {
      clearHoldTimer();

      if (holding) {
        finishHold(event, true, true);
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

    pointerCancel(event) {
      clearHoldTimer();
      if (holding) {
        finishHold(event, true, true);
        return;
      }
      clearSingleTimer();
      lastTapAt = 0;
    },

    cancel() {
      const wasHolding = holding;
      clearHoldTimer();
      clearSingleTimer();
      detachReleaseListeners();
      clearDragTarget();
      holding = false;
      lastTapAt = 0;

      if (wasHolding) {
        closeTemporaryHoldMenu();
        onHoldEnd?.({ selected: false, target: null });
      }
    },

    destroy() {
      this.cancel();
    }
  };
}
