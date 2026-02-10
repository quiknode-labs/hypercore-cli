export type DatasetName =
  | 'orders'
  | 'trades'
  | 'events'
  | 'book_updates'
  | 'twap'
  | 'writer_actions'
  | 'blocks';
export type OutputFormat = 'console' | 'json' | 'csv' | 'sqlite';
export type ProgressMode = 'text' | 'json';
export type ConnectionMode = 'quicknode' | 'x402';

export interface Credentials {
  endpoint?: string;
  token?: string;
}

export interface ResolvedCredentials extends Credentials {
  mode: ConnectionMode;
  endpointSource: 'flag' | 'env' | 'saved' | 'prompt';
  tokenSource: 'flag' | 'env' | 'saved' | 'prompt' | 'endpoint';
  walletKey?: string;
  x402BaseUrl?: string;
  x402Network?: string;
  x402Chain?: 'base-sepolia' | 'base';
}

export interface AppLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
