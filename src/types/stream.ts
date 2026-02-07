import type { DatasetName } from './common';

export interface RawStreamBlock {
  stream: DatasetName;
  blockNumber: number;
  blockTime: string;
  localTime: string;
  events: unknown[];
}

export interface StreamEnvelopeBase {
  eventKey: string;
  stream: DatasetName;
  blockNumber: number;
  blockTime: string;
  localTime: string;
  eventIndex: number;
  rawJson: string;
}

export interface NormalizedOrderEvent extends StreamEnvelopeBase {
  stream: 'orders';
  user: string;
  status: string;
  coin: string;
  side: string;
  limitPx: string | null;
  size: string | null;
  origSize: string | null;
  orderType: string | null;
  tif: string | null;
  oid: number | null;
  txHash: string | null;
  cloid: string | null;
  reduceOnly: boolean | null;
  isTrigger: boolean | null;
  triggerPx: string | null;
  builderAddress: string | null;
  builderFeeBps: number | null;
  eventTime: string | null;
}

export interface NormalizedTradeEvent extends StreamEnvelopeBase {
  stream: 'trades';
  user: string;
  coin: string;
  side: string;
  price: string;
  size: string;
  oid: number | null;
  tid: number | null;
  txHash: string | null;
  fee: string | null;
  feeToken: string | null;
  twapId: number | null;
  builderAddress: string | null;
  builderFee: string | null;
  crossed: boolean | null;
  direction: string | null;
  eventTimeMs: number | null;
}

export interface NormalizedSystemEvent extends StreamEnvelopeBase {
  stream: 'events';
  eventType: string;
  deltaType: string | null;
  txHash: string | null;
  users: string[];
  eventTime: string | null;
}

export interface NormalizedBookUpdateEvent extends StreamEnvelopeBase {
  stream: 'book_updates';
  user: string | null;
  oid: number | null;
  coin: string;
  side: string;
  price: string;
  diffType: 'new' | 'remove' | 'unknown';
  size: string | null;
}

export interface NormalizedTwapEvent extends StreamEnvelopeBase {
  stream: 'twap';
  twapId: number;
  status: string;
  coin: string;
  user: string;
  side: string;
  size: string;
  executedSize: string | null;
  executedNotional: string | null;
  minutes: number | null;
  reduceOnly: boolean | null;
  randomize: boolean | null;
  stateTimestamp: number | null;
  eventTime: string | null;
}

export type NormalizedEvent =
  | NormalizedOrderEvent
  | NormalizedTradeEvent
  | NormalizedSystemEvent
  | NormalizedBookUpdateEvent
  | NormalizedTwapEvent;

export interface StreamProcessorBlockFetcher {
  fetchBatchBlocks(stream: DatasetName, from: number, to: number): Promise<RawStreamBlock[]>;
}
