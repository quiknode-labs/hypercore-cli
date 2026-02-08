import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveEndpointUrls,
  extractTokenFromEndpoint,
  redactEndpointUrl,
  redactSensitiveText,
  sanitizeEndpointForStorage,
} from '../../dist/src/utils/url.js';

test('deriveEndpointUrls supports full Quicknode WSS hypercore endpoint', () => {
  const endpoint =
    'wss://demo.hype-mainnet.quiknode.pro/abc123/hypercore/ws';

  const urls = deriveEndpointUrls(endpoint);

  assert.equal(urls.wsUrl, endpoint);
  assert.equal(
    urls.httpUrl,
    'https://demo.hype-mainnet.quiknode.pro/abc123/hypercore',
  );
});

test('deriveEndpointUrls supports host + token fallback', () => {
  const urls = deriveEndpointUrls('demo.hype-mainnet.quiknode.pro', 'abc123');

  assert.equal(
    urls.wsUrl,
    'wss://demo.hype-mainnet.quiknode.pro/abc123/hypercore/ws',
  );
  assert.equal(
    urls.httpUrl,
    'https://demo.hype-mainnet.quiknode.pro/abc123/hypercore',
  );
});

test('extractTokenFromEndpoint pulls token from full WSS endpoint', () => {
  const token = extractTokenFromEndpoint(
    'wss://demo.hype-mainnet.quiknode.pro/abc123/hypercore/ws',
  );

  assert.equal(token, 'abc123');
});

test('redactEndpointUrl masks token segment in Hypercore endpoint URL', () => {
  const redacted = redactEndpointUrl(
    'wss://demo.hype-mainnet.quiknode.pro/abc123/hypercore/ws',
  );

  assert.equal(
    redacted,
    'wss://demo.hype-mainnet.quiknode.pro/REDACTED/hypercore/ws',
  );
});

test('redactSensitiveText masks URLs, token query params, and explicit token values', () => {
  const source =
    'Connecting wss://demo.hype-mainnet.quiknode.pro/abc123/hypercore/ws?token=abc123 with token abc123';
  const redacted = redactSensitiveText(source, { token: 'abc123' });

  assert.equal(redacted.includes('abc123'), false);
  assert.equal(redacted.includes('REDACTED'), true);
  assert.match(redacted, /token=REDACTED/);
});

test('sanitizeEndpointForStorage removes token path from full WSS endpoint', () => {
  const sanitized = sanitizeEndpointForStorage(
    'wss://demo.hype-mainnet.quiknode.pro/abc123/hypercore/ws',
  );

  assert.equal(sanitized, 'wss://demo.hype-mainnet.quiknode.pro');
});

test('sanitizeEndpointForStorage keeps host-only endpoint unchanged', () => {
  const sanitized = sanitizeEndpointForStorage('demo.hype-mainnet.quiknode.pro');
  assert.equal(sanitized, 'demo.hype-mainnet.quiknode.pro');
});
