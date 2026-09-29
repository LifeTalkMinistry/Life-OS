import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const buildSource = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const activityDirectorySource = readFileSync(new URL('../src/activityDirectory.js', import.meta.url), 'utf8');
const activityInsightsSource = readFileSync(new URL('../src/activityInsightsParity.js', import.meta.url), 'utf8');
const weeklyReportLinksCss = readFileSync(new URL('../src/weekly-report-links.css', import.meta.url), 'utf8');

test('Activity directory, cloud sync, and refined Activity Insights runtime are included in production', () => {
  assert.match(buildSource, /'src\/activityCommitments\.js',[\s\S]*'src\/sync\/activityCloudSync\.js',[\s\S]*'src\/activityDirectory\.js',[\s\S]*'src\/activityInsightsParity\.js'/);
  assert.match(indexSource, /activityCommitments\.js[^<]*<\/script>\s*<script[^>]*activityCloudSync\.js[^<]*<\/script>\s*<script[^>]*activityDirectory\.js[^<]*<\/script>\s*<script[^>]*activityInsightsParity\.js/);
});

test('Activity Insights uses its own DOM instead of borrowing Rest-specific report classes', () => {
  assert.match(activityInsightsSource, /activity-insights-panel/);
  assert.match(activityInsightsSource, /activity-insights-status-card/);
  assert.match(activityInsightsSource, /activity-insights-rhythm-card/);
  assert.match(activityInsightsSource, /activity-insights-streak-card/);
  assert.match(activityInsightsSource, /activity-insights-pattern-card/);
  assert.doesNotMatch(activityInsightsSource, /pause-recovery-status-card/);
  assert.doesNotMatch(activityInsightsSource, /pause-rhythm-day pause-rhythm-day-button/);
  assert.doesNotMatch(activityInsightsSource, /pause-sleep-routine-streak/);
  assert.doesNotMatch(activityInsightsSource, /pause-weekday-summary/);
});

test('Activity timeframe keeps the same 1/3/7/custom interaction structure as Rest Insights', () => {
  assert.match(activityInsightsSource, /data-activity-days="1">1 DAY/);
  assert.match(activityInsightsSource, /data-activity-days="3">3 DAYS/);
  assert.match(activityInsightsSource, /data-activity-days="7">7 DAYS/);
  assert.match(activityInsightsSource, /data-activity-custom-toggle>CUSTOM/);
  assert.match(activityInsightsSource, /days: 7/);
  assert.doesNotMatch(activityInsightsSource, />ALL TIME</);
});

test('Activity status preserves Activity wording and scoring semantics', () => {
  assert.match(activityInsightsSource, />ACTIVITY STATUS</);
  assert.match(activityInsightsSource, /TRACKING MODE/);
  assert.match(activityInsightsSource, /Track only/);
  assert.match(activityInsightsSource, /TARGET MET/);
  assert.match(activityInsightsSource, /PASS/);
  assert.match(activityInsightsSource, /SHORT/);
  assert.match(activityInsightsSource, /AVERAGE \/ DAY/);
  assert.doesNotMatch(activityInsightsSource, /REST STATUS/);
  assert.doesNotMatch(activityInsightsSource, /DAILY TARGET[^\n]*7h/);
});

test('Activity report mirrors the Rest Insights card hierarchy without copying Rest wording', () => {
  assert.match(activityInsightsSource, /YOUR 7-DAY RHYTHM/);
  assert.match(activityInsightsSource, /activity day in a row/);
  assert.match(activityInsightsSource, /YOUR ACTIVITY PATTERN · BY WEEKDAY/);
  assert.match(activityInsightsSource, /STRONGEST ACTIVITY DAY/);
  assert.match(activityInsightsSource, /BUILDING YOUR ACTIVITY PATTERN/);
  assert.match(activityInsightsSource, /Most common time/);
  assert.match(activityInsightsSource, /Active days vs last week/);
  assert.match(activityInsightsSource, /Tracked time vs last week/);
  assert.match(activityInsightsSource, /PAUSE reflects the time you recorded for this activity/);
  assert.doesNotMatch(activityInsightsSource, /YOUR REST PATTERN/);
  assert.doesNotMatch(activityInsightsSource, /STRONGEST REST DAY/);
  assert.doesNotMatch(activityInsightsSource, /routine day/);
});

test('Activity rhythm uses a clean three-column row and newest-first order', () => {
  assert.match(activityInsightsSource, /grid-template-columns:62px minmax\(0,1fr\) 68px/);
  assert.match(activityInsightsSource, /chronological\.reverse\(\)/);
  assert.match(activityInsightsSource, /· Today/);
  assert.match(activityInsightsSource, /· Yesterday/);
  assert.match(activityInsightsSource, /activity-insights-rhythm-label/);
  assert.match(activityInsightsSource, /activity-insights-rhythm-track/);
  assert.match(activityInsightsSource, /activity-insights-rhythm-tail/);
});

test('Activity main report does not surface Weekly Reports or Recent Sessions cards', () => {
  assert.doesNotMatch(activityInsightsSource, />WEEKLY REPORTS</);
  assert.doesNotMatch(activityInsightsSource, />RECENT SESSIONS</);
  assert.match(weeklyReportLinksCss, /\[data-activity-weekly\]/);
  assert.match(weeklyReportLinksCss, /display:\s*none\s*!important/);
});

test('The original Activity directory remains the source for the clean activity list', () => {
  assert.match(activityDirectorySource, /activity-directory-list/);
  assert.match(activityDirectorySource, /data-activity-directory-add/);
  assert.match(activityDirectorySource, /data-activity-report=/);
});
