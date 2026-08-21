import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function collectJs(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? collectJs(path) : path.endsWith('.js') || path.endsWith('.mjs') ? [path] : [];
  });
}

const files = [...collectJs('src'), ...collectJs('scripts'), ...collectJs('tests')];
for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}
console.log(`Syntax check passed for ${files.length} JavaScript files.`);
