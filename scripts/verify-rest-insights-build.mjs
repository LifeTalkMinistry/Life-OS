import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');

const required = [
  'REST RHYTHM · LAST 7 CALENDAR DAYS',
  'YOUR 7-DAY RHYTHM',
  'YOUR REST PATTERN · BY WEEKDAY',
  'RECENT RESTS',
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

const forbidden = [
  'RestInsightsSafePanel({',
  'new MutationObserver(pauseWeeklyReconcile)',
  'new MutationObserver(pauseSleepStreakQueueRender)',
  'initializeRestInsightsInfo()',
  'initializeRecoveryStatusCard()',
  'Your Monday–Sunday recovery report is ready.',
  'PAUSE is opening Rest Insights without blocking the app.'
];

for (const marker of forbidden) {
  assert.equal(html.includes(marker), false, `Unsafe/simplified Rest Insights path still shipped: ${marker}`);
}

console.log('Recovered Rest Insights production bundle verified.');
