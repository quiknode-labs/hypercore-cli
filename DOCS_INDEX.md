# Documentation Index

Quick reference guide to all documentation in the @quicknode/hypercore-cli project.

## Project Documentation

- **[PROJECT.md](PROJECT.md)** - Complete project specification with all commands, datasets, and usage examples
- **[README.md](README.md)** - Installation guide and quick start
- **[PROGRESS.md](PROGRESS.md)** - Implementation progress tracker (updated across chat sessions)
- **[ADR.md](ADR.md)** - Architecture Decision Records
- **[PHASE2_PLAN.md](PHASE2_PLAN.md)** - Phase 2 architecture audit, scope decisions, milestones, and acceptance criteria
- **[PHASE3_PLAN.md](PHASE3_PLAN.md)** - Phase 3 roadmap and contracts (historical ingestion + hardening)
- **[RELEASE.md](RELEASE.md)** - Publish checklist (Node 22, native rebuild, validation, pack dry-run)

## API Documentation

### WebSocket & JSON-RPC

- **[gRPC Streaming](docs/grpc-streaming.md)** - Connection setup, authentication, endpoint configuration
- **[Filtering](docs/filtering.md)** - Complete filtering guide with examples, limits, and special operators
- **[hl_subscribe](docs/hl_subscribe.md)** - WebSocket subscription method with filters
- **[hl_unsubscribe](docs/hl_unsubscribe.md)** - WebSocket unsubscription method
- **[hl_getBlock](docs/hl_getBlock.md)** - Fetch single block by number (historical data)
- **[hl_getBatchBlocks](docs/hl_getBatchBlocks.md)** - Fetch block range for backfill (critical for reconnection)

## Dataset Documentation

### Overview
- **[Datasets Overview](docs/datasets/datasets.md)** - Complete list of all 7 datasets with use cases

### Individual Datasets
- **[Orders Dataset](docs/datasets/orders-dataset.md)** - Order lifecycle with 18+ statuses (open, filled, canceled, rejected...)
- **[Trades Dataset](docs/datasets/trades-dataset.md)** - Executed fills with maker/taker, fees, liquidations
- **[Events Dataset](docs/datasets/events-dataset.md)** - 6 event types + 15 LedgerUpdate subtypes
- **[Book Updates Dataset](docs/datasets/book-updates-dataset.md)** - Level 2 order book changes
- **[TWAP Dataset](docs/datasets/twap-dataset.md)** - TWAP order execution tracking
- **[Blocks Dataset](docs/datasets/blocks-dataset.md)** - Raw L1 transactions (gRPC only, 34 action types)

## Implementation Reference

### Core Architecture

```
src/
├── index.ts                      # CLI entry point
├── commands/
│   ├── config.ts                 # Credential management command
│   ├── stream.ts                 # Main streaming command
│   ├── backfill.ts               # Historical JSON-RPC ingestion command
│   ├── sample.ts                 # Dataset sample explorer
│   ├── stats.ts                  # Live stream statistics
│   └── query.ts                  # SQLite SQL REPL and one-shot query
├── core/
│   ├── ws-client.ts              # WebSocket connection manager
│   ├── stream-processor.ts       # Block gap recovery + dedupe processing
│   ├── reconnection-manager.ts   # Exponential backoff strategy
│   ├── stream-runtime.ts         # Shared stream runtime loop (stream/stats)
│   └── backfill-runner.ts        # Batched historical block range runner
├── api/
│   ├── websocket-streams.ts      # hl_subscribe/unsubscribe request builders
│   └── jsonrpc.ts                # hl_getBatchBlocks backfill client
├── datasets/
│   ├── registry.ts               # Dataset metadata + stream alias/backfill mapping
│   ├── types.ts                  # Dataset normalizer registry
│   ├── orders.ts                 # Orders dataset handler
│   ├── trades.ts                 # Trades dataset handler
│   ├── events.ts                 # Events dataset handler
│   ├── book-updates.ts           # Book updates dataset handler
│   └── twap.ts                   # TWAP dataset handler
├── outputs/
│   ├── console.ts                # Pretty terminal output
│   ├── jsonl.ts                  # JSON lines output
│   ├── csv.ts                    # CSV output
│   └── sqlite.ts                 # SQLite persistence
├── filters/
│   ├── filter-builder.ts         # Build filter objects for API requests
│   └── event-filter.ts           # Local normalized-event filtering
├── config/
│   ├── credentials.ts            # 4-tier credential resolution
│   ├── keychain.ts               # OS keychain token storage
│   └── storage.ts                # Endpoint config file storage
├── types/
│   ├── common.ts                 # Shared app types
│   └── stream.ts                 # Stream/event normalized types
└── utils/
    ├── logger.ts                 # Structured logging
    ├── progress.ts               # Progress mode parsing/validation
    ├── hash.ts                   # Stable event dedupe keys
    ├── url.ts                    # Endpoint URL derivation
    ├── csv.ts                    # CSV escaping helper
    └── table.ts                  # CLI table rendering helper
```

### Key Design Decisions

See **[ADR.md](ADR.md)** for:
- Why WebSocket over gRPC for Phase 1
- Auto-backfill strategy on reconnection
- Phase 2 WebSocket-first delivery with explicit blocks defer

### Implementation Progress

See **[PROGRESS.md](PROGRESS.md)** for current status of all features.

## External Resources

- [HyperCore gRPC Examples](https://github.com/quiknode-labs/hypercore-grpc-examples) - Reference implementations
- [Quicknode HyperCore Documentation](https://www.quicknode.com/docs/hyperliquid/datasets) - Official API docs
- [Hyperliquid API Documentation](https://hyperliquid.gitbook.io/hyperliquid-docs/) - L1 protocol details
