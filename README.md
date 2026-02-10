# @quicknode/hypercore-cli

> **Note for reviewers**: While reviewing this CLI tool locally, check the [Local Development Setup](#local-development-setup) section for instructions on how to build, run, and test the CLI. Use `node dist/src/index.js` to run the built CLI from the command line, instead of `hypercore-cli`, as the package is not published to npm yet. 
For example: `node dist/src/index.js stream --dataset trades --tokens BTC,ETH --limit 20`

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
| **Real-time streaming** | Subscribe to live feeds for orders, trades, events, book updates, TWAP, writer actions, and blocks |
| **Dual transport: WSS + gRPC** | Choose WebSocket (default) or gRPC (`--transport grpc`) for lower latency and binary Protobuf encoding |
| **Auto-reconnect + gap recovery** | Exponential backoff reconnection with automatic JSON-RPC backfill — zero data loss on network drops |
| **Historical backfill** | Fetch any block range via JSON-RPC and export to JSON, CSV, or SQLite |
| **Auto file output** | CSV, JSON, and SQLite outputs are automatically written to timestamped files — no manual naming needed |
| **Built-in SQL query engine** | Interactive REPL and one-shot SQL against your local SQLite data |
| **7 datasets** | `orders` · `trades` · `events` · `book_updates` · `twap` · `writer_actions` · `blocks` (gRPC-only) |
| **4 output formats** | Pretty console, JSON lines, CSV, and SQLite persistence |
| **Server-side filtering** | Filter by coin, user address, or order status before data leaves the server |
| **Automation-ready** | `--progress json` emits machine-readable telemetry to stderr for scripts and pipelines |
| **Secure credential handling** | OS keychain storage, 4-tier credential resolution, full token redaction in logs |
| **Interactive wizards** | Stream and backfill can run with step-by-step prompts for dataset selection, filters, output format, limits, and block ranges |

---

## Quick Start

### Prerequisites

- **Node.js** >= 20 (22 recommended)
- A **Quicknode account** with a Hyperliquid endpoint ([sign up](https://www.quicknode.com/signup))

> **Pricing:** HyperCore usage is billed through your Quicknode plan. See [Quicknode HyperCore pricing](https://www.quicknode.com/docs/hyperliquid/pricing) for details.

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

The interactive prompt will ask for your WSS endpoint. The CLI auto-extracts the token from the URL path and derives the gRPC endpoint automatically — no need to split or configure them separately.

> Credentials are stored securely: the endpoint goes to `~/.hypercore-cli/config.json` and the token is saved to your OS keychain (or a local file with `0600` permissions if the keychain is unavailable).

### Step 4 — Stream your first data

```bash
hypercore-cli stream --dataset trades --tokens BTC,ETH --limit 20
```

You should see real-time Hyperliquid trades printed to your terminal. That's it — you're connected.

---

## Commands

Every command supports `--help` to show all available flags and their default values:

```bash
hypercore-cli stream --help
hypercore-cli backfill --help
hypercore-cli stats --help
hypercore-cli query --help
hypercore-cli sample --help
hypercore-cli config --help
```

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

See what each dataset looks like before you commit to a full stream or backfill. Includes documentation links, field descriptions, and sample payloads.

```bash
hypercore-cli sample --list              # List all datasets with docs links
hypercore-cli sample --dataset orders    # Inspect orders payload structure
hypercore-cli sample --dataset blocks    # Inspect raw block payload structure
```

### `stream` — Real-time streaming (WSS + gRPC)

Subscribe to live data over WebSocket or gRPC with optional server-side filtering. Use `--help` to see all flags and defaults.

#### Interactive mode

Run `stream` with no flags to launch the interactive wizard:

```bash
hypercore-cli stream
```

```
? Select dataset:
❯ orders           - Order lifecycle events
  trades           - Executed fills with price and size
  events           - System events and balance updates
  book updates     - Level 2 order book updates
  twap             - TWAP order status updates
  writer actions   - System writer actions and bridge operations
  blocks           - Raw block data (gRPC only)

? Transport:
❯ WSS  - WebSocket (default)
  gRPC - gRPC transport

? Filter by coins (e.g. BTC or BTC,ETH, or 'all'): BTC,ETH
? Filter by users (e.g. 0x123 or 0x123,0x456, or 'all'): all
? Filter by statuses (e.g. open or open,filled,canceled, or 'all'): all
? Output format:
❯ console - Pretty formatted terminal output
  json    - JSON lines (one object per line)
  csv     - CSV format
  sqlite  - Save to SQLite database
? Event limit (number, or 0 for unlimited): 50

🚀 Streaming orders for BTC, ETH...
```

The wizard detects when you are in a terminal (TTY) and walks through dataset selection, transport, filters, output format, and event limit step by step. Any flag you provide on the command line skips the corresponding wizard step. If you select a gRPC-only dataset (e.g. `blocks`), the transport step is automatically set to gRPC.

#### Flag-based usage

```bash
# Stream all orders (WebSocket, default)
hypercore-cli stream --dataset orders

# Use gRPC transport for lower latency
hypercore-cli stream --dataset trades --transport grpc --tokens BTC,ETH

# Stream raw blocks (gRPC-only dataset, transport auto-selected)
hypercore-cli stream --dataset blocks --output json --limit 100

# Filter by multiple coins and user addresses
hypercore-cli stream --dataset trades --tokens BTC,ETH --users 0x123,0x456

# Filter orders by status (orders dataset only)
hypercore-cli stream --dataset orders --statuses open,filled

# JSON output to auto-generated file, capped at 50 events
hypercore-cli stream --dataset book_updates --output json --limit 50

# Force JSON output to stdout instead of file
hypercore-cli stream --dataset trades --output json --limit 10 --stdout

# Persist directly to SQLite (auto-generates .db file)
hypercore-cli stream --dataset trades --output sqlite --limit 1000

# SQLite with a custom file path
hypercore-cli stream --dataset trades --output sqlite --path ./trades.db --limit 1000
```

**Key flags:**

| Flag | Description | Default |
|---|---|---|
| `--dataset` | Dataset to stream (see [Datasets](#datasets)) | _(prompted)_ |
| `--transport` | Transport protocol: `wss`, `grpc` | `wss` |
| `--tokens` | Filter by coins, e.g. `BTC` or `BTC,ETH` | _(none)_ |
| `--users` | Filter by user addresses, e.g. `0x123` or `0x123,0x456` | _(none)_ |
| `--statuses` | Filter by order status (orders only), e.g. `open` or `open,filled` | _(none)_ |
| `--output` | Output format: `console`, `json`, `csv`, `sqlite` | `console` |
| `--limit` | Stop after N events (0 = unlimited) | `0` |
| `--path` | Override auto-generated output file path (csv, json, sqlite) | _(auto-generated)_ |
| `--stdout` | Write csv/json to stdout instead of auto-generated file | `false` |

If the connection drops, the CLI automatically reconnects with exponential backoff and backfills any missed blocks via JSON-RPC — no manual intervention needed.

### `backfill` — Historical block range ingestion

Fetch past data via JSON-RPC. Useful for research, backtesting, or seeding a local database. Use `--help` to see all flags and defaults. Note: gRPC-only datasets (like `blocks`) are not available for backfill.

#### Interactive mode

Run `backfill` with missing required inputs to launch the interactive wizard:

```bash
hypercore-cli backfill
```

```
? Select dataset:
❯ orders           - Order lifecycle events
  trades           - Executed fills with price and size
  events           - System events and balance updates
  book updates     - Level 2 order book updates
  twap             - TWAP order status updates
  writer actions   - System writer actions and bridge operations

? Start block (inclusive) (number): 887643588
? End block (inclusive) (number): 887643688
? Batch size (1-200) (100): 100
? Filter by coins (e.g. BTC or BTC,ETH, or 'all'): BTC
? Filter by users (e.g. 0x123 or 0x123,0x456, or 'all'): all
? Filter by statuses (e.g. open or open,filled,canceled, or 'all'): filled
? Output format:
❯ console - Pretty formatted terminal output
  json    - JSON lines (one object per line)
  csv     - CSV format
  sqlite  - Save to SQLite database
? Event limit (number, or 0 for unlimited): 0
```

The wizard runs in a terminal (TTY) when `--dataset`, `--from`, or `--to` is missing. Any flag you provide skips the corresponding wizard step.

```bash
# Export a block range as JSON (auto-generates output file)
hypercore-cli backfill --dataset orders --from 887643588 --to 887643688 --output json

# Filter and export to CSV
hypercore-cli backfill --dataset trades --from 887643588 --to 887643688 \
  --tokens BTC,ETH --output csv

# Force output to stdout for piping
hypercore-cli backfill --dataset trades --from 887643588 --to 887643688 \
  --output csv --stdout > trades.csv

# Ingest into SQLite (auto-generates .db file)
hypercore-cli backfill --dataset events --from 887643588 --to 887643688 \
  --output sqlite

# SQLite with a custom file path
hypercore-cli backfill --dataset events --from 887643588 --to 887643688 \
  --output sqlite --path ./events.db

# Tune batch size (up to 200) and enable JSON progress for automation
hypercore-cli backfill --dataset writer_actions --from 887643588 --to 887643688 \
  --batch-size 150 --progress json
```

**Key flags:**

| Flag | Description | Default |
|---|---|---|
| `--from` | Start block number (inclusive) | _(prompted in TTY; required otherwise)_ |
| `--to` | End block number (inclusive) | _(prompted in TTY; required otherwise)_ |
| `--batch-size` | JSON-RPC batch size (1–200) | `100` |
| `--output` | Output format: `console`, `json`, `csv`, `sqlite` | `console` |
| `--path` | Override auto-generated output file path (csv, json, sqlite) | _(auto-generated)_ |
| `--stdout` | Write csv/json to stdout instead of auto-generated file | `false` |
| `--progress` | Progress output mode: `text`, `json` | `text` |

### `stats` — Live stream statistics

Monitor event rates and counters in real time. Supports both WSS and gRPC transports. Use `--help` to see all flags and defaults.

```bash
hypercore-cli stats --dataset orders --interval 5
hypercore-cli stats --dataset trades --transport grpc --tokens BTC,ETH --limit 200
hypercore-cli stats --dataset blocks --interval 2
hypercore-cli stats --dataset writer_actions --progress json --interval 2
```

**Key flags:**

| Flag | Description | Default |
|---|---|---|
| `--transport` | Transport protocol: `wss`, `grpc` | `wss` |
| `--interval` | Snapshot print interval in seconds | `5` |
| `--limit` | Stop after N events (0 = unlimited) | `0` |
| `--progress` | Progress output mode: `text`, `json` | `text` |

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

## Output Formats

| Format | Flag | Best for |
|---|---|---|
| Pretty console | `--output console` (default) | Interactive exploration, live monitoring |
| JSON lines | `--output json` | Piping to `jq`, scripts, downstream services |
| CSV | `--output csv` | Spreadsheets, pandas, R, data analysis |
| SQLite | `--output sqlite` | Local research DB, SQL queries, long-running ingestion |

### Auto file output

When using `--output json`, `--output csv`, or `--output sqlite`, the CLI automatically generates a timestamped output file in the current directory:

```
stream-trades-BTC-20260208-084441241.csv
backfill-orders-20260208-091022103.json
stream-trades-20260208-084441241.db
```

The file path is logged on startup so you always know where your data is going. Use `--path` to override the auto-generated name:

```bash
hypercore-cli stream --dataset trades --output sqlite --path ./my-trades.db
```

To write csv/json to stdout instead (for piping), use `--stdout`:

```bash
hypercore-cli stream --dataset trades --output json --stdout | jq .coin
```

---

## Datasets

| Dataset | Description | Stream | Backfill | Volume | Docs |
|---|---|---|---|---|---|
| `orders` | Order lifecycle — open, filled, canceled, rejected | WSS, gRPC | Yes | Very High | [Docs](https://www.quicknode.com/docs/hyperliquid/datasets/orders) |
| `trades` | Executed fills with price, size, and fee details | WSS, gRPC | Yes | High | [Docs](https://www.quicknode.com/docs/hyperliquid/datasets/trades) |
| `events` | System events — liquidations, funding, settlements | WSS, gRPC | Yes | Medium | [Docs](https://www.quicknode.com/docs/hyperliquid/datasets/events) |
| `book_updates` | Level 2 order book changes (bids/asks) | WSS, gRPC | Yes | Very High | [Docs](https://www.quicknode.com/docs/hyperliquid/datasets/book-updates) |
| `twap` | TWAP order execution tracking | WSS, gRPC | Yes | Low | [Docs](https://www.quicknode.com/docs/hyperliquid/datasets/twap) |
| `writer_actions` | HyperCore-to-HyperEVM bridge transfers | WSS, gRPC | Yes | Low | [Docs](https://www.quicknode.com/docs/hyperliquid/datasets/writer-actions) |
| `blocks` | Raw block data — all L1 transactions and responses | gRPC only | No | Very High | [Docs](https://www.quicknode.com/docs/hyperliquid/datasets/blocks) |

Browse all datasets interactively:

```bash
hypercore-cli sample --list
hypercore-cli sample --dataset trades
```

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
hypercore-cli backfill --dataset trades --from 887643588 --to 887644588 \
  --output sqlite --path ./research.db

hypercore-cli query --db ./research.db \
  --sql "SELECT coin, COUNT(*) AS fills, ROUND(SUM(size), 2) AS volume FROM trades GROUP BY coin ORDER BY volume DESC"
```

### CSV export for spreadsheets or pandas

```bash
# Auto-generates a timestamped .csv file
hypercore-cli backfill --dataset orders --from 887643588 --to 887643688 \
  --tokens BTC --statuses filled --output csv

# Or pipe to a specific file
hypercore-cli backfill --dataset orders --from 887643588 --to 887643688 \
  --tokens BTC --statuses filled --output csv --stdout > btc_fills.csv
```

### Monitor order book depth

```bash
hypercore-cli stream --dataset book_updates --tokens ETH --output json --limit 100
```

### Stream raw L1 blocks

Access every transaction on Hyperliquid — orders, cancels, transfers, vault ops, and more — via the gRPC-only `blocks` dataset:

```bash
hypercore-cli stream --dataset blocks --output json --limit 50
```

### Track HyperCore-to-HyperEVM bridge activity

```bash
hypercore-cli stream --dataset writer_actions --output json
```

### Automation and CI pipelines

Use `--progress json` for machine-readable status, and `--limit` for bounded runs:

```bash
hypercore-cli stream --dataset orders --progress json --limit 500 2>progress.log
hypercore-cli backfill --dataset events --from 887643588 --to 887643688 --progress json
```

JSON progress lines are emitted to `stderr`, keeping `stdout` clean for data output.

### Explore before you ingest

Not sure which dataset fits your use case? Browse them all:

```bash
hypercore-cli sample --list
hypercore-cli sample --dataset blocks
hypercore-cli sample --dataset writer_actions
```

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

```
SQLite native module failed to load. This usually means better-sqlite3 was compiled for a different Node.js version.
```

Fix with:

```bash
pnpm approve-builds          # approve: better-sqlite3, keytar
pnpm rebuild better-sqlite3 keytar
```

Use **Node 22** for best compatibility.

### Block range out of history

```
JSON-RPC error -32000: ... The requested block range may be outside available history.
```

The requested blocks may no longer be available. Try a more recent block range (e.g. blocks near `887643588`).

---

## Contributing

### Local development setup

```bash
git clone https://github.com/quiknode-labs/hypercore-cli.git
cd hypercore-cli
```

Use one package manager:

```bash
# pnpm
pnpm install
pnpm build
node dist/src/index.js --help
```

```bash
# npm
npm install
npm run build
node dist/src/index.js --help
```

```bash
# yarn
yarn install
yarn build
node dist/src/index.js --help
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

---

## Architecture

The CLI supports **dual transport** — WebSocket (default) and gRPC — for real-time streaming, with **JSON-RPC** for historical backfill. Key architectural choices:

- **Pluggable transport layer** — `stream` and `stats` accept `--transport wss` or `--transport grpc`; gRPC-only datasets (like `blocks`) auto-select gRPC
- **Auto-reconnect with gap recovery** — on disconnect, the CLI backfills missed blocks via `hl_getBatchBlocks` before resuming the live stream
- **Shared stream runtime** — `stream` and `stats` share the same reconnect/backfill pipeline, so reliability improvements apply everywhere
- **Central dataset registry** — adding a new dataset is mechanical: register it, write a normalizer, and all commands + outputs work automatically
- **Bounded dedupe memory** — long-running streams won't leak memory; dedupe keys are pruned by block retention window

---

## Roadmap

- [x] gRPC transport integration (higher throughput, binary Protobuf encoding)
- [x] `blocks` dataset support (raw L1 transactions, gRPC-only)

---

## License

MIT
