import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldCreateRecoveryPlanOverlay } from '../src/recoveryPlanPickerStability.js';

test('Sleep Routine setup does not recreate an overlay that is already open', () => {
  assert.equal(shouldCreateRecoveryPlanOverlay(true), false);
  assert.equal(shouldCreateRecoveryPlanOverlay(false), true);
});
