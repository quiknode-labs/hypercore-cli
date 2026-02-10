/* ------------------------------------------------------------------ */
/*  Shared ANSI color module (no external dependencies)                */
/* ------------------------------------------------------------------ */

export interface Colorizer {
  cyan(s: string): string;
  green(s: string): string;
  red(s: string): string;
  yellow(s: string): string;
  bold(s: string): string;
  reset: string;
  // Terminal control (always active, not color-dependent)
  clearLine: string;
  cursorUp(n: number): string;
  cursorToCol0: string;
  hideCursor: string;
  showCursor: string;
}

export function createColorizer(stream: NodeJS.WriteStream): Colorizer {
  const enabled = !process.env.NO_COLOR && stream.isTTY === true;

  const wrap = (code: string) =>
    enabled ? (s: string) => `\x1b[${code}m${s}\x1b[0m` : (s: string) => s;

  return {
    cyan: wrap('36'),
    green: wrap('32'),
    red: wrap('31'),
    yellow: wrap('33'),
    bold: wrap('1'),
    reset: enabled ? '\x1b[0m' : '',
    // Terminal control sequences — always active regardless of color
    clearLine: '\x1b[2K',
    cursorUp: (n: number): string => (n > 0 ? `\x1b[${n}A` : ''),
    cursorToCol0: '\r',
    hideCursor: '\x1b[?25l',
    showCursor: '\x1b[?25h',
  };
}

export const stdoutColors: Colorizer = createColorizer(process.stdout);
export const stderrColors: Colorizer = createColorizer(process.stderr);

/** Format an integer with comma separators: 1234567 → "1,234,567" */
export function formatNumber(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}
