import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { runCli } from '../../dist/src/index.js';

async function captureCliOutput(run) {
  const stdout = [];
  const stderr = [];
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = (chunk) => {
    stdout.push(String(chunk));
    return true;
  };
  process.stderr.write = (chunk) => {
    stderr.push(String(chunk));
    return true;
  };

  try {
    await run();
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }

  return { stdout: stdout.join(''), stderr: stderr.join('') };
}

test('backfill emits structured progress JSON and shutdown summary with redacted endpoint', async (t) => {
  const requests = [];
  const server = createServer(async (req, res) => {
    const bodyChunks = [];
    for await (const chunk of req) {
      bodyChunks.push(Buffer.from(chunk));
    }

    const payload = JSON.parse(Buffer.concat(bodyChunks).toString('utf8'));
    requests.push(payload);
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        id: payload.id ?? 1,
        result: {
          blocks: [
            {
              block_number: 100,
              block_time: '2026-01-01T00:00:00.000Z',
              local_time: '2026-01-01T00:00:00.100Z',
              events: [
                {
                  time: '2026-01-01T00:00:00.000Z',
                  user: '0xabc',
                  hash: '0xhash',
                  status: 'open',
                  order: { coin: 'BTC', side: 'B', limitPx: '100', sz: '1', origSz: '1' },
                },
              ],
            },
          ],
        },
      }),
    );
  });

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : '';
    if (code === 'EPERM' || code === 'EACCES') {
      t.skip('Local socket bind is not permitted in this runtime');
      return;
    }
    throw error;
  }

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unexpected HTTP server address');
  }

  try {
    const endpoint = `http://127.0.0.1:${address.port}/abc123/hypercore`;
    const output = await captureCliOutput(() =>
      runCli([
        'node',
        'hypercore-cli',
        'backfill',
        '--dataset',
        'orders',
        '--from',
        '100',
        '--to',
        '100',
        '--output',
        'json',
        '--progress',
        'json',
        '--endpoint',
        endpoint,
      ]),
    );

    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, 'hl_getBatchBlocks');
    assert.deepEqual(requests[0].params, { stream: 'orderUpdates', from: 100, to: 100 });

    const eventLine = output.stdout
      .trim()
      .split('\n')
      .find((line) => line.trim().startsWith('{'));
    assert.ok(eventLine);
    const event = JSON.parse(eventLine);
    assert.equal(event.stream, 'orders');
    assert.equal(event.coin, 'BTC');

    const stderrLines = output.stderr
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);
    assert.ok(stderrLines.length > 0);
    const logs = stderrLines.map((line) => JSON.parse(line));

    assert.ok(logs.every((entry) => typeof entry.timestamp === 'string'));
    assert.ok(logs.every((entry) => typeof entry.level === 'string'));
    assert.ok(logs.every((entry) => typeof entry.message === 'string'));

    assert.ok(logs.some((entry) => entry.message.startsWith('Backfill done:')));
    assert.ok(logs.some((entry) => entry.command === 'backfill'));
    assert.ok(output.stderr.includes('REDACTED/hypercore'));
    assert.equal(output.stderr.includes('abc123'), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
