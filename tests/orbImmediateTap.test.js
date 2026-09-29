import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrbGestureController } from '../src/gestures/orbGestures.js';

test('zero double-tap delay completes a normal ORB tap synchronously', () => {
  const events = [];
  const controller = createOrbGestureController({
    onSingleTap: () => events.push('single'),
    onDoubleTap: () => events.push('double'),
    holdDelay: 520,
    doubleTapDelay: 0
  });

  controller.pointerDown();
  controller.pointerUp({ clientX: 195, clientY: 422 });

  assert.deepEqual(events, ['single']);
  controller.destroy();
});
