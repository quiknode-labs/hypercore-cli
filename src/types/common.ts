export type DatasetName = 'orders' | 'trades' | 'events' | 'book_updates' | 'twap';
export type OutputFormat = 'console' | 'json' | 'csv' | 'sqlite';
export type ProgressMode = 'text' | 'json';

export interface Credentials {
  endpoint: string;
  token: string;
}

export interface ResolvedCredentials extends Credentials {
  endpointSource: 'flag' | 'env' | 'saved' | 'prompt';
  tokenSource: 'flag' | 'env' | 'saved' | 'prompt' | 'endpoint';
}

export interface AppLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
