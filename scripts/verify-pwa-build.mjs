import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
const fromDist = (...parts) => join(distDir, ...parts);

for (const path of [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'pwa/icon-192.png',
  'pwa/icon-512.png',
  'pwa/icon-maskable-512.png',
  'pwa/apple-touch-icon.png'
]) {
  await access(fromDist(path));
}

const html = await readFile(fromDist('index.html'), 'utf8');
const manifest = JSON.parse(await readFile(fromDist('manifest.webmanifest'), 'utf8'));
const serviceWorker = await readFile(fromDist('sw.js'), 'utf8');

assert.equal(manifest.short_name, 'PAUSE');
assert.equal(manifest.id, './');
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.background_color, '#030307');
assert.equal(manifest.theme_color, '#030307');
assert.equal(manifest.orientation, 'portrait-primary');

const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
assert.ok(icons.some((icon) => icon.src === './pwa/icon-192.png' && icon.sizes === '192x192'));
assert.ok(icons.some((icon) => icon.src === './pwa/icon-512.png' && icon.sizes === '512x512'));
assert.ok(icons.some((icon) => icon.src === './pwa/icon-maskable-512.png' && icon.sizes === '512x512' && String(icon.purpose).includes('maskable')));

function pngDimensions(buffer) {
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

assert.deepEqual(pngDimensions(await readFile(fromDist('pwa/icon-192.png'))), { width: 192, height: 192 });
assert.deepEqual(pngDimensions(await readFile(fromDist('pwa/icon-512.png'))), { width: 512, height: 512 });
assert.deepEqual(pngDimensions(await readFile(fromDist('pwa/icon-maskable-512.png'))), { width: 512, height: 512 });
assert.deepEqual(pngDimensions(await readFile(fromDist('pwa/apple-touch-icon.png'))), { width: 180, height: 180 });

assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest" \/>/);
assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="\.\/pwa\/apple-touch-icon\.png" \/>/);
assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes" \/>/);
assert.match(html, /<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" \/>/);
assert.match(html, /navigator\.serviceWorker[\s\S]*?\.register\('\.\/sw\.js', \{ scope: '\.\/', updateViaCache: 'none' \}\)/);

assert.match(serviceWorker, /const SHELL_URL = toUrl\('\.\/'\);/);
assert.match(serviceWorker, /const INDEX_URL = toUrl\('\.\/index\.html'\);/);
assert.match(serviceWorker, /cache\.addAll\(APP_SHELL\)/);
assert.match(serviceWorker, /key\.startsWith\(CACHE_PREFIX\) && key !== CACHE_NAME/);
assert.match(serviceWorker, /request\.mode === 'navigate'/);
assert.match(serviceWorker, /networkFirst\(request, SHELL_URL\)/);
assert.match(serviceWorker, /request\.destination === 'image' \|\| request\.destination === 'font' \|\| request\.destination === 'manifest'/);

console.log('PAUSE PWA build verified for Android/iOS install metadata, icons, service worker registration, and offline shell.');