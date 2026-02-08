# Phase 3 Plan - HyperCore CLI

Date: 2026-02-06
Status: Milestones A, B, and C delivered

## 1) Goal

Extend Phase 2 with historical ingestion and operational hardening while preserving existing defer decisions:
- keep `blocks` deferred (gRPC-only)
- keep gRPC transport deferred
- `writer_actions` now delivered in post-Phase3 expansion

## 2) Milestones

### Milestone A (Delivered): Historical backfill command
- Add `backfill` command using JSON-RPC `hl_getBatchBlocks`
- Support datasets: `orders|trades|events|book_updates|twap|writer_actions`
- Reuse existing normalizers + output writers (`console|json|csv|sqlite`)
- Add client-side normalized-event filters for backfill
- Add `--limit` and batched fetch behavior for deterministic runs

Acceptance:
- `backfill --dataset orders --from X --to Y --limit 1` exits deterministically
- `backfill --dataset trades --output sqlite --path ./x.db` writes rows
- Test coverage for batching/limit/filter matching

### Milestone B (Delivered): Query and export hardening
- Add guardrails and UX improvements for `query` one-shot and REPL export flows
- Add test coverage for dot-command parsing and export edge cases

Acceptance:
- REPL and `--sql` produce stable output for empty/non-empty result sets
- `.export` paths and formats are validated with clear errors

### Milestone C (Delivered): Runtime observability polish
- Add structured progress logging options for stream/backfill/stats
- Add optional machine-readable progress mode for automation

Acceptance:
- Long-running commands expose clear periodic progress without log spam
- Behavior remains backward-compatible with existing defaults

## 3) Phase 3 CLI/API Contract (Milestone A)

New command:

```bash
hypercore-cli backfill \
  --dataset <orders|trades|events|book_updates|twap|writer_actions> \
  --from <start_block_inclusive> \
  --to <end_block_inclusive> \
  [--batch-size <1-100>] \
  [--tokens <csv>] [--users <csv>] [--statuses <csv>] [--filter key=v1,v2] \
  [--output <console|json|csv|sqlite>] [--path <path>] \
  [--limit <n>] [--endpoint <url>] [--token <token>] [--quiet]
```

Behavior:
- Uses the existing credential resolution chain
- Uses JSON-RPC backfill stream mapping from dataset registry
- Applies filters after normalization for backfill-only path

## 4) Validation

Required checks:
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

Delivered addendum:
- Added non-network CLI E2E checks for `query --sql` success/error paths and progress option contract validation.
