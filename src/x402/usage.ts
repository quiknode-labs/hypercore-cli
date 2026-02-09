import type { ConnectionContext } from './connection';

export interface X402UsageBaseline {
  startCredits: number;
  purchasedCreditsAtStart: number;
}

interface UsageLogger {
  info(message: string): void;
  warn(message: string): void;
}

export async function captureX402UsageBaseline(
  connection: ConnectionContext,
  logger: UsageLogger,
): Promise<X402UsageBaseline | null> {
  if (connection.mode !== 'x402' || !connection.getCredits) {
    return null;
  }

  const startCredits = connection.initialCredits ?? (await connection.getCredits());
  if (startCredits < 0) {
    logger.warn('Unable to read x402 credits at command start');
    return null;
  }

  return {
    startCredits,
    purchasedCreditsAtStart: connection.getPurchasedCredits?.() ?? 0,
  };
}

export async function logX402UsageSummary(
  connection: ConnectionContext,
  baseline: X402UsageBaseline | null,
  logger: UsageLogger,
): Promise<void> {
  if (!baseline || connection.mode !== 'x402' || !connection.getCredits) {
    return;
  }

  const endCredits = await connection.getCredits();
  if (endCredits < 0) {
    logger.warn('Unable to read x402 credits at command end');
    return;
  }

  const purchasedCreditsTotal = connection.getPurchasedCredits?.() ?? baseline.purchasedCreditsAtStart;
  const acquiredCredits = purchasedCreditsTotal - baseline.purchasedCreditsAtStart;
  const spentCredits = baseline.startCredits + acquiredCredits - endCredits;

  logger.info(
    `x402 credits summary: start=${baseline.startCredits}, acquired=${acquiredCredits}, end=${endCredits}, spent=${spentCredits}`,
  );
}
