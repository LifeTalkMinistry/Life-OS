import test from 'node:test';
import assert from 'node:assert/strict';
import { getPauseMenuItems } from '../src/components/PauseOrbMenu.js';

test('PAUSE orb menu exposes the intended control-center actions in order', () => {
  const items = getPauseMenuItems({ active: false });
  assert.deepEqual(items.map((item) => item.id), [
    'timer',
    'recovery',
    'insights',
    'settings'
  ]);
  assert.equal(items.find((item) => item.id === 'recovery')?.label, 'Sleep Routine');
  assert.equal(items.every((item) => item.disabled === false), true);
  assert.equal(items.some((item) => item.id === 'nudges'), false);
});

test('timer is unavailable during active rest while non-timer controls remain available', () => {
  const items = getPauseMenuItems({ active: true });
  const timer = items.find((item) => item.id === 'timer');
  const otherItems = items.filter((item) => item.id !== 'timer');

  assert.equal(timer?.disabled, true);
  assert.equal(otherItems.every((item) => item.disabled === false), true);
});