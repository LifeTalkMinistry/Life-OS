import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const scriptOrder = [
  'src/activity-icons.js',
  'src/data/activities.js',
  'src/state/lifeProfile.js',
  'src/state/lifeState.js',
  'src/gestures/orbGestures.js',
  'src/components/Brand.js',
  'src/components/OrbArtwork.js',
  'src/components/LifeSetupOrb.js',
  'src/components/TodayRing.js',
  'src/components/WhyPanel.js',
  'src/components/Orb.js',
  'src/components/SystemPanel.js',
  'src/app.js',
  'src/setup-day-orbit.js',
  'src/setup-day-summary.js',
  'src/setup-activity-end-fix.js',
  'src/setup-icon-modal.js',
  'src/setup-copy-day.js',
  'src/setup-completion-guard.js',
  'src/hold-release-fix.js'
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
  readFileSync('src/setup-day-orbit.css', 'utf8'),
  readFileSync('src/setup-day-orbit-simple.css', 'utf8'),
  readFileSync('src/setup-day-navigation.css', 'utf8'),
  readFileSync('src/setup-activity-end-back.css', 'utf8'),
  readFileSync('src/setup-icon-modal.css', 'utf8'),
  readFileSync('src/setup-copy-day.css', 'utf8'),
  readFileSync('src/system-controls.css', 'utf8')
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
    <meta name="application-name" content="LIFE OS" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="LIFE OS" />
    <meta name="format-detection" content="telephone=no" />
    <title>LIFE OS — Control your life.</title>
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="apple-touch-icon" sizes="180x180" href="./pwa/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="./pwa/icon-192.png" />
    <style>${css}</style>
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('./sw.js', {
            scope: './',
            updateViaCache: 'none'
          }).catch(() => {});
        });
      }
    </script>
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
if (existsSync('pwa')) {
  cpSync('pwa', 'dist/pwa', { recursive: true });
}
cpSync('manifest.webmanifest', 'dist/manifest.webmanifest');
cpSync('sw.js', 'dist/sw.js');

console.log('Built self-contained LIFE OS V1 into dist/index.html.');