import { createWriteStream, type WriteStream } from 'node:fs';

import type { DatasetName } from '../types/common';
import type { NormalizedEvent } from '../types/stream';
import { toCsvLine } from '../utils/csv';
import type { OutputWriter, WriterInitContext } from './types';

const HEADERS: Record<DatasetName, string[]> = {
  orders: [
    'event_key',
    'block_number',
    'block_time',
    'local_time',
    'user',
    'status',
    'coin',
    'side',
    'limit_px',
    'size',
    'orig_size',
    'order_type',
    'tif',
    'oid',
    'tx_hash',
    'cloid',
  ],
  trades: [
    'event_key',
    'block_number',
    'block_time',
    'local_time',
    'user',
    'coin',
    'side',
    'price',
    'size',
    'oid',
    'tid',
    'tx_hash',
    'fee',
    'fee_token',
    'twap_id',
  ],
  events: [
    'event_key',
    'block_number',
    'block_time',
    'local_time',
    'event_type',
    'delta_type',
    'tx_hash',
    'users',
  ],
  book_updates: [
    'event_key',
    'block_number',
    'block_time',
    'local_time',
    'user',
    'oid',
    'coin',
    'side',
    'price',
    'diff_type',
    'size',
  ],
  twap: [
    'event_key',
    'block_number',
    'block_time',
    'local_time',
    'twap_id',
    'status',
    'coin',
    'user',
    'side',
    'size',
    'executed_size',
    'executed_notional',
    'minutes',
    'reduce_only',
    'randomize',
    'state_timestamp',
    'event_time',
  ],
  writer_actions: [
    'event_key',
    'block_number',
    'block_time',
    'local_time',
    'user',
    'nonce',
    'evm_tx_hash',
    'action_type',
    'destination',
    'token',
    'wei',
    'event_time',
  ],
};

export class CsvWriter implements OutputWriter {
  private readonly filePath: string | undefined;
  private dataset: DatasetName | null = null;
  private out: NodeJS.WritableStream = process.stdout;
  private fileStream: WriteStream | null = null;

  constructor(filePath?: string) {
    this.filePath = filePath;
  }

  async init(context: WriterInitContext): Promise<void> {
    this.dataset = context.dataset;
    if (this.filePath) {
      this.fileStream = createWriteStream(this.filePath, { flags: 'w', encoding: 'utf8' });
      this.out = this.fileStream;
    }
    this.out.write(`${toCsvLine(HEADERS[context.dataset])}\n`);
  }

  async write(event: NormalizedEvent): Promise<void> {
    if (!this.dataset) {
      throw new Error('CSV writer not initialized');
    }

    switch (event.stream) {
      case 'orders':
        this.out.write(
          `${toCsvLine([
            event.eventKey,
            event.blockNumber,
            event.blockTime,
            event.localTime,
            event.user,
            event.status,
            event.coin,
            event.side,
            event.limitPx,
            event.size,
            event.origSize,
            event.orderType,
            event.tif,
            event.oid,
            event.txHash,
            event.cloid,
          ])}\n`,
        );
        return;
      case 'trades':
        this.out.write(
          `${toCsvLine([
            event.eventKey,
            event.blockNumber,
            event.blockTime,
            event.localTime,
            event.user,
            event.coin,
            event.side,
            event.price,
            event.size,
            event.oid,
            event.tid,
            event.txHash,
            event.fee,
            event.feeToken,
            event.twapId,
          ])}\n`,
        );
        return;
      case 'events':
        this.out.write(
          `${toCsvLine([
            event.eventKey,
            event.blockNumber,
            event.blockTime,
            event.localTime,
            event.eventType,
            event.deltaType,
            event.txHash,
            event.users.join(';'),
          ])}\n`,
        );
        return;
      case 'book_updates':
        this.out.write(
          `${toCsvLine([
            event.eventKey,
            event.blockNumber,
            event.blockTime,
            event.localTime,
            event.user,
            event.oid,
            event.coin,
            event.side,
            event.price,
            event.diffType,
            event.size,
          ])}\n`,
        );
        return;
      case 'twap':
        this.out.write(
          `${toCsvLine([
            event.eventKey,
            event.blockNumber,
            event.blockTime,
            event.localTime,
            event.twapId,
            event.status,
            event.coin,
            event.user,
            event.side,
            event.size,
            event.executedSize,
            event.executedNotional,
            event.minutes,
            event.reduceOnly,
            event.randomize,
            event.stateTimestamp,
            event.eventTime,
          ])}\n`,
        );
        return;
      case 'writer_actions':
        this.out.write(
          `${toCsvLine([
            event.eventKey,
            event.blockNumber,
            event.blockTime,
            event.localTime,
            event.user,
            event.nonce,
            event.evmTxHash,
            event.actionType,
            event.destination,
            event.token,
            event.wei,
            event.eventTime,
          ])}\n`,
        );
        return;
    }
  }

  async flush(): Promise<void> {
    return Promise.resolve();
  }

  async close(): Promise<void> {
    if (this.fileStream) {
      await new Promise<void>((resolve, reject) => {
        this.fileStream!.end(() => resolve());
        this.fileStream!.on('error', reject);
      });
      this.fileStream = null;
    }
  }
}
