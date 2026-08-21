import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const scriptOrder = [
  'src/data/activities.js',
  'src/state/lifeProfile.js',
  'src/state/lifeState.js',
  'src/gestures/orbGestures.js',
  'src/components/Brand.js',
  'src/components/LifeSetupOrb.js',
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

const css = [
  readFileSync('src/styles.css', 'utf8'),
  readFileSync('src/refinements.css', 'utf8'),
  readFileSync('src/orb-depth.css', 'utf8'),
  readFileSync('src/orb-vector.css', 'utf8')
].join('\n\n');
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
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='25' fill='%23070416' stroke='%239d67ff' stroke-width='4'/%3E%3Ccircle cx='23' cy='25' r='7' fill='%23596dff' opacity='.85'/%3E%3C/svg%3E" />
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

if (existsSync('src/assets')) {
  cpSync('src/assets', 'dist/assets', { recursive: true });
}

console.log('Built self-contained LIFE OS V1 into dist/index.html.');
