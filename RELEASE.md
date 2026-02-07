# Release Checklist

Use this checklist before publishing `@quicknode/hypercore-cli`.

## 1) Runtime Baseline (Node 22)

```bash
node -v
pnpm node -v
```

Expected: both are Node `22.x`.

If your shell is not on Node 22, switch first (example with nvm):

```bash
source ~/.nvm/nvm.sh
export PATH="$(dirname "$(nvm which 22)"):$PATH"
hash -r
```

## 2) Native Module Rebuild (if needed)

`better-sqlite3` and `keytar` must be built for the same Node runtime.

```bash
pnpm install
pnpm rebuild better-sqlite3 keytar --reporter=append-only
```

If bindings are still broken, run:

```bash
bash /Users/sergenuysal/.codex/skills/node-native-rebuild/scripts/fix-native-bindings.sh /Users/sergenuysal/Quicknode/self-works/hypercore-cli-codex --node-major 22
```

## 3) Pre-Publish Validation

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:socket
pnpm perf:smoke
```

Notes:
- `pnpm test` keeps socket runtime tests skipped by default in restricted runtimes.
- `pnpm test:socket` explicitly enables the reconnect socket integration path with `ENABLE_SOCKET_TESTS=1`.

## 4) Pack Dry Run

```bash
pnpm pack:dry-run
```

Verify tarball contents include:
- `bin/hypercore-cli.js`
- `dist/src/index.js`
- `dist/src/index.d.ts`
- `README.md`
- `LICENSE`

Verify package metadata:
- `main` -> `dist/src/index.js`
- `types` -> `dist/src/index.d.ts`
- `bin.hypercore-cli` -> `./bin/hypercore-cli.js`

## 5) Large Backfill Runtime Recommendations

- Prefer Node 22 runtime.
- Use SQLite output for long-running ingestion: `--output sqlite --db <path>`.
- Keep JSON-RPC batches at or near max (`--batch-size 100`) unless endpoint pressure requires lower values.
- Use structured progress for automation and monitoring: `--progress json`.
- For very large ranges, consider higher Node heap:
  - `NODE_OPTIONS=--max-old-space-size=4096`
