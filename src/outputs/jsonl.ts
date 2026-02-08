import { createWriteStream, type WriteStream } from 'node:fs';

import type { NormalizedEvent } from '../types/stream';
import type { OutputWriter, WriterInitContext } from './types';

export class JsonlWriter implements OutputWriter {
  private readonly filePath: string | undefined;
  private fileStream: WriteStream | null = null;

  constructor(filePath?: string) {
    this.filePath = filePath;
  }

  async init(_context: WriterInitContext): Promise<void> {
    if (this.filePath) {
      this.fileStream = createWriteStream(this.filePath, { flags: 'w', encoding: 'utf8' });
    }
  }

  async write(event: NormalizedEvent): Promise<void> {
    const line = `${JSON.stringify(event)}\n`;
    if (this.fileStream) {
      this.fileStream.write(line);
    } else {
      process.stdout.write(line);
    }
  }

  async flush(): Promise<void> {
    return Promise.resolve();
  }

  async close(): Promise<void> {
    if (this.fileStream) {
      await new Promise<void>((resolve, reject) => {
        this.fileStream!.end(() => resolve());
        this.fileStream!.on('error', reject);
      });
      this.fileStream = null;
    }
  }
}
