import type { DatasetName } from '../types/common';
import type { NormalizedEvent, RawStreamBlock, StreamProcessorBlockFetcher } from '../types/stream';

interface StreamProcessorOptions {
  dataset: DatasetName;
  blockFetcher: StreamProcessorBlockFetcher;
  normalize: (block: RawStreamBlock) => NormalizedEvent[];
  emit: (event: NormalizedEvent) => Promise<void>;
  log: (message: string) => void;
  warn: (message: string) => void;
  dedupeRetainBlocks?: number;
}

const DEFAULT_DEDUPE_RETAIN_BLOCKS = 2_000;

export class StreamProcessor {
  private readonly dataset: DatasetName;
  private readonly blockFetcher: StreamProcessorBlockFetcher;
  private readonly normalize: (block: RawStreamBlock) => NormalizedEvent[];
  private readonly emit: (event: NormalizedEvent) => Promise<void>;
  private readonly log: (message: string) => void;
  private readonly warn: (message: string) => void;
  private readonly dedupeRetainBlocks: number;

  private readonly emittedKeys = new Set<string>();
  private readonly keysByBlock = new Map<number, string[]>();
  private lastBlock: number | null = null;
  private needsGapCheck = false;

  constructor(options: StreamProcessorOptions) {
    this.dataset = options.dataset;
    this.blockFetcher = options.blockFetcher;
    this.normalize = options.normalize;
    this.emit = options.emit;
    this.log = options.log;
    this.warn = options.warn;
    const retain = options.dedupeRetainBlocks ?? DEFAULT_DEDUPE_RETAIN_BLOCKS;
    this.dedupeRetainBlocks = Math.max(1, Math.floor(retain));
  }

  markReconnected(): void {
    this.needsGapCheck = true;
  }

  async ingestLiveBlock(block: RawStreamBlock): Promise<void> {
    if (this.needsGapCheck && this.lastBlock !== null) {
      this.needsGapCheck = false;
      const expected = this.lastBlock + 1;
      if (block.blockNumber > expected) {
        this.log(`Backfilling missing blocks ${expected}-${block.blockNumber - 1}`);
        await this.backfillRange(expected, block.blockNumber - 1);
      }
    }

    await this.processBlock(block);
  }

  private async backfillRange(from: number, to: number): Promise<void> {
    let cursor = from;
    const BATCH_SIZE = 100;

    while (cursor <= to) {
      const end = Math.min(to, cursor + BATCH_SIZE - 1);
      const blocks = await this.blockFetcher.fetchBatchBlocks(this.dataset, cursor, end);
      for (const block of blocks) {
        await this.processBlock(block);
      }
      cursor = end + 1;
    }
  }

  private async processBlock(block: RawStreamBlock): Promise<void> {
    const events = this.normalize(block);
    const blockKeys = this.keysByBlock.get(block.blockNumber) ?? [];

    for (const event of events) {
      if (this.emittedKeys.has(event.eventKey)) {
        continue;
      }
      this.emittedKeys.add(event.eventKey);
      blockKeys.push(event.eventKey);
      await this.emit(event);
    }
    this.keysByBlock.set(block.blockNumber, blockKeys);

    if (events.length === 0 && block.events.length > 0) {
      this.warn(`Block ${block.blockNumber} had no parseable ${this.dataset} records`);
    }

    if (this.lastBlock === null || block.blockNumber > this.lastBlock) {
      this.lastBlock = block.blockNumber;
      this.pruneOldDedupKeys();
    }
  }

  private pruneOldDedupKeys(): void {
    if (this.lastBlock === null) {
      return;
    }
    const cutoffBlock = this.lastBlock - this.dedupeRetainBlocks;

    while (true) {
      const oldest = this.keysByBlock.entries().next();
      if (oldest.done) {
        return;
      }

      const [blockNumber, keys] = oldest.value;
      if (blockNumber >= cutoffBlock) {
        return;
      }

      for (const key of keys) {
        this.emittedKeys.delete(key);
      }
      this.keysByBlock.delete(blockNumber);
    }
  }
}
