# Phase 2 Plan - HyperCore CLI

Date: 2026-02-06
Status: Approved for implementation in this workspace

## 1) Current Architecture Audit (Phase 1 Baseline)

### CLI and command wiring
- Entry point: `src/index.ts`
- Registered commands: `config`, `stream`
- CLI framework: `commander`

### Stream pipeline
- Transport: WebSocket JSON-RPC subscribe/unsubscribe via `src/core/ws-client.ts`
- Recovery: exponential reconnect (`src/core/reconnection-manager.ts`)
- Continuity: mandatory block gap backfill (`hl_getBatchBlocks`) via `src/core/stream-processor.ts` + `src/api/jsonrpc.ts`
- Block parser handles:
  - subscribe ack with `result.subscribed` as string or array
  - data envelopes including `{"type":"data","stream":"hl.trades","block":{...}}`
- Limit handling: stop on emitted event count even under high-volume blocks

### Data model and normalization
- Dataset union currently: `orders | trades | events`
- Normalizers:
  - `src/datasets/orders.ts`
  - `src/datasets/trades.ts`
  - `src/datasets/events.ts`
- Event dedupe key: SHA-256 of stable JSON (`src/utils/hash.ts`)

### Filtering
- Curated flags:
  - `--tokens` -> `coin`
  - `--users` -> `user`
  - `--statuses` -> `status` (orders only)
- Generic: repeatable `--filter key=v1,v2`

### Outputs
- `console`, `json`, `csv`, `sqlite`
- Writer factory: `src/outputs/index.ts`
- SQLite: `better-sqlite3` optional runtime dependency, loaded dynamically

### Credentials and endpoint
- Resolution precedence: flags > env > saved > prompt
- Token may be extracted from endpoint path
- Endpoint format standardized:
  - `wss://ENDPOINT_NAME.hype-mainnet.quiknode.pro/QUICKNODE_TOKEN/hypercore/ws`

### Tests and build
- Unit + integration tests use Node built-in test runner (`node --test`)
- Existing checks passing: `pnpm typecheck`, `pnpm test`, `pnpm build`

## 2) Phase 2 Scope Decisions (Decision-Complete)

### Included in Phase 2
- New commands:
  - `sample`
  - `stats`
  - `query`
- New datasets:
  - `book_updates`
  - `twap`
- Continue WebSocket + JSON-RPC backfill architecture

### Deferred from Phase 2
- `blocks` dataset and full gRPC client implementation
- `writer_actions` dataset (optional candidate, deferred to next increment)

### Explicit blocks decision
- Decision: **defer gRPC/blocks in this Phase 2 implementation** and ship WebSocket-first Phase 2 features now.
- Rationale:
  - Preserves validated Phase 1 architecture and reliability path.
  - Keeps delivery risk low while adding three major commands and two datasets.
  - `blocks` is gRPC-only and introduces protocol stack, auth/session handling, and high-throughput memory/IO concerns not yet represented in the current codebase.

## 3) Required Refactor/Migration Before Feature Additions

1. Introduce a central dataset registry:
- Unify dataset metadata, stream aliases, and backfill stream names.
- Prevent scattered dataset lists in commands/parsers/writers.

2. Extract shared stream runtime:
- Reuse one reconnect/backfill/emit loop for `stream` and `stats`.
- Reduce divergence risk between commands.

3. Extend normalized event union and writers:
- Add `book_updates` and `twap` event types and output mappings.

4. Add SQLite capability checks for query command:
- Provide graceful runtime errors when native binding is unavailable.

## 4) Phase 2 CLI/API Contracts

### `stream` (extended)
- `--dataset` now supports: `orders|trades|events|book_updates|twap`
- Existing flags remain backward compatible.

### `sample`
- `sample --list`: list available datasets with description/volume.
- `sample --dataset <name>`: print dataset summary + representative sample payload.

### `stats`
- Streams live data and reports rolling counters by dataset-specific facets.
- Supports same filtering and credential flags as `stream`.
- Uses `--limit` for deterministic termination.

### `query`
- `query --db <path>`: interactive SQL REPL over SQLite DB.
- `query --db <path> --sql "SELECT ..."`: one-shot query mode.
- Dot commands:
  - `.tables`
  - `.schema [table]`
  - `.count [table]`
  - `.export csv <file> <query>`
  - `.export json <file> <query>`
  - `.help`
  - `.exit`

## 5) Milestones and Acceptance Criteria

### Milestone A: Core refactor + dataset expansion
- Dataset registry and shared stream runner in place.
- `stream` works for `book_updates` and `twap`.
- Backfill works with correct JSON-RPC stream mapping.

Acceptance:
- `stream --dataset book_updates --limit 1` parses and emits event(s).
- `stream --dataset twap --limit 1` parses and emits event(s).

### Milestone B: New commands
- `sample`, `stats`, `query` commands implemented and registered.

Acceptance:
- `sample --list` and `sample --dataset orders` produce stable output.
- `stats --dataset orders --limit 5` exits correctly.
- `query --db <db> --sql "SELECT 1 as x"` returns table output.

### Milestone C: Tests + docs continuity
- Tests cover new normalizers and command-level behavior where feasible.
- README/PROGRESS/ADR updated for scope and blocks decision.

Acceptance:
- `pnpm typecheck` passes.
- `pnpm test` passes (with same SQLite optionality behavior).
- `pnpm build` passes.

## 6) Non-Goals in this Phase
- gRPC client stack
- blocks dataset ingestion pipeline
- writer_actions stream implementation
- TUI/interactive keypress dashboard for stats
