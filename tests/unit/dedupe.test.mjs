import test from 'node:test';
import assert from 'node:assert/strict';

import { computeEventKey } from '../../dist/src/utils/hash.js';

test('computeEventKey is deterministic with object key reorder', () => {
  const key1 = computeEventKey('orders', 100, 0, { a: 1, b: 2 });
  const key2 = computeEventKey('orders', 100, 0, { b: 2, a: 1 });
  assert.equal(key1, key2);
});

test('computeEventKey changes with event index', () => {
  const key1 = computeEventKey('orders', 100, 0, { a: 1 });
  const key2 = computeEventKey('orders', 100, 1, { a: 1 });
  assert.notEqual(key1, key2);
});
