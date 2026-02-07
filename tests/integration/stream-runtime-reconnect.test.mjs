import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { WebSocketServer } from 'ws';

import { getNormalizer } from '../../dist/src/datasets/types.js';
import { runStreamRuntime } from '../../dist/src/core/stream-runtime.js';

const SOCKET_TESTS_ENABLED = process.env.ENABLE_SOCKET_TESTS === '1';

test(
  'runStreamRuntime reconnects once and performs one backfill range',
  { skip: !SOCKET_TESTS_ENABLED },
  async (t) => {
  const httpServer = createServer();
  try {
    await new Promise((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(0, '127.0.0.1', () => {
        httpServer.off('error', reject);
        resolve();
      });
    });
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : '';
    if (code === 'EPERM' || code === 'EACCES') {
      t.skip('Socket bind is not permitted in this runtime');
      return;
    }
    throw error;
  }

  const wss = new WebSocketServer({ server: httpServer });
  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unexpected WebSocket server address');
  }

  let connectionNumber = 0;
  wss.on('connection', (socket) => {
    connectionNumber += 1;
    let subscribed = false;

    socket.on('message', (rawData) => {
      const message = JSON.parse(String(rawData));
      if (message.method !== 'hl_subscribe' || subscribed) {
        return;
      }

      subscribed = true;
      socket.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: message.id ?? 1,
          result: { subscribed: 'hl.trades' },
        }),
      );

      if (connectionNumber === 1) {
        socket.send(
          JSON.stringify({
            type: 'data',
            stream: 'hl.trades',
            block: {
              block_number: 100,
              block_time: '2026-01-01T00:00:00.000Z',
              local_time: '2026-01-01T00:00:00.001Z',
              events: [
                [
                  '0xfeed000000000000000000000000000000000001',
                  { coin: 'BTC', px: '100.0', sz: '1.0', side: 'B', tid: 100 },
                ],
              ],
            },
          }),
        );
        setTimeout(() => socket.close(), 30);
        return;
      }

      socket.send(
        JSON.stringify({
          type: 'data',
          stream: 'hl.trades',
          block: {
            block_number: 103,
            block_time: '2026-01-01T00:00:03.000Z',
            local_time: '2026-01-01T00:00:03.001Z',
            events: [
              [
                '0xfeed000000000000000000000000000000000003',
                { coin: 'BTC', px: '103.0', sz: '1.0', side: 'A', tid: 103 },
              ],
            ],
          },
        }),
      );
    });
  });

  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  globalThis.fetch = async (_url, init) => {
    const payload = JSON.parse(String(init?.body ?? '{}'));
    fetchCalls.push(payload.params);

    return {
      ok: true,
      json: async () => ({
        jsonrpc: '2.0',
        id: payload.id ?? 1,
        result: {
          blocks: [
            {
              block_number: 101,
              block_time: '2026-01-01T00:00:01.000Z',
              local_time: '2026-01-01T00:00:01.001Z',
              events: [
                [
                  '0xfeed000000000000000000000000000000000011',
                  { coin: 'BTC', px: '101.0', sz: '1.0', side: 'B', tid: 101 },
                ],
              ],
            },
            {
              block_number: 102,
              block_time: '2026-01-01T00:00:02.000Z',
              local_time: '2026-01-01T00:00:02.001Z',
              events: [
                [
                  '0xfeed000000000000000000000000000000000012',
                  { coin: 'BTC', px: '102.0', sz: '1.0', side: 'B', tid: 102 },
                ],
              ],
            },
          ],
        },
      }),
    };
  };

  const emittedBlockNumbers = [];
  const logs = [];

  try {
    const result = await runStreamRuntime({
      dataset: 'trades',
      wsUrl: `ws://127.0.0.1:${address.port}`,
      httpUrl: 'http://127.0.0.1/backfill',
      filters: {},
      normalize: getNormalizer('trades'),
      onEvent: async (event) => {
        emittedBlockNumbers.push(event.blockNumber);
      },
      limit: 4,
      log: (message) => logs.push(message),
      warn: () => {},
      idleLogIntervalMs: 0,
    });

    assert.equal(result.emittedCount, 4);
    assert.deepEqual(emittedBlockNumbers, [100, 101, 102, 103]);
    assert.equal(fetchCalls.length, 1);
    assert.deepEqual(fetchCalls[0], { stream: 'trades', from: 101, to: 102 });
    assert.equal(logs.some((line) => line.includes('Backfilling missing blocks 101-102')), true);
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise((resolve) => wss.close(resolve));
    await new Promise((resolve) => httpServer.close(resolve));
  }
  },
);
