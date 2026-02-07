# PROJECT.md - HyperCore CLI

## Overview

A developer-friendly CLI tool for exploring and collecting Hyperliquid Core (L1) data via Quicknode's gRPC streaming API.

**Purpose:** Enable developers to quickly explore HyperCore datasets, filter by tokens/users, and optionally persist data to SQLite for analysis - all without writing code.

**Complements:** [hypercore-grpc-examples](https://github.com/quiknode-labs/hypercore-grpc-examples) which shows *how to connect*. This CLI shows *what you can do* with the data.

---

## Installation & Usage

```bash
# Run directly with npx (no install)
$ npx @quicknode/hypercore-cli

# Or install globally
$ npm install -g @quicknode/hypercore-cli
$ hypercore-cli
```

---

## Credential Management

The CLI needs a Quicknode HyperCore gRPC endpoint and API token. Credentials are resolved in this priority order:

### 1. CLI Flags (Highest Priority)
```bash
$ hypercore-cli stream \
  --endpoint your-endpoint.grpc.quiknode.pro:443 \
  --token your-api-token \
  --dataset orders
```

### 2. Environment Variables
```bash
export QUICKNODE_ENDPOINT="your-endpoint.grpc.quiknode.pro:443"
export QUICKNODE_TOKEN="your-api-token"

$ hypercore-cli stream --dataset orders
```

### 3. Config File
Stored at `~/.hypercore-cli/config.json`:
```json
{
  "endpoint": "your-endpoint.grpc.quiknode.pro:443",
  "token": "your-api-token"
}
```

### 4. Interactive Prompt (Fallback)
If no credentials found, the CLI prompts:
```
⚠️  No Quicknode credentials found!

? Enter your Quicknode gRPC endpoint:
  (Get one at https://quicknode.com/chains/hl)

? Enter your API token:

? Save credentials for future use? (Y/n)
```

### Config Command
```bash
# Set up or update credentials
$ hypercore-cli config

? Quicknode gRPC endpoint: your-endpoint.grpc.quiknode.pro:443
? API token: ********
? Save credentials? Yes

✅ Saved to ~/.hypercore-cli/config.json

# View current config (token masked)
$ hypercore-cli config --show
Endpoint: your-endpoint.grpc.quiknode.pro:443
Token: ****...****

# Clear saved credentials
$ hypercore-cli config --clear
```

---

## Commands

### `stream` - Stream Real-Time Data

The main command for streaming HyperCore data.

#### Interactive Mode
```bash
$ hypercore-cli stream

? Select dataset:
❯ orders    - Order lifecycle (open, filled, canceled, rejected)
  trades    - Executed fills with price and size
  events    - System events (liquidations, funding, settlements)
  books     - Orderbook updates (bids/asks changes)
  twap      - TWAP order executions
  blocks    - Raw L1 transactions (highest volume)

? Filter by tokens (comma-separated, or 'all'): BTC, ETH

? Filter by users (comma-separated, or 'all'): all

? Output format:
❯ console   - Pretty formatted terminal output
  json      - JSON lines (one object per line)
  csv       - CSV format
  sqlite    - Save to SQLite database

🚀 Streaming orders for BTC, ETH...

[12:54:48] FILLED   alice.eth bought 40 XRP @ $2.0576 (Limit GTC)
[12:54:48] OPEN     0x258a...ff03 bought 597 HBAR @ $0.11675 (Limit ALO)
[12:54:48] CANCELED 0x258a...ff03 HBAR buy order canceled
```

#### Direct Mode (Scriptable)
```bash
# Basic usage
$ hypercore-cli stream --dataset orders --tokens BTC,ETH

# With user filter
$ hypercore-cli stream --dataset orders --users 0x72358ece...,0x258a4b8a...

# Status filter (orders only)
$ hypercore-cli stream --dataset orders --statuses open,filled

# Output to JSON (great for piping)
$ hypercore-cli stream --dataset trades --tokens BTC --output json | jq '.price'

# Save to SQLite
$ hypercore-cli stream --dataset orders --output sqlite --db ./orders.db

# CSV output to file
$ hypercore-cli stream --dataset trades --tokens ETH --output csv > eth-trades.csv
```

#### Stream Options

| Flag | Description | Default |
|------|-------------|---------|
| `--dataset, -d` | Dataset to stream (required) | - |
| `--tokens, -t` | Filter by tokens (comma-separated) | all |
| `--users, -u` | Filter by wallet addresses | all |
| `--statuses, -s` | Filter by status (orders only) | all |
| `--output, -o` | Output format: console, json, csv, sqlite | console |
| `--db` | SQLite database path (required if output=sqlite) | - |
| `--limit, -l` | Stop after N events (0 = unlimited) | 0 |
| `--quiet, -q` | Suppress status messages | false |

---

### `query` - SQL Query Interface

Interactive SQL REPL for querying collected data.

```bash
$ hypercore-cli query --db ./orders.db

Connected to ./orders.db
Tables: orders (15,234 rows)

hypercore> .schema orders
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  event_id TEXT UNIQUE,
  oid INTEGER,
  user_address TEXT,
  status TEXT,
  coin TEXT,
  side TEXT,
  order_type TEXT,
  limit_px TEXT,
  sz TEXT,
  orig_sz TEXT,
  tif TEXT,
  block_number INTEGER,
  block_time TEXT,
  tx_hash TEXT,
  created_at TEXT
);

hypercore> SELECT coin, COUNT(*) as count FROM orders GROUP BY coin ORDER BY count DESC LIMIT 5;
┌──────┬───────┐
│ coin │ count │
├──────┼───────┤
│ BTC  │ 5,234 │
│ ETH  │ 3,891 │
│ SOL  │ 2,456 │
│ XRP  │ 1,823 │
│ DOGE │ 1,102 │
└──────┴───────┘

hypercore> SELECT status, COUNT(*) FROM orders WHERE coin='BTC' GROUP BY status;
┌──────────┬──────────┐
│ status   │ COUNT(*) │
├──────────┼──────────┤
│ filled   │ 3,102    │
│ open     │ 1,245    │
│ canceled │ 887      │
└──────────┴──────────┘

hypercore> .export csv btc_fills.csv SELECT * FROM orders WHERE coin='BTC' AND status='filled';
Exported 3,102 rows to btc_fills.csv

hypercore> .exit
```

#### Query Commands

| Command | Description |
|---------|-------------|
| `.tables` | List all tables |
| `.schema [table]` | Show table schema |
| `.count [table]` | Count rows in table |
| `.export csv <file> <query>` | Export query results to CSV |
| `.export json <file> <query>` | Export query results to JSON |
| `.clear` | Clear screen |
| `.help` | Show help |
| `.exit` | Exit REPL |

---

### `sample` - View Dataset Samples

Fetch and display sample data from each dataset to understand the structure.

```bash
$ hypercore-cli sample --dataset orders

📦 Orders Dataset Sample
========================

Orders track the full lifecycle of trading orders on Hyperliquid.
Statuses: open, filled, triggered, canceled, marginCanceled, and 15+ more

Sample event:
{
  "time": "2026-01-16T04:54:48.716513415",
  "user": "0x72358ece04efcf447dbed03968809160635a5843",
  "hash": "0x258978278b03086f270304336f4fd00202f8000d...",
  "status": "filled",
  "order": {
    "coin": "XRP",
    "side": "B",
    "limitPx": "2.0576",
    "sz": "0.0",
    "origSz": "40.0",
    "orderType": "Limit",
    "tif": "Gtc",
    "oid": 295452566826,
    ...
  }
}

Key fields:
  • coin     - Trading pair (BTC, ETH, xyz:NVDA for predictions, @162 for spot)
  • side     - "B" (buy) or "A" (ask/sell)
  • status   - Order state (open, filled, canceled, rejected...)
  • limitPx  - Limit price
  • sz       - Remaining size (0.0 when filled)
  • origSz   - Original order size
  • tif      - Time-in-force (Gtc, Alo, Ioc, FrontendMarket)

Use cases:
  • Track order flow for specific traders
  • Monitor fill rates and rejection reasons
  • Build trading dashboards
```

```bash
# List all available datasets
$ hypercore-cli sample --list

Available HyperCore Datasets:
┌─────────┬────────────────────────────────────────────────┬────────────┐
│ Dataset │ Description                                    │ Volume     │
├─────────┼────────────────────────────────────────────────┼────────────┤
│ orders  │ Order lifecycle (placement → fill/cancel)      │ Very High  │
│ trades  │ Executed fills with price and size             │ High       │
│ events  │ System events (liquidations, funding)          │ Medium     │
│ books   │ Orderbook bid/ask updates                      │ Very High  │
│ twap    │ TWAP order slice executions                    │ Low        │
│ blocks  │ Raw L1 transactions (most comprehensive)       │ Extreme    │
└─────────┴────────────────────────────────────────────────┴────────────┘

Run 'hypercore-cli sample --dataset <name>' for details.
```

---

### `stats` - Stream Statistics

Monitor stream statistics in real-time.

```bash
$ hypercore-cli stats --dataset orders --tokens BTC,ETH

📊 Live Statistics (BTC, ETH orders)
====================================

Running for: 5m 23s
Total events: 12,456

By Status:
  filled:   8,234 (66.1%)  ████████████████████░░░░░░░░░░
  open:     2,891 (23.2%)  ███████░░░░░░░░░░░░░░░░░░░░░░░
  canceled: 1,102 (8.8%)   ███░░░░░░░░░░░░░░░░░░░░░░░░░░░
  rejected:   229 (1.8%)   █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

By Coin:
  BTC: 7,823 (62.8%)
  ETH: 4,633 (37.2%)

Events/sec: 38.6 (avg), 124 (peak)
Last event: 0.2s ago

Press 'q' to quit, 's' to save snapshot
```

---

## Output Formats

### Console (Default)
Human-readable, colored output optimized for terminal viewing.

```
[12:54:48] FILLED   alice.eth bought 40 XRP @ $2.0576 (Limit GTC)
                    OID: 295452566826 | Size: 40.0 | Block: 862932944

[12:54:48] OPEN     0x258a...ff03 bought 597 HBAR @ $0.11675 (Limit ALO)
                    OID: 295452566198 | Reduce Only | Block: 862932944

[12:54:48] CANCELED 0x258a...ff03 - HBAR buy canceled
                    OID: 295452566198 | Original: 597.0 @ $0.11675
```

### JSON Lines
One JSON object per line - perfect for piping to `jq` or other tools.

```json
{"event_id":"862932944:295452566826","status":"filled","user":"0x72358ece...","coin":"XRP","side":"B","limit_px":"2.0576","sz":"0.0","orig_sz":"40.0","order_type":"Limit","tif":"Gtc","block_number":862932944,"block_time":"2026-01-16T04:54:48.716513415"}
{"event_id":"862932944:295452566198","status":"open","user":"0x258a4b8a...","coin":"HBAR","side":"B","limit_px":"0.11675","sz":"597.0","orig_sz":"597.0","order_type":"Limit","tif":"Alo","block_number":862932944,"block_time":"2026-01-16T04:54:48.716513415"}
```

### CSV
Standard CSV format for spreadsheet import.

```csv
event_id,status,user,coin,side,limit_px,sz,orig_sz,order_type,tif,block_number,block_time
862932944:295452566826,filled,0x72358ece...,XRP,B,2.0576,0.0,40.0,Limit,Gtc,862932944,2026-01-16T04:54:48.716513415
862932944:295452566198,open,0x258a4b8a...,HBAR,B,0.11675,597.0,597.0,Limit,Alo,862932944,2026-01-16T04:54:48.716513415
```

### SQLite
Persists data to a local SQLite database for later querying.

```bash
$ hypercore-cli stream --dataset orders --output sqlite --db ./data.db

💾 Saving to ./data.db

[12:54:48] FILLED   XRP buy - saved
[12:54:48] OPEN     HBAR buy - saved
[12:54:48] CANCELED HBAR - saved

Events saved: 1,234 | DB size: 2.1 MB

# Later, query with:
$ hypercore-cli query --db ./data.db
```

---

## Datasets Reference

### Orders
Order lifecycle events - placement, fills, cancellations, rejections.

```bash
$ hypercore-cli stream --dataset orders
```

**Key fields:** `status`, `coin`, `side`, `limitPx`, `sz`, `origSz`, `orderType`, `tif`

**Statuses:**
- Success: `open`, `filled`, `triggered`
- Cancellation: `canceled`, `marginCanceled`, `reduceOnlyCanceled`, `scheduledCancel`, `selfTradeCanceled`, `siblingFilledCanceled`, `openInterestCapCanceled`
- Rejection: `badAloPxRejected`, `iocCancelRejected`, `perpMarginRejected`, `oracleRejected`, `insufficientSpotBalanceRejected`, `minTradeNtlRejected`, `perpMaxPositionRejected`, `reduceOnlyRejected`, `positionFlipAtOpenInterestCapRejected`, `positionIncreaseAtOpenInterestCapRejected`, `tooAggressiveAtOpenInterestCapRejected`

**Use cases:** Order flow analysis, fill rate monitoring, rejection debugging

---

### Trades
Executed trade fills with price and size.

```bash
$ hypercore-cli stream --dataset trades
```

**Key fields:** `coin`, `side`, `px` (price), `sz` (size), `time`, `tid` (trade ID)

**Use cases:** Volume tracking, price feeds, trade history

---

### Events
System-level events including liquidations, funding payments, and settlements.

```bash
$ hypercore-cli stream --dataset events
```

**Key fields:** `type`, `user`, `details` (varies by event type)

**Use cases:** Liquidation monitoring, funding rate tracking

---

### Books
Orderbook updates - bid/ask changes.

```bash
$ hypercore-cli stream --dataset books
```

**Key fields:** `coin`, `side`, `px`, `sz`, `n` (number of orders at level)

**Use cases:** Market making, spread monitoring, depth analysis

---

### TWAP
Time-Weighted Average Price order executions.

```bash
$ hypercore-cli stream --dataset twap
```

**Key fields:** `coin`, `side`, `px`, `sz`, `twapId`

**Use cases:** TWAP execution tracking

---

### Blocks
Raw L1 transactions - most comprehensive but highest volume.

```bash
$ hypercore-cli stream --dataset blocks
```

**Key fields:** `round`, `time`, `actions[]`, `resps[]`

**Use cases:** Full L1 analysis, custom processing

---

## SQLite Schema

When using `--output sqlite`, the following tables are created:

### Orders Table
```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT UNIQUE NOT NULL,
  oid INTEGER NOT NULL,
  user_address TEXT NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL,
  coin TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT,
  limit_px TEXT,
  sz TEXT,
  orig_sz TEXT,
  tif TEXT,
  cloid TEXT,
  is_trigger INTEGER DEFAULT 0,
  trigger_px TEXT,
  reduce_only INTEGER DEFAULT 0,
  network TEXT DEFAULT 'hypercore-mainnet',
  block_number INTEGER NOT NULL,
  block_time TEXT NOT NULL,
  local_time TEXT,
  builder TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user ON orders(user_address);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_coin ON orders(coin);
CREATE INDEX idx_orders_block_time ON orders(block_time);
```

### Trades Table
```sql
CREATE TABLE trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_id INTEGER NOT NULL,
  coin TEXT NOT NULL,
  side TEXT NOT NULL,
  price TEXT NOT NULL,
  size TEXT NOT NULL,
  time TEXT NOT NULL,
  user_address TEXT,
  block_number INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trades_coin ON trades(coin);
CREATE INDEX idx_trades_time ON trades(time);
```

*(Similar schemas for events, books, twap)*

---

## Example Workflows

### 1. Quick Exploration
"I want to see what HyperCore data looks like"

```bash
# See sample data structure
$ npx @quicknode/hypercore-cli sample --dataset orders

# Stream a few live events
$ npx @quicknode/hypercore-cli stream --dataset orders --limit 10
```

### 2. Token Monitoring
"I want to watch all BTC and ETH activity"

```bash
$ hypercore-cli stream --dataset orders --tokens BTC,ETH
```

### 3. Whale Tracking
"I want to track specific large traders"

```bash
$ hypercore-cli stream --dataset orders \
  --users 0x72358ece...,0x258a4b8a...,0xabcd1234... \
  --output sqlite --db ./whales.db
```

### 4. Data Collection for Analysis
"I want to collect a day's worth of trades for analysis"

```bash
# Start collector (run in background or tmux)
$ hypercore-cli stream --dataset trades --output sqlite --db ./trades-2026-01-22.db

# Later, analyze with SQL
$ hypercore-cli query --db ./trades-2026-01-22.db
hypercore> SELECT coin, SUM(CAST(size AS REAL) * CAST(price AS REAL)) as volume 
           FROM trades GROUP BY coin ORDER BY volume DESC;
```

### 5. Rejection Analysis
"I want to understand why orders are being rejected"

```bash
$ hypercore-cli stream --dataset orders \
  --statuses badAloPxRejected,perpMarginRejected,insufficientSpotBalanceRejected \
  --output json | jq -s 'group_by(.status) | map({status: .[0].status, count: length})'
```

### 6. Real-Time Dashboard Feed
"I want JSON data to feed into my dashboard"

```bash
# JSON output, pipe to your app
$ hypercore-cli stream --dataset orders --tokens BTC --output json --quiet | node my-dashboard.js
```

---

## Technical Architecture

```
hypercore-cli/
├── bin/
│   └── hypercore-cli.js        # Entry point with shebang
├── src/
│   ├── index.js                # Main CLI setup (commander)
│   ├── commands/
│   │   ├── stream.js           # stream command
│   │   ├── query.js            # query command (SQL REPL)
│   │   ├── sample.js           # sample command
│   │   ├── stats.js            # stats command
│   │   └── config.js           # config command
│   ├── grpc/
│   │   ├── client.js           # gRPC client setup
│   │   └── proto/              # Protocol buffer definitions
│   ├── datasets/
│   │   ├── index.js            # Dataset registry
│   │   ├── orders.js           # Orders formatting/schema
│   │   ├── trades.js           # Trades formatting/schema
│   │   ├── events.js           
│   │   ├── books.js            
│   │   ├── twap.js             
│   │   └── blocks.js           
│   ├── outputs/
│   │   ├── console.js          # Pretty terminal output
│   │   ├── json.js             # JSON lines output
│   │   ├── csv.js              # CSV output
│   │   └── sqlite.js           # SQLite persistence
│   ├── filters/
│   │   └── index.js            # Token/user/status filtering
│   ├── config/
│   │   └── credentials.js      # Credential management
│   └── utils/
│       ├── format.js           # Formatting helpers
│       └── tables.js           # Table rendering
├── package.json
├── README.md
└── LICENSE
```

---

## Dependencies

```json
{
  "dependencies": {
    "@grpc/grpc-js": "^1.9.0",
    "@grpc/proto-loader": "^0.7.0",
    "commander": "^11.0.0",
    "inquirer": "^9.0.0",
    "better-sqlite3": "^9.0.0",
    "chalk": "^5.0.0",
    "ora": "^7.0.0",
    "cli-table3": "^0.6.0",
    "conf": "^12.0.0"
  }
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Project setup with commander
- [ ] Credential management (env, config file, prompts)
- [ ] gRPC client connection
- [ ] Basic `config` command

### Phase 2: Stream Command
- [ ] Orders dataset streaming
- [ ] Console output formatter
- [ ] Token/user filtering
- [ ] JSON output
- [ ] CSV output

### Phase 3: SQLite Integration
- [ ] SQLite writer for orders
- [ ] `query` command with REPL
- [ ] Schema management
- [ ] Export commands

### Phase 4: Additional Datasets
- [ ] Trades dataset
- [ ] Events dataset
- [ ] Books dataset
- [ ] TWAP dataset
- [ ] Blocks dataset (basic)

### Phase 5: Enhanced Features
- [ ] `sample` command
- [ ] `stats` command
- [ ] Status filtering (orders)
- [ ] Interactive mode improvements

### Phase 6: Polish & Publish
- [ ] Error handling
- [ ] Help documentation
- [ ] README with examples
- [ ] Publish to npm

---

## Related Resources

- [HyperCore gRPC Examples](https://github.com/quiknode-labs/hypercore-grpc-examples)
- [Quicknode HyperCore Documentation](https://www.quicknode.com/docs/hyperliquid/datasets)
- [Hyperliquid API Documentation](https://hyperliquid.gitbook.io/hyperliquid-docs/)