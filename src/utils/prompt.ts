import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export interface PromptAdapter {
  ask(question: string, options?: { secret?: boolean }): Promise<string>;
}

class ReadlinePromptAdapter implements PromptAdapter {
  async ask(question: string, options?: { secret?: boolean }): Promise<string> {
    const rl = createInterface({ input, output, terminal: true });
    try {
      const prompt = options?.secret ? `${question}` : question;
      const answer = await rl.question(prompt);
      return answer.trim();
    } finally {
      rl.close();
    }
  }
}

export const promptAdapter: PromptAdapter = new ReadlinePromptAdapter();
