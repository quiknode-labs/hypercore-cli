import test from 'node:test';
import assert from 'node:assert/strict';

import { JsonRpcClient } from '../../dist/src/api/jsonrpc.js';

test('JsonRpcClient maps book_updates dataset to book stream for backfill', async () => {
  const originalFetch = globalThis.fetch;
  let seenPayload = null;

  globalThis.fetch = async (_url, init) => {
    seenPayload = JSON.parse(String(init.body));
    return {
      ok: true,
      json: async () => ({
        jsonrpc: '2.0',
        id: 1,
        result: {
          blocks: [
            {
              block_number: 1,
              block_time: 't',
              local_time: 'l',
              events: [],
            },
          ],
        },
      }),
    };
  };

  try {
    const client = new JsonRpcClient('https://example.com');
    await client.fetchBatchBlocks('book_updates', 1, 1);
    assert.equal(seenPayload.params.stream, 'book');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('JsonRpcClient maps writer_actions dataset to writer_actions stream for backfill', async () => {
  const originalFetch = globalThis.fetch;
  let seenPayload = null;

  globalThis.fetch = async (_url, init) => {
    seenPayload = JSON.parse(String(init.body));
    return {
      ok: true,
      json: async () => ({
        jsonrpc: '2.0',
        id: 1,
        result: {
          blocks: [
            {
              block_number: 1,
              block_time: 't',
              local_time: 'l',
              events: [],
            },
          ],
        },
      }),
    };
  };

  try {
    const client = new JsonRpcClient('https://example.com');
    await client.fetchBatchBlocks('writer_actions', 1, 1);
    assert.equal(seenPayload.params.stream, 'writer_actions');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
