import type { AppLogger, ProgressMode } from '../types/common';
import { stderrColors } from './ansi';

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
  const c = stderrColors;

  return {
    info(message: string): void {
      const safeMessage = redact(message);
      if (!options.quiet) {
        if (mode === 'json') {
          writeJsonLog('info', safeMessage, context);
          return;
        }
        process.stderr.write(`[info] ${safeMessage}\n`);
      }
    },
    warn(message: string): void {
      const safeMessage = redact(message);
      if (mode === 'json') {
        writeJsonLog('warn', safeMessage, context);
        return;
      }
      process.stderr.write(`${c.yellow('[warn]')} ${safeMessage}\n`);
    },
    error(message: string): void {
      const safeMessage = redact(message);
      if (mode === 'json') {
        writeJsonLog('error', safeMessage, context);
        return;
      }
      process.stderr.write(`${c.red('[error]')} ${safeMessage}\n`);
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
