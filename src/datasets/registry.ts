import type { DatasetName } from '../types/common';

export interface DatasetDefinition {
  name: DatasetName;
  displayName: string;
  description: string;
  docsUrl: string;
  volume: 'Low' | 'Medium' | 'High' | 'Very High';
  wsStreamType: string;
  wsAliases: string[];
  backfillStream: string;
  grpcOnly?: boolean;
  keyFields: string[];
  sampleEvent: unknown;
}

const DEFINITIONS: Record<DatasetName, DatasetDefinition> = {
  orders: {
    name: 'orders',
    displayName: 'Orders',
    description: 'Order lifecycle events',
    docsUrl: 'https://www.quicknode.com/docs/hyperliquid/datasets/orders',
    volume: 'Very High',
    wsStreamType: 'orders',
    wsAliases: ['orders', 'hl.orders'],
    backfillStream: 'orders',
    keyFields: ['status', 'coin', 'side', 'limitPx', 'sz', 'origSz', 'oid'],
    sampleEvent: {
      time: '2026-02-06T12:00:00.000000000',
      user: '0x1111222233334444555566667777888899990000',
      hash: '0xaaaabbbbccccddddeeeeffff1111222233334444555566667777888899990000',
      status: 'filled',
      order: {
        coin: 'BTC',
        side: 'B',
        limitPx: '102500.0',
        sz: '0.0',
        origSz: '0.12',
        orderType: 'Limit',
        tif: 'Gtc',
        oid: 295452566826,
      },
    },
  },
  trades: {
    name: 'trades',
    displayName: 'Trades',
    description: 'Executed fills with price and size',
    docsUrl: 'https://www.quicknode.com/docs/hyperliquid/datasets/trades',
    volume: 'High',
    wsStreamType: 'trades',
    wsAliases: ['trades', 'hl.trades'],
    backfillStream: 'trades',
    keyFields: ['coin', 'side', 'px', 'sz', 'oid', 'tid', 'twapId'],
    sampleEvent: [
      '0x1111222233334444555566667777888899990000',
      {
        coin: 'ETH',
        px: '3201.55',
        sz: '1.25',
        side: 'A',
        time: 1767351660123,
        hash: '0xbbbbccccddddeeeeffff1111222233334444555566667777888899990000aaaa',
        oid: 298001,
        tid: 8831202,
        fee: '0.91',
        feeToken: 'USDC',
        twapId: null,
      },
    ],
  },
  events: {
    name: 'events',
    displayName: 'Events',
    description: 'System events and balance updates',
    docsUrl: 'https://www.quicknode.com/docs/hyperliquid/datasets/events',
    volume: 'Medium',
    wsStreamType: 'events',
    wsAliases: ['events', 'hl.events'],
    backfillStream: 'events',
    keyFields: ['inner', 'users', 'delta.type', 'hash'],
    sampleEvent: {
      time: '2026-02-06T12:00:00.000000000',
      hash: '0xccccddddeeeeffff1111222233334444555566667777888899990000aaaabbbb',
      inner: {
        LedgerUpdate: {
          users: ['0x1111222233334444555566667777888899990000'],
          delta: {
            type: 'deposit',
          },
        },
      },
    },
  },
  book_updates: {
    name: 'book_updates',
    displayName: 'Book Updates',
    description: 'Level 2 order book updates',
    docsUrl: 'https://www.quicknode.com/docs/hyperliquid/datasets/book-updates',
    volume: 'Very High',
    wsStreamType: 'book_updates',
    wsAliases: ['book_updates', 'book', 'hl.book_updates', 'hl.book'],
    backfillStream: 'book',
    keyFields: ['coin', 'side', 'px', 'oid', 'raw_book_diff'],
    sampleEvent: {
      user: '0x1c1c270b573d55b68b3d14722b5d5d401511bed0',
      oid: 258166296856,
      coin: 'ETH',
      side: 'B',
      px: '3167.4',
      raw_book_diff: {
        new: {
          sz: '1.5785',
        },
      },
    },
  },
  twap: {
    name: 'twap',
    displayName: 'TWAP',
    description: 'TWAP order status updates',
    docsUrl: 'https://www.quicknode.com/docs/hyperliquid/datasets/twap',
    volume: 'Low',
    wsStreamType: 'twap',
    wsAliases: ['twap', 'hl.twap'],
    backfillStream: 'twap',
    keyFields: ['twap_id', 'status', 'state.coin', 'state.user', 'state.side'],
    sampleEvent: {
      time: '2026-02-06T12:00:00.000000000',
      twap_id: 1430699,
      status: 'activated',
      state: {
        coin: 'HYPE',
        user: '0x9d6a5ab97a8eed617bde9968d9ab6fcf72fde1b8',
        side: 'A',
        sz: '108.36',
        executedSz: '0.0',
        executedNtl: '0.0',
        minutes: 10,
        reduceOnly: false,
        randomize: false,
        timestamp: 1764867622417,
      },
    },
  },
  writer_actions: {
    name: 'writer_actions',
    displayName: 'Writer Actions',
    description: 'System writer actions and bridge operations',
    docsUrl: 'https://www.quicknode.com/docs/hyperliquid/datasets/writer-actions',
    volume: 'Low',
    wsStreamType: 'writer_actions',
    wsAliases: ['writer_actions', 'hl.writer_actions'],
    backfillStream: 'writer_actions',
    keyFields: [
      'user',
      'nonce',
      'evm_tx_hash',
      'action.type',
      'action.destination',
      'action.token',
      'action.wei',
    ],
    sampleEvent: {
      time: '2026-02-06T12:00:00.000000000',
      user: '0x2001222233334444555566667777888899990000',
      nonce: 8123,
      evm_tx_hash: '0xddddeeeeffff1111222233334444555566667777888899990000aaaabbbbcccc',
      action: {
        type: 'SystemSpotSendAction',
        destination: '0x9999222233334444555566667777888899990000',
        token: 124,
        wei: '250000000000000000',
      },
    },
  },
  blocks: {
    name: 'blocks',
    displayName: 'Blocks',
    description: 'Raw block data (gRPC only)',
    docsUrl: 'https://www.quicknode.com/docs/hyperliquid/datasets/blocks',
    volume: 'Very High',
    wsStreamType: '',
    wsAliases: [],
    backfillStream: '',
    grpcOnly: true,
    keyFields: ['block_number'],
    sampleEvent: {
      block_number: 123456,
      timestamp: 1767351660123,
      data: '{}',
    },
  },
};

const ORDER: DatasetName[] = ['orders', 'trades', 'events', 'book_updates', 'twap', 'writer_actions', 'blocks'];

export function getDatasetNames(): DatasetName[] {
  return [...ORDER];
}

export function listDatasetDefinitions(): DatasetDefinition[] {
  return ORDER.map((name) => DEFINITIONS[name]);
}

export function getDatasetDefinition(dataset: DatasetName): DatasetDefinition {
  return DEFINITIONS[dataset];
}

export function isDatasetName(value: string): value is DatasetName {
  return Object.prototype.hasOwnProperty.call(DEFINITIONS, value);
}

export function streamNameMatchesDataset(streamName: string, dataset: DatasetName): boolean {
  const normalized = streamName.trim().toLowerCase();
  const definition = DEFINITIONS[dataset];
  return definition.wsAliases.includes(normalized);
}
