import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const buildSource = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const activityDirectorySource = readFileSync(new URL('../src/activityDirectory.js', import.meta.url), 'utf8');

test('Activity directory is included in both production build and source-page runtime', () => {
  assert.match(buildSource, /'src\/activityCommitments\.js',[\s\S]*'src\/activityDirectory\.js'/);
  assert.match(indexSource, /activityCommitments\.js[^<]*<\/script>\s*<script[^>]*activityDirectory\.js/);
});

test('Activity report header keeps its title visually centered between back and close controls', () => {
  assert.match(activityDirectorySource, /activity-report-top\{display:grid;grid-template-columns:31px minmax\(0,1fr\) 31px/);
  assert.match(activityDirectorySource, /activity-report-heading\{min-width:0;text-align:center\}/);
  assert.match(activityDirectorySource, /activity-report-top>\.activity-directory-close\{justify-self:end\}/);
  assert.match(
    activityDirectorySource,
    /<div class="activity-report-top">\s*<button[^>]*data-activity-report-back[^>]*>←<\/button>\s*<div class="activity-report-heading">[\s\S]*?<button[^>]*data-activity-directory-close/
  );
});
