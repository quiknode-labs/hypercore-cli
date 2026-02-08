# Architecture Decision Record

This document records the key architectural decisions made for @quicknode/hypercore-cli.

---

## ADR-001: Use WebSocket over gRPC for Phase 1

**Date:** 2026-02-06
**Status:** ✅ Accepted
**Decision Makers:** Team discussion

### Context

Quicknode HyperCore supports three protocols for data streaming:
1. **gRPC** - Highest performance with compression (zstd), but requires complex connection management
2. **WebSocket (WSS)** - Native JSON support, stable connections, widely compatible
3. **JSON-RPC** - Batch historical data only (no streaming)

For Phase 1 implementation, we need to choose the primary streaming protocol.

### Decision

**Use WebSocket (WSS) for initial implementation**, defer gRPC to Phase 2.

**Rationale:**
- **Simpler implementation** - Native JSON, no protobuf compilation
- **Better stability** - WebSocket connections are more forgiving than gRPC streams
- **Broader compatibility** - Works everywhere Node.js does, no special ports
- **Easier debugging** - JSON messages are human-readable
- **Faster iteration** - Less boilerplate, quicker to validate correctness

### Consequences

**Positive:**
- ✅ Faster time to working prototype
- ✅ Easier to debug and troubleshoot
- ✅ Simpler reconnection logic
- ✅ Native TypeScript/Node.js support

**Negative:**
- ⚠️ Slightly lower performance vs gRPC (acceptable for Phase 1)
- ⚠️ BLOCKS dataset not available via WebSocket (requires gRPC)

**Mitigation:**
- Plan to add gRPC support in Phase 2 for performance-critical use cases
- BLOCKS dataset will be Phase 2 feature

---

## ADR-002: Auto-backfill on reconnection

**Date:** 2026-02-06
**Status:** ✅ Accepted
**Decision Makers:** User requirement, team discussion

### Context

Network connections can fail due to:
- Transient network issues
- Server restarts
- Client timeouts
- WiFi interruptions

When connections drop, users lose data continuity. WebSocket streams always resume from the latest block, not where the client left off.

### Decision

**Automatically backfill missed blocks using hl_getBatchBlocks on reconnection.**

**Implementation:**
1. Track last successfully processed block_number in `BlockTracker`
2. On disconnect, start exponential backoff reconnection
3. Before resuming WebSocket stream, detect gap: `currentBlock - lastBlock`
4. If gap exists, fetch missed blocks via `hl_getBatchBlocks` (100-block batches)
5. Process backfill data through same output formatters
6. Resume normal streaming once backfill complete

### Consequences

**Positive:**
- ✅ Zero data loss on connection failures
- ✅ Seamless user experience
- ✅ Production-ready reliability
- ✅ Users don't need manual intervention

**Negative:**
- ⚠️ More complex reconnection logic
- ⚠️ Requires HTTP endpoint for JSON-RPC calls
- ⚠️ Backfill may introduce latency spike during recovery

**Mitigation:**
- Limit batch size to 100 blocks to avoid timeouts
- Log backfill progress clearly
- Process backfill in chunks to maintain responsiveness
- Implement retry logic for backfill failures

---

## ADR-003: TypeScript with strict mode

**Date:** 2026-02-06
**Status:** ✅ Accepted
**Decision Makers:** Team standard, user preference

### Context

This is a production-grade tool that will be heavily used by the Hyperliquid community. Code quality and maintainability are critical.

### Decision

**Use TypeScript with strict mode enabled.**

**TypeScript Configuration:**
```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
```

### Consequences

**Positive:**
- ✅ Catch bugs at compile time, not runtime
- ✅ Excellent IDE support (autocomplete, refactoring)
- ✅ Self-documenting code (types as documentation)
- ✅ Easier to maintain and refactor
- ✅ Better onboarding for new contributors

**Negative:**
- ⚠️ Slightly more verbose than JavaScript
- ⚠️ Learning curve for contributors unfamiliar with TypeScript

**Mitigation:**
- Use type inference where possible to reduce verbosity
- Document complex types with comments
- Provide clear examples in README

---

## ADR-004: pnpm as package manager

**Date:** 2026-02-06
**Status:** ✅ Accepted
**Decision Makers:** User preference

### Context

Node.js ecosystem has three major package managers: npm, yarn, pnpm.

### Decision

**Use pnpm as the official package manager.**

### Consequences

**Positive:**
- ✅ Faster installs than npm/yarn
- ✅ More efficient disk usage (content-addressable store)
- ✅ Stricter dependency resolution (prevents phantom dependencies)
- ✅ Built-in workspace support

**Negative:**
- ⚠️ Some users may not have pnpm installed
- ⚠️ Slightly different CLI from npm

**Mitigation:**
- Provide installation instructions in README
- pnpm is becoming industry standard

---

## ADR-005: Exponential backoff with 60s max

**Date:** 2026-02-06
**Status:** ✅ Accepted
**Decision Makers:** Industry best practice

### Context

When connections fail, we need a reconnection strategy that:
- Doesn't overwhelm the server with rapid retry attempts
- Recovers quickly from transient failures
- Handles sustained outages gracefully

### Decision

**Use exponential backoff: 1s → 2s → 4s → 8s → 16s → 32s → max 60s**

### Consequences

**Positive:**
- ✅ Reduces server load during outages
- ✅ Fast recovery for transient issues (1-2s)
- ✅ Sustainable for long outages (60s max)
- ✅ Industry standard approach

**Negative:**
- ⚠️ Up to 60s delay during sustained outages

**Mitigation:**
- Log reconnection attempts clearly
- Show countdown timer to user

---

## ADR-006: Zod for runtime validation

**Date:** 2026-02-06
**Status:** ✅ Accepted
**Decision Makers:** Team discussion

### Context

WebSocket messages come from external API. We need runtime validation to ensure data integrity and provide clear error messages.

### Decision

**Use Zod for runtime schema validation of API responses.**

**Why Zod:**
- TypeScript-first design
- Excellent error messages
- Type inference (single source of truth)
- Lightweight and performant

### Consequences

**Positive:**
- ✅ Runtime type safety
- ✅ Clear error messages for malformed data
- ✅ Types derived from schemas (DRY principle)
- ✅ Easy to test

**Negative:**
- ⚠️ Slight performance overhead (negligible for CLI use case)

---

## ADR-007: SQLite for local persistence

**Date:** 2026-02-06
**Status:** ✅ Accepted
**Decision Makers:** PROJECT.md specification

### Context

Users need to persist streaming data for later analysis.

### Decision

**Use better-sqlite3 for SQLite persistence.**

**Why better-sqlite3:**
- Synchronous API (simpler than async)
- Faster than alternatives (node-sqlite3, sql.js)
- No external dependencies
- Battle-tested and maintained

### Consequences

**Positive:**
- ✅ Fast batch inserts
- ✅ Simple API
- ✅ Cross-platform

**Negative:**
- ⚠️ Native module (requires compilation)
- ⚠️ Synchronous API blocks event loop (acceptable for CLI)

**Mitigation:**
- Batch inserts to minimize blocking
- Document native module requirement in README

---

## ADR-008: Defer stats and query commands to Phase 2

**Date:** 2026-02-06
**Status:** ✅ Accepted
**Decision Makers:** User feedback, phased approach

### Context

PROJECT.md includes advanced features:
- `stats` - Live statistics dashboard
- `query` - SQL REPL for querying collected data
- `sample` - View dataset samples

### Decision

**Focus Phase 1 on core streaming features only. Defer advanced commands to Phase 2.**

**Phase 1 scope:**
- `stream` command (orders, trades, events)
- `config` command (credential management)
- All output formats (console, JSON, CSV, SQLite)
- Auto-reconnect with backfill

**Phase 2 scope:**
- `stats` command
- `query` command
- `sample` command
- Additional datasets (books, twap, blocks, writer-actions)

### Consequences

**Positive:**
- ✅ Faster time to working MVP
- ✅ Validate core architecture first
- ✅ Get user feedback sooner
- ✅ Reduced initial complexity

**Negative:**
- ⚠️ Users need external tools (sqlite3 CLI) for querying in Phase 1

**Mitigation:**
- Document how to use sqlite3 CLI in README
- Clearly communicate Phase 2 roadmap

---

## ADR-009: Phase 1 datasets: ORDERS, TRADES, EVENTS

**Date:** 2026-02-06
**Status:** ✅ Accepted
**Decision Makers:** User feedback

### Context

7 datasets available:
- ORDERS - Order lifecycle
- TRADES - Executed fills
- EVENTS - System events
- BOOK_UPDATES - Order book changes
- TWAP - TWAP order execution
- BLOCKS - Raw L1 transactions
- WRITER_ACTIONS - HyperCore ↔ HyperEVM transfers

### Decision

**Implement ORDERS, TRADES, EVENTS in Phase 1.**

**Rationale:**
- Most requested by traders
- Highest value for community
- Represent different data patterns (good for architecture validation)

### Consequences

**Positive:**
- ✅ Focused implementation
- ✅ Cover main use cases
- ✅ Easier to test

**Negative:**
- ⚠️ Advanced users need to wait for BOOK_UPDATES, BLOCKS

**Mitigation:**
- Add remaining datasets in Phase 2
- Architecture supports easy addition of new datasets

---

## ADR-010: Phase 2 remains WebSocket-first; defer gRPC/blocks

**Date:** 2026-02-06
**Status:** ✅ Accepted
**Decision Makers:** User requirement + implementation planning

### Context

Phase 2 introduces three new commands (`sample`, `stats`, `query`) and new datasets (`book_updates`, `twap`) while preserving production behavior already validated in Phase 1.

`blocks` remains gRPC-only and requires:
- gRPC transport/client lifecycle in this codebase
- Throughput-specific handling for very high-volume payloads
- Additional testing and operational hardening beyond current WebSocket/JSON-RPC stack

### Decision

**Deliver Phase 2 on the existing WebSocket + JSON-RPC architecture and explicitly defer gRPC + `blocks` dataset to a later phase.**

### Consequences

**Positive:**
- ✅ Ships user-facing Phase 2 features with low regression risk
- ✅ Reuses validated reconnect/backfill pipeline
- ✅ Keeps implementation scope focused and testable

**Negative:**
- ⚠️ `blocks` users still need a separate gRPC workflow
- ⚠️ gRPC integration work is pushed to a later milestone

**Mitigation:**
- Track explicit deferred scope in PROGRESS/README
- Keep dataset registry and stream runtime abstractions ready for gRPC extension

---

## ADR-011: Introduce shared stream runtime + dataset registry

**Date:** 2026-02-06
**Status:** ✅ Accepted
**Decision Makers:** Implementation architecture

### Context

Adding `stats` alongside `stream` risks duplicated reconnect/backfill logic. Also, expanding datasets introduces repeated dataset constants, alias handling, and backfill stream mapping.

### Decision

1. **Add `stream-runtime` core module** used by both `stream` and `stats`.
2. **Add central dataset registry** that defines:
   - dataset metadata for CLI/sample output
   - WebSocket stream names/aliases
   - JSON-RPC backfill stream mapping (e.g., `book_updates` -> `book`)

### Consequences

**Positive:**
- ✅ One reliability path for both streaming commands
- ✅ Reduced drift between commands and parser logic
- ✅ Dataset additions become lower-risk and more mechanical

**Negative:**
- ⚠️ Slightly more indirection than hard-coded constants

**Mitigation:**
- Keep registry schema simple and focused
- Cover mapping behavior with unit tests

---

## ADR-012: Add explicit historical backfill command over JSON-RPC

**Date:** 2026-02-06
**Status:** ✅ Accepted
**Decision Makers:** Implementation continuity for post-Phase-2 delivery

### Context

Phase 2 delivered reliable live streaming with reconnect-time backfill, but users still need a direct way to ingest historical ranges without forcing a live WebSocket session.

Requirements:
- Reuse existing WebSocket-first architecture decisions
- Avoid introducing gRPC scope (`blocks` remains deferred)
- Preserve existing normalizers and output formats

### Decision

**Add a new `backfill` CLI command that fetches block ranges via `hl_getBatchBlocks`, normalizes events through existing dataset handlers, applies local filters, and writes through existing output writers.**

Implementation notes:
- New shared core utility: `backfill-runner`
- New filter matcher for normalized events (used by backfill where server-side filtering is unavailable)
- Supports `--limit` for deterministic early termination

### Consequences

**Positive:**
- ✅ Adds first-class historical ingestion without protocol changes
- ✅ Reuses existing dataset/output stack, minimizing regression risk
- ✅ Establishes reusable runtime for future replay/ingestion workflows

**Negative:**
- ⚠️ JSON-RPC backfill filtering is client-side for this command
- ⚠️ Very large ranges can produce long-running CLI sessions

**Mitigation:**
- Batch requests (`--batch-size`, max 100) and progress logging
- `--limit` support for bounded runs
- Keep gRPC/`blocks` defer unchanged

---

## ADR-013: Add structured progress mode for automation

**Date:** 2026-02-06
**Status:** ✅ Accepted
**Decision Makers:** Phase 3 runtime hardening

### Context

The CLI is used both interactively and in scripts/automation. Existing status logs are human-readable text only.

Need:
- retain existing defaults for human usage
- provide machine-readable progress telemetry for automation
- avoid changing dataset output payloads

### Decision

Add `--progress text|json` to `stream`, `backfill`, and `stats`.

- `text` (default): current human-readable behavior
- `json`: emit structured JSON progress lines to `stderr`
- `stats --progress json` additionally emits JSON snapshots to `stdout`

### Consequences

**Positive:**
- ✅ Backward-compatible default behavior
- ✅ Better automation integration without scraping text logs
- ✅ Consistent mode across long-running commands

**Negative:**
- ⚠️ Additional option surface area in command help

**Mitigation:**
- Keep mode set small (`text`, `json`)
- Validate option values strictly with clear errors

---

## ADR-014: Bound stream dedupe memory by block retention window

**Date:** 2026-02-07
**Status:** ✅ Accepted
**Decision Makers:** Phase 3 reliability hardening

### Context

`StreamProcessor` used an unbounded in-memory set of emitted event keys for deduplication. Long-running streams can grow this set indefinitely.

### Decision

Keep dedupe behavior but bound retained keys by recent block window:
- Track emitted keys grouped by `blockNumber`
- Retain keys for a bounded number of recent blocks (`dedupeRetainBlocks`, default `2000`)
- Prune older block groups as new blocks advance

### Consequences

**Positive:**
- ✅ Prevents unbounded memory growth for long-lived streams
- ✅ Preserves reconnect/backfill dedupe for recent ranges where duplicates occur

**Negative:**
- ⚠️ Very old duplicates outside retention window may be emitted again

**Mitigation:**
- Keep default retention window high enough for reconnect/backfill overlap
- Allow internal tuning via `dedupeRetainBlocks` option when needed

---

## ADR-015: Serialize live block processing during reconnect recovery

**Date:** 2026-02-07
**Status:** ✅ Accepted
**Decision Makers:** Production bug fix after live reconnect testing

### Context

Live reconnect testing showed repeated overlapping backfill ranges being triggered in rapid succession. Root cause was concurrent handling of multiple live blocks during reconnect, combined with gap-check state being consumed too late.

### Decision

- Serialize block processing per WebSocket connection in `stream-runtime` via an internal promise chain.
- Consume `needsGapCheck` immediately before backfill starts in `StreamProcessor`.

### Consequences

**Positive:**
- ✅ Single reconnect gap check per reconnect cycle
- ✅ Prevents overlapping duplicate backfill requests
- ✅ Preserves existing reconnect/backfill semantics

**Negative:**
- ⚠️ Live block handling is strictly sequential (slightly lower peak concurrency)

**Mitigation:**
- Keep normalization/output path efficient
- Maintain batch backfill fetch size to control recovery latency

---

## ADR-016: Enable `writer_actions` dataset on WebSocket + JSON-RPC pipeline

**Date:** 2026-02-07
**Status:** ✅ Accepted
**Decision Makers:** Publish-readiness scope expansion

### Context

`writer_actions` was previously deferred, but it is available on WebSocket and JSON-RPC (`hl_subscribe`, `hl_getBatchBlocks`) without requiring gRPC.

Need:
- keep `blocks` + gRPC transport deferred
- add `writer_actions` with the same reliability/output/test contracts as existing datasets

### Decision

Add full `writer_actions` support to the existing pipeline:
- dataset registry + stream/backfill mapping
- normalizer + typed normalized event
- outputs (`console`, `json`, `csv`, `sqlite`)
- stream/stats/backfill compatibility
- tests and docs updates

### Consequences

**Positive:**
- ✅ Expands supported datasets without protocol-scope growth
- ✅ Reuses proven runtime/backfill/output architecture
- ✅ Keeps defer surface focused on gRPC + `blocks`

**Negative:**
- ⚠️ Additional schema/output/test maintenance burden for one more dataset

**Mitigation:**
- Keep `writer_actions` integration aligned with central registry + shared output abstractions
- Add dedicated normalizer/registry/filter tests to reduce regression risk

---

## Future ADRs

When making new architectural decisions, document them here with:
- Date and status
- Context and problem statement
- Decision and rationale
- Consequences (positive and negative)
- Mitigation strategies
