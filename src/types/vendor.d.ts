declare module 'viem/accounts' {
  interface PrivateKeyAccount {
    readonly address: `0x${string}`;
    type: 'local';
    signMessage(args: { message: string }): Promise<`0x${string}`>;
    signTypedData(message: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }): Promise<`0x${string}`>;
  }

  export function privateKeyToAccount(privateKey: `0x${string}`): PrivateKeyAccount;
}

declare module 'siwe' {
  interface SiweMessageFields {
    domain: string;
    address: string;
    statement?: string;
    uri: string;
    version: string;
    chainId: number;
    nonce: string;
    issuedAt?: string;
    expirationTime?: string;
    notBefore?: string;
    requestId?: string;
    resources?: string[];
  }

  export class SiweMessage {
    constructor(param: string | SiweMessageFields);
    prepareMessage(): string;
    toMessage(): string;
  }
}

declare module '@x402/fetch' {
  export class x402Client {}

  export function wrapFetchWithPayment(
    fetchFn: typeof globalThis.fetch,
    client: x402Client,
  ): typeof globalThis.fetch;
}

declare module '@x402/evm/exact/client' {
  import type { x402Client } from '@x402/fetch';

  interface ClientEvmSigner {
    readonly address: `0x${string}`;
    signTypedData(message: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }): Promise<`0x${string}`>;
  }

  interface EvmClientConfig {
    signer: ClientEvmSigner;
  }

  export function registerExactEvmScheme(
    client: x402Client,
    config: EvmClientConfig,
  ): x402Client;
}

declare module 'ws' {
  type Handler = (...args: unknown[]) => void;

  export default class WebSocket {
    static readonly OPEN: number;
    readonly readyState: number;

    constructor(address: string);

    on(event: string, handler: Handler): this;
    once(event: string, handler: Handler): this;
    off(event: string, handler: Handler): this;
    send(data: string): void;
    close(): void;
  }
}

declare module 'better-sqlite3' {
  interface Statement {
    run(params?: Record<string, unknown>): unknown;
  }

  interface Database {
    pragma(sql: string): unknown;
    exec(sql: string): unknown;
    prepare(sql: string): Statement;
    close(): void;
  }

  interface DatabaseConstructor {
    new (filename: string): Database;
  }

  const BetterSqlite3: DatabaseConstructor;
  export default BetterSqlite3;
}
