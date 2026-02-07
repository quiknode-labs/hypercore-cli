import { z } from 'zod';

import type { NormalizedTradeEvent, RawStreamBlock } from '../types/stream';
import { computeEventKey } from '../utils/hash';

const tradePayloadSchema = z
  .object({
    coin: z.string(),
    px: z.string(),
    sz: z.string(),
    side: z.string(),
    time: z.number().optional(),
    hash: z.string().optional(),
    oid: z.number().optional(),
    tid: z.number().optional(),
    fee: z.string().optional(),
    feeToken: z.string().optional(),
    twapId: z.number().nullable().optional(),
    builder: z.string().optional(),
    builderFee: z.string().optional(),
    crossed: z.boolean().optional(),
    dir: z.string().optional(),
  })
  .passthrough();

const tradeTupleSchema = z.tuple([z.string(), tradePayloadSchema]);

export function normalizeTradeBlock(block: RawStreamBlock): NormalizedTradeEvent[] {
  const normalized: NormalizedTradeEvent[] = [];

  for (const [index, rawEvent] of block.events.entries()) {
    const parsed = tradeTupleSchema.safeParse(rawEvent);
    if (!parsed.success) {
      continue;
    }

    const [user, payload] = parsed.data;
    normalized.push({
      eventKey: computeEventKey('trades', block.blockNumber, index, rawEvent),
      stream: 'trades',
      blockNumber: block.blockNumber,
      blockTime: block.blockTime,
      localTime: block.localTime,
      eventIndex: index,
      rawJson: JSON.stringify(rawEvent),
      user,
      coin: payload.coin,
      side: payload.side,
      price: payload.px,
      size: payload.sz,
      oid: payload.oid ?? null,
      tid: payload.tid ?? null,
      txHash: payload.hash ?? null,
      fee: payload.fee ?? null,
      feeToken: payload.feeToken ?? null,
      twapId: payload.twapId ?? null,
      builderAddress: payload.builder ?? null,
      builderFee: payload.builderFee ?? null,
      crossed: payload.crossed ?? null,
      direction: payload.dir ?? null,
      eventTimeMs: payload.time ?? null,
    });
  }

  return normalized;
}
