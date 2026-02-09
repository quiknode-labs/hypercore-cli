import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

/* ------------------------------------------------------------------ */
/*  ANSI helpers (no chalk dependency)                                 */
/* ------------------------------------------------------------------ */

const ansi = {
  cyan: (s: string): string => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string): string => `\x1b[2m${s}\x1b[0m`,
  green: (s: string): string => `\x1b[32m${s}\x1b[0m`,
  clearLine: '\x1b[2K',
  cursorUp: (n: number): string => (n > 0 ? `\x1b[${n}A` : ''),
  cursorToCol0: '\r',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SelectOption<T> {
  value: T;
  label: string;
  description?: string;
}

export interface SelectPromptConfig<T> {
  message: string;
  options: SelectOption<T>[];
}

export interface TextPromptConfig {
  message: string;
  defaultValue?: string;
}

/* ------------------------------------------------------------------ */
/*  isInteractive                                                      */
/* ------------------------------------------------------------------ */

export function isInteractive(): boolean {
  return stdin.isTTY === true && stdout.isTTY === true;
}

/* ------------------------------------------------------------------ */
/*  renderSelectOptions (pure, exported for testing)                   */
/* ------------------------------------------------------------------ */

export function renderSelectOptions<T>(
  options: SelectOption<T>[],
  selectedIndex: number,
): string {
  return options
    .map((opt, i) => {
      const cursor = i === selectedIndex ? ansi.cyan('❯') : ' ';
      const label = i === selectedIndex ? ansi.cyan(opt.label) : opt.label;
      const desc = opt.description ? ansi.dim(` - ${opt.description}`) : '';
      return `${cursor} ${label}${desc}`;
    })
    .join('\n');
}

/* ------------------------------------------------------------------ */
/*  selectPrompt                                                       */
/* ------------------------------------------------------------------ */

export async function selectPrompt<T>(config: SelectPromptConfig<T>): Promise<T> {
  const { message, options } = config;
  let selectedIndex = 0;

  const header = `${ansi.green('?')} ${message}:`;

  const render = (): void => {
    const body = renderSelectOptions(options, selectedIndex);
    stdout.write(`${ansi.cursorToCol0}${ansi.clearLine}${header}\n${body}`);
  };

  const moveUp = (): void => {
    // Move cursor back to header line so next render overwrites cleanly
    stdout.write(ansi.cursorUp(options.length));
  };

  return new Promise<T>((resolve) => {
    const wasRaw = stdin.isRaw ?? false;

    const cleanup = (): void => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      stdout.write(ansi.showCursor);
    };

    const exitCleanup = (): void => {
      stdout.write(ansi.showCursor);
    };
    process.once('exit', exitCleanup);

    const onData = (data: Buffer): void => {
      const key = data.toString();

      // Ctrl-C
      if (key === '\x03') {
        cleanup();
        process.removeListener('exit', exitCleanup);
        // Clear the rendered options
        moveUp();
        for (let i = 0; i <= options.length; i++) {
          stdout.write(`${ansi.cursorToCol0}${ansi.clearLine}\n`);
        }
        stdout.write(ansi.cursorUp(options.length + 1));
        process.exit(130);
      }

      // Up arrow
      if (key === '\x1b[A' || key === 'k') {
        if (selectedIndex > 0) {
          selectedIndex -= 1;
          moveUp();
          render();
        }
        return;
      }

      // Down arrow
      if (key === '\x1b[B' || key === 'j') {
        if (selectedIndex < options.length - 1) {
          selectedIndex += 1;
          moveUp();
          render();
        }
        return;
      }

      // Enter
      if (key === '\r' || key === '\n') {
        cleanup();
        process.removeListener('exit', exitCleanup);

        // Collapse to single confirmed line
        moveUp();
        for (let i = 0; i <= options.length; i++) {
          stdout.write(`${ansi.cursorToCol0}${ansi.clearLine}\n`);
        }
        stdout.write(ansi.cursorUp(options.length + 1));
        const selected = options[selectedIndex];
        stdout.write(
          `${ansi.cursorToCol0}${ansi.clearLine}${ansi.green('✔')} ${message}: ${ansi.cyan(selected.label)}\n`,
        );

        resolve(selected.value);
      }
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdout.write(ansi.hideCursor);
    render();

    stdin.on('data', onData);
  });
}

/* ------------------------------------------------------------------ */
/*  textPrompt                                                         */
/* ------------------------------------------------------------------ */

export async function textPrompt(config: TextPromptConfig): Promise<string> {
  const { message, defaultValue } = config;

  const hint = defaultValue ? ansi.dim(` (${defaultValue})`) : '';
  const question = `${ansi.green('?')} ${message}${hint}: `;

  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  try {
    const answer = await rl.question(question);
    const trimmed = answer.trim();
    return trimmed || defaultValue || '';
  } finally {
    rl.close();
  }
}
