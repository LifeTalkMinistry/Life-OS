import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const scriptOrder = [
  'src/gestures/orbGestures.js',
  'src/components/OrbArtwork.js',
  'src/restState.js',
  'src/components/Brand.js',
  'src/components/Orb.js',
  'src/components/PauseScore.js',
  'src/components/TodayRing.js',
  'src/components/PausePanel.js',
  'src/app.js'
];

function stripModuleSyntax(source) {
  return source
    .replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?\s*/g, '')
    .replace(/\bexport\s+(?=(const|let|var|function|class)\b)/g, '');
}

const cssFiles = [
  'src/styles.css',
  'src/refinements.css',
  'src/orb-depth.css',
  'src/system-controls.css',
  'src/layout-invariant.css',
  'src/pause.css'
];

const css = cssFiles.map((file) => readFileSync(file, 'utf8')).join('\n\n');
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
    <meta name="description" content="PAUSE — Know When to Stop." />
    <meta name="application-name" content="PAUSE" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="PAUSE" />
    <meta name="format-detection" content="telephone=no" />
    <title>PAUSE — Know When to Stop.</title>
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="apple-touch-icon" sizes="180x180" href="./pwa/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="./pwa/icon-192.png" />
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

if (existsSync('src/assets')) cpSync('src/assets', 'dist/assets', { recursive: true });
if (existsSync('pwa')) cpSync('pwa', 'dist/pwa', { recursive: true });
cpSync('manifest.webmanifest', 'dist/manifest.webmanifest');
cpSync('sw.js', 'dist/sw.js');

console.log('Built PAUSE into dist/index.html.');
