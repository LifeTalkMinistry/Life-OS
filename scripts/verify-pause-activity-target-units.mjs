import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
const testUser = {
  id: 'pause-target-unit-regression',
  name: 'PAUSE Target Unit Test',
  email: 'pause-target-unit@example.test',
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
const activityKey = `pause-activity-commitments-v1:account:${testUser.id}`;
const activityState = {
  version: 1,
  activities: [
    {
      id: 'practice-spanish-listening',
      name: 'Practice Spanish Listening',
      targetMode: 'daily',
      targetMinutes: 1,
      passingTargetMinutes: 30,
      spanMode: 'ongoing',
      endDate: null,
      createdAt: Date.now() - 86400000
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
})}.target-unit-test`;

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
      if (request.method === 'GET') return sendJson(response, 200, syncSnapshot || { exists: false, revision: 0 });
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
const chrome = spawn(chromeBinary, [
  '--headless',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-default-browser-check',
  '--remote-debugging-port=0',
  `--user-data-dir=/tmp/pause-target-unit-${process.pid}`,
  '--window-size=390,844',
  'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });

let chromeStderr = '';
chrome.stderr?.on('data', (chunk) => { chromeStderr += chunk.toString(); });

async function resolveDebugPort() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const match = chromeStderr.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
    if (match) return Number(match[1]);
    if (chrome.exitCode !== null) throw new Error(`Chrome exited before DevTools started.\n${chromeStderr}`);
    await sleep(100);
  }
  throw new Error(`Chrome DevTools did not start.\n${chromeStderr}`);
}

async function getJson(url, retries = 40) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await sleep(100);
  }
  throw new Error(`Unable to connect to ${url}.\n${chromeStderr}`);
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

async function openManage() {
  await evaluate(`window.__PAUSE_ACTIVITIES__.open('hub')`);
  await waitFor(`document.querySelector('[data-activity-report="practice-spanish-listening"]')`, 'Activity directory row');
  await evaluate(`document.querySelector('[data-activity-report="practice-spanish-listening"]').click()`);
  await waitFor(`document.querySelector('[data-activity-manage-trigger]')`, 'Activity manage trigger');
  await evaluate(`document.querySelector('[data-activity-manage-trigger]').click()`);
  await waitFor(`document.querySelector('[data-activity-manage-form]')`, 'Activity Setup form');
}

async function setupValues() {
  return evaluate(`(() => {
    const form = document.querySelector('[data-activity-manage-form]');
    return {
      targetValue: form.querySelector('[name="targetValue"]').value,
      targetUnit: form.querySelector('[name="targetUnit"]').value,
      passingValue: form.querySelector('[name="passingValue"]').value,
      passingUnit: form.querySelector('[name="passingUnit"]').value,
      error: form.querySelector('[data-activity-manage-error]').textContent.trim()
    };
  })()`);
}

async function storedActivity() {
  return evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(activityKey)})).activities.find((item) => item.id === 'practice-spanish-listening')`);
}

async function setField(name, value, eventName = 'input') {
  await evaluate(`(() => {
    const field = document.querySelector('[data-activity-manage-form] [name="${name}"]');
    field.value = ${JSON.stringify(String(value))};
    field.dispatchEvent(new Event('${eventName}', { bubbles: true }));
  })()`);
}

async function saveManage() {
  await evaluate(`document.querySelector('[data-activity-manage-form]').requestSubmit()`);
  await sleep(180);
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
    window.addEventListener('error', (event) => window.__pauseBrowserErrors.push(String(event.error?.stack || event.message || 'window error')));
    window.addEventListener('unhandledrejection', (event) => window.__pauseBrowserErrors.push(String(event.reason?.stack || event.reason || 'unhandled rejection')));
    localStorage.clear();
    localStorage.setItem('pause_backend_access_token_v1', ${JSON.stringify(token)});
    localStorage.setItem('pause_backend_user_v1', ${JSON.stringify(JSON.stringify(testUser))});
    localStorage.setItem('pause-recovery-plan-v1:account:${testUser.id}', ${JSON.stringify(JSON.stringify(recoveryPlan))});
    localStorage.setItem(${JSON.stringify(activityKey)}, ${JSON.stringify(JSON.stringify(activityState))});
  })();` });

  await send('Page.navigate', { url: `${origin}/` });
  await waitFor(`document.readyState === 'complete'`, 'document load');
  await waitFor(`document.querySelector('.pause-main-screen .orb')`, 'authenticated PAUSE screen', 12_000);
  await waitFor(`window.__PAUSE_ACTIVITIES__?.getActivities?.().length === 1`, 'seeded Activity state');

  await waitFor(`window.__PAUSE_ACTIVITIES__.getActivities()[0].targetMinutes === 60`, 'legacy 1/30 migration');
  let stored = await storedActivity();
  assert.equal(stored.targetMinutes, 60);
  assert.equal(stored.passingTargetMinutes, 30);
  assert.equal(stored.targetDisplayUnit, 'hours');
  assert.equal(stored.passingDisplayUnit, 'minutes');

  await openManage();
  assert.deepEqual(await setupValues(), {
    targetValue: '1',
    targetUnit: 'hours',
    passingValue: '30',
    passingUnit: 'minutes',
    error: ''
  });
  await saveManage();
  stored = await storedActivity();
  assert.equal(stored.targetMinutes, 60);
  assert.equal(stored.passingTargetMinutes, 30);
  assert.equal(stored.targetDisplayUnit, 'hours');
  assert.equal(stored.passingDisplayUnit, 'minutes');

  await openManage();
  await setField('targetUnit', 'minutes', 'change');
  await setField('targetValue', '90');
  await saveManage();
  stored = await storedActivity();
  assert.equal(stored.targetMinutes, 90);
  assert.equal(stored.targetDisplayUnit, 'minutes');

  await openManage();
  assert.equal((await setupValues()).targetValue, '90');
  assert.equal((await setupValues()).targetUnit, 'minutes');
  await setField('targetUnit', 'hours', 'change');
  assert.equal((await setupValues()).targetValue, '1.5');
  await saveManage();
  stored = await storedActivity();
  assert.equal(stored.targetMinutes, 90);
  assert.equal(stored.targetDisplayUnit, 'hours');

  await openManage();
  assert.equal((await setupValues()).targetValue, '1.5');
  assert.equal((await setupValues()).targetUnit, 'hours');
  await setField('targetUnit', 'minutes', 'change');
  await setField('targetValue', '30');
  await setField('passingUnit', 'hours', 'change');
  await setField('passingValue', '1');
  await saveManage();
  assert.equal((await setupValues()).error, 'Passing target cannot be higher than the 100% target.');
  stored = await storedActivity();
  assert.equal(stored.targetMinutes, 90, 'invalid mixed-unit save must not overwrite canonical target');
  assert.equal(stored.passingTargetMinutes, 30, 'invalid mixed-unit save must not overwrite canonical passing target');

  await waitFor(`window.__pauseBrowserErrors.length === 0`, 'no browser errors');
  assert.deepEqual(runtimeExceptions, []);

  await sleep(700);
  const cloudActivity = syncSnapshot?.state?.activityState?.activities?.find((item) => item.id === 'practice-spanish-listening');
  assert.equal(cloudActivity?.targetMinutes, 90);
  assert.equal(cloudActivity?.passingTargetMinutes, 30);
  assert.equal(cloudActivity?.targetDisplayUnit, 'hours');
  assert.equal(cloudActivity?.passingDisplayUnit, 'minutes');

  console.log('PAUSE Activity mixed-unit browser regression passed.');
} finally {
  try { ws?.close(); } catch {}
  chrome.kill('SIGTERM');
  await new Promise((resolve) => server.close(resolve));
}
