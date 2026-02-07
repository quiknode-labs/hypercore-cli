import type { AppLogger, ProgressMode } from '../types/common';

export interface LoggerOptions {
  quiet: boolean;
  mode?: ProgressMode;
  context?: Record<string, unknown>;
  redact?: (message: string) => string;
}

export function createLogger(options: LoggerOptions): AppLogger {
  const mode = options.mode ?? 'text';
  const context = options.context ?? {};
  const redact = options.redact ?? ((message: string) => message);

  return {
    info(message: string): void {
      const safeMessage = redact(message);
      if (!options.quiet) {
        if (mode === 'json') {
          writeJsonLog('info', safeMessage, context);
          return;
        }
        process.stderr.write(`${safeMessage}\n`);
      }
    },
    warn(message: string): void {
      const safeMessage = redact(message);
      if (mode === 'json') {
        writeJsonLog('warn', safeMessage, context);
        return;
      }
      process.stderr.write(`Warning: ${safeMessage}\n`);
    },
    error(message: string): void {
      const safeMessage = redact(message);
      if (mode === 'json') {
        writeJsonLog('error', safeMessage, context);
        return;
      }
      process.stderr.write(`Error: ${safeMessage}\n`);
    },
  };
}

function writeJsonLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  context: Record<string, unknown>,
): void {
  process.stderr.write(
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    })}\n`,
  );
}
