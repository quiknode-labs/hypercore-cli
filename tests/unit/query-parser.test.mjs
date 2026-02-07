import test from 'node:test';
import assert from 'node:assert/strict';

import { parseExportCommand } from '../../dist/src/commands/query.js';

test('parseExportCommand parses unquoted file path', () => {
  const parsed = parseExportCommand(
    '.export csv out.csv SELECT coin, COUNT(*) as c FROM trades GROUP BY coin',
  );

  assert.equal(parsed.format, 'csv');
  assert.equal(parsed.filePath, 'out.csv');
  assert.equal(parsed.query, 'SELECT coin, COUNT(*) as c FROM trades GROUP BY coin');
});

test('parseExportCommand parses quoted file path with spaces', () => {
  const parsed = parseExportCommand(
    '.export json "reports/daily trades.json" SELECT * FROM trades LIMIT 5',
  );

  assert.equal(parsed.format, 'json');
  assert.equal(parsed.filePath, 'reports/daily trades.json');
  assert.equal(parsed.query, 'SELECT * FROM trades LIMIT 5');
});

test('parseExportCommand rejects missing query', () => {
  assert.throws(
    () => parseExportCommand('.export csv out.csv'),
    /Missing SQL <query>/,
  );
});

test('parseExportCommand rejects invalid format', () => {
  assert.throws(
    () => parseExportCommand('.export tsv out.tsv SELECT 1'),
    /Expected csv or json/,
  );
});

test('parseExportCommand rejects unterminated quoted path', () => {
  assert.throws(
    () => parseExportCommand('.export csv "out file.csv SELECT 1'),
    /Unterminated quoted token/,
  );
});
