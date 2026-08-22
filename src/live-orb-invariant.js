/* Intentionally disabled.
 *
 * The live Orb is rendered only by MainScreen() -> Orb() in app.js.
 * This file remains in the bundle as a no-op so production no longer wraps
 * render(), rebuilds MainScreen(), mutates completed-state persistence, or
 * hides runtime failures behind repair attempts.
 */
