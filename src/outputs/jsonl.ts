import type { NormalizedEvent } from '../types/stream';
import type { OutputWriter, WriterInitContext } from './types';

export class JsonlWriter implements OutputWriter {
  async init(_context: WriterInitContext): Promise<void> {
    return Promise.resolve();
  }

  async write(event: NormalizedEvent): Promise<void> {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  }

  async flush(): Promise<void> {
    return Promise.resolve();
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }
}
