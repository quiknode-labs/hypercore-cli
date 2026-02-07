import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveCredentials } from '../../dist/src/config/credentials.js';

test('resolveCredentials prefers flags over env and saved', async () => {
  const result = await resolveCredentials({
    endpointFlag: 'flag-endpoint',
    tokenFlag: 'flag-token',
    env: {
      QUICKNODE_ENDPOINT: 'env-endpoint',
      QUICKNODE_TOKEN: 'env-token',
    },
    readSavedConfigFn: async () => ({ endpoint: 'saved-endpoint' }),
    getSavedTokenFn: async () => 'saved-token',
    promptOnMissing: false,
  });

  assert.equal(result.endpointSource, 'flag');
  assert.equal(result.tokenSource, 'flag');
  assert.equal(result.endpoint, 'flag-endpoint');
  assert.equal(result.token, 'flag-token');
});

test('resolveCredentials uses env when flags are absent', async () => {
  const result = await resolveCredentials({
    env: {
      QUICKNODE_ENDPOINT: 'env-endpoint',
      QUICKNODE_TOKEN: 'env-token',
    },
    readSavedConfigFn: async () => ({ endpoint: 'saved-endpoint' }),
    getSavedTokenFn: async () => 'saved-token',
    promptOnMissing: false,
  });

  assert.equal(result.endpointSource, 'env');
  assert.equal(result.tokenSource, 'env');
});

test('resolveCredentials uses saved values when env is absent', async () => {
  const result = await resolveCredentials({
    env: {},
    readSavedConfigFn: async () => ({ endpoint: 'saved-endpoint' }),
    getSavedTokenFn: async () => 'saved-token',
    promptOnMissing: false,
  });

  assert.equal(result.endpointSource, 'saved');
  assert.equal(result.tokenSource, 'saved');
  assert.equal(result.endpoint, 'saved-endpoint');
  assert.equal(result.token, 'saved-token');
});

test('resolveCredentials extracts token from full WSS endpoint when token is not provided', async () => {
  const result = await resolveCredentials({
    endpointFlag: 'wss://demo.hype-mainnet.quiknode.pro/abc123/hypercore/ws',
    env: {},
    readSavedConfigFn: async () => ({ endpoint: undefined }),
    getSavedTokenFn: async () => null,
    promptOnMissing: false,
  });

  assert.equal(result.endpointSource, 'flag');
  assert.equal(result.tokenSource, 'endpoint');
  assert.equal(result.token, 'abc123');
});

test('resolveCredentials prefers endpoint token over non-explicit saved token', async () => {
  const result = await resolveCredentials({
    endpointFlag: 'wss://demo.hype-mainnet.quiknode.pro/abc123/hypercore/ws',
    env: {},
    readSavedConfigFn: async () => ({ endpoint: undefined }),
    getSavedTokenFn: async () => 'saved-token',
    promptOnMissing: false,
  });

  assert.equal(result.tokenSource, 'endpoint');
  assert.equal(result.token, 'abc123');
});
