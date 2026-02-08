# @quicknode/hypercore-cli

Stream, backfill, and analyze [Hyperliquid L1](https://hyperliquid.gitbook.io/hyperliquid-docs/) data from the terminal — powered by [Quicknode HyperCore](https://www.quicknode.com/docs/hyperliquid/datasets).

```bash
npx @quicknode/hypercore-cli stream --dataset trades --tokens BTC,ETH --limit 20
```

```
[817824092] TRADES 0x4f2a…c301 BTC buy 0.12 @ 104281.0
[817824092] TRADES 0xb8e1…7f03 ETH sell 3.5 @ 3412.50
[817824093] TRADES 0x91cd…a842 BTC sell 0.05 @ 104279.0
...
```

No boilerplate. No custom ingestion code. Just real-time Hyperliquid data.

---

## Key Features

| Feature | What it does |
|---|---|
| **Real-time streaming** | Subscribe to live WebSocket feeds for orders, trades, events, book updates, TWAP, and writer actions |
| **Auto-reconnect + gap recovery** | Exponential backoff reconnection with automatic JSON-RPC backfill — zero data loss on network drops |
| **Historical backfill** | Fetch any block range via JSON-RPC and export to JSON, CSV, or SQLite |
| **Built-in SQL query engine** | Interactive REPL and one-shot SQL against your local SQLite data |
| **6 datasets** | `orders` · `trades` · `events` · `book_updates` · `twap` · `writer_actions` |
| **4 output formats** | Pretty console, JSON lines, CSV, and SQLite persistence |
| **Server-side filtering** | Filter by coin, user address, or order status before data leaves the server |
| **Automation-ready** | `--progress json` emits machine-readable telemetry to stderr for scripts and pipelines |
| **Secure credential handling** | OS keychain storage, 4-tier credential resolution, full token redaction in logs |

---

## Quick Start

### Prerequisites

- **Node.js** >= 20 (22 recommended)
- A **Quicknode account** with a Hyperliquid endpoint ([sign up](https://www.quicknode.com/signup))

### Step 1 — Install

Pick one:

```bash
# Run instantly with npx (no install)
npx @quicknode/hypercore-cli --help

# Or install globally
npm install -g @quicknode/hypercore-cli
```

### Step 2 — Get your Quicknode Hyperliquid endpoint

1. Log in to your [Quicknode dashboard](https://dashboard.quicknode.com/).
2. Create or select a **Hyperliquid** endpoint.
3. Copy the **WSS URL** — it looks like:
   ```
   wss://YOUR-ENDPOINT.hype-mainnet.quiknode.pro/YOUR-TOKEN/hypercore/ws
   ```

### Step 3 — Configure credentials

```bash
hypercore-cli config
```

The interactive prompt will ask for your WSS endpoint. The CLI auto-extracts the token from the URL path — no need to split it manually.

> Credentials are stored securely: the endpoint goes to `~/.hypercore-cli/config.json` and the token is saved to your OS keychain (or a local file with `0600` permissions if the keychain is unavailable).

### Step 4 — Stream your first data

```bash
hypercore-cli stream --dataset trades --tokens BTC,ETH --limit 20
```

You should see real-time Hyperliquid trades printed to your terminal. That's it — you're connected.

---

## Commands

### `config` — Credential management

```bash
hypercore-cli config          # Interactive setup
hypercore-cli config --show   # View saved config (token masked, endpoint redacted)
hypercore-cli config --clear  # Remove all saved credentials
```

Credentials can also be provided via CLI flags (`--endpoint`, `--token`) or environment variables (`QUICKNODE_ENDPOINT`, `QUICKNODE_TOKEN`). Resolution order:

1. CLI flags (highest priority)
2. Environment variables
3. Saved config/keychain
4. Interactive prompt (fallback)

### `sample` — Explore datasets before ingestion

See what each dataset looks like before you commit to a full stream or backfill.

```bash
hypercore-cli sample --list              # List all available datasets
hypercore-cli sample --dataset orders    # Inspect orders payload structure
hypercore-cli sample --dataset twap      # Inspect TWAP payload structure
```

### `stream` — Real-time WebSocket streaming

Subscribe to live data with optional server-side filtering.

```bash
# Stream all orders
hypercore-cli stream --dataset orders

# Filter by coins and user addresses
hypercore-cli stream --dataset trades --tokens BTC,ETH --users 0xabc...,0xdef...

# Filter orders by status
hypercore-cli stream --dataset orders --statuses open,filled

# JSON lines output, capped at 50 events
hypercore-cli stream --dataset book_updates --output json --limit 50

# Persist directly to SQLite
hypercore-cli stream --dataset trades --output sqlite --db ./trades.db --limit 1000
```

If the connection drops, the CLI automatically reconnects with exponential backoff and backfills any missed blocks via JSON-RPC — no manual intervention needed.

### `backfill` — Historical block range ingestion

Fetch past data via JSON-RPC. Useful for research, backtesting, or seeding a local database.

```bash
# Export a block range as JSON
hypercore-cli backfill --dataset orders --from 817824078 --to 817824178 --output json

# Filter and pipe to CSV
hypercore-cli backfill --dataset trades --from 817824078 --to 817824178 \
  --tokens BTC,ETH --output csv > trades.csv

# Ingest into SQLite
hypercore-cli backfill --dataset events --from 817824078 --to 817824178 \
  --output sqlite --db ./events.db

# Tune batch size and enable JSON progress for automation
hypercore-cli backfill --dataset writer_actions --from 817824078 --to 817824178 \
  --batch-size 50 --progress json
```

### `stats` — Live stream statistics

Monitor event rates and counters in real time.

```bash
hypercore-cli stats --dataset orders --interval 5
hypercore-cli stats --dataset trades --tokens BTC,ETH --limit 200
hypercore-cli stats --dataset writer_actions --progress json --interval 2
```

### `query` — SQL against collected data

Run ad-hoc SQL against any SQLite database created by `stream` or `backfill`.

```bash
# One-shot query
hypercore-cli query --db ./trades.db \
  --sql "SELECT coin, COUNT(*) AS c FROM trades GROUP BY coin ORDER BY c DESC LIMIT 5"

# Interactive REPL
hypercore-cli query --db ./trades.db
```

**REPL commands:**

| Command | Description |
|---|---|
| `.tables` | List all tables |
| `.schema [table]` | Show table schema |
| `.count [table]` | Row count |
| `.export csv <file> <query>` | Export query results to CSV |
| `.export json <file> <query>` | Export query results to JSON |
| `.clear` | Clear screen |
| `.help` | Show all commands |
| `.exit` | Quit |

---

## Use Cases

### Live market watch

Stream BTC and ETH trades directly to your terminal:

```bash
hypercore-cli stream --dataset trades --tokens BTC,ETH
```

### Build a local research database

Backfill a block range into SQLite, then query it:

```bash
hypercore-cli backfill --dataset trades --from 817824078 --to 817825078 \
  --output sqlite --db ./research.db

hypercore-cli query --db ./research.db \
  --sql "SELECT coin, COUNT(*) AS fills, ROUND(SUM(size), 2) AS volume FROM trades GROUP BY coin ORDER BY volume DESC"
```

### CSV export for spreadsheets or pandas

```bash
hypercore-cli backfill --dataset orders --from 817824078 --to 817824178 \
  --tokens BTC --statuses filled --output csv > btc_fills.csv
```

### Monitor order book depth

```bash
hypercore-cli stream --dataset book_updates --tokens ETH --output json --limit 100
```

### Track HyperCore-to-HyperEVM bridge activity

```bash
hypercore-cli stream --dataset writer_actions --output json
```

### Automation and CI pipelines

Use `--progress json` for machine-readable status, and `--limit` for bounded runs:

```bash
hypercore-cli stream --dataset orders --progress json --limit 500 2>progress.log
hypercore-cli backfill --dataset events --from 817824078 --to 817824178 --progress json
```

JSON progress lines are emitted to `stderr`, keeping `stdout` clean for data output.

### Explore before you ingest

Not sure which dataset fits your use case? Browse them all:

```bash
hypercore-cli sample --list
hypercore-cli sample --dataset twap
hypercore-cli sample --dataset writer_actions
```

---

## Datasets

| Dataset | Description | Key fields |
|---|---|---|
| `orders` | Order lifecycle — open, filled, canceled, rejected, and more | coin, side, size, price, status, user |
| `trades` | Executed fills with maker/taker details | coin, side, size, price, fee, user |
| `events` | System events — liquidations, funding, settlements, ledger updates | eventType, deltaType, users |
| `book_updates` | Level 2 order book changes (bids/asks) | coin, side, price, size, nOrders |
| `twap` | TWAP order execution tracking | coin, side, size, price, twapId |
| `writer_actions` | HyperCore-to-HyperEVM bridge transfers and system writer actions | actionType, user, data |

---

## Output Formats

| Format | Flag | Best for |
|---|---|---|
| Pretty console | `--output console` (default) | Interactive exploration, live monitoring |
| JSON lines | `--output json` | Piping to `jq`, scripts, downstream services |
| CSV | `--output csv` | Spreadsheets, pandas, R, data analysis |
| SQLite | `--output sqlite --db <path>` | Local research DB, SQL queries, long-running ingestion |

---

## Troubleshooting

### Missing Quicknode credentials

```
Error: Missing Quicknode credentials
```

Run the interactive config, or pass credentials directly:

```bash
hypercore-cli config

# Or use environment variables
export QUICKNODE_ENDPOINT="wss://your-endpoint.hype-mainnet.quiknode.pro/your-token/hypercore/ws"
export QUICKNODE_TOKEN="your-token"

# Or use CLI flags
hypercore-cli stream --endpoint wss://... --token your-token --dataset trades
```

### Keychain unavailable

If your environment doesn't support a system keychain (headless servers, containers), the CLI automatically falls back to storing the token in `~/.hypercore-cli/token` with `0600` permissions. No action needed.

### `better-sqlite3` native binding errors

This usually means the native module was compiled for a different Node version. Fix with:

```bash
pnpm approve-builds          # approve: better-sqlite3, keytar
pnpm rebuild better-sqlite3 keytar
```

Use **Node 22** for best compatibility.

---

## Contributing

### Setup

```bash
git clone https://github.com/quiknode-labs/hypercore-cli.git
cd hypercore-cli
pnpm install
pnpm build
```

### Development workflow

```bash
pnpm typecheck    # Type checking
pnpm lint         # Lint
pnpm test         # Unit + integration tests
pnpm build        # Compile TypeScript
```

### Additional test suites

```bash
pnpm test:socket  # WebSocket reconnect integration test (requires ENABLE_SOCKET_TESTS=1)
pnpm perf:smoke   # SQLite writer performance smoke test
```

### Packaging

```bash
pnpm pack:dry-run   # Verify tarball contents before publish
```

See [RELEASE.md](RELEASE.md) for the full publish checklist.

---

## Architecture

The CLI is built on a **WebSocket-first** design for real-time streaming with **JSON-RPC** for historical backfill. Key architectural choices:

- **Auto-reconnect with gap recovery** — on disconnect, the CLI backfills missed blocks via `hl_getBatchBlocks` before resuming the live stream (see [ADR-002](ADR.md#adr-002-auto-backfill-on-reconnection))
- **Shared stream runtime** — `stream` and `stats` share the same reconnect/backfill pipeline, so reliability improvements apply everywhere
- **Central dataset registry** — adding a new dataset is mechanical: register it, write a normalizer, and all commands + outputs work automatically
- **Bounded dedupe memory** — long-running streams won't leak memory; dedupe keys are pruned by block retention window

For the full list of architecture decisions, see [ADR.md](ADR.md).

---

## Roadmap

- [ ] gRPC transport integration (higher throughput, compression)
- [ ] `blocks` dataset support (raw L1 transactions, gRPC-only)

---

## Documentation

| Document | Description |
|---|---|
| [DOCS_INDEX.md](DOCS_INDEX.md) | Full documentation index |
| [PROJECT.md](PROJECT.md) | Complete project specification |
| [ADR.md](ADR.md) | Architecture Decision Records |
| [RELEASE.md](RELEASE.md) | Publish checklist |
| [PROGRESS.md](PROGRESS.md) | Implementation progress tracker |

---

## License

MIT
