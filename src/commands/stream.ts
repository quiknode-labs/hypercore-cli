import { Command } from 'commander';

import { GrpcStreamClient } from '../api/grpc-client';
import { resolveCredentials } from '../config/credentials';
import { getDatasetDefinition, getDatasetNames, isDatasetName } from '../datasets/registry';
import { getNormalizer } from '../datasets/types';
import { buildFilters, summarizeFilters } from '../filters/filter-builder';
import { runStreamRuntime } from '../core/stream-runtime';
import { WsClient } from '../core/ws-client';
import { createWriter } from '../outputs';
import type { DatasetName, OutputFormat } from '../types/common';
import type { TransportType } from '../types/transport';
import { stderrColors as c, formatNumber } from '../utils/ansi';
import { isInteractive } from '../utils/interactive';
import { createLogger } from '../utils/logger';
import { promptAdapter } from '../utils/prompt';
import { resolveProgressMode } from '../utils/progress';
import { generateOutputPath } from '../utils/output-path';
import { deriveEndpointUrls, QUICKNODE_WSS_EXAMPLE, redactSensitiveText } from '../utils/url';
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
  transport?: string;
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
    .option('--stdout', 'Write csv/json output to stdout instead of file', false)
    .option('--filter <kv>', 'Additional filter in key=v1,v2 format', collectRepeated, [])
    .option('--transport <type>', 'Transport protocol: wss (default), grpc', 'wss')
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
      transportFlag: options.transport === 'wss' ? undefined : options.transport,
      tokensFlag: options.tokens,
      usersFlag: options.users,
      statusesFlag: options.statuses,
      outputFlag: options.output,
      limitFlag: options.limit === '0' ? undefined : options.limit,
    });
    options.dataset = result.dataset;
    options.transport = result.transport;
    options.tokens = result.tokens ?? options.tokens;
    options.users = result.users ?? options.users;
    options.statuses = result.statuses ?? options.statuses;
    options.output = result.output;
    if (result.limit) {
      options.limit = result.limit;
    }
  }

  const dataset = await resolveDataset(options.dataset);
  const definition = getDatasetDefinition(dataset);
  const transport = definition.grpcOnly ? 'grpc' as TransportType : resolveTransport(options.transport);
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
  const connectUrl = transport === 'grpc' ? urls.grpcUrl : urls.wsUrl;
  const filterSummary = summarizeFilters(filters);
  const bannerLines = [
    `${c.bold('Stream')}`,
    `  dataset    ${c.cyan(dataset)}`,
    `  transport  ${c.cyan(transport)}`,
    `  output     ${c.cyan(output)}${filePath ? ` -> ${filePath}` : ''}`,
    `  limit      ${c.cyan(limitLabel)}`,
    `  filters    ${c.cyan(filterSummary)}`,
    `  connecting ${connectUrl}`,
  ];
  for (const line of bannerLines) {
    logger.info(line);
  }

  const writer = createWriter({
    format: output,
    dataset,
    filePath,
  });
  await writer.init({ dataset });

  const createTransport = transport === 'grpc'
    ? (opts: { onBlock: (block: import('../types/stream').RawStreamBlock) => Promise<void>; onInfo: (message: string) => void }) =>
        new GrpcStreamClient({ grpcUrl: urls.grpcUrl, token: credentials.token, dataset, filters, ...opts })
    : (opts: { onBlock: (block: import('../types/stream').RawStreamBlock) => Promise<void>; onInfo: (message: string) => void }) =>
        new WsClient({ url: urls.wsUrl, dataset, filters, ...opts });

  try {
    await runStreamRuntime({
      dataset,
      createTransport,
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
      `Stream complete: ${formatNumber(emittedCount)} events in ${runtimeSeconds.toFixed(3)}s (${avgEps.toFixed(2)} eps)`,
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

const VALID_TRANSPORTS: TransportType[] = ['wss', 'grpc'];

function resolveTransport(input?: string): TransportType {
  const value = (input ?? 'wss') as TransportType;
  if (!VALID_TRANSPORTS.includes(value)) {
    throw new Error(`Invalid --transport '${input}'. Expected one of: ${VALID_TRANSPORTS.join(', ')}`);
  }
  return value;
}
