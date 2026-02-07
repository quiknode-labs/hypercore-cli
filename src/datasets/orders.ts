import { z } from 'zod';

import type { NormalizedOrderEvent, RawStreamBlock } from '../types/stream';
import { computeEventKey } from '../utils/hash';

const builderSchema = z
  .object({
    b: z.string(),
    f: z.number(),
  })
  .nullable()
  .optional();

const orderSchema = z
  .object({
    coin: z.string(),
    side: z.string(),
    limitPx: z.string().optional(),
    sz: z.string().optional(),
    origSz: z.string().optional(),
    oid: z.number().optional(),
    orderType: z.string().optional(),
    tif: z.string().optional(),
    reduceOnly: z.boolean().optional(),
    isTrigger: z.boolean().optional(),
    triggerPx: z.string().optional(),
    cloid: z.string().nullable().optional(),
  })
  .passthrough();

const orderEventSchema = z
  .object({
    time: z.string().optional(),
    user: z.string(),
    hash: z.string().nullable().optional(),
    builder: builderSchema,
    status: z.string(),
    order: orderSchema,
  })
  .passthrough();

export function normalizeOrderBlock(block: RawStreamBlock): NormalizedOrderEvent[] {
  const normalized: NormalizedOrderEvent[] = [];

  for (const [index, rawEvent] of block.events.entries()) {
    const parsed = orderEventSchema.safeParse(rawEvent);
    if (!parsed.success) {
      continue;
    }

    const event = parsed.data;
    normalized.push({
      eventKey: computeEventKey('orders', block.blockNumber, index, rawEvent),
      stream: 'orders',
      blockNumber: block.blockNumber,
      blockTime: block.blockTime,
      localTime: block.localTime,
      eventIndex: index,
      rawJson: JSON.stringify(rawEvent),
      user: event.user,
      status: event.status,
      coin: event.order.coin,
      side: event.order.side,
      limitPx: event.order.limitPx ?? null,
      size: event.order.sz ?? null,
      origSize: event.order.origSz ?? null,
      orderType: event.order.orderType ?? null,
      tif: event.order.tif ?? null,
      oid: event.order.oid ?? null,
      txHash: event.hash ?? null,
      cloid: event.order.cloid ?? null,
      reduceOnly: event.order.reduceOnly ?? null,
      isTrigger: event.order.isTrigger ?? null,
      triggerPx: event.order.triggerPx ?? null,
      builderAddress: event.builder?.b ?? null,
      builderFeeBps: event.builder?.f ?? null,
      eventTime: event.time ?? null,
    });
  }

  return normalized;
}
