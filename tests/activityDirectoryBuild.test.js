import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const buildSource = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const activityDirectorySource = readFileSync(new URL('../src/activityDirectory.js', import.meta.url), 'utf8');
const activityParitySource = readFileSync(new URL('../src/activityInsightsParity.js', import.meta.url), 'utf8');
const weeklyReportLinksCss = readFileSync(new URL('../src/weekly-report-links.css', import.meta.url), 'utf8');

test('Activity directory and parity layer are included in production and source-page runtime', () => {
  assert.match(buildSource, /'src\/activityCommitments\.js',[\s\S]*'src\/activityDirectory\.js',[\s\S]*'src\/activityInsightsParity\.js'/);
  assert.match(indexSource, /activityCommitments\.js[^<]*<\/script>\s*<script[^>]*activityDirectory\.js[^<]*<\/script>\s*<script[^>]*activityInsightsParity\.js/);
});

test('Activity report reuses the Rest Insights panel and header primitives', () => {
  assert.match(activityParitySource, /panel\.classList\.add\('system-panel', 'pause-view-insights'\)/);
  assert.match(activityParitySource, /header\.className = 'system-panel-header'/);
  assert.match(activityParitySource, /wrapper\.className = 'pause-panel-heading'/);
  assert.match(activityParitySource, /back\.className = 'pause-audit-back'/);
  assert.match(activityParitySource, /close\.className = 'system-panel-close activity-close'/);
  assert.match(activityParitySource, /activity-panel\.system-panel\.pause-view-insights/);
});

test('Activity timeframe control is literally the Rest Insights 1/3/7/custom control', () => {
  assert.match(activityParitySource, /pause-recovery-status-card/);
  assert.match(activityParitySource, /pause-recovery-range-trigger/);
  assert.match(activityParitySource, /pause-recovery-range-menu/);
  assert.match(activityParitySource, /pause-recovery-quick-ranges/);
  assert.match(activityParitySource, /data-activity-days="1">1 DAY/);
  assert.match(activityParitySource, /data-activity-days="3">3 DAYS/);
  assert.match(activityParitySource, /data-activity-days="7">7 DAYS/);
  assert.match(activityParitySource, /data-activity-custom-toggle>CUSTOM/);
  assert.match(activityParitySource, /pause-recovery-custom-form/);
  assert.match(activityParitySource, /days: 7/);
  assert.doesNotMatch(activityParitySource, />ALL TIME</);
});

test('Activity status card reuses Rest Insights status typography, progress and two-column stats', () => {
  assert.match(activityParitySource, /pause-recovery-status-head/);
  assert.match(activityParitySource, /pause-recovery-status-kicker">ACTIVITY STATUS/);
  assert.match(activityParitySource, /pause-recovery-status-main/);
  assert.match(activityParitySource, /pause-recovery-status-value/);
  assert.match(activityParitySource, /pause-recovery-status-label/);
  assert.match(activityParitySource, /pause-recovery-progress-row/);
  assert.match(activityParitySource, /pause-recovery-progress-track/);
  assert.match(activityParitySource, /pause-recovery-progress-fill/);
  assert.match(activityParitySource, /pause-recovery-status-stats/);
  assert.match(activityParitySource, /pause-recovery-status-stat/);
});

test('Activity reports mirror the complete Rest Insights hierarchy with the same DOM primitives', () => {
  assert.match(activityDirectorySource, /YOUR 7-DAY RHYTHM/);
  assert.match(activityParitySource, /pause-insight-section/);
  assert.match(activityParitySource, /pause-rhythm-days/);
  assert.match(activityParitySource, /pause-rhythm-day pause-rhythm-day-button/);
  assert.match(activityParitySource, /pause-rhythm-day-label/);
  assert.match(activityParitySource, /pause-rhythm-track/);
  assert.match(activityParitySource, /pause-rhythm-fill/);
  assert.match(activityParitySource, /pause-rhythm-day-tail/);
  assert.match(activityParitySource, /pause-sleep-routine-streak is-compact/);
  assert.match(activityParitySource, /pause-sleep-streak-summary/);
  assert.match(activityParitySource, /pause-weekday-summary/);
  assert.match(activityParitySource, /pause-weekday-rank-list/);
  assert.match(activityParitySource, /pause-pattern-row/);
  assert.match(activityParitySource, /YOUR ACTIVITY PATTERN · BY WEEKDAY/);
  assert.match(activityParitySource, /YOUR STRONGEST ACTIVITY DAY/);
  assert.match(activityParitySource, /Activity-day consistency/);
  assert.match(activityParitySource, /Compared with last week/);
  assert.match(activityParitySource, /PAUSE reflects your recorded activity behavior/);
});

test('Activity main report hides redundant Weekly Reports and Recent Sessions blocks', () => {
  assert.match(activityParitySource, /panel\.querySelector\('\[data-activity-weekly\]'\)\?\.remove\(\)/);
  assert.match(activityParitySource, /RECENT SESSIONS/);
  assert.match(activityParitySource, /\?\.remove\(\)/);
  assert.match(weeklyReportLinksCss, /\[data-activity-weekly\]/);
  assert.match(weeklyReportLinksCss, /display:\s*none\s*!important/);
});

test('Activity rhythm is presented newest-first like Rest Insights', () => {
  assert.match(activityParitySource, /\[\.\.\.days\.children\]\.reverse\(\)\.forEach/);
  assert.match(activityParitySource, /activityParityOrder = 'newest-first'/);
  assert.match(activityParitySource, /- Today/);
  assert.match(activityParitySource, /- Yesterday/);
});

test('Rest Insights and Activity reports both suppress the Weekly Reports archive CTA', () => {
  assert.match(weeklyReportLinksCss, /\[data-pause-weekly-archive\]/);
  assert.match(weeklyReportLinksCss, /pause-weekly-archive-link/);
  assert.match(weeklyReportLinksCss, /\[data-activity-weekly\]/);
  assert.match(buildSource, /'src\/weekly-report-links\.css'/);
  assert.match(indexSource, /weekly-report-links\.css/);
});
