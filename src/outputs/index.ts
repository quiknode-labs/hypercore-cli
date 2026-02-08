import type { OutputWriter } from './types';
import type { WriterFactoryInput } from './types';
import { ConsoleWriter } from './console';
import { CsvWriter } from './csv';
import { JsonlWriter } from './jsonl';
import { SqliteWriter } from './sqlite';

export function createWriter(input: WriterFactoryInput): OutputWriter {
  switch (input.format) {
    case 'console':
      return new ConsoleWriter();
    case 'json':
      return new JsonlWriter(input.filePath);
    case 'csv':
      return new CsvWriter(input.filePath);
    case 'sqlite':
      if (!input.dbPath) {
        throw new Error('--db is required when --output sqlite');
      }
      return new SqliteWriter(input.dbPath);
    default: {
      const neverFormat: never = input.format;
      throw new Error(`Unsupported output format: ${String(neverFormat)}`);
    }
  }
}
