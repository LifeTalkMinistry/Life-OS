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

  // First-time setup begins inside the orb.
  await assertText('.setup-hero', 'READY TOTAKE CONTROL?');
  await evaluate('document.querySelector(".setup-orb").click()');
  await assertText('.setup-question', 'Do you have a fixed work or school schedule?');
  await evaluate('document.querySelector("button[data-setup-fixed=no]").click()');
  await assertText('.setup-question', 'When do you usually sleep?');
  await evaluate(`(() => {
    const sleep = document.querySelector('[data-setup-field="sleepStart"]');
    const wake = document.querySelector('[data-setup-field="sleepEnd"]');
    sleep.value = '23:00'; sleep.dispatchEvent(new Event('input', {bubbles:true}));
    wake.value = '07:00'; wake.dispatchEvent(new Event('input', {bubbles:true}));
  })()`);
  await evaluate('document.querySelector("button[data-setup-action=sleep-continue]").click()');
  await evaluate('document.querySelector("button[data-setup-priority=health]").click()');
  await evaluate('document.querySelector("button[data-setup-priority=business]").click()');
  await evaluate('document.querySelector("button[data-setup-action=priorities-continue]").click()');
  await evaluate('document.querySelector("button[data-setup-nonneg=health]").click()');
  await evaluate('document.querySelector("button[data-setup-action=nonneg-continue]").click()');
  await assertText('.setup-question', 'What are you trying to move forward right now?');
  await evaluate(`(() => {
    const input = document.querySelector('[data-setup-field="currentFocus"]');
    input.value = 'Launch newsletter';
    input.dispatchEvent(new Event('input', {bubbles:true}));
  })()`);
  await evaluate('document.querySelector("button[data-setup-action=focus-continue]").click()');
  await assertText('.setup-question', 'How much focused time should LIFE OS protect?');
  await evaluate("document.querySelector('button[data-setup-minutes=\"60\"]')?.click()");
  await assertText('.setup-eyebrow', 'LIFE OS IS READY');
  await sleep(1080);
  await assertText('.orb-kicker', 'WHAT MATTERS NOW');
  assert.equal(await evaluate('window.__LIFE_OS__.getState().lifeProfile.currentFocus'), 'Launch newsletter');

  // Reset to the deterministic demo state for the core gesture regression suite.
  await reset();
  await assertText('.orb-title', 'CLARAOUTREACH');

  // Single tap -> WHY
  await evaluate(dispatchTap);
  await sleep(340);
  assert.equal(await evaluate('Boolean(document.querySelector(".why-panel"))'), true);
  await assertText('.why-panel .eyebrow', 'WHY THIS NOW?');
  await evaluate('document.querySelector(".why-close").click()');

  // Hold -> TODAY -> release returns NOW
  await evaluate(`document.querySelector('.orb').dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerId:2, button:0}))`);
  await sleep(590);
  assert.equal(await evaluate('Boolean(document.querySelector(".today-ring"))'), true);
  await evaluate(`document.querySelector('.orb').dispatchEvent(new PointerEvent('pointerup', {bubbles:true, pointerId:2, button:0}))`);
  await sleep(80);
  assert.equal(await evaluate('Boolean(document.querySelector(".today-ring"))'), false);

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

  console.log('Browser smoke test passed: launch, single tap, hold/release, double tap, and all adjustment branches.');
} finally {
  try { ws?.close(); } catch {}
  chromium.kill('SIGTERM');
}
