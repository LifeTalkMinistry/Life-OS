import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const builtHtml = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const chromium = spawn('chromium', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--remote-debugging-port=9222',
  '--remote-allow-origins=*',
  '--window-size=390,844',
  'about:blank'
], { stdio: 'ignore' });

async function getJson(url, retries = 40) {
  for (let i = 0; i < retries; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await sleep(100);
  }
  throw new Error(`Unable to connect to ${url}`);
}

let ws;
let id = 0;
const pending = new Map();

function send(method, params = {}) {
  const messageId = ++id;
  ws.send(JSON.stringify({ id: messageId, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(messageId, { resolve, reject });
    setTimeout(() => {
      if (pending.has(messageId)) {
        pending.delete(messageId);
        reject(new Error(`CDP timeout: ${method}`));
      }
    }, 5000);
  });
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text);
  return response.result?.result?.value;
}

const dispatchTap = `
(() => {
  const orb = document.querySelector('.orb');
  orb.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerId:1, button:0}));
  orb.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, pointerId:1, button:0}));
})()`;

const dispatchDoubleTap = `
(async () => {
  const orb = document.querySelector('.orb');
  const fire = () => {
    orb.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerId:1, button:0}));
    orb.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, pointerId:1, button:0}));
  };
  fire();
  await new Promise(r => setTimeout(r, 90));
  fire();
})()`;

async function reset() {
  await evaluate('window.__LIFE_OS__.reset()');
  await sleep(40);
}

async function assertText(selector, expected) {
  const text = await evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent.trim()`);
  assert.equal(text, expected);
}

try {
  let page;
  for (let attempt = 0; attempt < 50 && !page; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:9222/json');
      if (response.ok) {
        const targets = await response.json();
        page = targets.find((target) => target.type === 'page');
      }
    } catch {}
    if (!page) await sleep(100);
  }
  if (!page?.webSocketDebuggerUrl) throw new Error('Chromium page target unavailable');

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

  await send('Runtime.enable');
  await send('Page.enable');
  await evaluate(`document.open(); document.write(${JSON.stringify(builtHtml)}); document.close();`);
  await sleep(2200);

  // First-time setup now ends at the V1 Life Map, not priorities or current focus.
  await assertText('.setup-hero', 'READY TOTAKE CONTROL?');
  await evaluate('document.querySelector(".setup-orb").click()');
  await assertText('.setup-question', 'Do you have a fixed work or school schedule?');
  await evaluate('document.querySelector("button[data-setup-fixed=no]").click()');
  await assertText('.setup-question', 'When do you usually sleep?');
  await evaluate(`(() => {
    const pad = (value) => String(value).padStart(2, '0');
    const now = new Date();
    const sleepHour = (now.getHours() + 2) % 24;
    const wakeHour = (sleepHour + 1) % 24;
    const sleepInput = document.querySelector('[data-setup-field="sleepStart"]');
    const wakeInput = document.querySelector('[data-setup-field="sleepEnd"]');
    sleepInput.value = pad(sleepHour) + ':00';
    wakeInput.value = pad(wakeHour) + ':00';
    sleepInput.dispatchEvent(new Event('input', {bubbles:true}));
    wakeInput.dispatchEvent(new Event('input', {bubbles:true}));
  })()`);
  await evaluate('document.querySelector("button[data-setup-action=sleep-continue]").click()');
  await assertText('.setup-question', 'Let’s map the time you control.');
  await evaluate(`(() => {
    const pad = (value) => String(value).padStart(2, '0');
    const now = new Date();
    const startHour = now.getHours();
    const endHour = (startHour + 1) % 24;
    const name = document.querySelector('[data-setup-draft-field="name"]');
    const start = document.querySelector('[data-setup-draft-field="start"]');
    const end = document.querySelector('[data-setup-draft-field="end"]');
    name.value = 'Launch newsletter';
    start.value = pad(startHour) + ':00';
    end.value = pad(endHour) + ':00';
    name.dispatchEvent(new Event('input', {bubbles:true}));
    start.dispatchEvent(new Event('input', {bubbles:true}));
    end.dispatchEvent(new Event('input', {bubbles:true}));
  })()`);
  await evaluate('document.querySelector("button[data-setup-action=activity-add]").click()');
  await evaluate('document.querySelector("button[data-setup-action=activities-continue]").click()');
  await assertText('.setup-question', 'Does this look right?');
  await evaluate('document.querySelector("button[data-setup-action=review-confirm]").click()');
  await assertText('.setup-eyebrow', 'LIFE OS IS READY');
  await sleep(980);
  await assertText('.orb-kicker', 'RUNNING NOW');
  assert.equal(await evaluate('window.__LIFE_OS__.getState().lifeProfile.activities[0].name'), 'Launch newsletter');

  // Reset to the deterministic demo state for the core gesture regression suite.
  await reset();
  await assertText('.orb-title', 'CLARAOUTREACH');

  // Single tap -> WHY
  await evaluate(dispatchTap);
  await sleep(340);
  assert.equal(await evaluate('Boolean(document.querySelector(".why-panel"))'), true);
  await assertText('.why-panel .eyebrow', 'WHY THIS NOW?');
  await evaluate('document.querySelector(".why-close").click()');

  // Hold -> TODAY stays open after release so the system controls can be tapped.
  await evaluate(`document.querySelector('.orb').dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerId:2, button:0}))`);
  await sleep(590);
  assert.equal(await evaluate('Boolean(document.querySelector(".today-ring"))'), true);
  assert.equal(await evaluate('Boolean(document.querySelector("[data-system-control=settings]"))'), true);
  assert.equal(await evaluate('Boolean(document.querySelector("[data-system-control=info]"))'), true);
  await evaluate(`document.querySelector('.orb').dispatchEvent(new PointerEvent('pointerup', {bubbles:true, pointerId:2, button:0}))`);
  await sleep(80);
  assert.equal(await evaluate('Boolean(document.querySelector(".today-ring"))'), true);

  // Settings -> Activity Times
  await evaluate('document.querySelector("[data-system-control=settings]").click()');
  await assertText('.system-panel h2', 'Settings');
  await evaluate('document.querySelector("[data-system-nav=activity-times]").click()');
  await assertText('.system-panel h2', 'Activity Times');
  assert.equal(await evaluate('Boolean(document.querySelector("[data-time-scope=sleep]"))'), true);
  await evaluate('document.querySelector("[data-system-action=close]").click()');
  assert.equal(await evaluate('Boolean(document.querySelector(".system-panel"))'), false);

  // Hold again -> Info panel
  await evaluate(`document.querySelector('.orb').dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerId:3, button:0}))`);
  await sleep(590);
  await evaluate(`document.querySelector('.orb').dispatchEvent(new PointerEvent('pointerup', {bubbles:true, pointerId:3, button:0}))`);
  await evaluate('document.querySelector("[data-system-control=info]").click()');
  await assertText('.system-panel h2', 'About LIFE OS');
  assert.equal(await evaluate('document.querySelector(".system-info-sections")?.textContent.includes("Creator Statement")'), true);
  assert.equal(await evaluate('document.querySelector(".system-info-sections")?.textContent.includes("App Policy")'), true);
  await evaluate('document.querySelector("[data-system-action=close]").click()');

  // Double tap -> Adjust -> I'm done -> Workout
  await evaluate(dispatchDoubleTap);
  await sleep(70);
  await assertText('.orb-prompt-title', 'WHAT CHANGED?');
  await evaluate('document.querySelector("button[data-action=done]").click()');
  await assertText('.orb-prompt-title', 'COMPLETED');
  await sleep(980);
  await assertText('.orb-title', 'WORKOUT');

  // Need more time
  await reset();
  await evaluate(dispatchDoubleTap);
  await sleep(70);
  await evaluate('document.querySelector("button[data-action=more]").click()');
  await assertText('.orb-prompt-title', 'HOW MUCH MORE TIME?');
  await evaluate("document.querySelector('button[data-minutes=\"30\"]').click()");
  await assertText('.orb-time', '5:30 PM');

  // Can't do this now -> skip -> replacement focus
  await reset();
  await evaluate(dispatchDoubleTap);
  await sleep(70);
  await evaluate('document.querySelector("button[data-action=cant]").click()');
  await assertText('.orb-prompt-title', 'WHAT SHOULD LIFE OS DO?');
  await evaluate('document.querySelector("button[data-defer=skip]").click()');
  await assertText('.orb-title', 'WORKOUT');

  // Urgent matter
  await reset();
  await evaluate(dispatchDoubleTap);
  await sleep(70);
  await evaluate('document.querySelector("button[data-action=urgent]").click()');
  await assertText('.orb-prompt-title', 'HOW MUCH TIME DO YOU NEED?');
  await evaluate("document.querySelector('button[data-urgent=\"30\"]').click()");
  await assertText('.orb-title', 'URGENTMATTER');
  await sleep(350);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile('/mnt/data/life-os-browser-smoke.png', Buffer.from(shot.result.data, 'base64'));

  console.log('Browser smoke test passed: V1 onboarding, persistent Today ring, Settings, Info, and adjustment branches.');
} finally {
  try { ws?.close(); } catch {}
  chromium.kill('SIGTERM');
}
