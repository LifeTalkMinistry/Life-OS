/* Hold-to-peek release guard.
 * The hold view re-renders the Orb, which removes the original element before
 * its pointerup handler can fire. Track the press at document level so the
 * release always returns Today view to RUNNING NOW.
 */
let holdReleasePointerId = null;
let holdReleaseStartedOnOrb = false;

function holdReleaseReset() {
  holdReleasePointerId = null;
  holdReleaseStartedOnOrb = false;
}

function holdReleaseCloseToday() {
  if (!holdReleaseStartedOnOrb) return;
  const todayOrb = document.querySelector('.main-screen.is-today .orb');
  if (!todayOrb) return;
  todayOrb.click();
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
}, true);

document.addEventListener('pointerup', (event) => {
  if (!holdReleaseStartedOnOrb || event.pointerId !== holdReleasePointerId) return;
  holdReleaseCloseToday();
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
