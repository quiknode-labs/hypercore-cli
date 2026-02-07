import type { DatasetName } from '../types/common';
import type { NormalizedEvent, RawStreamBlock } from '../types/stream';

export interface BackfillRunnerOptions {
  dataset: DatasetName;
  fromBlock: number;
  toBlock: number;
  batchSize: number;
  limit: number;
  normalize: (block: RawStreamBlock) => NormalizedEvent[];
  fetchBatchBlocks: (from: number, to: number) => Promise<RawStreamBlock[]>;
  onEvent: (event: NormalizedEvent) => Promise<void>;
  matchesEvent?: (event: NormalizedEvent) => boolean;
  log?: (message: string) => void;
}

export interface BackfillRunnerResult {
  requestedFrom: number;
  requestedTo: number;
  batches: number;
  fetchedBlocks: number;
  seenEvents: number;
  emittedCount: number;
}

export async function runBackfillRange(
  options: BackfillRunnerOptions,
): Promise<BackfillRunnerResult> {
  const result: BackfillRunnerResult = {
    requestedFrom: options.fromBlock,
    requestedTo: options.toBlock,
    batches: 0,
    fetchedBlocks: 0,
    seenEvents: 0,
    emittedCount: 0,
  };

  let cursor = options.fromBlock;
  while (cursor <= options.toBlock) {
    const end = Math.min(options.toBlock, cursor + options.batchSize - 1);
    options.log?.(
      `Backfill request ${options.dataset} blocks ${cursor}-${end} (${result.emittedCount} emitted so far)`,
    );

    const blocks = await options.fetchBatchBlocks(cursor, end);
    result.batches += 1;
    result.fetchedBlocks += blocks.length;

    for (const block of blocks) {
      const events = options.normalize(block);
      result.seenEvents += events.length;

      for (const event of events) {
        if (options.matchesEvent && !options.matchesEvent(event)) {
          continue;
        }

        await options.onEvent(event);
        result.emittedCount += 1;

        if (options.limit > 0 && result.emittedCount >= options.limit) {
          options.log?.(`Reached --limit ${options.limit}, stopping backfill early`);
          return result;
        }
      }
    }

    cursor = end + 1;
  }

  return result;
}
