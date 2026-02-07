import { z } from 'zod';

import type { NormalizedTwapEvent, RawStreamBlock } from '../types/stream';
import { computeEventKey } from '../utils/hash';

const stateSchema = z
  .object({
    coin: z.string(),
    user: z.string(),
    side: z.string(),
    sz: z.string(),
    executedSz: z.string().optional(),
    executedNtl: z.string().optional(),
    minutes: z.number().optional(),
    reduceOnly: z.boolean().optional(),
    randomize: z.boolean().optional(),
    timestamp: z.number().optional(),
  })
  .passthrough();

const eventSchema = z
  .object({
    time: z.string().optional(),
    twap_id: z.number().optional(),
    twapId: z.number().optional(),
    status: z.string(),
    state: stateSchema,
  })
  .passthrough();

export function normalizeTwapBlock(block: RawStreamBlock): NormalizedTwapEvent[] {
  const normalized: NormalizedTwapEvent[] = [];

  for (const [index, rawEvent] of block.events.entries()) {
    const parsed = eventSchema.safeParse(rawEvent);
    if (!parsed.success) {
      continue;
    }

    const event = parsed.data;
    const twapId = event.twap_id ?? event.twapId;
    if (twapId == null) {
      continue;
    }

    normalized.push({
      eventKey: computeEventKey('twap', block.blockNumber, index, rawEvent),
      stream: 'twap',
      blockNumber: block.blockNumber,
      blockTime: block.blockTime,
      localTime: block.localTime,
      eventIndex: index,
      rawJson: JSON.stringify(rawEvent),
      twapId,
      status: event.status,
      coin: event.state.coin,
      user: event.state.user,
      side: event.state.side,
      size: event.state.sz,
      executedSize: event.state.executedSz ?? null,
      executedNotional: event.state.executedNtl ?? null,
      minutes: event.state.minutes ?? null,
      reduceOnly: event.state.reduceOnly ?? null,
      randomize: event.state.randomize ?? null,
      stateTimestamp: event.state.timestamp ?? null,
      eventTime: event.time ?? null,
    });
  }

  return normalized;
}
