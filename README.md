# @quicknode/hypercore-cli

WebSocket-first CLI for streaming HyperCore data from Quicknode.

## Current Scope (Phase 3 Increment)

- Commands: `config`, `stream`, `backfill`, `sample`, `stats`, `query`
- Datasets: `orders`, `trades`, `events`, `book_updates`, `twap`
- Outputs: `console`, `json`, `csv`, `sqlite`
- Reliability: reconnect with exponential backoff + mandatory reconnect backfill + manual historical backfill
- Security: API token stored in OS keychain (endpoint in local config file)
- Logging safety: endpoint/token values are redacted in command logs and surfaced errors
- Deferred: `blocks` dataset (gRPC-only), gRPC transport integration, `writer_actions`

## Requirements

- Node.js 20+ (Node 22 recommended for native dependency compatibility)
- pnpm 10+
- Access to Quicknode Hyperliquid endpoint and API token

## Install

```bash
pnpm install
pnpm build
```

Run locally:

```bash
node dist/src/index.js --help
```

## Configure Credentials

```bash
node dist/src/index.js config
node dist/src/index.js config --show
node dist/src/index.js config --clear
```

Resolution order for credentialed commands (`stream`, `backfill`, `stats`):

1. CLI flags: `--endpoint`, `--token`
2. Env vars: `QUICKNODE_ENDPOINT`, `QUICKNODE_TOKEN`
3. Saved config + keychain token
4. Interactive prompt

Recommended endpoint format:

```text
wss://ENDPOINT_NAME.hype-mainnet.quiknode.pro/QUICKNODE_TOKEN/hypercore/ws
```

If token is present in the endpoint path, the CLI can extract and use it automatically.

## Commands

### stream

```bash
node dist/src/index.js stream --dataset orders --tokens BTC,ETH
node dist/src/index.js stream --dataset book_updates --output json --limit 10
node dist/src/index.js stream --dataset twap --output csv > twap.csv
node dist/src/index.js stream --dataset trades --output sqlite --db ./trades.db
node dist/src/index.js stream --dataset orders --progress json --limit 5
```

### backfill

```bash
node dist/src/index.js backfill --dataset orders --from 817824078 --to 817824178 --output json
node dist/src/index.js backfill --dataset trades --from 817824078 --to 817824178 --tokens BTC,ETH --output csv > trades.csv
node dist/src/index.js backfill --dataset events --from 817824078 --to 817824178 --output sqlite --db ./events.db
node dist/src/index.js backfill --dataset orders --from 817824078 --to 817824178 --progress json
```

### sample

```bash
node dist/src/index.js sample --list
node dist/src/index.js sample --dataset orders
```

### stats

```bash
node dist/src/index.js stats --dataset orders --tokens BTC,ETH --interval 5
node dist/src/index.js stats --dataset twap --limit 100
node dist/src/index.js stats --dataset trades --progress json --interval 2
```

`--progress` supports:
- `text` (default): human-readable status logs/snapshots
- `json`: machine-readable JSON lines for progress logs (and JSON snapshots for `stats`)

### query

```bash
# One-shot query
node dist/src/index.js query --db ./trades.db --sql "SELECT coin, COUNT(*) AS c FROM trades GROUP BY coin ORDER BY c DESC LIMIT 5"

# Interactive REPL
node dist/src/index.js query --db ./trades.db
```

REPL dot commands:

- `.tables`
- `.schema [table]`
- `.count [table]`
- `.export csv <file> <query>`
- `.export json <file> <query>`
- `.clear`
- `.help`
- `.exit`

For `.export`, wrap file paths with spaces in quotes (example: `.export json "reports/daily trades.json" SELECT * FROM trades`).

## SQLite Runtime Note

`better-sqlite3` is a native dependency. If bindings are missing in your runtime:

```bash
pnpm approve-builds
# approve: better-sqlite3, keytar
pnpm rebuild better-sqlite3 keytar
```

Node mismatch is the most common cause. Prefer Node 22 for rebuild and runtime.

## Development

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Tests use Node's built-in test runner (`node --test`).

Socket reconnect runtime test strategy:

- Default path (`pnpm test`): socket runtime integration test is skipped unless explicitly enabled.
- Enabled path (`pnpm test:socket`): sets `ENABLE_SOCKET_TESTS=1` and runs the reconnect socket test.

## Performance Smoke

Run a lightweight high-event sqlite writer check:

```bash
pnpm perf:smoke
```

Optional tuning:

- `PERF_EVENT_COUNT` (default: `10000`)
- `PERF_MAX_MS` (default: `20000`)

## Large Backfill Recommendations

- Use Node 22 runtime.
- Prefer `--output sqlite --db <path>` for long-range ingestion.
- Use `--batch-size 100` unless endpoint behavior requires a lower value.
- Use `--progress json` for machine-readable monitoring.
- For large ranges, increase heap when needed: `NODE_OPTIONS=--max-old-space-size=4096`

## Packaging

The package is publish-ready with `bin` entry at `bin/hypercore-cli.js` and compiled output in `dist/`.

Dry-run the publish artifact:

```bash
pnpm pack:dry-run
```

Full release workflow: [RELEASE.md](RELEASE.md).
