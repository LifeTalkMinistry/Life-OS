import test from 'node:test';
import assert from 'node:assert/strict';
import { getPauseMenuItems } from '../src/components/PauseOrbMenu.js';

test('PAUSE orb menu exposes the intended control-center actions in order', () => {
  const items = getPauseMenuItems({ active: false });
  assert.deepEqual(items.map((item) => item.id), [
    'timer',
    'recovery',
    'nudges',
    'insights',
    'settings'
  ]);
  assert.equal(items.every((item) => item.disabled === false), true);
});

test('timer is unavailable during active rest while non-timer controls remain available', () => {
  const items = getPauseMenuItems({ active: true });
  const timer = items.find((item) => item.id === 'timer');
  const otherItems = items.filter((item) => item.id !== 'timer');

  assert.equal(timer?.disabled, true);
  assert.equal(otherItems.every((item) => item.disabled === false), true);
});
