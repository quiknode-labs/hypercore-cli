import { z } from 'zod';

import type { NormalizedWriterActionEvent, RawStreamBlock } from '../types/stream';
import { computeEventKey } from '../utils/hash';

const scalarSchema = z.union([z.string(), z.number()]);

const actionSchema = z
  .object({
    type: z.string(),
    destination: z.string().optional(),
    token: scalarSchema.optional(),
    wei: scalarSchema.optional(),
  })
  .passthrough();

const writerActionSchema = z
  .object({
    time: z.string().optional(),
    user: z.string(),
    nonce: z.number().optional(),
    evm_tx_hash: z.string().nullable().optional(),
    evmTxHash: z.string().nullable().optional(),
    action: actionSchema,
  })
  .passthrough();

export function normalizeWriterActionsBlock(block: RawStreamBlock): NormalizedWriterActionEvent[] {
  const normalized: NormalizedWriterActionEvent[] = [];

  for (const [index, rawEvent] of block.events.entries()) {
    const parsed = writerActionSchema.safeParse(rawEvent);
    if (!parsed.success) {
      continue;
    }

    const event = parsed.data;
    const actionType = event.action.type;
    const destination = event.action.destination ?? null;
    const token = toOptionalString(event.action.token);
    const wei = toOptionalString(event.action.wei);
    normalized.push({
      eventKey: computeEventKey('writer_actions', block.blockNumber, index, rawEvent),
      stream: 'writer_actions',
      blockNumber: block.blockNumber,
      blockTime: block.blockTime,
      localTime: block.localTime,
      eventIndex: index,
      rawJson: JSON.stringify(rawEvent),
      user: event.user,
      nonce: event.nonce ?? null,
      evmTxHash: event.evm_tx_hash ?? event.evmTxHash ?? null,
      type: actionType,
      actionType,
      destination,
      token,
      wei,
      action: {
        type: actionType,
        destination,
        token,
        wei,
      },
      eventTime: event.time ?? null,
    });
  }

  return normalized;
}

function toOptionalString(value: string | number | undefined): string | null {
  if (value == null) {
    return null;
  }
  return String(value);
}
