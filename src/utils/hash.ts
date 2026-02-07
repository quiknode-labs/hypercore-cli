import { createHash } from 'node:crypto';

import type { DatasetName } from '../types/common';

export function computeEventKey(
  stream: DatasetName,
  blockNumber: number,
  eventIndex: number,
  rawEvent: unknown,
): string {
  const digest = createHash('sha256').update(stableStringify(rawEvent)).digest('hex');
  return `${stream}:${blockNumber}:${eventIndex}:${digest}`;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const content = entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(',');
  return `{${content}}`;
}
