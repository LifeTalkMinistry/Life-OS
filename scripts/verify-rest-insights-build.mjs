import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');

const required = [
  'REST RHYTHM · LAST 7 CALENDAR DAYS',
  'YOUR 7-DAY RHYTHM',
  'YOUR REST PATTERN · BY WEEKDAY',
  'DAILY AUDIT · MANILA TIME',
  'buildBoundedRestInsights(state)',
  'buildBoundedRestAuditForDay(state, dayKey)',
  "window.dispatchEvent(new CustomEvent('pause:insights-opened'))",
  "window.addEventListener('pause:insights-opened', pauseWeeklyReconcile)",
  "window.addEventListener('pause:insights-opened', pauseSleepStreakQueueRender)",
  'Your Monday–Sunday Weekly Report is ready.'
];

for (const marker of required) {
  assert.ok(html.includes(marker), `Production Rest Insights bundle is missing: ${marker}`);
}

// RECENT RESTS was intentionally removed from the main Rest Insights surface.
// Daily audits remain the supported path for inspecting exact recorded sessions.
assert.equal(html.includes('<p class="pause-insight-section-title">RECENT RESTS</p>'), false, 'Removed Recent Rests section returned to the main Rest Insights surface.');

const forbidden = [
  'RestInsightsSafePanel({',
  'new MutationObserver(pauseWeeklyReconcile)',
  'new MutationObserver(pauseSleepStreakQueueRender)',
  'initializeRestInsightsInfo()',
  'Your Monday–Sunday recovery report is ready.',
  'PAUSE is opening Rest Insights without blocking the app.'
];

for (const marker of forbidden) {
  assert.equal(html.includes(marker), false, `Unsafe/simplified Rest Insights path still shipped: ${marker}`);
}

console.log('Recovered Rest Insights production bundle verified.');
