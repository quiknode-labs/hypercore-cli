import test from 'node:test';
import assert from 'node:assert/strict';

import { getReconnectDelaySeconds } from '../../dist/src/core/reconnection-manager.js';

test('reconnect delay follows exponential pattern and caps at 60', () => {
  assert.equal(getReconnectDelaySeconds(0), 1);
  assert.equal(getReconnectDelaySeconds(1), 2);
  assert.equal(getReconnectDelaySeconds(2), 4);
  assert.equal(getReconnectDelaySeconds(5), 32);
  assert.equal(getReconnectDelaySeconds(6), 60);
  assert.equal(getReconnectDelaySeconds(20), 60);
});
