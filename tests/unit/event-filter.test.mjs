import test from 'node:test';
import assert from 'node:assert/strict';

import { createEventFilter } from '../../dist/src/filters/event-filter.js';

function baseEnvelope(stream) {
  return {
    eventKey: `${stream}:1:0`,
    stream,
    blockNumber: 1,
    blockTime: '2026-01-01T00:00:00.000Z',
    localTime: '2026-01-01T00:00:00.000Z',
    eventIndex: 0,
    rawJson: '{}',
  };
}

test('createEventFilter returns pass-through matcher when filters are empty', () => {
  const matcher = createEventFilter({});
  const event = {
    ...baseEnvelope('orders'),
    user: '0xabc',
    status: 'open',
    coin: 'BTC',
    side: 'B',
  };

  assert.equal(matcher(event), true);
});

test('createEventFilter matches user for orders.user and events.users', () => {
  const matcher = createEventFilter({ user: ['0xabc'] });
  const orderEvent = {
    ...baseEnvelope('orders'),
    user: '0xabc',
    status: 'open',
    coin: 'BTC',
    side: 'B',
  };
  const systemEvent = {
    ...baseEnvelope('events'),
    eventType: 'LedgerUpdate',
    deltaType: 'deposit',
    txHash: null,
    users: ['0xabc', '0xdef'],
    eventTime: null,
  };

  assert.equal(matcher(orderEvent), true);
  assert.equal(matcher(systemEvent), true);
});

test('createEventFilter supports nested key paths', () => {
  const matcher = createEventFilter({ 'state.coin': ['ETH'] });
  const twapLikeEvent = {
    ...baseEnvelope('twap'),
    state: {
      coin: 'ETH',
      user: '0xabc',
    },
  };

  assert.equal(matcher(twapLikeEvent), true);
});

test('createEventFilter rejects events missing a requested field', () => {
  const matcher = createEventFilter({ coin: ['BTC'] });
  const event = {
    ...baseEnvelope('events'),
    eventType: 'LedgerUpdate',
    deltaType: null,
    txHash: null,
    users: ['0xabc'],
    eventTime: null,
  };

  assert.equal(matcher(event), false);
});
