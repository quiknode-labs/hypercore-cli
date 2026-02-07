import type { ProgressMode } from '../types/common';

export const PROGRESS_MODES: ProgressMode[] = ['text', 'json'];

export function resolveProgressMode(input?: string): ProgressMode {
  const value = (input ?? 'text').trim().toLowerCase();
  if (!PROGRESS_MODES.includes(value as ProgressMode)) {
    throw new Error(`Invalid --progress '${input ?? ''}'. Expected one of: ${PROGRESS_MODES.join(', ')}`);
  }
  return value as ProgressMode;
}
