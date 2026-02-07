import test from 'node:test';
import assert from 'node:assert/strict';

import { runBackfillRange } from '../../dist/src/core/backfill-runner.js';

test('runBackfillRange batches requests and stops at limit', async () => {
  const blocksByNumber = new Map([
    [
      100,
      {
        stream: 'orders',
        blockNumber: 100,
        blockTime: 't100',
        localTime: 'l100',
        events: [
          { eventKey: 'orders:100:0', coin: 'BTC' },
          { eventKey: 'orders:100:1', coin: 'ETH' },
        ],
      },
    ],
    [
      101,
      {
        stream: 'orders',
        blockNumber: 101,
        blockTime: 't101',
        localTime: 'l101',
        events: [{ eventKey: 'orders:101:0', coin: 'BTC' }],
      },
    ],
    [
      102,
      {
        stream: 'orders',
        blockNumber: 102,
        blockTime: 't102',
        localTime: 'l102',
        events: [{ eventKey: 'orders:102:0', coin: 'BTC' }],
      },
    ],
  ]);

  const calls = [];
  const emitted = [];

  const result = await runBackfillRange({
    dataset: 'orders',
    fromBlock: 100,
    toBlock: 104,
    batchSize: 2,
    limit: 2,
    normalize: (block) =>
      block.events.map((item, index) => ({
        eventKey: item.eventKey ?? `orders:${block.blockNumber}:${index}`,
        stream: 'orders',
        blockNumber: block.blockNumber,
        blockTime: block.blockTime,
        localTime: block.localTime,
        eventIndex: index,
        rawJson: '{}',
        user: '0xuser',
        status: 'open',
        coin: item.coin ?? 'BTC',
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
    fetchBatchBlocks: async (from, to) => {
      calls.push({ from, to });
      const rows = [];
      for (let blockNumber = from; blockNumber <= to; blockNumber += 1) {
        const block = blocksByNumber.get(blockNumber);
        if (block) {
          rows.push(block);
        }
      }
      return rows;
    },
    onEvent: async (event) => {
      emitted.push(event.eventKey);
    },
    matchesEvent: (event) => event.coin === 'BTC',
  });

  assert.deepEqual(calls, [{ from: 100, to: 101 }]);
  assert.deepEqual(emitted, ['orders:100:0', 'orders:101:0']);
  assert.equal(result.emittedCount, 2);
  assert.equal(result.seenEvents, 3);
  assert.equal(result.batches, 1);
});
