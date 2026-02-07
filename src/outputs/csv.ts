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
};

export class CsvWriter implements OutputWriter {
  private dataset: DatasetName | null = null;

  async init(context: WriterInitContext): Promise<void> {
    this.dataset = context.dataset;
    process.stdout.write(`${toCsvLine(HEADERS[context.dataset])}\n`);
  }

  async write(event: NormalizedEvent): Promise<void> {
    if (!this.dataset) {
      throw new Error('CSV writer not initialized');
    }

    switch (event.stream) {
      case 'orders':
        process.stdout.write(
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
        process.stdout.write(
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
        process.stdout.write(
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
        process.stdout.write(
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
        process.stdout.write(
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
    }
  }

  async flush(): Promise<void> {
    return Promise.resolve();
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }
}
