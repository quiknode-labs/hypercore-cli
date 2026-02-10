import { Command } from 'commander';

import { GrpcStreamClient } from '../api/grpc-client';
import { resolveCredentials } from '../config/credentials';
import { getDatasetDefinition, getDatasetNames, isDatasetName } from '../datasets/registry';
import { getNormalizer } from '../datasets/types';
import { buildFilters, summarizeFilters } from '../filters/filter-builder';
import { runStreamRuntime } from '../core/stream-runtime';
import { WsClient } from '../core/ws-client';
import type { DatasetName, ProgressMode } from '../types/common';
import type { NormalizedEvent, RawStreamBlock } from '../types/stream';
import type { TransportType } from '../types/transport';
import { stdoutColors, formatNumber } from '../utils/ansi';
import { isInteractive, selectPrompt } from '../utils/interactive';
import { createLogger } from '../utils/logger';
import { promptAdapter } from '../utils/prompt';
import { resolveProgressMode } from '../utils/progress';
import { QUICKNODE_WSS_EXAMPLE, redactSensitiveText } from '../utils/url';
import { createConnection } from '../x402/connection';
import { captureX402UsageBaseline, logX402UsageSummary, startPeriodicCreditCheck } from '../x402/usage';

const DATASETS = getDatasetNames();

interface StatsOptions {
  dataset?: string;
  tokens?: string;
  users?: string;
  statuses?: string;
  endpoint?: string;
  token?: string;
  filter?: string[];
  interval?: string;
  limit?: string;
  quiet?: boolean;
  progress?: string;
  transport?: string;
  mode?: string;
  walletKey?: string;
  x402Url?: string;
}

interface StatsSnapshot {
  total: number;
  runtimeSeconds: number;
  eventsPerSecondAvg: number;
  eventsPerSecondInterval: number;
  eventsPerSecondPeak: number;
  lastEventSecondsAgo: number;
  primary: Array<{ key: string; count: number }>;
  coin: Array<{ key: string; count: number }>;
  blockRange: { min: number; max: number } | null;
  avgBlockIntervalMs: number | null;
  dataKeys: Array<{ key: string; count: number }>;
  arrayFieldItems: Array<{ key: string; count: number }>;
  totalDataBytes: number;
  avgDataBytes: number;
}

class LiveStats {
  readonly dataset: DatasetName;
  readonly startedAt = Date.now();
  private lastEventAt = Date.now();
  private total = 0;
  private coin = new Map<string, number>();
  private primary = new Map<string, number>();
  private lastSnapshotTime = Date.now();
  private lastSnapshotTotal = 0;
  private peakEventsPerSecond = 0;
  private blockMin = Number.MAX_SAFE_INTEGER;
  private blockMax = 0;
  private dataKeys = new Map<string, number>();
  private arrayFieldItems = new Map<string, number>();
  private totalDataBytes = 0;
  private firstBlockTime = 0;
  private lastBlockTime = 0;
  private blockTimeCount = 0;

  constructor(dataset: DatasetName) {
    this.dataset = dataset;
  }

  ingest(event: NormalizedEvent): void {
    this.total += 1;
    this.lastEventAt = Date.now();

    switch (event.stream) {
      case 'orders':
        increment(this.coin, event.coin);
        increment(this.primary, event.status);
        return;
      case 'trades':
        increment(this.coin, event.coin);
        increment(this.primary, event.side);
        return;
      case 'events':
        increment(this.primary, event.eventType);
        return;
      case 'book_updates':
        increment(this.coin, event.coin);
        increment(this.primary, event.diffType);
        return;
      case 'twap':
        increment(this.coin, event.coin);
        increment(this.primary, event.status);
        return;
      case 'writer_actions':
        increment(this.primary, event.actionType);
        if (event.token) {
          increment(this.coin, event.token);
        }
        return;
      case 'blocks': {
        if (event.blockNumber < this.blockMin) this.blockMin = event.blockNumber;
        if (event.blockNumber > this.blockMax) this.blockMax = event.blockNumber;
        this.totalDataBytes += Buffer.byteLength(event.dataJson, 'utf8');
        const bt = Date.parse(event.blockTime);
        if (!Number.isNaN(bt)) {
          if (this.blockTimeCount === 0) this.firstBlockTime = bt;
          this.lastBlockTime = bt;
          this.blockTimeCount += 1;
        }
        try {
          const parsed = JSON.parse(event.dataJson);
          if (parsed && typeof parsed === 'object') {
            for (const [key, value] of Object.entries(parsed)) {
              increment(this.dataKeys, key);
              if (Array.isArray(value)) {
                this.arrayFieldItems.set(key, (this.arrayFieldItems.get(key) ?? 0) + value.length);
              }
            }
          }
        } catch {
          // skip unparseable data
        }
        return;
      }
    }
  }

  snapshot(): StatsSnapshot {
    const now = Date.now();
    const runtimeSeconds = Math.max((now - this.startedAt) / 1000, 0.001);
    const avg = this.total / runtimeSeconds;

    const intervalSeconds = Math.max((now - this.lastSnapshotTime) / 1000, 0.001);
    const delta = this.total - this.lastSnapshotTotal;
    const intervalEps = delta / intervalSeconds;
    this.peakEventsPerSecond = Math.max(this.peakEventsPerSecond, intervalEps);

    this.lastSnapshotTime = now;
    this.lastSnapshotTotal = this.total;

    return {
      total: this.total,
      runtimeSeconds,
      eventsPerSecondAvg: avg,
      eventsPerSecondInterval: intervalEps,
      eventsPerSecondPeak: this.peakEventsPerSecond,
      lastEventSecondsAgo: Math.max((now - this.lastEventAt) / 1000, 0),
      primary: topEntries(this.primary),
      coin: topEntries(this.coin),
      blockRange: this.blockMin <= this.blockMax ? { min: this.blockMin, max: this.blockMax } : null,
      avgBlockIntervalMs: this.blockTimeCount >= 2
        ? (this.lastBlockTime - this.firstBlockTime) / (this.blockTimeCount - 1)
        : null,
      dataKeys: topEntries(this.dataKeys),
      arrayFieldItems: topEntries(this.arrayFieldItems),
      totalDataBytes: this.totalDataBytes,
      avgDataBytes: this.total > 0 ? Math.round(this.totalDataBytes / this.total) : 0,
    };
  }
}

export function registerStatsCommand(program: Command): void {
  program
    .command('stats')
    .description('Stream live statistics for a dataset')
    .option('-d, --dataset <dataset>', `Dataset: ${DATASETS.join(', ')}`)
    .option('-t, --tokens <tokens>', 'Coin filter (single or comma-separated, e.g. BTC or BTC,ETH)')
    .option('-u, --users <users>', 'User address filter (single or comma-separated, e.g. 0x123 or 0x123,0x456)')
    .option(
      '-s, --statuses <statuses>',
      'Order status filter (orders only, single or comma-separated, e.g. open or open,filled)',
    )
    .option('--interval <seconds>', 'Snapshot print interval in seconds', '5')
    .option('-l, --limit <n>', 'Stop after N emitted events (0=unlimited)', '0')
    .option('-q, --quiet', 'Suppress status logs', false)
    .option('--progress <mode>', 'Progress output mode: text, json', 'text')
    .option(
      '--endpoint <endpoint>',
      `Quicknode endpoint override (host or full WSS URL, e.g. ${QUICKNODE_WSS_EXAMPLE})`,
    )
    .option('--token <token>', 'Quicknode token override')
    .option('--mode <mode>', 'Connection mode: quicknode, x402')
    .option('--wallet-key <key>', 'Wallet private key for x402 payments')
    .option('--x402-url <url>', 'x402 proxy base URL override')
    .option('--filter <kv>', 'Additional filter in key=v1,v2 format', collectRepeated, [])
    .option('--transport <type>', 'Transport protocol: wss (default), grpc', 'wss')
    .action(async (options: StatsOptions) => {
      await statsAction(options);
    });
}

function collectRepeated(value: string, previous: string[]): string[] {
  return [...previous, value];
}

async function statsAction(options: StatsOptions): Promise<void> {
  const credentials = await resolveCredentials({
    endpointFlag: options.endpoint,
    tokenFlag: options.token,
    modeFlag: options.mode,
    walletKeyFlag: options.walletKey,
    x402BaseUrlFlag: options.x402Url,
    promptOnMissing: true,
    prompt: promptAdapter,
  });

  const dataset = await resolveDataset(options.dataset);
  const definition = getDatasetDefinition(dataset);
  let transport = await resolveTransportInteractive(options.transport, dataset, credentials.mode);
  const limit = resolveLimit(options.limit);
  const intervalSeconds = resolveIntervalSeconds(options.interval);
  const progressMode = resolveProgressMode(options.progress);

  // x402 mode does not support gRPC or gRPC-only datasets (blocks)
  if (credentials.mode === 'x402') {
    if (definition.grpcOnly) {
      throw new Error(
        `The '${dataset}' dataset requires gRPC transport which is not yet supported in x402 mode. ` +
        'Use a Quicknode endpoint instead, or choose a different dataset.',
      );
    }
    if (transport === 'grpc') {
      throw new Error(
        'gRPC transport is not yet supported in x402 mode (requires HTTP/2). ' +
        'Use --transport wss or a Quicknode endpoint instead.',
      );
    }
  }

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
      command: 'stats',
      dataset,
      intervalSeconds,
    },
    redact,
  });

  const conn = await createConnection(credentials, logger);
  const creditUsageBaseline = await captureX402UsageBaseline(conn, logger);

  const filters = buildFilters({
    dataset,
    tokens: options.tokens,
    users: options.users,
    statuses: options.statuses,
    rawFilters: options.filter,
  });
  const limitLabel = limit > 0 ? String(limit) : 'unlimited';
  const transportLabel = transport;
  const connectUrl = transport === 'grpc' ? conn.grpcUrl : conn.wsUrl;
  logger.info(`Connecting to ${connectUrl} (transport=${transportLabel}, dataset=${dataset}, limit=${limitLabel}, ${summarizeFilters(filters)})`);

  const stats = new LiveStats(dataset);
  const timer = setInterval(() => {
    writeSnapshot(stats, progressMode);
  }, intervalSeconds * 1000);

  type TransportOpts = { onBlock: (block: RawStreamBlock) => Promise<void>; onInfo: (message: string) => void };
  let createTransport: (opts: TransportOpts) => import('../types/transport').StreamTransport | Promise<import('../types/transport').StreamTransport>;

  if (transport === 'grpc') {
    createTransport = (opts: TransportOpts) =>
      new GrpcStreamClient({ grpcUrl: conn.grpcUrl, token: conn.token!, dataset, filters, ...opts });
  } else {
    createTransport = async (opts: TransportOpts) => {
      const currentWsUrl = conn.refreshWsUrl ? await conn.refreshWsUrl() : conn.wsUrl;
      return new WsClient({ url: currentWsUrl, dataset, filters, ...opts });
    };
  }

  const creditChecker = startPeriodicCreditCheck(conn, logger);
  try {
    await runStreamRuntime({
      dataset,
      createTransport,
      httpUrl: conn.httpUrl,
      filters,
      normalize: getNormalizer(dataset),
      onEvent: async (event) => {
        stats.ingest(event);
      },
      limit,
      log: (message) => logger.info(message),
      warn: (message) => logger.warn(message),
      idleLogIntervalMs: 15_000,
      httpFetchFn: conn.fetchFn,
      ensureCredits: conn.ensureCredits,
    });
  } finally {
    creditChecker?.stop();
    clearInterval(timer);
    const finalSnapshot = writeSnapshot(stats, progressMode);
    logger.info(
      `Stats complete: ${formatNumber(finalSnapshot.total)} events in ${finalSnapshot.runtimeSeconds.toFixed(3)}s (${finalSnapshot.eventsPerSecondAvg.toFixed(2)} eps)`,
    );
    await logX402UsageSummary(conn, creditUsageBaseline, logger);
    conn.cleanup?.();
  }
}

function writeSnapshot(stats: LiveStats, mode: ProgressMode): StatsSnapshot {
  const snapshot = stats.snapshot();
  if (mode === 'json') {
    process.stdout.write(
      `${JSON.stringify({
        type: 'stats_snapshot',
        timestamp: new Date().toISOString(),
        dataset: stats.dataset,
        ...snapshot,
      })}\n`,
    );
    return snapshot;
  }

  process.stdout.write(`${renderSnapshotText(stats, snapshot)}\n`);
  return snapshot;
}

function renderSnapshotText(stats: LiveStats, snapshot: StatsSnapshot): string {
  const sc = stdoutColors;
  const runtime = formatDuration(snapshot.runtimeSeconds);

  const lines = [
    `${sc.bold(`Stats (${stats.dataset})`)}`,
    `Runtime: ${runtime} | Total: ${formatNumber(snapshot.total)} | Last event: ${snapshot.lastEventSecondsAgo.toFixed(1)}s ago`,
    `Events/sec avg=${snapshot.eventsPerSecondAvg.toFixed(2)} interval=${snapshot.eventsPerSecondInterval.toFixed(2)} peak=${snapshot.eventsPerSecondPeak.toFixed(2)}`,
  ];

  if (stats.dataset === 'blocks') {
    lines.push('---');
    if (snapshot.blockRange) {
      lines.push(`Block range: ${formatNumber(snapshot.blockRange.min)} - ${formatNumber(snapshot.blockRange.max)} (${formatNumber(snapshot.blockRange.max - snapshot.blockRange.min + 1)} blocks)`);
    } else {
      lines.push('Block range: (no data yet)');
    }
    if (snapshot.avgBlockIntervalMs !== null) {
      const intervalSec = snapshot.avgBlockIntervalMs / 1000;
      lines.push(`Avg block interval: ${intervalSec.toFixed(2)}s`);
    }
    lines.push(`Avg payload size: ${formatBytes(snapshot.avgDataBytes)}`);
    if (snapshot.arrayFieldItems.length > 0) {
      lines.push('---', 'Array items (total):');
      for (const entry of snapshot.arrayFieldItems) {
        const avg = snapshot.total > 0 ? (entry.count / snapshot.total).toFixed(1) : '0';
        lines.push(`- ${entry.key}: ${formatNumber(entry.count)} (${avg}/block)`);
      }
    }
    if (snapshot.dataKeys.length > 0) {
      lines.push('---', 'By data key:', ...renderCounts(snapshot.dataKeys));
    }
  } else {
    const primaryLabel = primaryBucketLabel(stats.dataset);
    const secondaryLabel = secondaryBucketLabel(stats.dataset);
    lines.push('---', `${primaryLabel}:`, ...renderCounts(snapshot.primary));
    if (snapshot.coin.length > 0 && secondaryLabel) {
      lines.push('---', secondaryLabel, ...renderCounts(snapshot.coin));
    }
  }

  return `${lines.join('\n')}\n`;
}

function secondaryBucketLabel(dataset: DatasetName): string | null {
  switch (dataset) {
    case 'orders':
    case 'trades':
    case 'book_updates':
    case 'twap':
      return 'By coin:';
    case 'writer_actions':
      return 'By token:';
    case 'events':
    case 'blocks':
      return null;
  }
}

function renderCounts(items: Array<{ key: string; count: number }>): string[] {
  if (items.length === 0) {
    return ['- (no data yet)'];
  }
  return items.map((item) => `- ${item.key}: ${formatNumber(item.count)}`);
}

function resolveIntervalSeconds(input?: string): number {
  const value = input ?? '5';
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid --interval '${value}'. Must be > 0.`);
  }
  return parsed;
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

function increment(counter: Map<string, number>, key: string): void {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

function topEntries(counter: Map<string, number>, limit = 6): Array<{ key: string; count: number }> {
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function primaryBucketLabel(dataset: DatasetName): string {
  switch (dataset) {
    case 'orders':
      return 'By status';
    case 'trades':
      return 'By side';
    case 'events':
      return 'By event type';
    case 'book_updates':
      return 'By diff type';
    case 'twap':
      return 'By status';
    case 'writer_actions':
      return 'By action type';
    case 'blocks':
      return 'By block';
  }
}

const VALID_TRANSPORTS: TransportType[] = ['wss', 'grpc'];

async function resolveTransportInteractive(input: string | undefined, dataset: DatasetName, mode?: string): Promise<TransportType> {
  const definition = getDatasetDefinition(dataset);
  const isX402 = mode === 'x402';

  // x402 mode only supports WSS
  if (isX402) {
    return 'wss';
  }

  // Explicit flag always wins
  if (input && input !== 'wss') {
    const value = input as TransportType;
    if (!VALID_TRANSPORTS.includes(value)) {
      throw new Error(`Invalid --transport '${input}'. Expected one of: ${VALID_TRANSPORTS.join(', ')}`);
    }
    return value;
  }

  // gRPC-only datasets auto-select grpc
  if (definition.grpcOnly) {
    return 'grpc';
  }

  // Interactive mode: prompt for transport
  if (isInteractive() && (!input || input === 'wss')) {
    return selectPrompt<TransportType>({
      message: 'Transport',
      options: [
        { value: 'wss', label: 'WSS', description: 'WebSocket (default)' },
        { value: 'grpc', label: 'gRPC', description: 'gRPC transport' },
      ],
    });
  }

  return (input ?? 'wss') as TransportType;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(secondsInput: number): string {
  const seconds = Math.max(0, Math.floor(secondsInput));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}
