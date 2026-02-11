import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'node:path';

import type { FilterMap } from '../filters/filter-builder';
import type { DatasetName } from '../types/common';
import type { RawStreamBlock } from '../types/stream';
import type { StreamTransport } from '../types/transport';

const PROTO_PATH = path.join(__dirname, '..', 'proto', 'streaming.proto');

const KEEPALIVE_INTERVAL_MS = 25_000;

const DATASET_TO_STREAM_TYPE: Record<DatasetName, string> = {
  trades: 'TRADES',
  orders: 'ORDERS',
  book_updates: 'BOOK_UPDATES',
  twap: 'TWAP',
  events: 'EVENTS',
  blocks: 'BLOCKS',
  writer_actions: 'WRITER_ACTIONS',
};

export interface GrpcStreamClientOptions {
  grpcUrl: string;
  token: string;
  dataset: DatasetName;
  filters: FilterMap;
  onBlock: (block: RawStreamBlock) => Promise<void>;
  onInfo: (message: string) => void;
}

type GrpcServiceConstructor = new (
  address: string,
  credentials: grpc.ChannelCredentials,
  options?: Record<string, unknown>,
) => grpc.Client & Record<string, Function>;

export class GrpcStreamClient implements StreamTransport {
  private readonly options: GrpcStreamClientOptions;
  private stream: grpc.ClientDuplexStream<unknown, unknown> | grpc.ClientReadableStream<unknown> | null = null;
  private client: grpc.Client | null = null;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: GrpcStreamClientOptions) {
    this.options = options;
  }

  async connectAndRun(abortSignal: AbortSignal): Promise<'closed' | 'aborted'> {
    const pkgDef = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const proto = grpc.loadPackageDefinition(pkgDef) as Record<string, unknown>;
    const hyperliquid = proto['hyperliquid'] as Record<string, unknown>;

    const grpcOpts = { 'grpc.max_receive_message_length': 100 * 1024 * 1024 };
    const creds = grpc.credentials.createSsl();
    const metadata = new grpc.Metadata();
    metadata.add('x-token', this.options.token);

    if (this.options.dataset === 'blocks') {
      return this.connectBlockStream(hyperliquid, creds, grpcOpts, metadata, abortSignal);
    }
    return this.connectDataStream(hyperliquid, creds, grpcOpts, metadata, abortSignal);
  }

  private async connectDataStream(
    hyperliquid: Record<string, unknown>,
    creds: grpc.ChannelCredentials,
    grpcOpts: Record<string, unknown>,
    metadata: grpc.Metadata,
    abortSignal: AbortSignal,
  ): Promise<'closed' | 'aborted'> {
    const StreamingService = hyperliquid['Streaming'] as GrpcServiceConstructor;
    const client = new StreamingService(this.options.grpcUrl, creds, grpcOpts);
    this.client = client;

    // Verify connectivity with a Ping
    await new Promise<void>((resolve, reject) => {
      client['Ping']({ count: 1 }, metadata, (err: Error | null) => {
        if (err) {
          reject(new Error(`gRPC Ping failed: ${err.message}`));
          return;
        }
        resolve();
      });
    });
    this.options.onInfo('gRPC Ping OK');

    const stream = client['StreamData'](metadata) as grpc.ClientDuplexStream<unknown, unknown>;
    this.stream = stream;

    return new Promise<'closed' | 'aborted'>((resolve, reject) => {
      let resolved = false;

      const cleanup = (): void => {
        if (this.keepaliveTimer) {
          clearInterval(this.keepaliveTimer);
          this.keepaliveTimer = null;
        }
      };

      abortSignal.addEventListener('abort', () => {
        this.closeGracefully().finally(() => {
          cleanup();
          if (!resolved) {
            resolved = true;
            resolve('aborted');
          }
        });
      });

      stream.on('data', (msg: Record<string, unknown>) => {
        if (msg['pong']) {
          return;
        }

        const data = msg['data'] as Record<string, unknown> | undefined;
        if (!data?.['data']) {
          return;
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(data['data'] as string) as Record<string, unknown>;
        } catch {
          return;
        }

        const events = payload['events'];
        if (!Array.isArray(events)) {
          return;
        }

        const blockNumber = Number(data['block_number']);
        const timestamp = Number(data['timestamp']);

        const block: RawStreamBlock = {
          stream: this.options.dataset,
          blockNumber,
          blockTime: timestamp > 0 ? new Date(timestamp).toISOString() : new Date().toISOString(),
          localTime: new Date().toISOString(),
          events,
        };

        this.options.onBlock(block).catch((err) => {
          if (!resolved) {
            resolved = true;
            cleanup();
            reject(err);
          }
        });
      });

      stream.on('error', (err: Error & { code?: number }) => {
        cleanup();
        if (!resolved) {
          resolved = true;
          reject(new Error(`gRPC stream error (code=${err.code}): ${err.message}`));
        }
      });

      stream.on('end', () => {
        cleanup();
        if (!resolved) {
          resolved = true;
          resolve('closed');
        }
      });

      const grpcFilters: Record<string, { values: string[] }> = {};
      for (const [key, values] of Object.entries(this.options.filters)) {
        if (values.length > 0) {
          grpcFilters[key] = { values };
        }
      }

      stream.write({
        subscribe: {
          stream_type: DATASET_TO_STREAM_TYPE[this.options.dataset],
          start_block: 0,
          filters: grpcFilters,
        },
      });
      this.options.onInfo(
        `gRPC subscription sent for '${this.options.dataset}' (stream_type=${DATASET_TO_STREAM_TYPE[this.options.dataset]})`,
      );

      this.keepaliveTimer = setInterval(() => {
        try {
          (stream as grpc.ClientDuplexStream<unknown, unknown>).write({ ping: { timestamp: Date.now() } });
        } catch {
          // stream may have ended
        }
      }, KEEPALIVE_INTERVAL_MS);
    });
  }

  private async connectBlockStream(
    hyperliquid: Record<string, unknown>,
    creds: grpc.ChannelCredentials,
    grpcOpts: Record<string, unknown>,
    metadata: grpc.Metadata,
    abortSignal: AbortSignal,
  ): Promise<'closed' | 'aborted'> {
    const BlockStreamingService = hyperliquid['BlockStreaming'] as GrpcServiceConstructor;
    const client = new BlockStreamingService(this.options.grpcUrl, creds, grpcOpts);
    this.client = client;

    const stream = client['StreamBlocks']({ timestamp: 0 }, metadata) as grpc.ClientReadableStream<unknown>;
    this.stream = stream;
    this.options.onInfo('gRPC BlockStreaming connected');

    let blockIndex = 0;

    return new Promise<'closed' | 'aborted'>((resolve, reject) => {
      let resolved = false;

      abortSignal.addEventListener('abort', () => {
        this.closeGracefully().finally(() => {
          if (!resolved) {
            resolved = true;
            resolve('aborted');
          }
        });
      });

      stream.on('data', (msg: Record<string, unknown>) => {
        const dataJson = msg['data_json'] as string | undefined;
        if (!dataJson) {
          return;
        }

        let payload: unknown;
        try {
          payload = JSON.parse(dataJson);
        } catch {
          return;
        }

        blockIndex += 1;
        const events = Array.isArray(payload) ? payload : [payload];

        const block: RawStreamBlock = {
          stream: 'blocks',
          blockNumber: blockIndex,
          blockTime: new Date().toISOString(),
          localTime: new Date().toISOString(),
          events,
        };

        this.options.onBlock(block).catch((err) => {
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        });
      });

      stream.on('error', (err: Error & { code?: number }) => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`gRPC block stream error (code=${err.code}): ${err.message}`));
        }
      });

      stream.on('end', () => {
        if (!resolved) {
          resolved = true;
          resolve('closed');
        }
      });
    });
  }

  async closeGracefully(): Promise<void> {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }

    if (this.stream) {
      try {
        if ('end' in this.stream && typeof this.stream.end === 'function') {
          this.stream.end();
        } else {
          this.stream.cancel();
        }
      } catch {
        // already ended
      }
      this.stream = null;
    }

    if (this.client) {
      try {
        this.client.close();
      } catch {
        // already closed
      }
      this.client = null;
    }
  }
}
