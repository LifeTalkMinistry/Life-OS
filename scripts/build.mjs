import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const scriptOrder = [
  'src/gestures/orbGestures.js',
  'src/components/OrbArtwork.js',
  'src/manilaTime.js',
  'src/pauseAlarm.js',
  'src/restState.js',
  'src/components/RestInsightsAsyncRuntime.js',
  'src/components/Brand.js',
  'src/components/Orb.js',
  'src/components/PauseScore.js',
  'src/components/TodayRing.js',
  'src/components/PausePanel.js',
  'src/components/PauseTimerPicker.js',
  'src/components/PauseOrbMenu.js',
  'src/auth/backendClient.js',
  'src/pausePushClient.js',
  'src/components/PauseSettingsPanel.js',
  'src/sync/pauseSyncClient.js',
  'src/sync/pauseSyncReconcile.js',
  'src/auth/LoginScreen.js',
  'src/recoveryStatusCard.js',
  'src/app.js',
  'src/recoveryPlan.js',
  'src/sleepRoutineSchedule.js',
  'src/recoveryPlanPickerStability.js',
  'src/recoveryBriefing.js',
  'src/recoveryThiefLog.js',
  'src/weeklyReport.js',
  'src/sleepRoutineStreak.js'
];

function stripModuleSyntax(source) {
  return source
    .replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?\s*/g, '')
    .replace(/\bexport\s*\{[\s\S]*?\};?\s*/g, '')
    .replace(/\bexport\s+default\s+/g, '')
    .replace(/\bexport\s+(?=(?:async\s+)?(?:const|let|var|function|class)\b)/g, '');
}

function applyRuntimeSafety(file, source) {
  if (file === 'src/components/PausePanel.js') {
    source = source
      .replace(
        '  const insights = restInsights(state);',
        '  const insights = buildBoundedRestInsights(state);'
      )
      .replace(
        '  const audit = restAuditForDay(state, dayKey);',
        '  const audit = buildBoundedRestAuditForDay(state, dayKey);'
      )
      .replace(
        'const historyRows = state.history.slice(0, 20).map((entry) => {',
        "const historyRows = (Array.isArray(state?.history) ? state.history : [])\n    .filter((entry) => entry && typeof entry === 'object' && Number.isFinite(Number(entry.startAt ?? entry.endedAt)))\n    .slice(0, 20)\n    .map((entry) => {"
      )
      .replace(
        '    panel.scrollTop = resetScroll ? 0 : previousScrollTop;\n  };',
        "    panel.scrollTop = resetScroll ? 0 : previousScrollTop;\n    if (!selectedDayKey) queueMicrotask(() => window.dispatchEvent(new CustomEvent('pause:insights-opened')));\n  };"
      );
  }

  if (file === 'src/app.js') {
    source = source
      .replace(
        'pointerUp: () => gestureController.pointerUp(),',
        'pointerUp: (event) => gestureController.pointerUp(event),'
      )
      .replace(
        'cancel: () => gestureController.cancel(),',
        'pointerCancel: (event) => gestureController.pointerCancel?.(event),\n    cancel: () => gestureController.cancel(),'
      );
  }

  if (file === 'src/recoveryStatusCard.js') {
    source = source.replace(
      /export function initializeRecoveryStatusCard\(\) \{\n  if \(typeof document === 'undefined' \|\| recoveryObserver\) return;\n  ensureRecoveryStyles\(\);\n  recoveryObserver = new MutationObserver\(queueRecoveryScan\);\n  recoveryObserver\.observe\(document\.documentElement, \{ childList: true, subtree: true \}\);\n  queueRecoveryScan\(\);\n\}/,
      "export function initializeRecoveryStatusCard() {\n  if (typeof document === 'undefined' || recoveryObserver) return;\n  ensureRecoveryStyles();\n  recoveryObserver = { disconnect() {} };\n  window.addEventListener('pause:insights-opened', queueRecoveryScan);\n  window.addEventListener('pause:state-changed', queueRecoveryScan);\n  window.addEventListener('focus', queueRecoveryScan);\n  queueRecoveryScan();\n}"
    );
  }

  if (file === 'src/weeklyReport.js') {
    source = source
      .replace(
        /  const pauseWeeklyObserver = new MutationObserver\(pauseWeeklyReconcile\);\n  pauseWeeklyObserver\.observe\(document\.documentElement, \{ childList: true, subtree: true \}\);\n  const pauseWeeklyInterval = setInterval\(pauseWeeklyReconcile, 1200\);\n  pauseWeeklyInterval\.unref\?\.\(\);/,
        "  window.addEventListener('pause:insights-opened', pauseWeeklyReconcile);"
      )
      .replace('Your Monday–Sunday recovery report is ready.', 'Your Monday–Sunday Weekly Report is ready.');
  }

  if (file === 'src/sleepRoutineStreak.js') {
    source = source.replace(
      /  const observer = new MutationObserver\(pauseSleepStreakQueueRender\);\n  observer\.observe\(document\.documentElement, \{ childList: true, subtree: true \}\);/,
      "  window.addEventListener('pause:insights-opened', pauseSleepStreakQueueRender);"
    );
  }

  return source;
}

const cssFiles = [
  'src/styles.css',
  'src/refinements.css',
  'src/orb-depth.css',
  'src/system-controls.css',
  'src/layout-invariant.css',
  'src/pause.css',
  'src/brand-wordmark.css',
  'src/auth/auth.css',
  'src/recovery-plan.css',
  'src/sleep-routine-schedule.css',
  'src/recovery-briefing-brand.css'
];

const css = cssFiles.map((file) => readFileSync(file, 'utf8')).join('\n\n');
const js = scriptOrder
  .map((file) => {
    const source = applyRuntimeSafety(file, readFileSync(file, 'utf8'));
    return `// ${file}\n${stripModuleSyntax(source)}`;
  })
  .join('\n\n');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#030307" />
    <meta name="color-scheme" content="dark" />
    <meta name="description" content="PAUSE — Know When to Stop." />
    <meta name="application-name" content="PAUSE" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="PAUSE" />
    <meta name="format-detection" content="telephone=no" />
    <title>PAUSE — Know When to Stop.</title>
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="apple-touch-icon" sizes="180x180" href="./pwa/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="./pwa/icon-192.png" />
    <style>${css}</style>
  </head>
  <body>
    <main id="app" aria-live="polite"></main>
    <script>${js.replace(/<\/script>/gi, '<\\/script>')}</script>
  </body>
</html>`;

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);

if (existsSync('src/assets')) cpSync('src/assets', 'dist/assets', { recursive: true });
if (existsSync('pwa')) cpSync('pwa', 'dist/pwa', { recursive: true });
cpSync('manifest.webmanifest', 'dist/manifest.webmanifest');
cpSync('sw.js', 'dist/sw.js');

console.log('Built PAUSE into dist/index.html.');