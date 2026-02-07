import type { FilterMap } from '../filters/filter-builder';

export interface SubscribeParams {
  streamType: string;
  filters?: FilterMap;
}

export function buildSubscribeRequest(id: number, params: SubscribeParams): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    method: 'hl_subscribe',
    params,
    id,
  });
}

export function buildUnsubscribeRequest(id: number, streamType: string): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    method: 'hl_unsubscribe',
    params: { streamType },
    id,
  });
}
