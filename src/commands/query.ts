import { writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { Command } from 'commander';

import { toCsvLine } from '../utils/csv';
import { renderTable } from '../utils/table';

interface QueryOptions {
  db?: string;
  sql?: string;
}

interface BetterSqliteStatement {
  all(params?: unknown[] | Record<string, unknown>): Array<Record<string, unknown>>;
  get(params?: unknown[] | Record<string, unknown>): Record<string, unknown> | undefined;
  run(params?: unknown[] | Record<string, unknown>): { changes: number };
}

interface BetterSqliteDatabase {
  prepare(sql: string): BetterSqliteStatement;
  close(): void;
}

interface BetterSqliteModule {
  new (filename: string): BetterSqliteDatabase;
}

export function registerQueryCommand(program: Command): void {
  program
    .command('query')
    .description('Run SQL queries against a HyperCore SQLite database')
    .requiredOption('--db <path>', 'SQLite DB path')
    .option('--sql <query>', 'Execute one SQL query and exit')
    .action(async (options: QueryOptions) => {
      await queryAction(options);
    });
}

async function queryAction(options: QueryOptions): Promise<void> {
  const dbPath = options.db?.trim();
  if (!dbPath) {
    throw new Error('--db is required');
  }

  const db = await openDatabase(dbPath);

  try {
    const tables = listTables(db);
    process.stdout.write(`Connected to ${dbPath}\n`);
    process.stdout.write(
      tables.length > 0 ? `Tables: ${tables.join(', ')}\n` : 'Tables: (none)\n',
    );

    if (options.sql?.trim()) {
      await executeSqlAndPrint(db, options.sql.trim());
      return;
    }

    await runRepl(db);
  } finally {
    db.close();
  }
}

async function openDatabase(path: string): Promise<BetterSqliteDatabase> {
  let imported: BetterSqliteModule | { default: BetterSqliteModule };
  try {
    imported = (await import('better-sqlite3')) as unknown as
      | BetterSqliteModule
      | { default: BetterSqliteModule };
  } catch {
    throw new Error(
      'better-sqlite3 is unavailable. Run pnpm approve-builds and pnpm rebuild better-sqlite3 keytar (Node 22 recommended).',
    );
  }

  const BetterSqlite = typeof imported === 'function' ? imported : imported.default;
  try {
    return new BetterSqlite(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Could not locate the bindings file')) {
      throw new Error(
        'better-sqlite3 native binding is missing for this runtime. Run pnpm approve-builds and pnpm rebuild better-sqlite3 keytar (Node 22 recommended).',
      );
    }
    throw error;
  }
}

async function runRepl(db: BetterSqliteDatabase): Promise<void> {
  const rl = createInterface({ input, output, terminal: true });
  process.stdout.write("Type .help for commands. Type .exit to quit.\n\n");

  try {
    while (true) {
      const line = (await rl.question('hypercore> ')).trim();
      if (!line) {
        continue;
      }

      try {
        if (line.startsWith('.')) {
          const shouldExit = await handleDotCommand(db, line);
          if (shouldExit) {
            break;
          }
          continue;
        }

        await executeSqlAndPrint(db, line);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stdout.write(`Error: ${message}\n\n`);
      }
    }
  } finally {
    rl.close();
  }
}

async function handleDotCommand(db: BetterSqliteDatabase, line: string): Promise<boolean> {
  if (line === '.exit' || line === '.quit') {
    return true;
  }

  if (line === '.help') {
    process.stdout.write(
      [
        '.tables                          List all tables',
        '.schema [table]                  Show schema for one table or all tables',
        '.count [table]                   Count rows in one table or all tables',
        '.export csv <file> <query>       Export query results as CSV',
        '.export json <file> <query>      Export query results as JSON',
        '.clear                           Clear the screen',
        '.exit                            Exit the REPL',
        '',
      ].join('\n'),
    );
    return false;
  }

  if (line === '.tables') {
    const tables = listTables(db);
    process.stdout.write(tables.length > 0 ? `${tables.join('\n')}\n\n` : '(no tables)\n\n');
    return false;
  }

  if (line.startsWith('.schema')) {
    const table = line.replace('.schema', '').trim();
    if (table) {
      assertSafeIdentifier(table);
      const row = db
        .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`)
        .get([table]);
      process.stdout.write(`${row?.sql ?? `No schema found for table '${table}'.`}\n\n`);
      return false;
    }

    const rows = db
      .prepare(`SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all();
    process.stdout.write(renderTable(rows));
    process.stdout.write('\n');
    return false;
  }

  if (line.startsWith('.count')) {
    const table = line.replace('.count', '').trim();
    if (table) {
      assertSafeIdentifier(table);
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
      process.stdout.write(`${table}: ${row?.count ?? 0}\n\n`);
      return false;
    }

    const tables = listTables(db);
    const rows = tables.map((tableName) => {
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
      return { table: tableName, count: row?.count ?? 0 };
    });
    process.stdout.write(renderTable(rows));
    process.stdout.write('\n');
    return false;
  }

  if (line.startsWith('.export')) {
    const parsed = parseExportCommand(line);
    const format = parsed.format;
    const filePath = parsed.filePath;
    const query = parsed.query;

    const rows = db.prepare(query).all();
    if (format === 'json') {
      await writeFile(filePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
    } else {
      const csv = toCsv(rows);
      await writeFile(filePath, csv, 'utf8');
    }

    process.stdout.write(`Exported ${rows.length} rows to ${filePath}\n\n`);
    return false;
  }

  if (line === '.clear') {
    process.stdout.write('\x1Bc');
    return false;
  }

  throw new Error(`Unknown dot command '${line}'. Type .help for available commands.`);
}

async function executeSqlAndPrint(db: BetterSqliteDatabase, sql: string): Promise<void> {
  const statement = db.prepare(sql);
  const head = sql.trim().split(/\s+/)[0]?.toUpperCase() ?? '';

  if (isReadQuery(head)) {
    const rows = statement.all();
    process.stdout.write(renderTable(rows));
    process.stdout.write('\n');
    return;
  }

  const result = statement.run();
  process.stdout.write(`OK. Rows changed: ${result.changes}\n\n`);
}

function isReadQuery(head: string): boolean {
  return ['SELECT', 'PRAGMA', 'WITH', 'EXPLAIN'].includes(head);
}

export function parseExportCommand(line: string): {
  format: 'csv' | 'json';
  filePath: string;
  query: string;
} {
  const trimmed = line.trim();
  if (!trimmed.startsWith('.export')) {
    throw new Error("Invalid .export syntax. Use '.export csv <file> <query>' or '.export json <file> <query>'.");
  }

  let cursor = '.export'.length;
  const formatToken = readToken(trimmed, cursor);
  if (!formatToken) {
    throw new Error("Invalid .export syntax. Missing format (csv|json).");
  }
  const format = formatToken.value.toLowerCase();
  if (format !== 'csv' && format !== 'json') {
    throw new Error(`Invalid .export format '${formatToken.value}'. Expected csv or json.`);
  }

  cursor = formatToken.nextIndex;
  const fileToken = readToken(trimmed, cursor);
  if (!fileToken || fileToken.value.trim().length === 0) {
    throw new Error("Invalid .export syntax. Missing <file> path.");
  }

  cursor = fileToken.nextIndex;
  const query = trimmed.slice(cursor).trim();
  if (!query) {
    throw new Error("Invalid .export syntax. Missing SQL <query>.");
  }

  return {
    format,
    filePath: fileToken.value,
    query,
  };
}

function listTables(db: BetterSqliteDatabase): string[] {
  const rows = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    .all();
  return rows.map((row) => String(row.name));
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const lines = [toCsvLine(headers)];

  for (const row of rows) {
    const values = headers.map((header) => {
      const value = row[header];
      if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
      }
      return value as string | number | boolean | null | undefined;
    });
    lines.push(toCsvLine(values));
  }

  return `${lines.join('\n')}\n`;
}

function assertSafeIdentifier(value: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe table name '${value}'.`);
  }
}

function readToken(
  inputLine: string,
  fromIndex: number,
): { value: string; nextIndex: number } | null {
  let index = fromIndex;
  while (index < inputLine.length && /\s/.test(inputLine[index])) {
    index += 1;
  }
  if (index >= inputLine.length) {
    return null;
  }

  const quote = inputLine[index];
  if (quote === '"' || quote === '\'') {
    index += 1;
    let value = '';
    while (index < inputLine.length) {
      const char = inputLine[index];
      if (char === '\\' && index + 1 < inputLine.length) {
        value += inputLine[index + 1];
        index += 2;
        continue;
      }
      if (char === quote) {
        index += 1;
        return { value, nextIndex: index };
      }
      value += char;
      index += 1;
    }

    throw new Error('Unterminated quoted token in .export command.');
  }

  const start = index;
  while (index < inputLine.length && !/\s/.test(inputLine[index])) {
    index += 1;
  }
  return { value: inputLine.slice(start, index), nextIndex: index };
}
