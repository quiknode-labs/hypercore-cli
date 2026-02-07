import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveProgressMode } from '../../dist/src/utils/progress.js';

test('resolveProgressMode defaults to text', () => {
  assert.equal(resolveProgressMode(), 'text');
});

test('resolveProgressMode accepts json', () => {
  assert.equal(resolveProgressMode('json'), 'json');
});

test('resolveProgressMode rejects invalid values', () => {
  assert.throws(() => resolveProgressMode('yaml'), /Invalid --progress/);
});
