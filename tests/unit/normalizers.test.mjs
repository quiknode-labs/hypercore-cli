import test from 'node:test';
import assert from 'node:assert/strict';

let modules = null;

try {
  const [orders, trades, events, bookUpdates, twap, writerActions] = await Promise.all([
    import('../../dist/src/datasets/orders.js'),
    import('../../dist/src/datasets/trades.js'),
    import('../../dist/src/datasets/events.js'),
    import('../../dist/src/datasets/book-updates.js'),
    import('../../dist/src/datasets/twap.js'),
    import('../../dist/src/datasets/writer-actions.js'),
  ]);
  modules = { orders, trades, events, bookUpdates, twap, writerActions };
} catch {
  modules = null;
}

if (!modules) {
  test('dataset normalizers (skipped: runtime deps unavailable)', { skip: true }, () => {});
} else {
  test('normalizeOrderBlock parses valid events', () => {
    const rows = modules.orders.normalizeOrderBlock({
      stream: 'orders',
      blockNumber: 10,
      blockTime: '2026-01-01T00:00:00.000Z',
      localTime: '2026-01-01T00:00:00.100Z',
      events: [{ user: '0xabc', status: 'open', hash: '0xhash', order: { coin: 'BTC', side: 'B' } }],
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].coin, 'BTC');
  });

  test('normalizeTradeBlock parses tuple events', () => {
    const rows = modules.trades.normalizeTradeBlock({
      stream: 'trades',
      blockNumber: 11,
      blockTime: '2026-01-01T00:00:00.000Z',
      localTime: '2026-01-01T00:00:00.100Z',
      events: [['0xabc', { coin: 'ETH', px: '100', sz: '2', side: 'A' }]],
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].user, '0xabc');
  });

  test('normalizeEventsBlock extracts event type and delta type', () => {
    const rows = modules.events.normalizeEventsBlock({
      stream: 'events',
      blockNumber: 12,
      blockTime: '2026-01-01T00:00:00.000Z',
      localTime: '2026-01-01T00:00:00.100Z',
      events: [{
        hash: '0xhash',
        inner: { LedgerUpdate: { users: ['0x1'], delta: { type: 'deposit' } } },
      }],
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].eventType, 'LedgerUpdate');
    assert.equal(rows[0].deltaType, 'deposit');
  });

  test('normalizeBookUpdatesBlock parses remove and new diff types', () => {
    const rows = modules.bookUpdates.normalizeBookUpdatesBlock({
      stream: 'book_updates',
      blockNumber: 13,
      blockTime: '2026-01-01T00:00:00.000Z',
      localTime: '2026-01-01T00:00:00.100Z',
      events: [
        { coin: 'BTC', side: 'B', px: '100000', raw_book_diff: 'remove' },
        { coin: 'BTC', side: 'A', px: '100010', raw_book_diff: { new: { sz: '2.1' } } },
      ],
    });

    assert.equal(rows.length, 2);
    assert.equal(rows[0].diffType, 'remove');
    assert.equal(rows[1].diffType, 'new');
    assert.equal(rows[1].size, '2.1');
  });

  test('normalizeTwapBlock parses status and state fields', () => {
    const rows = modules.twap.normalizeTwapBlock({
      stream: 'twap',
      blockNumber: 14,
      blockTime: '2026-01-01T00:00:00.000Z',
      localTime: '2026-01-01T00:00:00.100Z',
      events: [
        {
          time: '2026-01-01T00:00:00.000Z',
          twap_id: 123,
          status: 'activated',
          state: {
            coin: 'ETH',
            user: '0xabc',
            side: 'A',
            sz: '5.0',
            executedSz: '1.0',
            executedNtl: '3000',
            minutes: 20,
            reduceOnly: false,
            randomize: true,
            timestamp: 123456,
          },
        },
      ],
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].twapId, 123);
    assert.equal(rows[0].status, 'activated');
    assert.equal(rows[0].coin, 'ETH');
  });

  test('normalizeWriterActionsBlock parses action fields', () => {
    const rows = modules.writerActions.normalizeWriterActionsBlock({
      stream: 'writer_actions',
      blockNumber: 15,
      blockTime: '2026-01-01T00:00:00.000Z',
      localTime: '2026-01-01T00:00:00.100Z',
      events: [
        {
          time: '2026-01-01T00:00:00.000Z',
          user: '0xwriter',
          nonce: 77,
          evm_tx_hash: '0xevm',
          action: {
            type: 'SystemSpotSendAction',
            destination: '0xdest',
            token: 124,
            wei: '250000000000000000',
          },
        },
      ],
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].type, 'SystemSpotSendAction');
    assert.equal(rows[0].actionType, 'SystemSpotSendAction');
    assert.equal(rows[0].token, '124');
    assert.equal(rows[0].destination, '0xdest');
  });
}
