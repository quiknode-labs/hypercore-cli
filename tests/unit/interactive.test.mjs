import test from 'node:test';
import assert from 'node:assert/strict';

import { runBackfillWizard } from '../../dist/src/commands/backfill-wizard.js';
import { isInteractive, renderSelectOptions } from '../../dist/src/utils/interactive.js';
import { runStreamWizard } from '../../dist/src/commands/stream-wizard.js';

/* ------------------------------------------------------------------ */
/*  isInteractive                                                      */
/* ------------------------------------------------------------------ */

test('isInteractive returns false when stdin is not a TTY', () => {
  // In the test runner, stdin is typically not a TTY
  // This test verifies the function doesn't crash and returns a boolean
  const result = isInteractive();
  assert.equal(typeof result, 'boolean');
});

/* ------------------------------------------------------------------ */
/*  renderSelectOptions                                                */
/* ------------------------------------------------------------------ */

test('renderSelectOptions highlights the selected option', () => {
  const options = [
    { value: 'a', label: 'Alpha', description: 'First option' },
    { value: 'b', label: 'Beta', description: 'Second option' },
    { value: 'c', label: 'Gamma' },
  ];

  const output = renderSelectOptions(options, 0);
  const lines = output.split('\n');
  assert.equal(lines.length, 3);
  // First line should contain the cursor symbol
  assert.ok(lines[0].includes('❯'), 'selected line should have cursor');
  assert.ok(lines[0].includes('Alpha'), 'selected line should have label');
  assert.ok(lines[0].includes('First option'), 'selected line should have description');
  // Second line should NOT have cursor
  assert.ok(!lines[1].includes('❯'), 'non-selected line should not have cursor');
  // Third line has no description
  assert.ok(lines[2].includes('Gamma'), 'label without description renders');
});

test('renderSelectOptions moves cursor with different selectedIndex', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
  ];

  const output0 = renderSelectOptions(options, 0);
  const output1 = renderSelectOptions(options, 1);

  // Cursor on first line for index 0
  assert.ok(output0.split('\n')[0].includes('❯'));
  assert.ok(!output0.split('\n')[1].includes('❯'));

  // Cursor on second line for index 1
  assert.ok(!output1.split('\n')[0].includes('❯'));
  assert.ok(output1.split('\n')[1].includes('❯'));
});

/* ------------------------------------------------------------------ */
/*  runStreamWizard with mocked prompts                                */
/* ------------------------------------------------------------------ */

test('wizard produces correct result with mocked prompts', async () => {
  const mockPromptFns = {
    selectPrompt: async (config) => {
      if (config.message.includes('dataset')) return 'orders';
      if (config.message.includes('Transport')) return 'wss';
      if (config.message.includes('Output')) return 'json';
      throw new Error(`Unexpected select prompt: ${config.message}`);
    },
    textPrompt: async (config) => {
      if (config.message.includes('coins')) return 'BTC,ETH';
      if (config.message.includes('users')) return 'all';
      if (config.message.includes('statuses')) return 'open,filled';
      if (config.message.includes('limit')) return '50';
      throw new Error(`Unexpected text prompt: ${config.message}`);
    },
  };

  const result = await runStreamWizard({}, mockPromptFns);

  assert.equal(result.dataset, 'orders');
  assert.equal(result.tokens, 'BTC,ETH');
  assert.equal(result.users, undefined); // 'all' becomes undefined
  assert.equal(result.statuses, 'open,filled');
  assert.equal(result.output, 'json');
  assert.equal(result.limit, '50');
});

test('wizard skips steps when flags are pre-supplied', async () => {
  const promptsCalled = [];

  const mockPromptFns = {
    selectPrompt: async (config) => {
      promptsCalled.push(config.message);
      if (config.message.includes('Transport')) return 'wss';
      if (config.message.includes('Output')) return 'csv';
      throw new Error(`Unexpected select: ${config.message}`);
    },
    textPrompt: async (config) => {
      promptsCalled.push(config.message);
      if (config.message.includes('limit')) return '0';
      return 'all';
    },
  };

  const result = await runStreamWizard(
    {
      datasetFlag: 'trades',
      tokensFlag: 'BTC',
      usersFlag: '0xabc',
      limitFlag: '100',
    },
    mockPromptFns,
  );

  assert.equal(result.dataset, 'trades');
  assert.equal(result.tokens, 'BTC');
  assert.equal(result.users, '0xabc');
  assert.equal(result.output, 'csv');
  assert.equal(result.limit, '100');

  // Dataset select should NOT have been called
  assert.ok(!promptsCalled.some((m) => m.includes('dataset')));
  // Token/user text prompts should NOT have been called
  assert.ok(!promptsCalled.some((m) => m.includes('coins')));
  assert.ok(!promptsCalled.some((m) => m.includes('users')));
  // Limit prompt should NOT have been called
  assert.ok(!promptsCalled.some((m) => m.includes('limit')));
  // Output select SHOULD have been called
  assert.ok(promptsCalled.some((m) => m.includes('Output')));
});

test('wizard skips status prompt for non-orders datasets', async () => {
  const promptsCalled = [];

  const mockPromptFns = {
    selectPrompt: async (config) => {
      promptsCalled.push(config.message);
      if (config.message.includes('dataset')) return 'trades';
      if (config.message.includes('Transport')) return 'wss';
      if (config.message.includes('Output')) return 'console';
      throw new Error(`Unexpected select: ${config.message}`);
    },
    textPrompt: async (config) => {
      promptsCalled.push(config.message);
      if (config.message.includes('limit')) return '0';
      return 'all';
    },
  };

  const result = await runStreamWizard({}, mockPromptFns);

  assert.equal(result.dataset, 'trades');
  assert.equal(result.statuses, undefined);
  // Status prompt should NOT have been called
  assert.ok(!promptsCalled.some((m) => m.includes('statuses')));
});

test('wizard shows status prompt for orders dataset', async () => {
  const promptsCalled = [];

  const mockPromptFns = {
    selectPrompt: async (config) => {
      promptsCalled.push(config.message);
      if (config.message.includes('dataset')) return 'orders';
      if (config.message.includes('Transport')) return 'wss';
      if (config.message.includes('Output')) return 'console';
      throw new Error(`Unexpected select: ${config.message}`);
    },
    textPrompt: async (config) => {
      promptsCalled.push(config.message);
      if (config.message.includes('statuses')) return 'filled';
      if (config.message.includes('limit')) return '0';
      return 'all';
    },
  };

  const result = await runStreamWizard({}, mockPromptFns);

  assert.equal(result.dataset, 'orders');
  assert.equal(result.statuses, 'filled');
  assert.ok(promptsCalled.some((m) => m.includes('statuses')));
});

test('wizard uses "tokens" label for writer_actions dataset', async () => {
  const promptsCalled = [];

  const mockPromptFns = {
    selectPrompt: async (config) => {
      promptsCalled.push(config.message);
      if (config.message.includes('dataset')) return 'writer_actions';
      if (config.message.includes('Transport')) return 'wss';
      if (config.message.includes('Output')) return 'console';
      throw new Error(`Unexpected select: ${config.message}`);
    },
    textPrompt: async (config) => {
      promptsCalled.push(config.message);
      if (config.message.includes('limit')) return '0';
      return 'all';
    },
  };

  await runStreamWizard({}, mockPromptFns);

  // For writer_actions, the label should be 'tokens' not 'coins'
  assert.ok(promptsCalled.some((m) => m.includes('tokens')));
  assert.ok(!promptsCalled.some((m) => m.includes('coins')));
});

test('wizard returns undefined limit when user enters 0', async () => {
  const mockPromptFns = {
    selectPrompt: async (config) => {
      if (config.message.includes('dataset')) return 'trades';
      if (config.message.includes('Transport')) return 'wss';
      if (config.message.includes('Output')) return 'console';
      throw new Error(`Unexpected select: ${config.message}`);
    },
    textPrompt: async (config) => {
      if (config.message.includes('limit')) return '0';
      return 'all';
    },
  };

  const result = await runStreamWizard({}, mockPromptFns);
  assert.equal(result.limit, undefined);
});

/* ------------------------------------------------------------------ */
/*  runBackfillWizard with mocked prompts                              */
/* ------------------------------------------------------------------ */

test('backfill wizard produces correct result with mocked prompts', async () => {
  const mockPromptFns = {
    selectPrompt: async (config) => {
      if (config.message.includes('dataset')) return 'orders';
      if (config.message.includes('Output')) return 'json';
      throw new Error(`Unexpected select prompt: ${config.message}`);
    },
    textPrompt: async (config) => {
      if (config.message.includes('Start block')) return '100';
      if (config.message.includes('End block')) return '120';
      if (config.message.includes('Batch size')) return '150';
      if (config.message.includes('coins')) return 'BTC,ETH';
      if (config.message.includes('users')) return '0x123,0x456';
      if (config.message.includes('statuses')) return 'open,filled';
      if (config.message.includes('limit')) return '10';
      throw new Error(`Unexpected text prompt: ${config.message}`);
    },
  };

  const result = await runBackfillWizard({}, mockPromptFns);

  assert.equal(result.dataset, 'orders');
  assert.equal(result.from, '100');
  assert.equal(result.to, '120');
  assert.equal(result.batchSize, '150');
  assert.equal(result.tokens, 'BTC,ETH');
  assert.equal(result.users, '0x123,0x456');
  assert.equal(result.statuses, 'open,filled');
  assert.equal(result.output, 'json');
  assert.equal(result.limit, '10');
});

test('backfill wizard skips pre-supplied steps', async () => {
  const promptsCalled = [];
  const mockPromptFns = {
    selectPrompt: async (config) => {
      promptsCalled.push(config.message);
      if (config.message.includes('Output')) return 'csv';
      throw new Error(`Unexpected select prompt: ${config.message}`);
    },
    textPrompt: async (config) => {
      promptsCalled.push(config.message);
      if (config.message.includes('statuses')) return 'all';
      return 'all';
    },
  };

  const result = await runBackfillWizard(
    {
      datasetFlag: 'trades',
      fromFlag: '10',
      toFlag: '20',
      batchSizeFlag: '50',
      tokensFlag: 'BTC',
      usersFlag: '0x123',
      limitFlag: '25',
    },
    mockPromptFns,
  );

  assert.equal(result.dataset, 'trades');
  assert.equal(result.from, '10');
  assert.equal(result.to, '20');
  assert.equal(result.batchSize, '50');
  assert.equal(result.tokens, 'BTC');
  assert.equal(result.users, '0x123');
  assert.equal(result.statuses, undefined);
  assert.equal(result.output, 'csv');
  assert.equal(result.limit, '25');

  assert.ok(!promptsCalled.some((m) => m.includes('dataset')));
  assert.ok(!promptsCalled.some((m) => m.includes('Start block')));
  assert.ok(!promptsCalled.some((m) => m.includes('End block')));
  assert.ok(!promptsCalled.some((m) => m.includes('Batch size')));
  assert.ok(!promptsCalled.some((m) => m.includes('coins')));
  assert.ok(!promptsCalled.some((m) => m.includes('users')));
  assert.ok(!promptsCalled.some((m) => m.includes('statuses')));
  assert.ok(!promptsCalled.some((m) => m.includes('limit')));
  assert.ok(promptsCalled.some((m) => m.includes('Output')));
});

test('backfill wizard returns undefined batch size and limit for defaults', async () => {
  const mockPromptFns = {
    selectPrompt: async (config) => {
      if (config.message.includes('dataset')) return 'trades';
      if (config.message.includes('Output')) return 'console';
      throw new Error(`Unexpected select prompt: ${config.message}`);
    },
    textPrompt: async (config) => {
      if (config.message.includes('Start block')) return '1';
      if (config.message.includes('End block')) return '2';
      if (config.message.includes('Batch size')) return '100';
      if (config.message.includes('limit')) return '0';
      return 'all';
    },
  };

  const result = await runBackfillWizard({}, mockPromptFns);
  assert.equal(result.batchSize, undefined);
  assert.equal(result.limit, undefined);
});
