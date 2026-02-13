# Changelog

## 0.1.1 (2026-02-13)

### Fixed

- Move `better-sqlite3` and `keytar` to `optionalDependencies` so `npm install` succeeds even when native compilation fails (e.g., missing build tools or unsupported Node versions)

## 0.1.0 (2026-02-12)

Initial public release.

### Features

- **Stream** real-time HyperCore datasets (orders, trades, fills, TWAP, book updates, events, blocks)
- **Backfill** historical block ranges with resumable batched fetching
- **Sample** events from any dataset for quick exploration
- **Query** and inspect local SQLite databases
- **Output formats:** console, JSON Lines, CSV, SQLite
- **Transports:** WebSocket (WSS) and gRPC
- **x402 micropayments:** pay-per-request access via wallet-based authentication
- **Interactive wizard** for guided dataset and filter selection
- **Server-side filtering** by token, user address, order status, and custom key-value pairs
- **Credential management** with OS keychain integration and secure file fallback
- **Automatic reconnection** with exponential backoff and gap detection
