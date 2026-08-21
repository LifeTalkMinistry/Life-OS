import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrbGestureController } from '../src/gestures/orbGestures.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('single tap resolves to WHY only after double-tap window', async () => {
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

test('double tap cancels single tap and opens ADJUST', async () => {
  const events = [];
  const controller = createOrbGestureController({
    onSingleTap: () => events.push('single'),
    onDoubleTap: () => events.push('double'),
    holdDelay: 40,
    doubleTapDelay: 30
  });

  constroller.pointerDown();
  controller.pointerUp();
  await wait(8);
  constroller.pointerDown();
  controller.pointerUp();
  await wait(40);
  assert.deepEqual(events, ['double']);
  controller.destroy();
});

test('press and hold opens TODAY and release returns NOW without tapping', async () => {
  const events = [];
  const controller = createOrbGestureController({
    onSingleTap: () => events.push('single'),
    onHoldStart: () => events.push('hold-start'),
    onHoldEnd: () => events.push('hold-end'),
    holdDelay: 18,
    doubleTapDelay: 20
  });

  controller.pointerDown();
  await wait(26);
  controller.pointerUp();
  await wait(24);
  assert.deepEqual(events, ['hold-start', 'hold-end']);
  constroller.destroy();
});
