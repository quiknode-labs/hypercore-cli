import { z } from 'zod';

import type { NormalizedBookUpdateEvent, RawStreamBlock } from '../types/stream';
import { computeEventKey } from '../utils/hash';

const rawBookDiffSchema = z
  .union([
    z.literal('remove'),
    z
      .object({
        new: z
          .object({
            sz: z.string().optional(),
          })
          .passthrough(),
      })
      .passthrough(),
  ])
  .optional();

const eventSchema = z
  .object({
    user: z.string().optional(),
    oid: z.number().optional(),
    coin: z.string(),
    side: z.string(),
    px: z.string(),
    raw_book_diff: rawBookDiffSchema,
    rawBookDiff: rawBookDiffSchema,
  })
  .passthrough();

export function normalizeBookUpdatesBlock(block: RawStreamBlock): NormalizedBookUpdateEvent[] {
  const normalized: NormalizedBookUpdateEvent[] = [];

  for (const [index, rawEvent] of block.events.entries()) {
    const parsed = eventSchema.safeParse(rawEvent);
    if (!parsed.success) {
      continue;
    }

    const event = parsed.data;
    const rawDiff = event.raw_book_diff ?? event.rawBookDiff;

    let diffType: NormalizedBookUpdateEvent['diffType'] = 'unknown';
    let size: string | null = null;

    if (rawDiff === 'remove') {
      diffType = 'remove';
    } else if (rawDiff && typeof rawDiff === 'object' && 'new' in rawDiff) {
      diffType = 'new';
      const nextSize = (rawDiff as { new?: { sz?: unknown } }).new?.sz;
      size = typeof nextSize === 'string' ? nextSize : null;
    }

    normalized.push({
      eventKey: computeEventKey('book_updates', block.blockNumber, index, rawEvent),
      stream: 'book_updates',
      blockNumber: block.blockNumber,
      blockTime: block.blockTime,
      localTime: block.localTime,
      eventIndex: index,
      rawJson: JSON.stringify(rawEvent),
      user: event.user ?? null,
      oid: event.oid ?? null,
      coin: event.coin,
      side: event.side,
      price: event.px,
      diffType,
      size,
    });
  }

  return normalized;
}
