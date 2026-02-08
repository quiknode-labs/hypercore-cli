# @quicknode/hypercore-cli

Developer-friendly CLI for exploring, streaming, and backfilling Hypercore data from Quicknode Hyperliquid endpoints.

This project is WebSocket-first for real-time data plus JSON-RPC for historical backfill. It is designed for fast onboarding, scriptability, and production-safe logging.

## Why This CLI

- Explore Hypercore datasets without writing custom ingestion code.
- Stream real-time market/system data with reconnect and gap recovery.
- Backfill historical block ranges into `json`, `csv`, or `sqlite`.
- Query collected data locally with built-in SQL and export helpers.

## Features

- Commands: `config`, `sample`, `stream`, `backfill`, `stats`, `query`
- Datasets: `orders`, `trades`, `events`, `book_updates`, `twap`, `writer_actions`
- Outputs: `console`, `json`, `csv`, `sqlite`
- Reliability: exponential reconnect + mandatory reconnect backfill
- Progress modes: `--progress text|json` for automation-friendly observability
- Security:
  - Endpoint/token redaction in logs and surfaced errors
  - Token storage in OS keychain when available
  - Automatic fallback to local token file with `0600` permissions when keychain backend is unavailable

## Deferred Scope

- gRPC transport integration
- `blocks` dataset support (gRPC-only)

## Requirements

- Node.js `>=20` (Node `22` recommended)
- pnpm `10+` for local development
- A Quicknode Hyperliquid endpoint and API token

## Installation

Run directly with npx:

```bash
npx @quicknode/hypercore-cli --help
```

Install globally:

```bash
npm install -g @quicknode/hypercore-cli
hypercore-cli --help
```

Run from source:

```bash
pnpm install
pnpm build
node dist/src/index.js --help
```

## Quick Start (5 Minutes)

1. Create/sign in to your [Quicknode account](https://www.quicknode.com/signup).
2. Create a [Hyperliquid](https://www.quicknode.com/chains/hyperliquid) endpoint.
3. Select the WSS endpoint and copy the Hypercore URL. (Example: `wss://YOUR_ENDPOINT_NAME.hype-mainnet.quiknode.pro/YOUR_TOKEN/hypercore/ws`)
4. Configure credentials.
5. Start streaming.


Setup credentials:

```bash
hypercore-cli config
```

Start with a live stream:

```bash
hypercore-cli stream --dataset trades --tokens BTC,ETH --limit 20
```

This command subscribes to the `trades` dataset, filtering for events involving `BTC` and `ETH`, and limits the output to 20 events. You should see real-time trade data printed to your console as it arrives.

## Credentials and Security Model

Credential resolution order for `stream`, `backfill`, and `stats`:

1. CLI flags: `--endpoint`, `--token`
2. Environment variables: `QUICKNODE_ENDPOINT`, `QUICKNODE_TOKEN`
3. Saved config/token
4. Interactive prompt

Storage behavior:

- Endpoint is saved to `~/.hypercore-cli/config.json`
- Token is saved to OS keychain when available
- If keychain backend is unavailable, token is saved to `~/.hypercore-cli/token` with `0600` permissions to restrict access
- `config --show` redacts endpoint token path and masks token output

Notes:

- You can pass host-only endpoint + token separately.
- If token is present in endpoint path, CLI auto-extracts it.
- Sensitive values are redacted from runtime logs and top-level errors.

## Command Guide

### `config`

Manage saved credentials.

```bash
hypercore-cli config
hypercore-cli config --show
hypercore-cli config --clear
```

### `sample`

Discover datasets and inspect sample payload structure before ingestion.

```bash
hypercore-cli sample --list
hypercore-cli sample --dataset orders
hypercore-cli sample --dataset writer_actions
```

### `stream`

Subscribe to real-time data via WebSocket.

```bash
# basic
hypercore-cli stream --dataset orders

# token and user filters
hypercore-cli stream --dataset trades --tokens BTC,ETH --users 0xabc...,0xdef...

# orders-only status filter
hypercore-cli stream --dataset orders --statuses open,filled

# machine-readable output
hypercore-cli stream --dataset book_updates --output json --limit 50

# sqlite sink
hypercore-cli stream --dataset trades --output sqlite --db ./trades.db --limit 1000
```

### `backfill`

Fetch historical ranges via JSON-RPC and emit normalized events.

```bash
# basic range
hypercore-cli backfill --dataset orders --from 817824078 --to 817824178 --output json

# filtered CSV export
hypercore-cli backfill --dataset trades --from 817824078 --to 817824178 --tokens BTC,ETH --output csv > trades.csv

# sqlite historical ingestion
hypercore-cli backfill --dataset events --from 817824078 --to 817824178 --output sqlite --db ./events.db

# tune batch size and progress mode
hypercore-cli backfill --dataset writer_actions --from 817824078 --to 817824178 --batch-size 50 --progress json
```

### `stats`

Live counters and rate snapshots for a dataset.

```bash
hypercore-cli stats --dataset orders --interval 5
hypercore-cli stats --dataset trades --tokens BTC,ETH --limit 200
hypercore-cli stats --dataset writer_actions --progress json --interval 2
```

### `query`

Run SQL against collected SQLite data.

```bash
# one-shot query
hypercore-cli query --db ./trades.db --sql "SELECT coin, COUNT(*) AS c FROM trades GROUP BY coin ORDER BY c DESC LIMIT 5"

# interactive REPL
hypercore-cli query --db ./trades.db
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

## End-to-End Use Cases

### 1) Live market watch in terminal

```bash
hypercore-cli stream --dataset trades --tokens BTC,ETH --output console
```

### 2) Build a local research DB from historical range

```bash
hypercore-cli backfill --dataset trades --from 817824078 --to 817825078 --output sqlite --db ./research.db
hypercore-cli query --db ./research.db --sql "SELECT coin, COUNT(*) AS n FROM trades GROUP BY coin ORDER BY n DESC"
```

### 3) Automation-friendly progress logs

```bash
hypercore-cli stream --dataset orders --progress json --limit 500
hypercore-cli backfill --dataset events --from 817824078 --to 817824178 --progress json
```

### 4) Dataset exploration before production ingestion

```bash
hypercore-cli sample --list
hypercore-cli sample --dataset twap
```

## Troubleshooting

### `Missing Quicknode credentials`

Provide credentials via flags, env vars, or run:

```bash
hypercore-cli config
```

### `System keychain is unavailable`-type environment issues

Token storage automatically falls back to `~/.hypercore-cli/token` with `0600` permissions.

### `better-sqlite3` native binding errors

Most common root cause is Node/runtime mismatch. Use Node 22, then rebuild:

```bash
pnpm approve-builds
# approve: better-sqlite3, keytar
pnpm rebuild better-sqlite3 keytar
```

## Development

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Socket reconnect runtime test:

```bash
pnpm test:socket
```

## Performance Smoke

```bash
pnpm perf:smoke
```

Optional env tuning:

- `PERF_EVENT_COUNT` (default `10000`)
- `PERF_MAX_MS` (default `20000`)

## Packaging and Release

Dry-run publish artifact:

```bash
pnpm pack:dry-run
```

Release checklist: [RELEASE.md](RELEASE.md)

## Documentation

- [PROJECT.md](PROJECT.md)
- [DOCS_INDEX.md](DOCS_INDEX.md)
- [ADR.md](ADR.md)
- [PHASE2_PLAN.md](PHASE2_PLAN.md)
- [PHASE3_PLAN.md](PHASE3_PLAN.md)
