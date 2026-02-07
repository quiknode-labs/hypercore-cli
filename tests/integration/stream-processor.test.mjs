import test from 'node:test';
import assert from 'node:assert/strict';

import { StreamProcessor } from '../../dist/src/core/stream-processor.js';

class FakeFetcher {
  constructor(blocks, delayMs = 0) {
    this.blocks = blocks;
    this.calls = [];
    this.delayMs = delayMs;
  }

  async fetchBatchBlocks(stream, from, to) {
    this.calls.push({ stream, from, to });
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    return this.blocks.filter((block) => block.blockNumber >= from && block.blockNumber <= to);
  }
}

test('StreamProcessor backfills missed range after reconnect', async () => {
  const emitted = [];

  const fetcher = new FakeFetcher([
    {
      stream: 'orders',
      blockNumber: 101,
      blockTime: 't1',
      localTime: 'l1',
      events: [{ user: '0x1', status: 'open', order: { coin: 'BTC', side: 'B' } }],
    },
    {
      stream: 'orders',
      blockNumber: 102,
      blockTime: 't2',
      localTime: 'l2',
      events: [{ user: '0x2', status: 'filled', order: { coin: 'ETH', side: 'A' } }],
    },
  ]);

  const processor = new StreamProcessor({
    dataset: 'orders',
    blockFetcher: fetcher,
    normalize: (block) =>
      block.events.map((_, index) => ({
        eventKey: `orders:${block.blockNumber}:${index}`,
        stream: 'orders',
        blockNumber: block.blockNumber,
        blockTime: block.blockTime,
        localTime: block.localTime,
        eventIndex: index,
        rawJson: '{}',
        user: '0xuser',
        status: 'open',
        coin: 'BTC',
        side: 'B',
        limitPx: null,
        size: null,
        origSize: null,
        orderType: null,
        tif: null,
        oid: null,
        txHash: null,
        cloid: null,
        reduceOnly: null,
        isTrigger: null,
        triggerPx: null,
        builderAddress: null,
        builderFeeBps: null,
        eventTime: null,
      })),
    emit: async (event) => {
      emitted.push(event.eventKey);
    },
    log: () => {},
    warn: () => {},
  });

  await processor.ingestLiveBlock({
    stream: 'orders',
    blockNumber: 100,
    blockTime: 't0',
    localTime: 'l0',
    events: [{ user: '0x0', status: 'open', order: { coin: 'BTC', side: 'B' } }],
  });

  processor.markReconnected();

  await processor.ingestLiveBlock({
    stream: 'orders',
    blockNumber: 103,
    blockTime: 't3',
    localTime: 'l3',
    events: [{ user: '0x3', status: 'open', order: { coin: 'SOL', side: 'B' } }],
  });

  assert.deepEqual(fetcher.calls, [{ stream: 'orders', from: 101, to: 102 }]);
  assert.equal(emitted.length, 4);
});

test('StreamProcessor prunes old dedupe keys by block window', async () => {
  const emitted = [];

  const fetcher = new FakeFetcher([]);
  const processor = new StreamProcessor({
    dataset: 'orders',
    blockFetcher: fetcher,
    dedupeRetainBlocks: 1,
    normalize: (block) =>
      block.events.map((raw, index) => ({
        eventKey: String(raw.key ?? `orders:${block.blockNumber}:${index}`),
        stream: 'orders',
        blockNumber: block.blockNumber,
        blockTime: block.blockTime,
        localTime: block.localTime,
        eventIndex: index,
        rawJson: '{}',
        user: '0xuser',
        status: 'open',
        coin: 'BTC',
        side: 'B',
        limitPx: null,
        size: null,
        origSize: null,
        orderType: null,
        tif: null,
        oid: null,
        txHash: null,
        cloid: null,
        reduceOnly: null,
        isTrigger: null,
        triggerPx: null,
        builderAddress: null,
        builderFeeBps: null,
        eventTime: null,
      })),
    emit: async (event) => {
      emitted.push(event.eventKey);
    },
    log: () => {},
    warn: () => {},
  });

  await processor.ingestLiveBlock({
    stream: 'orders',
    blockNumber: 100,
    blockTime: 't100',
    localTime: 'l100',
    events: [{ key: 'repeatable-key' }],
  });
  await processor.ingestLiveBlock({
    stream: 'orders',
    blockNumber: 101,
    blockTime: 't101',
    localTime: 'l101',
    events: [{ key: 'next-key' }],
  });
  await processor.ingestLiveBlock({
    stream: 'orders',
    blockNumber: 102,
    blockTime: 't102',
    localTime: 'l102',
    events: [{ key: 'current-key' }],
  });

  await processor.ingestLiveBlock({
    stream: 'orders',
    blockNumber: 103,
    blockTime: 't103',
    localTime: 'l103',
    events: [{ key: 'repeatable-key' }],
  });

  assert.deepEqual(emitted, ['repeatable-key', 'next-key', 'current-key', 'repeatable-key']);
});

test('StreamProcessor performs reconnect gap check once under concurrent block ingestion', async () => {
  const emitted = [];
  const fetcher = new FakeFetcher(
    [
      {
        stream: 'orders',
        blockNumber: 101,
        blockTime: 't101',
        localTime: 'l101',
        events: [{ key: 'backfill-101' }],
      },
      {
        stream: 'orders',
        blockNumber: 102,
        blockTime: 't102',
        localTime: 'l102',
        events: [{ key: 'backfill-102' }],
      },
      {
        stream: 'orders',
        blockNumber: 103,
        blockTime: 't103',
        localTime: 'l103',
        events: [{ key: 'live-103' }],
      },
      {
        stream: 'orders',
        blockNumber: 104,
        blockTime: 't104',
        localTime: 'l104',
        events: [{ key: 'live-104' }],
      },
    ],
    15,
  );

  const processor = new StreamProcessor({
    dataset: 'orders',
    blockFetcher: fetcher,
    normalize: (block) =>
      block.events.map((raw, index) => ({
        eventKey: String(raw.key ?? `orders:${block.blockNumber}:${index}`),
        stream: 'orders',
        blockNumber: block.blockNumber,
        blockTime: block.blockTime,
        localTime: block.localTime,
        eventIndex: index,
        rawJson: '{}',
        user: '0xuser',
        status: 'open',
        coin: 'BTC',
        side: 'B',
        limitPx: null,
        size: null,
        origSize: null,
        orderType: null,
        tif: null,
        oid: null,
        txHash: null,
        cloid: null,
        reduceOnly: null,
        isTrigger: null,
        triggerPx: null,
        builderAddress: null,
        builderFeeBps: null,
        eventTime: null,
      })),
    emit: async (event) => {
      emitted.push(event.eventKey);
    },
    log: () => {},
    warn: () => {},
  });

  await processor.ingestLiveBlock({
    stream: 'orders',
    blockNumber: 100,
    blockTime: 't100',
    localTime: 'l100',
    events: [{ key: 'seed-100' }],
  });

  processor.markReconnected();

  await Promise.all([
    processor.ingestLiveBlock({
      stream: 'orders',
      blockNumber: 103,
      blockTime: 't103',
      localTime: 'l103',
      events: [{ key: 'live-103' }],
    }),
    processor.ingestLiveBlock({
      stream: 'orders',
      blockNumber: 104,
      blockTime: 't104',
      localTime: 'l104',
      events: [{ key: 'live-104' }],
    }),
  ]);

  assert.deepEqual(fetcher.calls, [{ stream: 'orders', from: 101, to: 102 }]);
  assert.equal(emitted.includes('backfill-101'), true);
  assert.equal(emitted.includes('backfill-102'), true);
});
