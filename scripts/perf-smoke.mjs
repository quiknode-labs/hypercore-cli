import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { mkdtemp, rm } from 'node:fs/promises';

import { createWriter } from '../dist/src/outputs/index.js';

const EVENT_COUNT = parseInteger(process.env.PERF_EVENT_COUNT, 10000);
const MAX_RUNTIME_MS = parseInteger(process.env.PERF_MAX_MS, 20000);

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hypercore-cli-perf-'));
const dbPath = path.join(tempDir, 'perf-smoke.db');

const writer = createWriter({
  format: 'sqlite',
  dataset: 'orders',
  dbPath,
});

let initialized = false;
let closed = false;
try {
  try {
    await writer.init({ dataset: 'orders' });
    initialized = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isNativeBindingError(message)) {
      process.stdout.write(
        JSON.stringify({
          type: 'perf_smoke',
          status: 'skipped',
          reason: 'sqlite_native_binding_unavailable',
          detail: message,
        }) + '\n',
      );
      process.exit(0);
    }
    throw error;
  }

  const start = performance.now();
  for (let index = 0; index < EVENT_COUNT; index += 1) {
    await writer.write(createOrderEvent(index));
  }
  await writer.flush();
  await writer.close();
  closed = true;

  const runtimeMs = performance.now() - start;
  const eventsPerSecond = EVENT_COUNT / Math.max(runtimeMs / 1000, 0.001);
  const status = runtimeMs <= MAX_RUNTIME_MS ? 'passed' : 'failed';

  process.stdout.write(
    JSON.stringify({
      type: 'perf_smoke',
      status,
      dataset: 'orders',
      output: 'sqlite',
      eventCount: EVENT_COUNT,
      runtimeMs: Number(runtimeMs.toFixed(2)),
      eventsPerSecond: Number(eventsPerSecond.toFixed(2)),
      maxRuntimeMs: MAX_RUNTIME_MS,
      dbPath,
    }) + '\n',
  );

  if (status === 'failed') {
    process.exitCode = 1;
  }
} finally {
  if (initialized && !closed) {
    await writer.close();
  }
  await rm(tempDir, { recursive: true, force: true });
}

function parseInteger(value, fallback) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function isNativeBindingError(message) {
  return (
    message.includes('Could not locate the bindings file') ||
    message.includes('native binding') ||
    message.includes('better-sqlite3')
  );
}

function createOrderEvent(index) {
  return {
    eventKey: `orders:perf:${index}`,
    stream: 'orders',
    blockNumber: 900000000 + index,
    blockTime: '2026-01-01T00:00:00.000Z',
    localTime: '2026-01-01T00:00:00.100Z',
    eventIndex: 0,
    rawJson: '{"perf":true}',
    user: '0xperf',
    status: 'open',
    coin: 'BTC',
    side: 'B',
    limitPx: '100.0',
    size: '1.0',
    origSize: '1.0',
    orderType: 'Limit',
    tif: 'Gtc',
    oid: index,
    txHash: null,
    cloid: null,
    reduceOnly: false,
    isTrigger: false,
    triggerPx: null,
    builderAddress: null,
    builderFeeBps: null,
    eventTime: null,
  };
}
