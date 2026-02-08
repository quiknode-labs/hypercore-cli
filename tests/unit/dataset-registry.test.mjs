import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDatasetDefinition,
  getDatasetNames,
  streamNameMatchesDataset,
} from '../../dist/src/datasets/registry.js';

test('dataset registry exposes phase 2 dataset list', () => {
  const names = getDatasetNames();
  assert.deepEqual(names, ['orders', 'trades', 'events', 'book_updates', 'twap', 'writer_actions']);
});

test('stream alias matching accepts hl.book for book_updates', () => {
  assert.equal(streamNameMatchesDataset('hl.book', 'book_updates'), true);
  assert.equal(streamNameMatchesDataset('book_updates', 'book_updates'), true);
  assert.equal(streamNameMatchesDataset('hl.twap', 'book_updates'), false);
});

test('book_updates uses JSON-RPC backfill stream book', () => {
  const definition = getDatasetDefinition('book_updates');
  assert.equal(definition.backfillStream, 'book');
});

test('writer_actions uses JSON-RPC backfill stream writer_actions', () => {
  const definition = getDatasetDefinition('writer_actions');
  assert.equal(definition.backfillStream, 'writer_actions');
});

test('every dataset has a docsUrl', () => {
  const names = getDatasetNames();
  for (const name of names) {
    const definition = getDatasetDefinition(name);
    assert.ok(definition.docsUrl, `${name} should have a docsUrl`);
    assert.ok(definition.docsUrl.startsWith('https://'), `${name} docsUrl should be HTTPS`);
  }
});
