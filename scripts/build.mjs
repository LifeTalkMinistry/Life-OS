import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const scriptOrder = [
  'src/data/activities.js',
  'src/state/lifeState.js',
  'src/gestures/orbGestures.js',
  'src/components/Brand.js',
  'src/components/TodayRing.js',
  'src/components/WhyPanel.js',
  'src/components/Orb.js',
  'src/app.js'
];

function stripModuleSyntax(source) {
  return source
    .replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?\s*/g, '')
    .replace(/\bexport\s+(?=(const|let|var|function|class)\b)/g, '');
}

const css = readFileSync('src/styles.css', 'utf8');
const js = scriptOrder
  .map((file) => `// ${file}\n${stripModuleSyntax(readFileSync(file, 'utf8'))}`)
  .join('\n\n');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#030307" />
    <meta name="color-scheme" content="dark" />
    <meta name="description" content="LIFE OS — Control your life." />
    <title>LIFE OS — Control your life.</title>
    <style>${css}</style>
  </head>
  <body>
    <main id="app" aria-live="polite"></main>
    <script>${js.replace(/<\/script>/gi, ':\\/script>')}</script>
  </body>
</html>`;

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
console.log('Built self-contained LIFE OS V1 into dist/index.html.');
