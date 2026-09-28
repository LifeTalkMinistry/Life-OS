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

test('Activity report header keeps its title visually centered between back and close controls', () => {
  assert.match(activityDirectorySource, /activity-report-top\{display:grid;grid-template-columns:31px minmax\(0,1fr\) 31px/);
  assert.match(activityDirectorySource, /activity-report-heading\{min-width:0;text-align:center\}/);
  assert.match(activityDirectorySource, /activity-report-top>\.activity-directory-close\{justify-self:end\}/);
  assert.match(activityDirectorySource, /<div class="activity-report-top">[\s\S]*data-activity-report-back[\s\S]*activity-report-heading[\s\S]*data-activity-directory-close/);
});

test('Activity reports mirror the complete Rest Insights hierarchy', () => {
  assert.match(activityDirectorySource, /activity-status-card/);
  assert.match(activityDirectorySource, /ACTIVITY STATUS/);
  assert.match(activityDirectorySource, /YOUR 7-DAY RHYTHM/);
  assert.match(activityParitySource, /activity-rhythm-card/);
  assert.match(activityParitySource, /activity-streak-card/);
  assert.match(activityParitySource, /activity-pattern-card/);
  assert.match(activityParitySource, /YOUR ACTIVITY PATTERN · BY WEEKDAY/);
  assert.match(activityParitySource, /YOUR STRONGEST ACTIVITY DAY/);
  assert.match(activityParitySource, /Activity-day consistency/);
  assert.match(activityParitySource, /Compared with last week/);
  assert.match(activityParitySource, /PAUSE reflects your recorded activity behavior/);
});

test('Activity main report hides redundant Weekly Reports and Recent Sessions blocks', () => {
  assert.match(activityParitySource, /panel\.querySelector\('\[data-activity-weekly\]'\)\?\.remove\(\)/);
  assert.match(activityParitySource, /RECENT SESSIONS/);
  assert.match(activityParitySource, /recent\?\.remove\(\)/);
  assert.match(weeklyReportLinksCss, /\[data-activity-weekly\]/);
  assert.match(weeklyReportLinksCss, /display:\s*none\s*!important/);
});

test('Activity rhythm is presented newest-first like Rest Insights', () => {
  assert.match(activityParitySource, /\[\.\.\.days\.children\]\.reverse\(\)\.forEach/);
  assert.match(activityParitySource, /activityParityOrder = 'newest-first'/);
});

test('Rest Insights and Activity reports both suppress the Weekly Reports archive CTA', () => {
  assert.match(weeklyReportLinksCss, /\[data-pause-weekly-archive\]/);
  assert.match(weeklyReportLinksCss, /pause-weekly-archive-link/);
  assert.match(weeklyReportLinksCss, /\[data-activity-weekly\]/);
  assert.match(buildSource, /'src\/weekly-report-links\.css'/);
  assert.match(indexSource, /weekly-report-links\.css/);
});
