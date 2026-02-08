import type { DatasetName } from '../types/common';

export type FilterMap = Record<string, string[]>;

export interface BuildFilterInput {
  dataset: DatasetName;
  tokens?: string;
  users?: string;
  statuses?: string;
  rawFilters?: string[];
}

export function buildFilters(input: BuildFilterInput): FilterMap {
  const filters: FilterMap = {};

  appendCsv(filters, input.dataset === 'writer_actions' ? 'token' : 'coin', input.tokens);
  appendCsv(filters, 'user', input.users);

  if (input.dataset === 'orders') {
    appendCsv(filters, 'status', input.statuses);
  } else if (input.statuses && input.statuses.trim()) {
    throw new Error('--statuses is only supported for --dataset orders');
  }

  for (const rawFilter of input.rawFilters ?? []) {
    const parsed = parseRawFilter(rawFilter);
    if (!parsed) {
      continue;
    }
    mergeValues(filters, parsed.key, parsed.values);
  }

  return filters;
}

export function parseRawFilter(rawFilter: string): { key: string; values: string[] } | null {
  const separatorIndex = rawFilter.indexOf('=');
  if (separatorIndex < 1) {
    throw new Error(`Invalid --filter '${rawFilter}'. Use key=v1,v2 format.`);
  }

  const key = rawFilter.slice(0, separatorIndex).trim();
  const valuePart = rawFilter.slice(separatorIndex + 1).trim();
  const values = splitCsv(valuePart);
  if (!key || values.length === 0) {
    throw new Error(`Invalid --filter '${rawFilter}'. Use key=v1,v2 format.`);
  }

  return { key, values };
}

function appendCsv(filters: FilterMap, key: string, csv?: string): void {
  const values = splitCsv(csv);
  if (values.length > 0) {
    mergeValues(filters, key, values);
  }
}

function splitCsv(csv?: string): string[] {
  if (!csv) {
    return [];
  }
  if (csv.trim().toLowerCase() === 'all') {
    return [];
  }

  return csv
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function mergeValues(filters: FilterMap, key: string, values: string[]): void {
  const normalizedKey = key.trim();
  const existing = filters[normalizedKey] ?? [];
  const merged = new Set<string>(existing);
  for (const value of values) {
    merged.add(value.trim());
  }
  filters[normalizedKey] = [...merged];
}
