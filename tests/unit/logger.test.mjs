import test from 'node:test';
import assert from 'node:assert/strict';

import { createLogger } from '../../dist/src/utils/logger.js';

test('createLogger emits JSON progress lines when mode=json', () => {
  const writes = [];
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk) => {
    writes.push(String(chunk));
    return true;
  };

  try {
    const logger = createLogger({
      quiet: false,
      mode: 'json',
      context: { command: 'stream', dataset: 'orders' },
    });
    logger.info('connecting');
    logger.warn('retrying');
  } finally {
    process.stderr.write = originalWrite;
  }

  assert.equal(writes.length, 2);
  const info = JSON.parse(writes[0]);
  const warn = JSON.parse(writes[1]);
  assert.equal(info.level, 'info');
  assert.equal(info.message, 'connecting');
  assert.equal(info.command, 'stream');
  assert.equal(info.dataset, 'orders');
  assert.equal(warn.level, 'warn');
  assert.equal(warn.message, 'retrying');
});

test('createLogger quiet mode suppresses info but not warnings', () => {
  const writes = [];
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk) => {
    writes.push(String(chunk));
    return true;
  };

  try {
    const logger = createLogger({ quiet: true, mode: 'text' });
    logger.info('hidden');
    logger.warn('visible');
  } finally {
    process.stderr.write = originalWrite;
  }

  assert.equal(writes.length, 1);
  assert.ok(writes[0].includes('[warn]'));
  assert.ok(writes[0].includes('visible'));
});

test('createLogger applies message redaction before output', () => {
  const writes = [];
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk) => {
    writes.push(String(chunk));
    return true;
  };

  try {
    const logger = createLogger({
      quiet: false,
      mode: 'json',
      redact: (message) => message.replaceAll('abc123', 'REDACTED'),
    });
    logger.error('failed url=/abc123/hypercore/ws token=abc123');
  } finally {
    process.stderr.write = originalWrite;
  }

  const payload = JSON.parse(writes[0]);
  assert.equal(payload.message.includes('abc123'), false);
  assert.equal(payload.message.includes('REDACTED'), true);
});
