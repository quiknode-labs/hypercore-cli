import type { DatasetName } from '../types/common';
import type { NormalizedEvent, RawStreamBlock } from '../types/stream';
import { normalizeBlocksBlock } from './blocks';
import { normalizeBookUpdatesBlock } from './book-updates';
import { normalizeEventsBlock } from './events';
import { normalizeOrderBlock } from './orders';
import { normalizeTradeBlock } from './trades';
import { normalizeTwapBlock } from './twap';
import { normalizeWriterActionsBlock } from './writer-actions';

export type DatasetNormalizer = (block: RawStreamBlock) => NormalizedEvent[];

const NORMALIZERS: Record<DatasetName, DatasetNormalizer> = {
  orders: normalizeOrderBlock,
  trades: normalizeTradeBlock,
  events: normalizeEventsBlock,
  book_updates: normalizeBookUpdatesBlock,
  twap: normalizeTwapBlock,
  writer_actions: normalizeWriterActionsBlock,
  blocks: normalizeBlocksBlock,
};

export function getNormalizer(dataset: DatasetName): DatasetNormalizer {
  return NORMALIZERS[dataset];
}
