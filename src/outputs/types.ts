import type { DatasetName, OutputFormat } from '../types/common';
import type { NormalizedEvent } from '../types/stream';

export interface WriterInitContext {
  dataset: DatasetName;
}

export interface OutputWriter {
  init(context: WriterInitContext): Promise<void>;
  write(event: NormalizedEvent): Promise<void>;
  flush(): Promise<void>;
  close(): Promise<void>;
}

export interface WriterFactoryInput {
  format: OutputFormat;
  dataset: DatasetName;
  dbPath?: string;
}
