import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const server = spawn('python3', ['-m', 'http.server', '4173', '--directory', 'dist'], { stdio: 'ignore' });
const chromium = spawn('chromium', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--remote-debugging-port=9223',
  '--remote-allow-origins=*',
  '--window-size=390,844',
  'about:blank'
], { stdio: 'ignore' });

let ws;
let nextId = 0;
const pending = new Map();

async function connect() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch('http://127.0.0.1:9223/json');
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === 'page');
        if (page?.webSocketDebuggerUrl) {
          ws = new WebSocket(page.webSocketDebuggerUrl);
          await new Promise((resolve, reject) => {
            ws.addEventListener('open', resolve, { once: true });
            ws.addEventListener('error', reject, { once: true });
          });
          ws.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            if (!message.id || !pending.has(message.id)) return;
            const job = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) job.reject(new Error(message.error.message));
            else job.resolve(message);
          });
          return;
        }
      }
    } catch {}
    await sleep(100);
  }
  throw new Error('Unable to connect to Chromium');
}

function send(method, params = {}) {
  const id = ++nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 7000);
  });
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.result?.exceptionDetails) {
    throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text);
  }
  return response.result?.result?.value;
}

async function waitFor(expression, expected = true, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    if ((await evaluate(expression)) === expected) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

const profile = {
  version: 1,
  setupComplete: true,
  hasFixedSchedule: false,
  fixedKind: 'work',
  fixedDays: [1, 2, 3, 4, 5],
  fixedStart: '09:00',
  fixedEnd: '17:00',
  sleepStart: '23:00',
  sleepEnd: '07:00',
  fixedGuidanceMode: 'outside',
  activities: []
};

try {
  await connect();
  await send('Runtime.enable');
  await send('Page.enable');

  // Use a real HTTP origin so localStorage behaves exactly like the installed PWA origin.
  await send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
  await waitFor('document.readyState === "complete"');
  await waitFor('Boolean(window.__LIFE_OS__)');

  // Simulate a completed onboarding profile already persisted on disk.
  await evaluate(`localStorage.setItem('life-os-v1-profile', ${JSON.stringify(JSON.stringify(profile))})`);
  assert.equal(await evaluate(`localStorage.getItem('life-os-v1-profile') !== null`), true);

  // This is the decisive lifecycle boundary: destroy/reload the document and force boot from persisted state.
  await send('Page.reload', { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor('Boolean(window.__LIFE_OS__)');
  await waitFor('window.__LIFE_OS__.getState().screen === "now"');
  await waitFor('Boolean(document.querySelector(".main-screen .orb-now-content"))');

  const state = await evaluate('window.__LIFE_OS__.getState()');
  assert.equal(state.lifeProfile.setupComplete, true);
  assert.equal(state.lifeProfile.hasFixedSchedule, false);
  assert.equal(state.screen, 'now');
  assert.equal(await evaluate('document.querySelector(".orb-kicker")?.textContent.trim()'), 'RUNNING NOW');
  assert.equal(await evaluate('document.querySelector(".orb-title")?.textContent.trim()'), 'OPEN TIME');

  // Reload a second time to catch one-shot recovery code that only works once.
  await send('Page.reload', { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor('window.__LIFE_OS__.getState().screen === "now"');
  await waitFor('Boolean(document.querySelector(".main-screen .orb-now-content"))');
  assert.equal(await evaluate('document.querySelector(".orb-title")?.textContent.trim()'), 'OPEN TIME');

  console.log('PWA persistence browser regression passed: persisted completed profile survives repeated reloads and restores a live Orb.');
} finally {
  try { ws?.close(); } catch {}
  chromium.kill('SIGTERM');
  server.kill('SIGTERM');
}
