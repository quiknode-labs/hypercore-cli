export const MAX_BACKOFF_SECONDS = 60;

export function getReconnectDelaySeconds(attempt: number): number {
  const boundedAttempt = Math.max(0, attempt);
  const exponential = 2 ** boundedAttempt;
  return Math.min(MAX_BACKOFF_SECONDS, exponential);
}

export async function waitForReconnectDelay(attempt: number): Promise<void> {
  const seconds = getReconnectDelaySeconds(attempt);
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
