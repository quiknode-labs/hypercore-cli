import { z } from 'zod';

import type { NormalizedSystemEvent, RawStreamBlock } from '../types/stream';
import { computeEventKey } from '../utils/hash';

const ledgerUpdateSchema = z
  .object({
    users: z.array(z.string()).optional(),
    delta: z
      .object({
        type: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const innerSchema = z.record(z.unknown());

const eventSchema = z
  .object({
    time: z.string().optional(),
    hash: z.string().nullable().optional(),
    inner: innerSchema,
  })
  .passthrough();

export function normalizeEventsBlock(block: RawStreamBlock): NormalizedSystemEvent[] {
  const normalized: NormalizedSystemEvent[] = [];

  for (const [index, rawEvent] of block.events.entries()) {
    const parsed = eventSchema.safeParse(rawEvent);
    if (!parsed.success) {
      continue;
    }

    const event = parsed.data;
    const [eventType, innerValue] = Object.entries(event.inner)[0] ?? ['unknown', null];
    const ledgerUpdate = ledgerUpdateSchema.safeParse(innerValue).success
      ? ledgerUpdateSchema.parse(innerValue)
      : null;

    normalized.push({
      eventKey: computeEventKey('events', block.blockNumber, index, rawEvent),
      stream: 'events',
      blockNumber: block.blockNumber,
      blockTime: block.blockTime,
      localTime: block.localTime,
      eventIndex: index,
      rawJson: JSON.stringify(rawEvent),
      eventType,
      deltaType: ledgerUpdate?.delta?.type ?? null,
      txHash: event.hash ?? null,
      users: ledgerUpdate?.users ?? [],
      eventTime: event.time ?? null,
    });
  }

  return normalized;
}
