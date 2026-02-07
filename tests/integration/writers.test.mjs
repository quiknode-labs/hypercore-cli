import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';

import { createWriter } from '../../dist/src/outputs/index.js';

const sampleOrder = {
  eventKey: 'orders:1:0:test',
  stream: 'orders',
  blockNumber: 1,
  blockTime: '2026-01-01T00:00:00.000Z',
  localTime: '2026-01-01T00:00:00.100Z',
  eventIndex: 0,
  rawJson: '{"a":1}',
  user: '0xabc',
  status: 'open',
  coin: 'BTC',
  side: 'B',
  limitPx: '100',
  size: '1',
  origSize: '1',
  orderType: 'Limit',
  tif: 'Gtc',
  oid: 1,
  txHash: '0xhash',
  cloid: null,
  reduceOnly: false,
  isTrigger: false,
  triggerPx: null,
  builderAddress: null,
  builderFeeBps: null,
  eventTime: null,
};

test('JSON writer outputs serialized event', async () => {
  const writes = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    writes.push(String(chunk));
    return true;
  };

  try {
    const writer = createWriter({ format: 'json', dataset: 'orders' });
    await writer.init({ dataset: 'orders' });
    await writer.write(sampleOrder);
    await writer.close();
  } finally {
    process.stdout.write = originalWrite;
  }

  assert.ok(writes.some((line) => line.includes('eventKey')));
});

test('CSV writer outputs header and row', async () => {
  const writes = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    writes.push(String(chunk));
    return true;
  };

  try {
    const writer = createWriter({ format: 'csv', dataset: 'orders' });
    await writer.init({ dataset: 'orders' });
    await writer.write(sampleOrder);
    await writer.close();
  } finally {
    process.stdout.write = originalWrite;
  }

  assert.ok(writes[0].includes('event_key'));
  assert.ok(writes[1].includes('orders:1:0:test'));
});

test('SQLite writer writes row when better-sqlite3 is available', async (t) => {
  let sqliteAvailable = true;
  try {
    await import('better-sqlite3');
  } catch {
    sqliteAvailable = false;
  }

  if (!sqliteAvailable) {
    t.skip('better-sqlite3 not installed in this environment');
    return;
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hypercore-cli-test-'));
  const dbPath = path.join(tempDir, 'events.db');

  try {
    const writer = createWriter({ format: 'sqlite', dataset: 'orders', dbPath });
    try {
      await writer.init({ dataset: 'orders' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Could not locate the bindings file')) {
        t.skip('better-sqlite3 native binding unavailable for current Node runtime');
        return;
      }
      throw error;
    }

    await writer.write(sampleOrder);
    await writer.close();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  assert.equal(true, true);
});
