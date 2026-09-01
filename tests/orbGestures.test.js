import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrbGestureController } from '../src/gestures/orbGestures.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function installPointerEnvironment() {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const listeners = new Map();
  let pointTarget = null;
  let menuCloseClicks = 0;

  globalThis.window = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (listeners.get(type) === handler) listeners.delete(type);
    }
  };

  const menuOrb = {
    isConnected: true,
    click() {
      menuCloseClicks += 1;
    }
  };

  globalThis.document = {
    elementFromPoint() {
      return pointTarget;
    },
    querySelector(selector) {
      return selector === '.orb-mode-menu .orb' ? menuOrb : null;
    }
  };

  return {
    listeners,
    setPointTarget(target) {
      pointTarget = target;
    },
    getMenuCloseClicks() {
      return menuCloseClicks;
    },
    restore() {
      if (originalWindow === undefined) delete globalThis.window;
      else globalThis.window = originalWindow;
      if (originalDocument === undefined) delete globalThis.document;
      else globalThis.document = originalDocument;
    }
  };
}

function createMenuTarget(id = 'nudges') {
  const classes = new Set();
  let clicks = 0;
  const target = {
    disabled: false,
    isConnected: true,
    dataset: { pauseMenu: id },
    getAttribute() {
      return null;
    },
    closest() {
      return target;
    },
    classList: {
      add(value) {
        classes.add(value);
      },
      remove(value) {
        classes.delete(value);
      }
    },
    click() {
      clicks += 1;
    }
  };

  return {
    target,
    classes,
    clicks: () => clicks
  };
}

test('single tap fires only after the double-tap window', async () => {
  const events = [];
  const controller = createOrbGestureController({
    onSingleTap: () => events.push('single'),
    onDoubleTap: () => events.push('double'),
    holdDelay: 40,
    doubleTapDelay: 22
  });

  controller.pointerDown();
  controller.pointerUp();
  await wait(30);
  assert.deepEqual(events, ['single']);
  controller.destroy();
});

test('double tap cancels the pending single tap', async () => {
  const events = [];
  const controller = createOrbGestureController({
    onSingleTap: () => events.push('single'),
    onDoubleTap: () => events.push('double'),
    holdDelay: 40,
    doubleTapDelay: 30
  });

  controller.pointerDown();
  controller.pointerUp();
  await wait(8);
  controller.pointerDown();
  controller.pointerUp();
  await wait(40);
  assert.deepEqual(events, ['double']);
  controller.destroy();
});

test('hold then release without dragging closes the temporary radial menu', { concurrency: false }, async () => {
  const env = installPointerEnvironment();
  const events = [];
  const controller = createOrbGestureController({
    onHoldStart: () => events.push('hold-start'),
    onHoldEnd: ({ selected }) => events.push(selected ? 'selected' : 'cancelled'),
    holdDelay: 18,
    doubleTapDelay: 20
  });

  try {
    controller.pointerDown();
    await wait(26);
    controller.pointerUp();

    assert.deepEqual(events, ['hold-start', 'cancelled']);
    assert.equal(env.getMenuCloseClicks(), 1);
  } finally {
    controller.destroy();
    env.restore();
  }
});

test('hold, drag over an option, and release selects that option', { concurrency: false }, async () => {
  const env = installPointerEnvironment();
  const menu = createMenuTarget('recovery');
  const events = [];
  const controller = createOrbGestureController({
    onHoldStart: () => events.push('hold-start'),
    onHoldEnd: ({ selected }) => events.push(selected ? 'selected' : 'cancelled'),
    holdDelay: 18
  });

  try {
    controller.pointerDown();
    await wait(26);

    env.setPointTarget(menu.target);
    env.listeners.get('pointermove')?.({ clientX: 140, clientY: 220 });
    assert.equal(menu.classes.has('is-drag-target'), true);

    env.listeners.get('pointerup')?.({ clientX: 140, clientY: 220 });

    assert.equal(menu.clicks(), 1);
    assert.equal(env.getMenuCloseClicks(), 0);
    assert.equal(menu.classes.has('is-drag-target'), false);
    assert.deepEqual(events, ['hold-start', 'selected']);
  } finally {
    controller.destroy();
    env.restore();
  }
});

test('dragging over an option then back to empty center before release cancels', { concurrency: false }, async () => {
  const env = installPointerEnvironment();
  const menu = createMenuTarget('settings');
  const events = [];
  const controller = createOrbGestureController({
    onHoldStart: () => events.push('hold-start'),
    onHoldEnd: ({ selected }) => events.push(selected ? 'selected' : 'cancelled'),
    holdDelay: 18
  });

  try {
    controller.pointerDown();
    await wait(26);

    env.setPointTarget(menu.target);
    env.listeners.get('pointermove')?.({ clientX: 120, clientY: 180 });
    assert.equal(menu.classes.has('is-drag-target'), true);

    env.setPointTarget(null);
    env.listeners.get('pointermove')?.({ clientX: 190, clientY: 320 });
    assert.equal(menu.classes.has('is-drag-target'), false);

    env.listeners.get('pointerup')?.({ clientX: 190, clientY: 320 });

    assert.equal(menu.clicks(), 0);
    assert.equal(env.getMenuCloseClicks(), 1);
    assert.deepEqual(events, ['hold-start', 'cancelled']);
  } finally {
    controller.destroy();
    env.restore();
  }
});
