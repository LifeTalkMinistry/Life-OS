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
  'src/components/RestInsightsSafePanel.js',
  'src/components/PauseTimerPicker.js',
  'src/components/PauseOrbMenu.js',
  'src/auth/backendClient.js',
  'src/pausePushClient.js',
  'src/components/PauseSettingsPanel.js',
  'src/sync/pauseSyncClient.js',
  'src/auth/LoginScreen.js',
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

function applyRuntimeGuards(file, source) {
  if (file === 'src/components/PausePanel.js') {
    source = source
      .replace(
        "const historyRows = state.history.slice(0, 20).map((entry) => {",
        "const historyRows = (Array.isArray(state?.history) ? state.history : [])\n    .filter((entry) => entry && typeof entry === 'object' && Number.isFinite(Number(entry.startAt ?? entry.endedAt)))\n    .slice(0, 20)\n    .map((entry) => {"
      )
      .replace(
        '  const insights = restInsights(state);',
        '  const insights = buildBoundedRestInsights(state);'
      )
      .replace(
        '  renderContent();\n\n  panel.addEventListener',
        `  panel.innerHTML = \`\n    \${panelHeader('Rest Insights')}\n    <p class="system-panel-intro">Loading your recorded rest data…</p>\n    <p class="pause-live-data-note">Preparing Rest Insights</p>\n    <div class="pause-audit-empty">PAUSE is opening Rest Insights without blocking the app.</div>\n  \`;\n\n  setTimeout(() => {\n    try {\n      renderContent();\n      if (typeof window !== 'undefined') window.__PAUSE_INSIGHTS_ERROR__ = null;\n    } catch (error) {\n      const message = String(error?.stack || error?.message || error || 'Unknown Rest Insights error');\n      if (typeof window !== 'undefined') window.__PAUSE_INSIGHTS_ERROR__ = message;\n      panel.innerHTML = \`\n        \${panelHeader('Rest Insights')}\n        <p class="system-panel-intro">Rest Insights opened, but PAUSE hit a runtime error while preparing your data.</p>\n        <div class="pause-audit-empty" style="text-align:left;word-break:break-word">\n          <strong style="display:block;margin-bottom:8px;color:#d8c7ef">DIAGNOSTIC ERROR</strong>\n          <span data-pause-insights-error>\${escapeHtml(message)}</span>\n        </div>\n      \`;\n    }\n  }, 80);\n\n  panel.addEventListener`
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
      )
      .replace(
        `view.appendChild(PausePanel({\n      state: pauseState,\n      onClose: closePanel\n    }));`,
        `view.appendChild(RestInsightsSafePanel({\n      state: pauseState,\n      onClose: closePanel\n    }));`
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
    const source = applyRuntimeGuards(file, readFileSync(file, 'utf8'));
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
