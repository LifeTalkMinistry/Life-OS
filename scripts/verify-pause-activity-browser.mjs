import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
const testUser = {
  id: 'pause-browser-regression',
  name: 'PAUSE Browser Test',
  email: 'pause-browser@example.test',
  role: 'user',
  status: 'active',
  plan: 'free',
  app: 'pause'
};
const recoveryPlan = {
  version: 2,
  setupComplete: true,
  nudgeConsentComplete: true,
  workDays: [1, 2, 3, 4, 5],
  shiftStart: '22:00',
  shiftEnd: '08:00',
  commuteMinutes: 60,
  windDownMinutes: 45,
  recoveryMinutes: 480,
  nudges: {
    shiftEnd: false,
    commuteEnd: false,
    windDownReminder: false,
    recoveryStart: false,
    wakeTarget: false
  }
};
const activityState = {
  version: 1,
  activities: [
    {
      id: 'spanish',
      name: 'Spanish Language Practice',
      targetMode: 'track',
      targetMinutes: null,
      spanMode: 'ongoing',
      endDate: null,
      createdAt: Date.now()
    }
  ],
  sessions: [],
  active: null
};

function base64Url(value) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const token = `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url({
  app: 'pause',
  aud: 'pause-client',
  exp: Math.floor(Date.now() / 1000) + 3600
})}.browser-test`;

let syncSnapshot = null;

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

function contentType(pathname) {
  const extension = extname(pathname).toLowerCase();
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.js') return 'text/javascript; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.json' || extension === '.webmanifest') return 'application/json; charset=utf-8';
  if (extension === '.png') return 'image/png';
  if (extension === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://127.0.0.1');

    if (url.pathname === '/api/pause/me') return sendJson(response, 200, testUser);

    if (url.pathname === '/api/pause/sync') {
      if (request.method === 'GET') {
        return sendJson(response, 200, syncSnapshot || { exists: false, revision: 0 });
      }
      if (request.method === 'PUT') {
        const body = await readJsonBody(request);
        syncSnapshot = {
          exists: true,
          state: body?.state || { active: null, history: [] },
          scorePreference: body?.scorePreference || { version: 2, timeframe: 'daily', customRange: null },
          revision: (syncSnapshot?.revision || 0) + 1
        };
        return sendJson(response, 200, syncSnapshot);
      }
    }

    if (url.pathname === '/api/pause/recovery-plan') {
      if (request.method === 'GET') return sendJson(response, 200, { exists: true, plan: recoveryPlan });
      if (request.method === 'PUT') {
        const body = await readJsonBody(request);
        return sendJson(response, 200, { exists: true, plan: body?.plan || recoveryPlan });
      }
    }

    const relativePath = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const safePath = normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = join(distDir, safePath);
    const fileStat = await stat(filePath).catch(() => null);
    if (!fileStat?.isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    const file = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': contentType(filePath), 'Cache-Control': 'no-store' });
    response.end(file);
  } catch (error) {
    response.writeHead(500);
    response.end(String(error?.stack || error));
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const origin = `http://127.0.0.1:${server.address().port}`;

function resolveChromeBinary() {
  const candidates = [
    process.env.CHROME_PATH,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser'
  ].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error(`No Chrome/Chromium binary found. Checked: ${candidates.join(', ')}`);
}

const chromeBinary = resolveChromeBinary();
const chromeVersion = spawnSync(chromeBinary, ['--version'], { encoding: 'utf8' }).stdout.trim();
const chrome = spawn(chromeBinary, [
  '--headless',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-default-browser-check',
  '--remote-debugging-port=0',
  `--user-data-dir=/tmp/pause-browser-${process.pid}`,
  '--window-size=390,844',
  'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });

let chromeStderr = '';
chrome.stderr?.on('data', (chunk) => { chromeStderr += chunk.toString(); });

async function resolveDebugPort() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const match = chromeStderr.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
    if (match) return Number(match[1]);
    if (chrome.exitCode !== null) {
      throw new Error(`Chrome exited before DevTools started (${chromeVersion}, exit ${chrome.exitCode}).\n${chromeStderr}`);
    }
    await sleep(100);
  }
  throw new Error(`Chrome DevTools did not start (${chromeVersion}).\n${chromeStderr}`);
}

async function getJson(url, retries = 40) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await sleep(100);
  }
  throw new Error(`Unable to connect to ${url} (${chromeVersion}).\n${chromeStderr}`);
}

let ws = null;
let nextMessageId = 0;
const pending = new Map();
const runtimeExceptions = [];

function send(method, params = {}) {
  const id = ++nextMessageId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 6000);
  });
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.result?.exceptionDetails) {
    throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text);
  }
  return response.result?.result?.value;
}

async function waitFor(expression, label, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await sleep(80);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function tapOrb(pointerId) {
  await evaluate(`(() => {
    const orb = document.querySelector('.pause-main-screen .orb');
    if (!orb) throw new Error('ORB not found');
    orb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: ${pointerId}, button: 0, clientX: 195, clientY: 422 }));
    orb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: ${pointerId}, button: 0, clientX: 195, clientY: 422 }));
  })()`);
  await sleep(360);
}

async function holdOrb(pointerId) {
  await evaluate(`(() => {
    const orb = document.querySelector('.pause-main-screen .orb');
    if (!orb) throw new Error('ORB not found');
    orb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: ${pointerId}, button: 0, clientX: 195, clientY: 422 }));
  })()`);
  await sleep(580);
  await waitFor(`document.querySelector('.pause-orb-menu')`, 'PAUSE radial menu after hold');
  await evaluate(`(() => {
    const orb = document.querySelector('.pause-main-screen .orb');
    orb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: ${pointerId}, button: 0, clientX: 195, clientY: 422 }));
  })()`);
  await sleep(100);
}

async function closeMenuIfOpen() {
  if (await evaluate(`Boolean(document.querySelector('.orb-mode-menu .orb'))`)) {
    await evaluate(`document.querySelector('.orb-mode-menu .orb').click()`);
    await waitFor(`!document.querySelector('.pause-orb-menu')`, 'radial menu to close');
  }
}

async function openNativeMenuItem(id, pointerId) {
  await holdOrb(pointerId);
  assert.equal(await evaluate(`document.querySelectorAll('[data-pause-activity-menu]').length`), 1);
  assert.equal(await evaluate(`document.querySelectorAll('[data-pause-activities-menu]').length`), 0);
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-pause-menu="${id}"]'))`), true, `${id} should exist in the radial menu`);
  await evaluate(`document.querySelector('[data-pause-menu="${id}"]').click()`);
}

try {
  const debugPort = await resolveDebugPort();
  const targets = await getJson(`http://127.0.0.1:${debugPort}/json/list`);
  const page = targets.find((target) => target.type === 'page');
  if (!page?.webSocketDebuggerUrl) throw new Error('Chrome page target unavailable');

  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') {
      runtimeExceptions.push(message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text || 'Runtime exception');
    }
    if (!message.id || !pending.has(message.id)) return;
    const job = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) job.reject(new Error(message.error.message));
    else job.resolve(message);
  });

  await send('Runtime.enable');
  await send('Page.enable');

  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    window.PAUSE_API_URL = location.origin;
    window.__pauseBrowserErrors = [];
    window.__pauseConsoleErrors = [];
    window.addEventListener('error', (event) => window.__pauseBrowserErrors.push(String(event.error?.stack || event.message || 'window error')));
    window.addEventListener('unhandledrejection', (event) => window.__pauseBrowserErrors.push(String(event.reason?.stack || event.reason || 'unhandled rejection')));
    const originalConsoleError = console.error.bind(console);
    console.error = (...args) => {
      window.__pauseConsoleErrors.push(args.map((value) => String(value)).join(' '));
      originalConsoleError(...args);
    };
    localStorage.clear();
    localStorage.setItem('pause_backend_access_token_v1', ${JSON.stringify(token)});
    localStorage.setItem('pause_backend_user_v1', ${JSON.stringify(JSON.stringify(testUser))});
    localStorage.setItem('pause-recovery-plan-v1:account:${testUser.id}', ${JSON.stringify(JSON.stringify(recoveryPlan))});
    localStorage.setItem('pause-activity-commitments-v1:account:${testUser.id}', ${JSON.stringify(JSON.stringify(activityState))});
  })();` });

  await send('Page.navigate', { url: `${origin}/` });
  await waitFor(`document.readyState === 'complete'`, 'document load');
  await waitFor(`document.querySelector('.pause-main-screen .orb')`, 'authenticated PAUSE main screen', 12_000);
  await waitFor(`window.__PAUSE_RECOVERY_PLAN__?.getPlan?.()?.setupComplete === true`, 'completed Sleep Routine test state');
  await waitFor(`window.__PAUSE_ACTIVITIES__?.getActivities?.().length === 1`, 'seeded Activity state');

  // Test A — hold still opens the existing more menu and remains stable.
  await holdOrb(11);
  assert.equal(await evaluate(`Boolean(document.querySelector('.pause-orb-menu'))`), true);
  assert.equal(await evaluate(`document.querySelectorAll('[data-pause-activity-menu]').length`), 1);
  assert.equal(await evaluate(`document.querySelectorAll('[data-pause-activities-menu]').length`), 0);
  assert.deepEqual(
    await evaluate(`Array.from(document.querySelectorAll('[data-pause-menu]')).map((button) => button.dataset.pauseMenu).sort()`),
    ['insights', 'recovery', 'settings', 'timer']
  );

  await evaluate(`(() => {
    const nav = document.querySelector('.pause-orb-menu');
    window.__pauseMenuMutationCount = 0;
    window.__pauseMenuMutationObserver = new MutationObserver((records) => {
      window.__pauseMenuMutationCount += records.reduce((total, record) => total + record.addedNodes.length + record.removedNodes.length, 0);
    });
    window.__pauseMenuMutationObserver.observe(nav, { childList: true, subtree: true });
  })()`);
  await sleep(650);
  assert.equal(await evaluate(`document.querySelectorAll('[data-pause-activity-menu]').length`), 1);
  assert.equal(await evaluate(`window.__pauseMenuMutationCount`), 0, 'radial menu should not keep mutating after Activity injection settles');
  assert.equal(await evaluate(`new Promise((resolve) => {
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      if (ticks === 4) { clearInterval(timer); resolve(ticks); }
    }, 40);
  })`), 4, 'browser main thread should remain responsive after hold');
  await evaluate(`window.__pauseMenuMutationObserver.disconnect()`);

  // Test B — Activity is management-only: no START button remains in the panel.
  await evaluate(`document.querySelector('[data-pause-activity-menu]').click()`);
  await waitFor(`document.querySelector('.activity-panel')`, 'Activity panel');
  assert.equal(await evaluate(`document.querySelectorAll('.activity-backdrop').length`), 1);
  assert.equal(await evaluate(`document.querySelectorAll('.activity-start, [data-start]').length`), 0);
  assert.equal(await evaluate(`document.querySelector('.activity-panel').textContent.includes('Spanish Language Practice')`), true);
  await evaluate(`document.querySelector('.activity-close').click()`);
  await waitFor(`!document.querySelector('.activity-backdrop')`, 'Activity panel to close');
  await closeMenuIfOpen();

  // Test C — native hold-menu destinations are unchanged.
  await openNativeMenuItem('timer', 21);
  await waitFor(`document.querySelector('.pause-timer-panel')`, 'Timer panel');
  await evaluate(`document.querySelector('[data-timer-close]').click()`);
  await waitFor(`!document.querySelector('.pause-timer-panel')`, 'Timer panel to close');

  await openNativeMenuItem('recovery', 22);
  await waitFor(`document.querySelector('.recovery-plan-overlay .recovery-plan-card')`, 'Sleep Routine panel');
  await evaluate(`document.querySelector('.recovery-plan-overlay [data-plan-action="back"]').click()`);
  await waitFor(`!document.querySelector('.recovery-plan-overlay')`, 'Sleep Routine panel to close');

  await openNativeMenuItem('insights', 23);
  await waitFor(`document.querySelector('.pause-view-insights')`, 'Rest Insights panel');
  await evaluate(`document.querySelector('[data-pause-panel-action="close"]').click()`);
  await waitFor(`!document.querySelector('.pause-view-insights')`, 'Rest Insights panel to close');

  await openNativeMenuItem('settings', 24);
  await waitFor(`document.querySelector('.pause-settings-panel')`, 'Settings panel');
  await evaluate(`document.querySelector('[data-settings-close]').click()`);
  await waitFor(`!document.querySelector('.pause-settings-panel')`, 'Settings panel to close');

  // Test D — normal tap opens Rest + declared activities around the ORB.
  await tapOrb(31);
  await waitFor(`document.querySelector('.pause-start-chooser')`, 'Rest and Activity chooser');
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-pause-start-choice="rest"]'))`), true);
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-pause-start-choice="spanish"]'))`), true);
  assert.equal(await evaluate(`Boolean(window.__PAUSE__.getState().pauseState.active)`), false, 'tap alone must not start Rest');
  assert.equal(await evaluate(`Boolean(window.__PAUSE__.getState().activity)`), false, 'tap alone must not start Activity');

  // Choosing an activity starts its count on the ORB.
  await evaluate(`document.querySelector('[data-pause-start-choice="spanish"]').click()`);
  await waitFor(`document.querySelector('.orb-mode-activity [data-pause-activity-timer]')`, 'active Activity timer on ORB');
  assert.equal(await evaluate(`window.__PAUSE__.getState().activity?.activityId`), 'spanish');
  assert.equal(await evaluate(`Boolean(window.__PAUSE__.getState().pauseState.active)`), false);
  const activityTimerBefore = await evaluate(`document.querySelector('[data-pause-activity-timer]').textContent`);
  await waitFor(
    `document.querySelector('[data-pause-activity-timer]').textContent !== ${JSON.stringify(activityTimerBefore)}`,
    'Activity timer to advance on the ORB',
    3000
  );
  const activityTimerAfter = await evaluate(`document.querySelector('[data-pause-activity-timer]').textContent`);
  assert.notEqual(activityTimerAfter, activityTimerBefore, 'Activity timer should advance on the ORB');

  // Hold-for-more still works while an Activity is running.
  await holdOrb(32);
  assert.equal(await evaluate(`Boolean(document.querySelector('.pause-orb-menu'))`), true);
  assert.equal(await evaluate(`document.querySelector('[data-pause-menu="timer"]').disabled`), true, 'Rest timer must stay unavailable during an active Activity');
  await closeMenuIfOpen();
  await waitFor(`document.querySelector('.orb-mode-activity [data-pause-action="end-activity"]')`, 'Activity ORB after closing more menu');
  await evaluate(`document.querySelector('[data-pause-action="end-activity"]').click()`);
  await waitFor(`!window.__PAUSE__.getState().activity`, 'Activity to end');

  // Choosing Rest from the same tap chooser still starts the existing Rest flow.
  await tapOrb(33);
  await waitFor(`document.querySelector('.pause-start-chooser')`, 'Rest chooser after Activity');
  await evaluate(`document.querySelector('[data-pause-start-choice="rest"]').click()`);
  await waitFor(`document.querySelector('.orb-mode-resting [data-pause-action="end-rest"]')`, 'Resting state after choosing Rest');
  assert.equal(await evaluate(`Boolean(window.__PAUSE__.getState().pauseState.active)`), true);
  assert.equal(await evaluate(`Boolean(window.__PAUSE__.getState().activity)`), false);

  assert.equal(await evaluate(`window.__pauseBrowserErrors.length`), 0, `window errors: ${await evaluate(`JSON.stringify(window.__pauseBrowserErrors)`)}`);
  assert.equal(await evaluate(`window.__pauseConsoleErrors.length`), 0, `console errors: ${await evaluate(`JSON.stringify(window.__pauseConsoleErrors)`)}`);
  assert.deepEqual(runtimeExceptions, []);

  console.log(`PAUSE browser regression passed in ${chromeVersion}: tap opens Rest + Activity choices, Activity timing runs on the ORB, Rest still starts from the chooser, and hold-for-more remains intact.`);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill('SIGTERM');
  await new Promise((resolve) => server.close(resolve));
}