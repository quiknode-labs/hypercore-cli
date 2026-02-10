import type { NormalizedBlockEvent, RawStreamBlock } from '../types/stream';
import { computeEventKey } from '../utils/hash';

export function normalizeBlocksBlock(block: RawStreamBlock): NormalizedBlockEvent[] {
  const normalized: NormalizedBlockEvent[] = [];

  for (const [index, rawEvent] of block.events.entries()) {
    normalized.push({
      eventKey: computeEventKey('blocks', block.blockNumber, index, rawEvent),
      stream: 'blocks',
      blockNumber: block.blockNumber,
      blockTime: block.blockTime,
      localTime: block.localTime,
      eventIndex: index,
      rawJson: JSON.stringify(rawEvent),
      dataJson: JSON.stringify(rawEvent),
    });
  }

  return normalized;
}
