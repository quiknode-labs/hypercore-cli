import { Command } from 'commander';

import { JsonRpcClient } from '../api/jsonrpc';
import { resolveCredentials } from '../config/credentials';
import { runBackfillRange } from '../core/backfill-runner';
import { getDatasetNames, isDatasetName } from '../datasets/registry';
import { getNormalizer } from '../datasets/types';
import { createEventFilter } from '../filters/event-filter';
import { buildFilters, summarizeFilters } from '../filters/filter-builder';
import { createWriter } from '../outputs';
import type { DatasetName, OutputFormat } from '../types/common';
import { createLogger } from '../utils/logger';
import { promptAdapter } from '../utils/prompt';
import { resolveProgressMode } from '../utils/progress';
import { generateOutputPath } from '../utils/output-path';
import { deriveEndpointUrls, QUICKNODE_WSS_EXAMPLE, redactSensitiveText } from '../utils/url';

const DATASETS = getDatasetNames();
const OUTPUT_FORMATS: OutputFormat[] = ['console', 'json', 'csv', 'sqlite'];
const DEFAULT_BATCH_SIZE = 100;

interface BackfillOptions {
  dataset?: string;
  from?: string;
  to?: string;
  batchSize?: string;
  tokens?: string;
  users?: string;
  statuses?: string;
  output?: string;
  path?: string;
  limit?: string;
  progress?: string;
  endpoint?: string;
  token?: string;
  filter?: string[];
  quiet?: boolean;
  stdout?: boolean;
}

export function registerBackfillCommand(program: Command): void {
  program
    .command('backfill')
    .description('Fetch historical HyperCore blocks via JSON-RPC and emit normalized events')
    .option('-d, --dataset <dataset>', `Dataset: ${DATASETS.join(', ')}`)
    .requiredOption('--from <block>', 'Start block (inclusive)')
    .requiredOption('--to <block>', 'End block (inclusive)')
    .option('--batch-size <n>', 'JSON-RPC batch size (1-200, default: 100)', String(DEFAULT_BATCH_SIZE))
    .option('-t, --tokens <tokens>', 'Comma-separated coin filter (e.g. BTC,ETH)')
    .option('-u, --users <users>', 'Comma-separated user address filter (e.g. 0xabc,0xdef)')
    .option('-s, --statuses <statuses>', 'Comma-separated order status filter (orders only, e.g. open,filled)')
    .option('-o, --output <output>', 'Output format: console, json, csv, sqlite', 'console')
    .option('--path <path>', 'Override auto-generated output file path (csv, json, sqlite)')
    .option('-l, --limit <n>', 'Stop after N emitted events (0=unlimited)', '0')
    .option('-q, --quiet', 'Suppress status logs', false)
    .option('--progress <mode>', 'Progress log mode: text, json', 'text')
    .option(
      '--endpoint <endpoint>',
      `Quicknode endpoint override (host or full WSS URL, e.g. ${QUICKNODE_WSS_EXAMPLE})`,
    )
    .option('--token <token>', 'Quicknode token override')
    .option('--stdout', 'Write csv/json output to stdout instead of file', false)
    .option('--filter <kv>', 'Additional filter in key=v1,v2 format', collectRepeated, [])
    .action(async (options: BackfillOptions) => {
      await backfillAction(options);
    });
}

function collectRepeated(value: string, previous: string[]): string[] {
  return [...previous, value];
}

async function backfillAction(options: BackfillOptions): Promise<void> {
  const dataset = await resolveDataset(options.dataset);
  const fromBlock = parseBlockNumber(options.from, '--from');
  const toBlock = parseBlockNumber(options.to, '--to');
  const batchSize = parseBatchSize(options.batchSize);
  const output = resolveOutput(options.output);
  const limit = resolveLimit(options.limit);
  const progressMode = resolveProgressMode(options.progress);
  const startedAt = Date.now();

  if (toBlock < fromBlock) {
    throw new Error(`--to (${toBlock}) must be greater than or equal to --from (${fromBlock})`);
  }
  if (output === 'sqlite' && options.stdout) {
    throw new Error('--stdout is not supported with --output sqlite (SQLite must write to a file)');
  }

  const credentials = await resolveCredentials({
    endpointFlag: options.endpoint,
    tokenFlag: options.token,
    promptOnMissing: true,
    prompt: promptAdapter,
  });

  const redact = (message: string): string =>
    redactSensitiveText(message, { token: credentials.token });
  const logger = createLogger({
    quiet: options.quiet === true,
    mode: progressMode,
    context: {
      command: 'backfill',
      dataset,
      output,
      fromBlock,
      toBlock,
      batchSize,
    },
    redact,
  });
  const urls = deriveEndpointUrls(credentials.endpoint, credentials.token);

  const filters = buildFilters({
    dataset,
    tokens: options.tokens,
    users: options.users,
    statuses: options.statuses,
    rawFilters: options.filter,
  });
  const matchesEvent = createEventFilter(filters);

  let filePath: string | undefined;
  if (options.path) {
    filePath = options.path;
  } else if (!options.stdout && (output === 'csv' || output === 'json' || output === 'sqlite')) {
    filePath = generateOutputPath('backfill', dataset, output, options.tokens);
  }
  const limitLabel = limit > 0 ? String(limit) : 'unlimited';
  logger.info(
    `Backfilling '${dataset}' blocks ${fromBlock}-${toBlock} via ${urls.httpUrl} (batch=${batchSize}, output=${output}${filePath ? ` -> ${filePath}` : ''}, limit=${limitLabel}, ${summarizeFilters(filters)})`,
  );

  const writer = createWriter({
    format: output,
    dataset,
    filePath,
  });
  await writer.init({ dataset });

  const client = new JsonRpcClient(urls.httpUrl);
  try {
    const result = await runBackfillRange({
      dataset,
      fromBlock,
      toBlock,
      batchSize,
      limit,
      normalize: getNormalizer(dataset),
      fetchBatchBlocks: async (from, to) => client.fetchBatchBlocks(dataset, from, to),
      onEvent: async (event) => writer.write(event),
      matchesEvent,
      log: (message) => logger.info(message),
    });

    const runtimeSeconds = Math.max((Date.now() - startedAt) / 1000, 0.001);
    const avgEps = result.emittedCount / runtimeSeconds;
    logger.info(
      `Backfill done: emitted=${result.emittedCount}, seen=${result.seenEvents}, fetched_blocks=${result.fetchedBlocks}, batches=${result.batches}, runtime_s=${runtimeSeconds.toFixed(3)}, eps_avg=${avgEps.toFixed(2)}`,
    );
  } finally {
    await writer.flush();
    await writer.close();
    if (filePath) {
      logger.info(`Output written to: ${filePath}`);
    }
  }
}

async function resolveDataset(input?: string): Promise<DatasetName> {
  if (input) {
    if (!isDatasetName(input)) {
      throw new Error(`Invalid --dataset '${input}'. Expected one of: ${DATASETS.join(', ')}`);
    }
    return input;
  }

  const answer = await promptAdapter.ask(`Dataset (${DATASETS.join('|')}): `);
  if (!isDatasetName(answer)) {
    throw new Error(`Invalid dataset '${answer}'`);
  }
  return answer;
}

function resolveOutput(input?: string): OutputFormat {
  const value = input ?? 'console';
  if (!OUTPUT_FORMATS.includes(value as OutputFormat)) {
    throw new Error(`Invalid --output '${value}'. Expected one of: ${OUTPUT_FORMATS.join(', ')}`);
  }
  return value as OutputFormat;
}

function resolveLimit(input?: string): number {
  if (!input) {
    return 0;
  }
  const parsed = Number.parseInt(input, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid --limit '${input}'. Must be >= 0.`);
  }
  return parsed;
}

function parseBatchSize(input?: string): number {
  const raw = input ?? String(DEFAULT_BATCH_SIZE);
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 200) {
    throw new Error(`Invalid --batch-size '${raw}'. Must be an integer between 1 and 200.`);
  }
  return parsed;
}

function parseBlockNumber(input: string | undefined, flagName: '--from' | '--to'): number {
  if (!input) {
    throw new Error(`${flagName} is required`);
  }
  const parsed = Number.parseInt(input, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid ${flagName} '${input}'. Must be >= 0.`);
  }
  return parsed;
}
