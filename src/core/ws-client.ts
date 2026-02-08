import WebSocket from 'ws';

import { buildSubscribeRequest, buildUnsubscribeRequest } from '../api/websocket-streams';
import { getDatasetDefinition, streamNameMatchesDataset } from '../datasets/registry';
import { summarizeFilters, type FilterMap } from '../filters/filter-builder';
import type { DatasetName } from '../types/common';
import type { RawStreamBlock } from '../types/stream';

export interface WsClientOptions {
  url: string;
  dataset: DatasetName;
  filters: FilterMap;
  onBlock: (block: RawStreamBlock) => Promise<void>;
  onInfo: (message: string) => void;
}

export class WsClient {
  private readonly options: WsClientOptions;
  private socket: WebSocket | null = null;
  private requestId = 1;

  constructor(options: WsClientOptions) {
    this.options = options;
  }

  async connectAndRun(abortSignal: AbortSignal): Promise<'closed' | 'aborted'> {
    const socket = new WebSocket(this.options.url);
    this.socket = socket;

    await new Promise<void>((resolve, reject) => {
      const onOpen = (): void => {
        socket.off('error', onError);
        resolve();
      };
      const onError = (...args: unknown[]): void => {
        const [error] = args;
        socket.off('open', onOpen);
        reject(error);
      };

      socket.once('open', onOpen);
      socket.once('error', onError);
    });

    const definition = getDatasetDefinition(this.options.dataset);
    const subscribePayload = buildSubscribeRequest(this.requestId++, {
      streamType: definition.wsStreamType,
      filters: Object.keys(this.options.filters).length > 0 ? this.options.filters : undefined,
    });
    socket.send(subscribePayload);
    const filterSummary = summarizeFilters(this.options.filters);
    this.options.onInfo(`Subscription request sent for '${this.options.dataset}' (${filterSummary})`);

    return new Promise<'closed' | 'aborted'>((resolve, reject) => {
      let unknownPayloadLogged = false;

      abortSignal.addEventListener('abort', () => {
        this.closeGracefully().finally(() => resolve('aborted'));
      });

      socket.on('message', async (rawData: unknown) => {
        try {
          const parsed = JSON.parse(String(rawData)) as unknown;

          const rpcError = getJsonRpcError(parsed);
          if (rpcError) {
            reject(new Error(`WebSocket JSON-RPC error ${rpcError.code}: ${rpcError.message}`));
            return;
          }

          if (isSubscriptionAck(parsed, this.options.dataset)) {
            this.options.onInfo(`Subscription confirmed for '${this.options.dataset}' (${summarizeFilters(this.options.filters)})`);
            return;
          }

          const block = parseStreamBlock(this.options.dataset, parsed);
          if (block) {
            await this.options.onBlock(block);
            return;
          }

          if (!unknownPayloadLogged) {
            unknownPayloadLogged = true;
            this.options.onInfo(
              `Connected, but received unrecognized payload shape for '${this.options.dataset}'. First payload: ${summarizePayload(parsed)}`,
            );
          }
        } catch (error) {
          reject(error);
        }
      });

      socket.on('close', () => {
        resolve('closed');
      });

      socket.on('error', (...args: unknown[]) => {
        const [error] = args;
        reject(error);
      });
    });
  }

  async closeGracefully(): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const definition = getDatasetDefinition(this.options.dataset);
    const unsubscribePayload = buildUnsubscribeRequest(this.requestId++, definition.wsStreamType);
    this.socket.send(unsubscribePayload);
    this.options.onInfo('WebSocket unsubscribe sent');
    this.socket.close();
  }
}

function parseStreamBlock(dataset: DatasetName, message: unknown): RawStreamBlock | null {
  const queue: unknown[] = [message];
  const visited = new Set<object>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const object = current as Record<string, unknown>;
    const direct = toRawStreamBlock(dataset, object, object);
    if (direct) {
      return direct;
    }

    const nested = object['data'];
    if (nested && typeof nested === 'object') {
      const fromData = toRawStreamBlock(dataset, object, nested as Record<string, unknown>);
      if (fromData) {
        return fromData;
      }
    }

    for (const key of ['params', 'result', 'payload', 'notification', 'data', 'block']) {
      const candidate = object[key];
      if (candidate && typeof candidate === 'object') {
        queue.push(candidate);
      }
    }
  }

  return null;
}

function toRawStreamBlock(
  dataset: DatasetName,
  root: Record<string, unknown>,
  payload: Record<string, unknown>,
): RawStreamBlock | null {
  const eventsCandidate = asEvents(payload['events'] ?? payload['Events']);
  if (eventsCandidate === null) {
    return null;
  }

  const streamName =
    asString(payload['stream']) ??
    asString(payload['streamType']) ??
    asString(root['stream']) ??
    asString(root['streamType']) ??
    asString((root['params'] as Record<string, unknown> | undefined)?.['stream']);
  if (streamName && !streamNameMatchesDataset(streamName, dataset)) {
    return null;
  }

  const blockNumber =
    asNumber(payload['block_number']) ??
    asNumber(payload['blockNumber']) ??
    asNumber(root['block_number']) ??
    asNumber(root['blockNumber']);
  if (blockNumber === null) {
    return null;
  }

  return {
    stream: dataset,
    blockNumber,
    blockTime:
      asString(payload['block_time']) ??
      asString(payload['blockTime']) ??
      asString(root['block_time']) ??
      asString(root['blockTime']) ??
      new Date().toISOString(),
    localTime:
      asString(payload['local_time']) ??
      asString(payload['localTime']) ??
      asString(root['local_time']) ??
      asString(root['localTime']) ??
      new Date().toISOString(),
    events: eventsCandidate,
  };
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function isSubscriptionAck(message: unknown, dataset: DatasetName): boolean {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const result = (message as Record<string, unknown>)['result'];
  if (!result || typeof result !== 'object') {
    return false;
  }

  const subscribed = (result as Record<string, unknown>)['subscribed'];
  if (typeof subscribed === 'string') {
    return streamNameMatchesDataset(subscribed, dataset);
  }
  if (!Array.isArray(subscribed)) {
    return false;
  }

  return subscribed.some(
    (entry) => typeof entry === 'string' && streamNameMatchesDataset(entry, dataset),
  );
}

function getJsonRpcError(message: unknown): { code: number; message: string } | null {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const error = (message as Record<string, unknown>)['error'];
  if (!error || typeof error !== 'object') {
    return null;
  }

  const code = asNumber((error as Record<string, unknown>)['code']);
  const errorMessage = asString((error as Record<string, unknown>)['message']);
  if (code === null || !errorMessage) {
    return null;
  }
  return { code, message: errorMessage };
}

function asEvents(value: unknown): unknown[] | null {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object') {
    return [value];
  }
  return null;
}

function summarizePayload(payload: unknown): string {
  try {
    const serialized = JSON.stringify(payload);
    if (!serialized) {
      return '[empty]';
    }
    return serialized.length > 280 ? `${serialized.slice(0, 280)}...` : serialized;
  } catch {
    return '[unserializable]';
  }
}
