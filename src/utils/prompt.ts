import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export interface PromptAdapter {
  ask(question: string, options?: { secret?: boolean }): Promise<string>;
}

class ReadlinePromptAdapter implements PromptAdapter {
  async ask(question: string, options?: { secret?: boolean }): Promise<string> {
    if (options?.secret) {
      return askSecret(question);
    }

    const rl = createInterface({ input, output, terminal: true });
    try {
      const answer = await rl.question(question);
      return answer.trim();
    } finally {
      rl.close();
    }
  }
}

async function askSecret(question: string): Promise<string> {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    const rl = createInterface({ input, output, terminal: true });
    try {
      const answer = await rl.question(question);
      return answer.trim();
    } finally {
      rl.close();
    }
  }

  output.write(question);
  const wasRaw = input.isRaw ?? false;

  return new Promise<string>((resolve) => {
    let value = '';

    const cleanup = (): void => {
      input.removeListener('data', onData);
      input.setRawMode?.(wasRaw);
      input.pause();
    };

    const onData = (chunk: Buffer | string): void => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');

      for (const char of text) {
        if (char === '\r' || char === '\n') {
          cleanup();
          output.write('\n');
          resolve(value.trim());
          return;
        }

        if (char === '\u0003') {
          cleanup();
          output.write('\n');
          process.exit(130);
        }

        if (char === '\u007F' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }

        if (isPrintableChar(char)) {
          value += char;
        }
      }
    };

    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

function isPrintableChar(char: string): boolean {
  if (!char) {
    return false;
  }
  const code = char.codePointAt(0);
  return typeof code === 'number' && code >= 32 && code !== 127;
}

export const promptAdapter: PromptAdapter = new ReadlinePromptAdapter();
