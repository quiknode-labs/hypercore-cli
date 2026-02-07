import type { NormalizedEvent } from '../types/stream';
import type { FilterMap } from './filter-builder';

export type EventFilter = (event: NormalizedEvent) => boolean;

export function createEventFilter(filters: FilterMap): EventFilter {
  const entries = Object.entries(filters)
    .map(([key, values]) => ({
      key: key.trim(),
      values: values.map((value) => value.trim()).filter((value) => value.length > 0),
    }))
    .filter((entry) => entry.key.length > 0 && entry.values.length > 0);

  if (entries.length === 0) {
    return () => true;
  }

  return (event: NormalizedEvent) =>
    entries.every((entry) => {
      const candidates = resolveValues(event, entry.key);
      if (candidates.length === 0) {
        return false;
      }
      return candidates.some((candidate) => entry.values.includes(candidate));
    });
}

function resolveValues(event: NormalizedEvent, key: string): string[] {
  if (key === 'user') {
    const values: string[] = [];
    const singleUser = readPath(event, 'user');
    values.push(...toScalarStrings(singleUser));
    const usersArray = readPath(event, 'users');
    values.push(...toScalarStrings(usersArray));
    return values;
  }

  return toScalarStrings(readPath(event, key));
}

function readPath(input: unknown, path: string): unknown {
  const segments = path
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return undefined;
  }

  let current: unknown = input;
  for (const segment of segments) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function toScalarStrings(value: unknown): string[] {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => toScalarStrings(entry));
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }
  return [];
}
