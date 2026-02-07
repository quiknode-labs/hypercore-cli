# PROGRESS

## Status: Phase 3 Increment 1 Completed (WebSocket + JSON-RPC)

### Phase 1 (Completed)
- [x] TypeScript strict scaffold
- [x] `config` command + secure credential resolution
- [x] `stream` command for `orders|trades|events`
- [x] Outputs: `console|json|csv|sqlite`
- [x] Reconnect + mandatory JSON-RPC backfill

### Phase 2 (Completed in this workspace)
- [x] New commands: `sample`, `stats`, `query`
- [x] New datasets: `book_updates`, `twap`
- [x] Shared streaming runtime refactor for command reuse
- [x] Dataset registry introduced for stream alias/backfill mapping
- [x] Stream + outputs updated for Phase 2 datasets
- [x] Query REPL + one-shot SQL mode implemented
- [x] Additional tests for dataset registry, JSON-RPC mapping, and new normalizers

### Phase 3 (Current Increment Completed)
- [x] New command: `backfill` for historical block range ingestion via JSON-RPC
- [x] Shared backfill runner for batched fetch + limit-aware event emission
- [x] Local normalized-event filtering for backfill (`coin`, `user`, `status`, and raw keys)
- [x] Tests for backfill batching/limit behavior and event filter matching
- [x] Query REPL hardening: non-fatal command errors, `.clear`, robust `.export` parser
- [x] Query parser tests for quoted paths and malformed `.export` edge cases
- [x] Structured progress mode for `stream`, `backfill`, and `stats` (`--progress text|json`)
- [x] JSON mode emits machine-readable progress logs (and `stats` snapshots) for automation
- [x] Added non-network CLI E2E tests (`query --sql`, invalid `--progress` contract checks)
- [x] Stream processor dedupe memory is now bounded by block-retention window
- [x] Reconnect gap-check/backfill trigger is serialized to prevent overlapping duplicate backfill runs
- [x] Added runtime-level reconnect integration test with local mock WebSocket server + JSON-RPC backfill stub
- [x] Added end-of-run summaries for `stream`, `backfill`, and `stats`

## Explicit Deferred Items
- [ ] gRPC transport integration
- [ ] `blocks` dataset support (gRPC-only)
- [ ] `writer_actions` dataset support

## Validation in Current Environment
- `pnpm typecheck` passes.
- `pnpm test` passes.
- `pnpm build` passes.
- SQLite-dependent runtime features may be unavailable if native binding is missing for current Node build.

## Publish Readiness Hardening (Current Pass)
- [x] Added endpoint/token redaction helpers and applied them to stream/backfill/stats logs and top-level CLI error surfaces
- [x] Added redaction unit coverage and JSON-progress CLI integration coverage (including shutdown summary assertions)
- [x] Fixed publish metadata entry points (`main`, `types`) to compiled `dist/src/index.*`
- [x] Added package metadata integration test for entry point/bin wiring
- [x] Added explicit socket-test enabled path via `pnpm test:socket` (`ENABLE_SOCKET_TESTS=1`)
- [x] Added sqlite perf smoke script (`pnpm perf:smoke`) for high-event writer-path checks
- [x] Added release checklist documentation (`RELEASE.md`) and linked it in docs index/README
