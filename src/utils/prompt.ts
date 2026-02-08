import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export interface PromptAdapter {
  ask(question: string, options?: { secret?: boolean }): Promise<string>;
}

class ReadlinePromptAdapter implements PromptAdapter {
  async ask(question: string, options?: { secret?: boolean }): Promise<string> {
    const rl = createInterface({ input, output, terminal: true });
    const maskedInterface = rl as typeof rl & {
      _writeToOutput?: (chunk: string) => void;
    };
    const originalWriteToOutput = maskedInterface._writeToOutput;

    try {
      if (options?.secret) {
        // Keep secret input hidden while preserving the prompt text.
        maskedInterface._writeToOutput = (chunk: string): void => {
          if (chunk.includes(question)) {
            output.write(chunk);
          }
        };
      }

      const answer = await rl.question(question);
      if (options?.secret) {
        output.write('\n');
      }

      return answer.trim();
    } finally {
      if (originalWriteToOutput) {
        maskedInterface._writeToOutput = originalWriteToOutput;
      }
      rl.close();
    }
  }
}

export const promptAdapter: PromptAdapter = new ReadlinePromptAdapter();
