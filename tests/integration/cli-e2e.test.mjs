import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const CLI_PATH = path.join(process.cwd(), 'dist/src/index.js');

/** Returns true if the error message indicates a better-sqlite3 native binding failure. */
function isSqliteBindingError(message) {
  return (
    message.includes('Could not locate the bindings file') ||
    message.includes('NODE_MODULE_VERSION') ||
    message.includes('ERR_DLOPEN_FAILED') ||
    message.includes('native module failed to load')
  );
}

function runCli(args, options = {}) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
  });

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

test('config --show redacts endpoint token path', async () => {
  const tempHome = await mkdtemp(path.join(os.tmpdir(), 'hypercore-cli-home-'));
  const configDir = path.join(tempHome, '.hypercore-cli');
  const configPath = path.join(configDir, 'config.json');

  try {
    await mkdir(configDir, { recursive: true });
    await writeFile(
      configPath,
      JSON.stringify(
        {
          endpoint: 'wss://demo.hype-mainnet.quiknode.pro/abc123/hypercore/ws',
        },
        null,
        2,
      ),
      'utf8',
    );

    const result = runCli(['config', '--show'], {
      env: {
        HOME: tempHome,
      },
    });

    assert.equal(result.status, 0);
    assert.match(
      result.stdout,
      /Endpoint: wss:\/\/\*{4}\.hype-mainnet\.quiknode\.pro\/\*{4}\/hypercore\/ws/,
    );
  } finally {
    await rm(tempHome, { recursive: true, force: true });
  }
});

test('query --sql returns table output for valid query', async (t) => {
  let sqlite = null;
  try {
    const imported = await import('better-sqlite3');
    sqlite = typeof imported === 'function' ? imported : imported.default;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isSqliteBindingError(message)) {
      t.skip('better-sqlite3 native binding unavailable for current Node runtime');
    } else {
      t.skip('better-sqlite3 not available in this runtime');
    }
    return;
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hypercore-cli-e2e-'));
  const dbPath = path.join(tempDir, 'e2e.db');

  try {
    let db;
    try {
      db = new sqlite(dbPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isSqliteBindingError(message)) {
        t.skip('better-sqlite3 native binding unavailable for current Node runtime');
        return;
      }
      throw error;
    }
    db.exec(`
      CREATE TABLE trades (coin TEXT NOT NULL);
      INSERT INTO trades (coin) VALUES ('BTC');
      INSERT INTO trades (coin) VALUES ('BTC');
      INSERT INTO trades (coin) VALUES ('ETH');
    `);
    db.close();

    const result = runCli([
      'query',
      '--db',
      dbPath,
      '--sql',
      'SELECT coin, COUNT(*) AS c FROM trades GROUP BY coin ORDER BY c DESC',
    ]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Connected to/);
    assert.match(result.stdout, /BTC/);
    assert.match(result.stdout, /ETH/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('query --sql exits non-zero for invalid SQL', async (t) => {
  let sqlite = null;
  try {
    const imported = await import('better-sqlite3');
    sqlite = typeof imported === 'function' ? imported : imported.default;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isSqliteBindingError(message)) {
      t.skip('better-sqlite3 native binding unavailable for current Node runtime');
    } else {
      t.skip('better-sqlite3 not available in this runtime');
    }
    return;
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hypercore-cli-e2e-'));
  const dbPath = path.join(tempDir, 'e2e-invalid.db');

  try {
    let db;
    try {
      db = new sqlite(dbPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isSqliteBindingError(message)) {
        t.skip('better-sqlite3 native binding unavailable for current Node runtime');
        return;
      }
      throw error;
    }
    db.exec('CREATE TABLE trades (coin TEXT NOT NULL);');
    db.close();

    const result = runCli([
      'query',
      '--db',
      dbPath,
      '--sql',
      'SELECT * FROM missing_table',
    ]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Error:/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('stream rejects invalid --progress before credential resolution', () => {
  const result = runCli([
    'stream',
    '--dataset',
    'orders',
    '--progress',
    'yaml',
    '--limit',
    '1',
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid --progress/);
});

test('backfill rejects invalid --progress before network calls', () => {
  const result = runCli([
    'backfill',
    '--dataset',
    'trades',
    '--from',
    '1',
    '--to',
    '2',
    '--progress',
    'yaml',
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid --progress/);
});

test('stream rejects --stdout with --output sqlite', () => {
  const result = runCli([
    'stream',
    '--dataset',
    'orders',
    '--output',
    'sqlite',
    '--stdout',
    '--limit',
    '1',
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--stdout is not supported with --output sqlite/);
});
