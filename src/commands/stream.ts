import { Command } from 'commander';

import { resolveCredentials } from '../config/credentials';
import { getDatasetNames, isDatasetName } from '../datasets/registry';
import { getNormalizer } from '../datasets/types';
import { buildFilters } from '../filters/filter-builder';
import { runStreamRuntime } from '../core/stream-runtime';
import { createWriter } from '../outputs';
import type { DatasetName, OutputFormat } from '../types/common';
import { createLogger } from '../utils/logger';
import { promptAdapter } from '../utils/prompt';
import { resolveProgressMode } from '../utils/progress';
import { deriveEndpointUrls, QUICKNODE_WSS_EXAMPLE, redactSensitiveText } from '../utils/url';

const DATASETS = getDatasetNames();
const OUTPUT_FORMATS: OutputFormat[] = ['console', 'json', 'csv', 'sqlite'];

interface StreamOptions {
  dataset?: string;
  tokens?: string;
  users?: string;
  statuses?: string;
  output?: string;
  db?: string;
  limit?: string;
  quiet?: boolean;
  progress?: string;
  endpoint?: string;
  token?: string;
  filter?: string[];
}

export function registerStreamCommand(program: Command): void {
  program
    .command('stream')
    .description('Stream HyperCore datasets')
    .option('-d, --dataset <dataset>', `Dataset: ${DATASETS.join(', ')}`)
    .option('-t, --tokens <tokens>', 'Coin filter CSV (e.g. BTC,ETH)')
    .option('-u, --users <users>', 'User address filter CSV')
    .option('-s, --statuses <statuses>', 'Order status filter CSV (orders only)')
    .option('-o, --output <output>', 'Output format: console, json, csv, sqlite', 'console')
    .option('--db <path>', 'SQLite DB path (required when --output sqlite)')
    .option('-l, --limit <n>', 'Stop after N emitted events (0=unlimited)', '0')
    .option('-q, --quiet', 'Suppress status logs', false)
    .option('--progress <mode>', 'Progress log mode: text, json', 'text')
    .option(
      '--endpoint <endpoint>',
      `Quicknode endpoint override (host or full WSS URL, e.g. ${QUICKNODE_WSS_EXAMPLE})`,
    )
    .option('--token <token>', 'Quicknode token override')
    .option('--filter <kv>', 'Additional filter in key=v1,v2 format', collectRepeated, [])
    .action(async (options: StreamOptions) => {
      await streamAction(options);
    });
}

function collectRepeated(value: string, previous: string[]): string[] {
  return [...previous, value];
}

async function streamAction(options: StreamOptions): Promise<void> {
  const dataset = await resolveDataset(options.dataset);
  const output = resolveOutput(options.output);
  const limit = resolveLimit(options.limit);
  const progressMode = resolveProgressMode(options.progress);
  const startedAt = Date.now();
  let emittedCount = 0;

  if (output === 'sqlite' && !options.db) {
    throw new Error('--db is required when --output sqlite');
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
      command: 'stream',
      dataset,
      output,
    },
    redact,
  });

  const urls = deriveEndpointUrls(credentials.endpoint, credentials.token);
  logger.info(`Connecting to ${urls.wsUrl}`);

  const filters = buildFilters({
    dataset,
    tokens: options.tokens,
    users: options.users,
    statuses: options.statuses,
    rawFilters: options.filter,
  });

  const writer = createWriter({
    format: output,
    dataset,
    dbPath: options.db,
  });
  await writer.init({ dataset });

  try {
    await runStreamRuntime({
      dataset,
      wsUrl: urls.wsUrl,
      httpUrl: urls.httpUrl,
      filters,
      normalize: getNormalizer(dataset),
      onEvent: async (event) => {
        await writer.write(event);
        emittedCount += 1;
      },
      limit,
      log: (message) => logger.info(message),
      warn: (message) => logger.warn(message),
    });
  } finally {
    await writer.flush();
    await writer.close();
    const runtimeSeconds = Math.max((Date.now() - startedAt) / 1000, 0.001);
    const avgEps = emittedCount / runtimeSeconds;
    logger.info(
      `Stream done: emitted=${emittedCount}, runtime_s=${runtimeSeconds.toFixed(3)}, eps_avg=${avgEps.toFixed(2)}`,
    );
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
