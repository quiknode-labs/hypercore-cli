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
