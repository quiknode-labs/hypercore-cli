import { JsonRpcClient } from '../api/jsonrpc';
import type { FilterMap } from '../filters/filter-builder';
import { getReconnectDelaySeconds } from './reconnection-manager';
import { StreamProcessor } from './stream-processor';
import { WsClient, X402CreditExhaustedError } from './ws-client';
import type { DatasetName } from '../types/common';
import type { NormalizedEvent, RawStreamBlock } from '../types/stream';

export interface StreamRuntimeOptions {
  dataset: DatasetName;
  wsUrl: string;
  httpUrl: string;
  filters: FilterMap;
  normalize: (block: RawStreamBlock) => NormalizedEvent[];
  onEvent: (event: NormalizedEvent) => Promise<void>;
  limit: number;
  log: (message: string) => void;
  warn: (message: string) => void;
  idleLogIntervalMs?: number;
  httpFetchFn?: typeof fetch;
  refreshWsUrl?: () => Promise<string>;
  ensureCredits?: () => Promise<void>;
}

export interface StreamRuntimeResult {
  emittedCount: number;
}

export async function runStreamRuntime(options: StreamRuntimeOptions): Promise<StreamRuntimeResult> {
  const abortController = new AbortController();
  let stopRequested = false;
  let emittedCount = 0;
  let lastEventTime = Date.now();

  const jsonRpcClient = new JsonRpcClient(options.httpUrl, options.httpFetchFn);
  const processor = new StreamProcessor({
    dataset: options.dataset,
    blockFetcher: jsonRpcClient,
    normalize: options.normalize,
    emit: async (event) => {
      if (stopRequested) {
        return;
      }
      await options.onEvent(event);
      emittedCount += 1;
      if (options.limit > 0 && emittedCount >= options.limit) {
        stopRequested = true;
        options.log(`Reached --limit ${options.limit}, stopping stream...`);
        abortController.abort();
      }
    },
    log: (message) => options.log(message),
    warn: (message) => options.warn(message),
  });

  let reconnectAttempt = 0;
  let consecutivePaymentAttempts = 0;
  const MAX_PAYMENT_RETRIES = 3;
  const shutdownHandler = (): void => {
    options.log('Received shutdown signal, stopping stream...');
    abortController.abort();
  };

  process.once('SIGINT', shutdownHandler);
  process.once('SIGTERM', shutdownHandler);

  const idleLogIntervalMs = options.idleLogIntervalMs ?? 10_000;
  const heartbeat =
    idleLogIntervalMs > 0
      ? setInterval(() => {
          if (Date.now() - lastEventTime >= idleLogIntervalMs && !abortController.signal.aborted) {
            options.log(`Connected and waiting for '${options.dataset}' events...`);
            lastEventTime = Date.now();
          }
        }, idleLogIntervalMs)
      : null;

  try {
    while (!abortController.signal.aborted) {
      let blockProcessingChain: Promise<void> = Promise.resolve();

      const currentWsUrl = options.refreshWsUrl
        ? await options.refreshWsUrl()
        : options.wsUrl;

      const wsClient = new WsClient({
        url: currentWsUrl,
        dataset: options.dataset,
        filters: options.filters,
        onBlock: async (block) => {
          blockProcessingChain = blockProcessingChain.then(async () => {
            if (stopRequested || abortController.signal.aborted) {
              return;
            }
            lastEventTime = Date.now();
            await processor.ingestLiveBlock(block);
          });
          await blockProcessingChain;
        },
        onInfo: (message) => options.log(message),
      });

      if (reconnectAttempt > 0) {
        processor.markReconnected();
        const delay = getReconnectDelaySeconds(reconnectAttempt - 1);
        options.log(`Reconnecting in ${delay}s (attempt ${reconnectAttempt})`);
        await sleep(delay * 1000);
      }

      try {
        const result = await wsClient.connectAndRun(abortController.signal);
        await blockProcessingChain;
        consecutivePaymentAttempts = 0;
        if (result === 'aborted') {
          break;
        }
        reconnectAttempt += 1;
      } catch (error) {
        const isPaymentRequired =
          (error instanceof X402CreditExhaustedError) ||
          (error instanceof Error && /Unexpected server response: 402/.test(error.message));

        if (isPaymentRequired && options.ensureCredits && consecutivePaymentAttempts < MAX_PAYMENT_RETRIES) {
          consecutivePaymentAttempts += 1;
          options.log(`x402 payment required, acquiring credits (attempt ${consecutivePaymentAttempts}/${MAX_PAYMENT_RETRIES})...`);
          try {
            await options.ensureCredits();
            options.log('x402 credits acquired, reconnecting WebSocket...');
            reconnectAttempt = 0;
            continue;
          } catch (paymentError) {
            const paymentMsg = paymentError instanceof Error ? paymentError.message : String(paymentError);
            options.warn(`x402 credit acquisition failed: ${paymentMsg}`);
          }
        }
        reconnectAttempt += 1;
        const message = error instanceof Error ? error.message : String(error);
        options.warn(`Stream connection dropped: ${message}`);
      }
    }
  } finally {
    if (heartbeat) {
      clearInterval(heartbeat);
    }
    process.removeListener('SIGINT', shutdownHandler);
    process.removeListener('SIGTERM', shutdownHandler);
  }

  return { emittedCount };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
