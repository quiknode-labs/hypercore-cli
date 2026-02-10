import { Code, ConnectError, createClient } from '@connectrpc/connect';
import { createGrpcWebTransport } from '@connectrpc/connect-web';

import { BlockStreaming, type Block } from '../gen/streaming_pb';
import type { RawStreamBlock } from '../types/stream';
import type { StreamTransport } from '../types/transport';

export interface GrpcWebBlockStreamClientOptions {
  baseUrl: string;
  fetchFn: typeof fetch;
  onBlock: (block: RawStreamBlock) => Promise<void>;
  onInfo: (message: string) => void;
}

/**
 * gRPC-Web client for BlockStreaming.StreamBlocks (server-streaming).
 * Uses @connectrpc/connect-web with the x402 payment-wrapped fetch.
 * Only supports the `blocks` dataset (server-streaming RPC).
 */
export class GrpcWebBlockStreamClient implements StreamTransport {
  private abortController: AbortController | null = null;

  constructor(private readonly options: GrpcWebBlockStreamClientOptions) {}

  async connectAndRun(abortSignal: AbortSignal): Promise<'closed' | 'aborted'> {
    this.abortController = new AbortController();
    const onAbort = (): void => this.abortController?.abort();
    abortSignal.addEventListener('abort', onAbort, { once: true });

    this.options.onInfo(`gRPC-Web connecting to ${this.options.baseUrl}`);

    // Debug fetch wrapper: log error response bodies (the worker returns JSON on 502)
    const baseFetch = this.options.fetchFn;
    const onInfo = this.options.onInfo;
    const debugFetch: typeof fetch = async (input, init) => {
      const response = await baseFetch(input, init);
      if (!response.ok && response.status !== 402) {
        const clone = response.clone();
        const errorBody = await clone.text().catch(() => '');
        onInfo(`[gRPC-Web] HTTP ${response.status}: ${errorBody}`);
      }
      return response;
    };

    const transport = createGrpcWebTransport({
      baseUrl: this.options.baseUrl,
      useBinaryFormat: true,
      fetch: debugFetch,
    });

    const client = createClient(BlockStreaming, transport);
    let blockIndex = 0;

    try {
      for await (const msg of client.streamBlocks(
        { timestamp: BigInt(0) },
        { signal: this.abortController.signal },
      )) {
        if (blockIndex === 0) {
          this.options.onInfo('gRPC-Web BlockStreaming connected');
        }

        const dataJson = (msg as Block).dataJson;
        if (!dataJson) continue;

        blockIndex += 1;
        let payload: unknown;
        try {
          payload = JSON.parse(dataJson);
        } catch {
          continue;
        }

        const events = Array.isArray(payload) ? payload : [payload];
        const block: RawStreamBlock = {
          stream: 'blocks',
          blockNumber: blockIndex,
          blockTime: new Date().toISOString(),
          localTime: new Date().toISOString(),
          events,
        };

        await this.options.onBlock(block);
      }
    } catch (err) {
      if (abortSignal.aborted) return 'aborted';

      // Handle gRPC-specific errors
      if (err instanceof ConnectError) {
        if (err.code === Code.ResourceExhausted) {
          throw new Error(`gRPC-Web stream ended: credits exhausted`);
        }
        throw new Error(`gRPC-Web error (${Code[err.code]}): ${err.rawMessage}`);
      }
      throw err;
    } finally {
      abortSignal.removeEventListener('abort', onAbort);
    }

    return abortSignal.aborted ? 'aborted' : 'closed';
  }

  async closeGracefully(): Promise<void> {
    this.abortController?.abort();
  }
}
