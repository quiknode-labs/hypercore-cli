import { Command } from 'commander';

import { resolveCredentials } from '../config/credentials';
import { getDatasetNames, isDatasetName } from '../datasets/registry';
import { getNormalizer } from '../datasets/types';
import { buildFilters, summarizeFilters } from '../filters/filter-builder';
import { runStreamRuntime } from '../core/stream-runtime';
import { createWriter } from '../outputs';
import type { DatasetName, OutputFormat } from '../types/common';
import { isInteractive } from '../utils/interactive';
import { createLogger } from '../utils/logger';
import { promptAdapter } from '../utils/prompt';
import { resolveProgressMode } from '../utils/progress';
import { generateOutputPath } from '../utils/output-path';
import { QUICKNODE_WSS_EXAMPLE, redactSensitiveText } from '../utils/url';
import { createConnection } from '../x402/connection';
import { runStreamWizard } from './stream-wizard';

const DATASETS = getDatasetNames();
const OUTPUT_FORMATS: OutputFormat[] = ['console', 'json', 'csv', 'sqlite'];

interface StreamOptions {
  dataset?: string;
  tokens?: string;
  users?: string;
  statuses?: string;
  output?: string;
  path?: string;
  limit?: string;
  quiet?: boolean;
  progress?: string;
  endpoint?: string;
  token?: string;
  filter?: string[];
  stdout?: boolean;
  mode?: string;
  walletKey?: string;
  x402Url?: string;
}

export function registerStreamCommand(program: Command): void {
  program
    .command('stream')
    .description('Stream HyperCore datasets')
    .option('-d, --dataset <dataset>', `Dataset: ${DATASETS.join(', ')}`)
    .option('-t, --tokens <tokens>', 'Coin filter (single or comma-separated, e.g. BTC or BTC,ETH)')
    .option('-u, --users <users>', 'User address filter (single or comma-separated, e.g. 0x123 or 0x123,0x456)')
    .option(
      '-s, --statuses <statuses>',
      'Order status filter (orders only, single or comma-separated, e.g. open or open,filled)',
    )
    .option('-o, --output <output>', 'Output format: console (default), json, csv, sqlite')
    .option('--path <path>', 'Override auto-generated output file path (csv, json, sqlite)')
    .option('-l, --limit <n>', 'Stop after N emitted events (0=unlimited)', '0')
    .option('-q, --quiet', 'Suppress status logs', false)
    .option('--progress <mode>', 'Progress log mode: text, json', 'text')
    .option(
      '--endpoint <endpoint>',
      `Quicknode endpoint override (host or full WSS URL, e.g. ${QUICKNODE_WSS_EXAMPLE})`,
    )
    .option('--token <token>', 'Quicknode token override')
    .option('--mode <mode>', 'Connection mode: quicknode, x402')
    .option('--wallet-key <key>', 'Wallet private key for x402 payments')
    .option('--x402-url <url>', 'x402 proxy base URL override')
    .option('--stdout', 'Write csv/json output to stdout instead of file', false)
    .option('--filter <kv>', 'Additional filter in key=v1,v2 format', collectRepeated, [])
    .action(async (options: StreamOptions) => {
      await streamAction(options);
    });
}

function collectRepeated(value: string, previous: string[]): string[] {
  return [...previous, value];
}

async function streamAction(options: StreamOptions): Promise<void> {
  // Interactive wizard when running in a TTY with no dataset flag
  if (isInteractive() && !options.dataset) {
    const result = await runStreamWizard({
      datasetFlag: options.dataset,
      tokensFlag: options.tokens,
      usersFlag: options.users,
      statusesFlag: options.statuses,
      outputFlag: options.output,
      limitFlag: options.limit === '0' ? undefined : options.limit,
    });
    options.dataset = result.dataset;
    options.tokens = result.tokens ?? options.tokens;
    options.users = result.users ?? options.users;
    options.statuses = result.statuses ?? options.statuses;
    options.output = result.output;
    if (result.limit) {
      options.limit = result.limit;
    }
  }

  const dataset = await resolveDataset(options.dataset);
  const output = resolveOutput(options.output);
  const limit = resolveLimit(options.limit);
  const progressMode = resolveProgressMode(options.progress);
  const startedAt = Date.now();
  let emittedCount = 0;

  if (output === 'sqlite' && options.stdout) {
    throw new Error('--stdout is not supported with --output sqlite (SQLite must write to a file)');
  }

  const credentials = await resolveCredentials({
    endpointFlag: options.endpoint,
    tokenFlag: options.token,
    modeFlag: options.mode,
    walletKeyFlag: options.walletKey,
    x402BaseUrlFlag: options.x402Url,
    promptOnMissing: true,
    prompt: promptAdapter,
  });

  const redact = (message: string): string => {
    let result = redactSensitiveText(message, { token: credentials.token });
    if (credentials.walletKey) {
      result = result.replace(new RegExp(credentials.walletKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '****');
    }
    return result;
  };
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

  const conn = await createConnection(credentials, logger);

  const filters = buildFilters({
    dataset,
    tokens: options.tokens,
    users: options.users,
    statuses: options.statuses,
    rawFilters: options.filter,
  });
  const limitLabel = limit > 0 ? String(limit) : 'unlimited';
  let filePath: string | undefined;
  if (options.path) {
    filePath = options.path;
  } else if (!options.stdout && (output === 'csv' || output === 'json' || output === 'sqlite')) {
    filePath = generateOutputPath('stream', dataset, output, options.tokens);
  }
  logger.info(`Connecting to ${conn.wsUrl} (dataset=${dataset}, output=${output}${filePath ? ` -> ${filePath}` : ''}, limit=${limitLabel}, ${summarizeFilters(filters)})`);

  const writer = createWriter({
    format: output,
    dataset,
    filePath,
  });
  await writer.init({ dataset });

  try {
    await runStreamRuntime({
      dataset,
      wsUrl: conn.wsUrl,
      httpUrl: conn.httpUrl,
      filters,
      normalize: getNormalizer(dataset),
      onEvent: async (event) => {
        await writer.write(event);
        emittedCount += 1;
      },
      limit,
      log: (message) => logger.info(message),
      warn: (message) => logger.warn(message),
      httpFetchFn: conn.fetchFn,
      refreshWsUrl: conn.refreshWsUrl,
      ensureCredits: conn.ensureCredits,
    });
  } finally {
    await writer.flush();
    await writer.close();
    const runtimeSeconds = Math.max((Date.now() - startedAt) / 1000, 0.001);
    const avgEps = emittedCount / runtimeSeconds;
    logger.info(
      `Stream done: emitted=${emittedCount}, runtime_s=${runtimeSeconds.toFixed(3)}, eps_avg=${avgEps.toFixed(2)}`,
    );
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
