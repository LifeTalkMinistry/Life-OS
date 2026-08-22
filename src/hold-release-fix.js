/* Hold + drag selector for the live Orb.
 *
 * The Orb is re-rendered when a hold opens Today view, so the element that
 * received pointerdown no longer exists by the time the user releases. Track
 * the original pointer at document level, then let the finger slide across the
 * newly rendered activity / system targets. Release selects the highlighted
 * target; release on empty space simply returns to RUNNING NOW.
 */
let holdReleasePointerId = null;
let holdReleaseStartedOnOrb = false;
let holdReleaseSelectedTarget = null;

function holdReleaseClearHighlight() {
  document.querySelectorAll('.is-hold-target').forEach((element) => {
    element.classList.remove('is-hold-target');
  });
  holdReleaseSelectedTarget = null;
}

function holdReleaseReset() {
  holdReleaseClearHighlight();
  holdReleasePointerId = null;
  holdReleaseStartedOnOrb = false;
}

function holdReleaseTodayIsOpen() {
  return Boolean(document.querySelector('.main-screen.is-today'));
}

function holdReleaseCloseToday() {
  if (!holdReleaseStartedOnOrb) return;
  const todayOrb = document.querySelector('.main-screen.is-today .orb');
  if (!todayOrb) return;
  todayOrb.click();
}

function holdReleaseTargetAt(clientX, clientY) {
  const hit = document.elementFromPoint(clientX, clientY);
  if (!(hit instanceof Element)) return null;
  const target = hit.closest('[data-hold-target]');
  if (!target || !target.closest('.main-screen.is-today')) return null;
  return target;
}

function holdReleaseHighlight(target) {
  if (target === holdReleaseSelectedTarget) return;
  holdReleaseClearHighlight();
  holdReleaseSelectedTarget = target;
  target?.classList.add('is-hold-target');
}

function holdReleaseActivateSelection() {
  const target = holdReleaseSelectedTarget;
  if (!target || !target.isConnected) return false;

  /* The original pointerdown happened on the Orb before this target existed,
   * so browsers do not reliably synthesize a click on release. Trigger the
   * already-wired target click deliberately. */
  target.click();
  return true;
}

document.addEventListener('pointerdown', (event) => {
  const liveOrb = event.target instanceof Element
    ? event.target.closest('.orb-mode-now .orb')
    : null;

  if (!liveOrb) {
    holdReleaseReset();
    return;
  }

  holdReleasePointerId = event.pointerId;
  holdReleaseStartedOnOrb = true;
  holdReleaseSelectedTarget = null;
}, true);

document.addEventListener('pointermove', (event) => {
  if (!holdReleaseStartedOnOrb || event.pointerId !== holdReleasePointerId) return;
  if (!holdReleaseTodayIsOpen()) return;

  event.preventDefault();
  holdReleaseHighlight(holdReleaseTargetAt(event.clientX, event.clientY));
}, { capture: true, passive: false });

document.addEventListener('pointerup', (event) => {
  if (!holdReleaseStartedOnOrb || event.pointerId !== holdReleasePointerId) return;

  if (holdReleaseTodayIsOpen()) {
    event.preventDefault();
    event.stopPropagation();

    if (!holdReleaseActivateSelection()) {
      holdReleaseCloseToday();
    }
  }

  holdReleaseReset();
}, true);

document.addEventListener('pointercancel', (event) => {
  if (!holdReleaseStartedOnOrb || event.pointerId !== holdReleasePointerId) return;
  holdReleaseCloseToday();
  holdReleaseReset();
}, true);

window.addEventListener('blur', () => {
  if (holdReleaseStartedOnOrb) holdReleaseCloseToday();
  holdReleaseReset();
});
