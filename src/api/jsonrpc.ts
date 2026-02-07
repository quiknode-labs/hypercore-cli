import { getDatasetDefinition } from '../datasets/registry';
import type { DatasetName } from '../types/common';
import type { RawStreamBlock, StreamProcessorBlockFetcher } from '../types/stream';

interface JsonRpcResponse<T> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

interface BatchBlocksResult {
  blocks: Array<{
    block_number: number;
    block_time: string;
    local_time: string;
    events: unknown[];
  }>;
}

export class JsonRpcClient implements StreamProcessorBlockFetcher {
  private readonly url: string;
  private idCounter = 1;

  constructor(url: string) {
    this.url = url;
  }

  async fetchBatchBlocks(dataset: DatasetName, from: number, to: number): Promise<RawStreamBlock[]> {
    if (to < from) {
      return [];
    }

    const definition = getDatasetDefinition(dataset);
    const result = await this.call<BatchBlocksResult>('hl_getBatchBlocks', {
      stream: definition.backfillStream,
      from,
      to,
    });

    return (result.blocks ?? []).map((block) => ({
      stream: dataset,
      blockNumber: block.block_number,
      blockTime: block.block_time,
      localTime: block.local_time,
      events: block.events,
    }));
  }

  private async call<T>(method: string, params: unknown): Promise<T> {
    const payload = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.idCounter++,
    };

    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`JSON-RPC HTTP ${response.status}`);
    }

    const data = (await response.json()) as JsonRpcResponse<T>;
    if (data.error) {
      throw new Error(`JSON-RPC error ${data.error.code}: ${data.error.message}`);
    }
    if (!data.result) {
      throw new Error('JSON-RPC response missing result');
    }

    return data.result;
  }
}
