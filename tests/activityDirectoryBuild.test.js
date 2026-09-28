import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const buildSource = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const activityDirectorySource = readFileSync(new URL('../src/activityDirectory.js', import.meta.url), 'utf8');
const weeklyReportLinksCss = readFileSync(new URL('../src/weekly-report-links.css', import.meta.url), 'utf8');

test('Activity directory is included in both production build and source-page runtime', () => {
  assert.match(buildSource, /'src\/activityCommitments\.js',[\s\S]*'src\/activityDirectory\.js'/);
  assert.match(indexSource, /activityCommitments\.js[^<]*<\/script>\s*<script[^>]*activityDirectory\.js/);
});

test('Activity report header keeps its title visually centered between back and close controls', () => {
  assert.match(activityDirectorySource, /activity-report-top\{display:grid;grid-template-columns:31px minmax\(0,1fr\) 31px/);
  assert.match(activityDirectorySource, /activity-report-heading\{min-width:0;text-align:center\}/);
  assert.match(activityDirectorySource, /activity-report-top>\.activity-directory-close\{justify-self:end\}/);
  assert.match(activityDirectorySource, /<div class="activity-report-top">[\s\S]*data-activity-report-back[\s\S]*activity-report-heading[\s\S]*data-activity-directory-close/);
});

test('Activity reports use the Rest Insights hierarchy without a redundant Weekly Reports CTA', () => {
  assert.match(activityDirectorySource, /activity-status-card/);
  assert.match(activityDirectorySource, /ACTIVITY STATUS/);
  assert.match(activityDirectorySource, /LAST 7 DAYS/);
  assert.match(activityDirectorySource, /YOUR 7-DAY RHYTHM/);
  assert.match(activityDirectorySource, /activity-status-progress/);
  assert.match(activityDirectorySource, /activity-rhythm-day/);
  assert.match(activityDirectorySource, /renderDayAudit/);
  assert.match(weeklyReportLinksCss, /\[data-activity-weekly\]/);
  assert.match(weeklyReportLinksCss, /activity-weekly-button/);
  assert.match(weeklyReportLinksCss, /display:\s*none\s*!important/);
});

test('Rest Insights and Activity reports both suppress the Weekly Reports archive CTA', () => {
  assert.match(weeklyReportLinksCss, /\[data-pause-weekly-archive\]/);
  assert.match(weeklyReportLinksCss, /pause-weekly-archive-link/);
  assert.match(weeklyReportLinksCss, /\[data-activity-weekly\]/);
  assert.match(buildSource, /'src\/weekly-report-links\.css'/);
  assert.match(indexSource, /weekly-report-links\.css/);
});
