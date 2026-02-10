import test from 'node:test';
import assert from 'node:assert/strict';

import { createColorizer, formatNumber } from '../../dist/src/utils/ansi.js';

/* ------------------------------------------------------------------ */
/*  createColorizer — NO_COLOR                                         */
/* ------------------------------------------------------------------ */

test('createColorizer returns identity functions when NO_COLOR is set', () => {
  const original = process.env.NO_COLOR;
  try {
    process.env.NO_COLOR = '1';
    // Fake a TTY stream
    const fakeStream = { isTTY: true };
    const c = createColorizer(fakeStream);

    assert.equal(c.cyan('hello'), 'hello');
    assert.equal(c.green('hello'), 'hello');
    assert.equal(c.red('hello'), 'hello');
    assert.equal(c.yellow('hello'), 'hello');
    assert.equal(c.bold('hello'), 'hello');
    assert.equal(c.reset, '');
  } finally {
    if (original === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = original;
    }
  }
});

/* ------------------------------------------------------------------ */
/*  createColorizer — non-TTY                                          */
/* ------------------------------------------------------------------ */

test('createColorizer returns identity functions for non-TTY streams', () => {
  const original = process.env.NO_COLOR;
  try {
    delete process.env.NO_COLOR;
    const fakeStream = { isTTY: false };
    const c = createColorizer(fakeStream);

    assert.equal(c.cyan('hello'), 'hello');
    assert.equal(c.green('hello'), 'hello');
    assert.equal(c.red('hello'), 'hello');
    assert.equal(c.yellow('hello'), 'hello');
    assert.equal(c.bold('hello'), 'hello');
    assert.equal(c.reset, '');
  } finally {
    if (original === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = original;
    }
  }
});

/* ------------------------------------------------------------------ */
/*  createColorizer — TTY with colors enabled                          */
/* ------------------------------------------------------------------ */

test('createColorizer wraps text with ANSI codes on TTY without NO_COLOR', () => {
  const original = process.env.NO_COLOR;
  try {
    delete process.env.NO_COLOR;
    const fakeStream = { isTTY: true };
    const c = createColorizer(fakeStream);

    assert.ok(c.cyan('test').includes('\x1b[36m'));
    assert.ok(c.green('test').includes('\x1b[32m'));
    assert.ok(c.red('test').includes('\x1b[31m'));
    assert.ok(c.yellow('test').includes('\x1b[33m'));
    assert.ok(c.bold('test').includes('\x1b[1m'));
    assert.ok(c.reset.includes('\x1b[0m'));
  } finally {
    if (original === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = original;
    }
  }
});

/* ------------------------------------------------------------------ */
/*  createColorizer — terminal control always active                   */
/* ------------------------------------------------------------------ */

test('terminal control sequences are always present regardless of color mode', () => {
  const original = process.env.NO_COLOR;
  try {
    process.env.NO_COLOR = '1';
    const fakeStream = { isTTY: false };
    const c = createColorizer(fakeStream);

    assert.equal(c.clearLine, '\x1b[2K');
    assert.equal(c.cursorUp(3), '\x1b[3A');
    assert.equal(c.cursorUp(0), '');
    assert.equal(c.cursorToCol0, '\r');
    assert.equal(c.hideCursor, '\x1b[?25l');
    assert.equal(c.showCursor, '\x1b[?25h');
  } finally {
    if (original === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = original;
    }
  }
});

/* ------------------------------------------------------------------ */
/*  formatNumber                                                       */
/* ------------------------------------------------------------------ */

test('formatNumber adds comma separators for large numbers', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(999), '999');
  assert.equal(formatNumber(1000), '1,000');
  assert.equal(formatNumber(1234567), '1,234,567');
  assert.equal(formatNumber(100), '100');
});

test('formatNumber floors decimal values', () => {
  assert.equal(formatNumber(1234.56), '1,234');
  assert.equal(formatNumber(999.99), '999');
});
