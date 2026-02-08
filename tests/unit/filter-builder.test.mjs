import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFilters, parseRawFilter } from '../../dist/src/filters/filter-builder.js';

test('buildFilters merges curated and raw filters', () => {
  const filters = buildFilters({
    dataset: 'orders',
    tokens: 'BTC,ETH',
    users: '0x1',
    statuses: 'open,filled',
    rawFilters: ['coin=SOL', 'side=B'],
  });

  assert.deepEqual(filters.coin, ['BTC', 'ETH', 'SOL']);
  assert.deepEqual(filters.user, ['0x1']);
  assert.deepEqual(filters.status, ['open', 'filled']);
  assert.deepEqual(filters.side, ['B']);
});

test('buildFilters rejects statuses for non-orders', () => {
  assert.throws(
    () =>
      buildFilters({
        dataset: 'trades',
        statuses: 'filled',
      }),
    /--statuses is only supported/,
  );
});

test('buildFilters maps --tokens to token field for writer_actions', () => {
  const filters = buildFilters({
    dataset: 'writer_actions',
    tokens: '124,125',
    users: '0x1',
  });

  assert.deepEqual(filters.token, ['124', '125']);
  assert.deepEqual(filters.user, ['0x1']);
  assert.equal(filters.coin, undefined);
});

test('parseRawFilter handles key value csv and malformed input', () => {
  assert.deepEqual(parseRawFilter('type=deposit,withdraw'), {
    key: 'type',
    values: ['deposit', 'withdraw'],
  });

  assert.throws(() => parseRawFilter('bad'), /Invalid --filter/);
});
