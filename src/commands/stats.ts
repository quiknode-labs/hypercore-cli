import { Command } from 'commander';

import { resolveCredentials } from '../config/credentials';
import { getDatasetNames, isDatasetName } from '../datasets/registry';
import { getNormalizer } from '../datasets/types';
import { buildFilters, summarizeFilters } from '../filters/filter-builder';
import { runStreamRuntime } from '../core/stream-runtime';
import type { DatasetName, ProgressMode } from '../types/common';
import type { NormalizedEvent } from '../types/stream';
import { createLogger } from '../utils/logger';
import { promptAdapter } from '../utils/prompt';
import { resolveProgressMode } from '../utils/progress';
import { deriveEndpointUrls, QUICKNODE_WSS_EXAMPLE, redactSensitiveText } from '../utils/url';

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
    };
  }
}

export function registerStatsCommand(program: Command): void {
  program
    .command('stats')
    .description('Stream live statistics for a dataset')
    .option('-d, --dataset <dataset>', `Dataset: ${DATASETS.join(', ')}`)
    .option('-t, --tokens <tokens>', 'Comma-separated coin filter (e.g. BTC,ETH)')
    .option('-u, --users <users>', 'Comma-separated user address filter (e.g. 0xabc,0xdef)')
    .option('-s, --statuses <statuses>', 'Comma-separated order status filter (orders only, e.g. open,filled)')
    .option('--interval <seconds>', 'Snapshot print interval in seconds', '5')
    .option('-l, --limit <n>', 'Stop after N emitted events (0=unlimited)', '0')
    .option('-q, --quiet', 'Suppress status logs', false)
    .option('--progress <mode>', 'Progress output mode: text, json', 'text')
    .option(
      '--endpoint <endpoint>',
      `Quicknode endpoint override (host or full WSS URL, e.g. ${QUICKNODE_WSS_EXAMPLE})`,
    )
    .option('--token <token>', 'Quicknode token override')
    .option('--filter <kv>', 'Additional filter in key=v1,v2 format', collectRepeated, [])
    .action(async (options: StatsOptions) => {
      await statsAction(options);
    });
}

function collectRepeated(value: string, previous: string[]): string[] {
  return [...previous, value];
}

async function statsAction(options: StatsOptions): Promise<void> {
  const dataset = await resolveDataset(options.dataset);
  const limit = resolveLimit(options.limit);
  const intervalSeconds = resolveIntervalSeconds(options.interval);
  const progressMode = resolveProgressMode(options.progress);

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
      command: 'stats',
      dataset,
      intervalSeconds,
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
  logger.info(`Connecting to ${urls.wsUrl} (dataset=${dataset}, limit=${limitLabel}, ${summarizeFilters(filters)})`);

  const stats = new LiveStats(dataset);
  const timer = setInterval(() => {
    writeSnapshot(stats, progressMode);
  }, intervalSeconds * 1000);

  try {
    await runStreamRuntime({
      dataset,
      wsUrl: urls.wsUrl,
      httpUrl: urls.httpUrl,
      filters,
      normalize: getNormalizer(dataset),
      onEvent: async (event) => {
        stats.ingest(event);
      },
      limit,
      log: (message) => logger.info(message),
      warn: (message) => logger.warn(message),
      idleLogIntervalMs: 15_000,
    });
  } finally {
    clearInterval(timer);
    const finalSnapshot = writeSnapshot(stats, progressMode);
    logger.info(
      `Stats done: total=${finalSnapshot.total}, runtime_s=${finalSnapshot.runtimeSeconds.toFixed(3)}, eps_avg=${finalSnapshot.eventsPerSecondAvg.toFixed(2)}`,
    );
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
  const runtime = formatDuration(snapshot.runtimeSeconds);
  const primaryLabel = primaryBucketLabel(stats.dataset);
  const secondaryLabel = secondaryBucketLabel(stats.dataset);

  const lines = [
    `Stats (${stats.dataset})`,
    `Runtime: ${runtime} | Total: ${snapshot.total} | Last event: ${snapshot.lastEventSecondsAgo.toFixed(1)}s ago`,
    `Events/sec avg=${snapshot.eventsPerSecondAvg.toFixed(2)} interval=${snapshot.eventsPerSecondInterval.toFixed(2)} peak=${snapshot.eventsPerSecondPeak.toFixed(2)}`,
    '',
    `${primaryLabel}:`,
    ...renderCounts(snapshot.primary),
  ];

  if (snapshot.coin.length > 0 && secondaryLabel) {
    lines.push('', secondaryLabel, ...renderCounts(snapshot.coin));
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
      return null;
  }
}

function renderCounts(items: Array<{ key: string; count: number }>): string[] {
  if (items.length === 0) {
    return ['- (no data yet)'];
  }
  return items.map((item) => `- ${item.key}: ${item.count}`);
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
  }
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
