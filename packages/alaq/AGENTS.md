# AGENTS.md — `alaq`

Local agent context for this package. 50–150 lines per [AI_FIRST.md §Consequences](../../AI_FIRST.md). For global rules read [../../AGENTS.md](../../AGENTS.md); for the "why" read [../../PHILOSOPHY.md](../../PHILOSOPHY.md); for what "AI-first" means physically read [../../AI_FIRST.md](../../AI_FIRST.md).

---

## What this package is

`alaq` is the **unscoped, AI-native frontdoor** for the `@alaq/*` ecosystem. Not a runtime. Not a scaffolder. Not an LLM. A thin CLI + MCP wiring tool + capability manifest publisher.

Primary consumer: an LLM agent in a fresh Claude Code / Cursor / Zed session. Human developer is the degenerate case.

## Files and what lives in each

| File | Role | LOC target |
|------|------|------------|
| [`src/bin.ts`](src/bin.ts) | CLI entry. Parses argv, dispatches commands. Exit codes: 0 ok, 1 error, 2 usage. | ≤ 300 |
| [`src/index.ts`](src/index.ts) | Public API exports for tooling authors. No side effects. | ≤ 50 |
| [`src/manifest.ts`](src/manifest.ts) | Capability manifest generator. Reads `architecture.yaml` or falls back to bundled snapshot. Sorts keys deep for diffable output. | ≤ 250 |
| [`src/stanza.ts`](src/stanza.ts) | MCP server stanza renderer (json / toml / yaml). Hand-rolled encoders; zero deps. | ≤ 200 |
| [`src/launcher.ts`](src/launcher.ts) | `@alaq/mcp` spawner. Resolves upstream `bin` entries; forwards signals; propagates exit code. | ≤ 150 |
| [`src/errors.ts`](src/errors.ts) | Error code registry (E001–E010). Every CLI-surfaced error carries a code. | ≤ 80 |

If a file crosses its LOC target, split it. Per [AQBR §7](../../../aqbr/MANIFESTO.md) convention (adopted here): a module > 500 LoC is wrong.

## Seven physical properties — how this package implements them

1. **JSON by default** — `bin.ts` `renderJson(v, pretty)`. `--pretty` opt-in; TTY auto-detect promotes to indented JSON, still JSON.
2. **Structured error codes** — `errors.ts`. All `fail(code, ...)` sites carry E001–E010.
3. **Capability manifest ≤ 2 KB** — `manifest.ts` SNAPSHOT is ~0.9 KB JSON (8 packages). Full variant expands to architecture.yaml (~22 entries, still under 2 KB gzipped).
4. **MCP main, CLI fallback** — `spawnMcp()` delegates to `@alaq/mcp` for both `start` and `call`. `mcp call` exits through the child's exit code; the CLI doesn't re-wrap.
5. **Sandbox real** — delegated to `@alaq/mcp` (rootDir enforcement lives there). This package has no filesystem surface of its own except `--write <path>` which is opt-in and atomic (temp + rename).
6. **`review` right-to-stop** — delegated to `@alaq/mcp` `schema_diff`. `alaq mcp call schema_diff` surfaces the `review` class unchanged.
7. **No telemetry** — zero network calls from this binary. The Logi endpoint is user-configured and referenced only in the rendered stanza (as a default string).

## Sub-command decision tree

```
alaq [--flags]                → cmdRoot      → manifest JSON
alaq doctor                   → cmdDoctor    → runtime + mcp reachability JSON
alaq mcp list                 → cmdMcpList   → tools/list via spawnMcp('call', ['--list'])
alaq mcp install [opts]       → cmdMcpInstall → renderMcpStanza → stdout or --write
alaq mcp call <tool> <json>   → cmdMcpCall   → spawnMcp('call', [tool, payload])
alaq mcp start                → cmdMcpStart  → spawnMcp('start')
```

`install` is the only one that does real work in-process; `list`/`call`/`start` delegate.

## Error codes owned here

| Code | Meaning | Emitted by |
|------|---------|------------|
| E001 | Usage — flags/args malformed | all commands |
| E002 | Unknown sub-command | main / mcp |
| E003 | Invalid JSON argument | mcp call |
| E004 | --args-file unreadable | mcp call |
| E005 | @alaq/mcp spawn failed | launcher |
| E006 | Bundled Node fallback missing | launcher |
| E007 | --write target has existing alaq entry | mcp install |
| E008 | Atomic write failed | mcp install |
| E009 | architecture.yaml not found | manifest (non-fatal; uses snapshot) |
| E010 | Unsupported --format value | stanza renderer |

Adding a new code: append to `errors.ts` `CODES` and `DESCRIPTIONS` in the **next free slot**. **Never renumber** existing codes. Before GA the code space may still shift — the moment we ship `6.0.0` this table becomes normative.

## Runtime parity

`npx alaq` and `bunx alaq` are equal. The launcher detects host via `process.versions.bun` and spawns `@alaq/mcp` with the active runtime. Do not privilege one runtime in docs, error messages, or default flag values.

## When changing this package

1. **Update `architecture.yaml`** if the manifest shape changes (new property, new hint). The root-level file is the source of truth for ecosystem layout.
2. **Keep the snapshot small.** `manifest.ts` SNAPSHOT is 8 entries — first-contact only. Utilities and UI adapters go into `--full`, not the default.
3. **Before adding a command** — can it be delegated to `@alaq/mcp`? If yes, delegate. `alaq` is thin.
4. **Before adding a dependency** — the install budget is < 2 MB (alaq + @alaq/mcp + @alaq/graph). Adding `yaml` or `commander` blows it.
5. **Test against both runtimes** — `bun src/bin.ts` and `node --experimental-strip-types src/bin.ts`. Any runtime-specific divergence is a bug.

## What's explicitly out of scope

- Re-exports of `@alaq/atom`, `@alaq/quark`, etc. — see DESIGN.md §7.1.
- Per-client MCP adapters (Claude Code / Cursor / Zed paths). MCP is a protocol.
- Telemetry of any kind.
- Embedded LLM.
- `graph` runtime wrapper (`alaq compile` — delegated to MCP).

## Cross-refs

- [README.md](README.md) — user-facing tour.
- [DESIGN.md](DESIGN.md) — normative shape for the implementor.
- [../mcp/AGENTS.md](../mcp/AGENTS.md) — sibling context for the MCP server (if present).
