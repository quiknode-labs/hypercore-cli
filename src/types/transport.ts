export type TransportType = 'wss' | 'grpc';

export interface StreamTransport {
  connectAndRun(abortSignal: AbortSignal): Promise<'closed' | 'aborted'>;
  closeGracefully(): Promise<void>;
}
