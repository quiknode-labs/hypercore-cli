import type { DatasetName } from '../types/common';
import type {
  NormalizedBookUpdateEvent,
  NormalizedEvent,
  NormalizedOrderEvent,
  NormalizedSystemEvent,
  NormalizedTradeEvent,
  NormalizedTwapEvent,
  NormalizedWriterActionEvent,
} from '../types/stream';
import type { OutputWriter, WriterInitContext } from './types';

interface BetterSqliteStatement {
  run(params?: Record<string, unknown>): void;
}

interface BetterSqliteDatabase {
  pragma(sql: string): void;
  exec(sql: string): void;
  prepare(sql: string): BetterSqliteStatement;
  close(): void;
}

interface BetterSqliteModule {
  new (filename: string): BetterSqliteDatabase;
}

export class SqliteWriter implements OutputWriter {
  private readonly dbPath: string;
  private db: BetterSqliteDatabase | null = null;
  private dataset: DatasetName | null = null;
  private orderInsert: BetterSqliteStatement | null = null;
  private tradeInsert: BetterSqliteStatement | null = null;
  private eventInsert: BetterSqliteStatement | null = null;
  private bookUpdateInsert: BetterSqliteStatement | null = null;
  private twapInsert: BetterSqliteStatement | null = null;
  private writerActionInsert: BetterSqliteStatement | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async init(context: WriterInitContext): Promise<void> {
    this.dataset = context.dataset;
    const imported = (await import('better-sqlite3')) as unknown as
      | BetterSqliteModule
      | { default: BetterSqliteModule };
    const BetterSqlite = typeof imported === 'function' ? imported : imported.default;
    this.db = new BetterSqlite(this.dbPath);

    this.db.pragma('journal_mode = WAL');
    this.createSchema(this.db);

    this.orderInsert = this.db.prepare(`
      INSERT OR IGNORE INTO orders (
        event_key, block_number, block_time, local_time, user_address, status,
        coin, side, limit_px, sz, orig_sz, order_type, tif, oid, tx_hash,
        cloid, reduce_only, is_trigger, trigger_px, builder_address,
        builder_fee_bps, event_time, raw_json
      ) VALUES (
        @eventKey, @blockNumber, @blockTime, @localTime, @user,
        @status, @coin, @side, @limitPx, @size, @origSize,
        @orderType, @tif, @oid, @txHash, @cloid, @reduceOnly,
        @isTrigger, @triggerPx, @builderAddress, @builderFeeBps,
        @eventTime, @rawJson
      )
    `);

    this.tradeInsert = this.db.prepare(`
      INSERT OR IGNORE INTO trades (
        event_key, block_number, block_time, local_time, user_address, coin,
        side, price, size, oid, tid, tx_hash, fee, fee_token, twap_id,
        builder_address, builder_fee, crossed, direction, event_time_ms, raw_json
      ) VALUES (
        @eventKey, @blockNumber, @blockTime, @localTime, @user, @coin,
        @side, @price, @size, @oid, @tid, @txHash, @fee, @feeToken, @twapId,
        @builderAddress, @builderFee, @crossed, @direction, @eventTimeMs, @rawJson
      )
    `);

    this.eventInsert = this.db.prepare(`
      INSERT OR IGNORE INTO events (
        event_key, block_number, block_time, local_time, event_type,
        delta_type, tx_hash, users_json, event_time, raw_json
      ) VALUES (
        @eventKey, @blockNumber, @blockTime, @localTime, @eventType,
        @deltaType, @txHash, @usersJson, @eventTime, @rawJson
      )
    `);

    this.bookUpdateInsert = this.db.prepare(`
      INSERT OR IGNORE INTO book_updates (
        event_key, block_number, block_time, local_time, user_address,
        oid, coin, side, price, diff_type, sz, raw_json
      ) VALUES (
        @eventKey, @blockNumber, @blockTime, @localTime, @user,
        @oid, @coin, @side, @price, @diffType, @size, @rawJson
      )
    `);

    this.twapInsert = this.db.prepare(`
      INSERT OR IGNORE INTO twap (
        event_key, block_number, block_time, local_time, twap_id,
        status, coin, user_address, side, sz, executed_sz,
        executed_ntl, minutes, reduce_only, randomize, state_timestamp,
        event_time, raw_json
      ) VALUES (
        @eventKey, @blockNumber, @blockTime, @localTime, @twapId,
        @status, @coin, @user, @side, @size, @executedSize,
        @executedNotional, @minutes, @reduceOnly, @randomize, @stateTimestamp,
        @eventTime, @rawJson
      )
    `);

    this.writerActionInsert = this.db.prepare(`
      INSERT OR IGNORE INTO writer_actions (
        event_key, block_number, block_time, local_time, user_address,
        nonce, evm_tx_hash, action_type, destination, token, wei,
        event_time, raw_json
      ) VALUES (
        @eventKey, @blockNumber, @blockTime, @localTime, @user,
        @nonce, @evmTxHash, @actionType, @destination, @token, @wei,
        @eventTime, @rawJson
      )
    `);
  }

  async write(event: NormalizedEvent): Promise<void> {
    if (!this.db || !this.dataset) {
      throw new Error('SQLite writer not initialized');
    }

    switch (event.stream) {
      case 'orders':
        this.orderInsert?.run(orderRow(event));
        return;
      case 'trades':
        this.tradeInsert?.run(tradeRow(event));
        return;
      case 'events':
        this.eventInsert?.run(systemEventRow(event));
        return;
      case 'book_updates':
        this.bookUpdateInsert?.run(bookUpdateRow(event));
        return;
      case 'twap':
        this.twapInsert?.run(twapRow(event));
        return;
      case 'writer_actions':
        this.writerActionInsert?.run(writerActionRow(event));
        return;
    }
  }

  async flush(): Promise<void> {
    return Promise.resolve();
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }

  private createSchema(db: BetterSqliteDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        block_number INTEGER NOT NULL,
        block_time TEXT NOT NULL,
        local_time TEXT NOT NULL,
        user_address TEXT NOT NULL,
        status TEXT NOT NULL,
        coin TEXT NOT NULL,
        side TEXT NOT NULL,
        limit_px TEXT,
        sz TEXT,
        orig_sz TEXT,
        order_type TEXT,
        tif TEXT,
        oid INTEGER,
        tx_hash TEXT,
        cloid TEXT,
        reduce_only INTEGER,
        is_trigger INTEGER,
        trigger_px TEXT,
        builder_address TEXT,
        builder_fee_bps INTEGER,
        event_time TEXT,
        raw_json TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_orders_coin ON orders(coin);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_address);

      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        block_number INTEGER NOT NULL,
        block_time TEXT NOT NULL,
        local_time TEXT NOT NULL,
        user_address TEXT NOT NULL,
        coin TEXT NOT NULL,
        side TEXT NOT NULL,
        price TEXT NOT NULL,
        size TEXT NOT NULL,
        oid INTEGER,
        tid INTEGER,
        tx_hash TEXT,
        fee TEXT,
        fee_token TEXT,
        twap_id INTEGER,
        builder_address TEXT,
        builder_fee TEXT,
        crossed INTEGER,
        direction TEXT,
        event_time_ms INTEGER,
        raw_json TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_trades_coin ON trades(coin);
      CREATE INDEX IF NOT EXISTS idx_trades_tid ON trades(tid);
      CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_address);

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        block_number INTEGER NOT NULL,
        block_time TEXT NOT NULL,
        local_time TEXT NOT NULL,
        event_type TEXT NOT NULL,
        delta_type TEXT,
        tx_hash TEXT,
        users_json TEXT NOT NULL,
        event_time TEXT,
        raw_json TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_delta_type ON events(delta_type);

      CREATE TABLE IF NOT EXISTS book_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        block_number INTEGER NOT NULL,
        block_time TEXT NOT NULL,
        local_time TEXT NOT NULL,
        user_address TEXT,
        oid INTEGER,
        coin TEXT NOT NULL,
        side TEXT NOT NULL,
        price TEXT NOT NULL,
        diff_type TEXT NOT NULL,
        sz TEXT,
        raw_json TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_book_updates_coin ON book_updates(coin);
      CREATE INDEX IF NOT EXISTS idx_book_updates_oid ON book_updates(oid);

      CREATE TABLE IF NOT EXISTS twap (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        block_number INTEGER NOT NULL,
        block_time TEXT NOT NULL,
        local_time TEXT NOT NULL,
        twap_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        coin TEXT NOT NULL,
        user_address TEXT NOT NULL,
        side TEXT NOT NULL,
        sz TEXT NOT NULL,
        executed_sz TEXT,
        executed_ntl TEXT,
        minutes INTEGER,
        reduce_only INTEGER,
        randomize INTEGER,
        state_timestamp INTEGER,
        event_time TEXT,
        raw_json TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_twap_status ON twap(status);
      CREATE INDEX IF NOT EXISTS idx_twap_coin ON twap(coin);
      CREATE INDEX IF NOT EXISTS idx_twap_id ON twap(twap_id);

      CREATE TABLE IF NOT EXISTS writer_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        block_number INTEGER NOT NULL,
        block_time TEXT NOT NULL,
        local_time TEXT NOT NULL,
        user_address TEXT NOT NULL,
        nonce INTEGER,
        evm_tx_hash TEXT,
        action_type TEXT NOT NULL,
        destination TEXT,
        token TEXT,
        wei TEXT,
        event_time TEXT,
        raw_json TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_writer_actions_user ON writer_actions(user_address);
      CREATE INDEX IF NOT EXISTS idx_writer_actions_type ON writer_actions(action_type);
      CREATE INDEX IF NOT EXISTS idx_writer_actions_token ON writer_actions(token);
    `);
  }
}

function orderRow(event: NormalizedOrderEvent): Record<string, unknown> {
  return {
    ...event,
    reduceOnly: event.reduceOnly == null ? null : Number(event.reduceOnly),
    isTrigger: event.isTrigger == null ? null : Number(event.isTrigger),
  };
}

function tradeRow(event: NormalizedTradeEvent): Record<string, unknown> {
  return {
    ...event,
    crossed: event.crossed == null ? null : Number(event.crossed),
  };
}

function systemEventRow(event: NormalizedSystemEvent): Record<string, unknown> {
  return {
    ...event,
    usersJson: JSON.stringify(event.users),
  };
}

function bookUpdateRow(event: NormalizedBookUpdateEvent): Record<string, unknown> {
  return {
    ...event,
  };
}

function twapRow(event: NormalizedTwapEvent): Record<string, unknown> {
  return {
    ...event,
    reduceOnly: event.reduceOnly == null ? null : Number(event.reduceOnly),
    randomize: event.randomize == null ? null : Number(event.randomize),
  };
}

function writerActionRow(event: NormalizedWriterActionEvent): Record<string, unknown> {
  return {
    ...event,
  };
}
