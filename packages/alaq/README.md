# alaq

AI-first frontdoor for the v6 `@alaq/*` ecosystem — CLI, MCP wiring, capability manifest. One package, one entry point.

## Status

`6.0.0-alpha.0` — **unstable**. This is the AI-first frontdoor for the v6 ecosystem. The CLI surface and manifest schema may shift between alphas. Pin exact versions.

The `why` lives in [`../../PHILOSOPHY.md`](../../PHILOSOPHY.md); what "AI-first" means physically — [`../../AI_FIRST.md`](../../AI_FIRST.md); the design in [`./DESIGN.md`](./DESIGN.md); the ecosystem rules in [`../../AGENTS.md`](../../AGENTS.md). This README is a pointer.

## Install

```sh
npm install alaq
```

```sh
bun add alaq
```

Or, without installing:

```sh
npx alaq
bunx alaq
```

Both are equal. Requires Node ≥ 20 or Bun ≥ 1.3. Installs `@alaq/mcp` and `@alaq/graph` transitively; nothing else.

## The 60-second AI tour

Five commands an LLM runs on first contact with a fresh repo:

```sh
npx alaq         # or: bunx alaq
```
Prints the capability manifest — ecosystem version, package roles, MCP tool catalog. ~1.5 KB JSON. Paste into context. The manifest reflects the *installed* `alaq` and `@alaq/mcp` snapshot, not the live monorepo state — pin versions if you need reproducibility.

```sh
npx alaq doctor  # or: bunx alaq doctor
```
Checks runtime, reachability of `@alaq/mcp`, optional Logi endpoint.

```sh
npx alaq mcp list  # or: bunx alaq mcp list
```
Lists MCP tools grouped by `compile_time` (`schema_compile`, `schema_diff`) and `runtime_observation` (`alaq_capabilities` + six `alaq_*` tools that read the Logi HTTP API).

```sh
npx alaq mcp install  # or: bunx alaq mcp install
```
Prints the standard MCP server stanza (JSON by default). Paste it into your MCP client's config file. `--format toml|yaml` for non-JSON clients; `--write <path>` to merge into a file you point at.

```sh
npx alaq mcp call schema_compile '{"paths":["core.aql"],"rootDir":"./schema"}'
# or: bunx alaq mcp call schema_compile '{"paths":["core.aql"],"rootDir":"./schema"}'
```
One-shot MCP call — no client needed. Output is the unwrapped tool payload. Same tool, same schema, whether invoked here or from an MCP client.

## Install as MCP server

```sh
npx alaq mcp install   # or: bunx alaq mcp install
```

Prints the stanza below. Append or merge it into your MCP client's config file (whatever path that client uses), then restart the client.

```json
{
  "mcpServers": {
    "alaq": {
      "command": "npx",
      "args": ["-y", "alaq", "mcp", "start"]
    }
  }
}
```

`command` is `npx` by default; pass `--command bunx` for a Bun stanza — the two are equal at runtime, pick whichever matches how your client launches packages.

Flags: `--format <json|toml|yaml>` for non-JSON configs, `--write <path>` to merge into a file directly, `--dry-run` to preview the merge, `--force` to overwrite an existing `alaq` entry. `alaq` does not resolve client-specific config paths — MCP is a protocol, and the set of clients keeps growing; pick the file yourself.

Once the stanza is in place and the client is restarted, the `alaq` server exposes both the compile-time and runtime-observation tool groups.

## Shell usage

Compile a schema:

```sh
alaq mcp call schema_compile '{"paths":["players.aql"],"rootDir":"./schema"}'
```

Compute a breaking-change report between two snapshots:

```sh
alaq mcp call schema_diff --args-file ./diff-args.json
```

Output is the unwrapped tool payload (pure JSON). Exit codes: `0` ok, `1` tool or runtime error, `2` usage error. Drop this into CI to gate PRs on `report.summary.breaking`.

## Error codes

Every error `alaq` surfaces carries a stable code (`E###`) followed by a human message. Automation keys on the code, not the text.

| Code | Meaning |
|------|---------|
| E001 | Usage — flags or arguments malformed (exit 2) |
| E002 | Unknown sub-command |
| E003 | Invalid JSON argument to `mcp call` |
| E004 | `--args-file` unreadable |
| E005 | `@alaq/mcp` could not be spawned |
| E006 | Bundled Node fallback missing |
| E007 | `--write` target already has an `alaq` entry (use `--force`) |
| E008 | Atomic write failed |
| E009 | `architecture.yaml` not found (non-fatal; snapshot used) |
| E010 | Unsupported `--format` value |

Full registry: [`src/errors.ts`](src/errors.ts). Before `6.0.0` GA the code space may shift; after GA these are normative under semver.

## What's in the box

`alaq` itself is thin: a CLI, an MCP launcher, a capability manifest. The ecosystem it points at:

- **Frontdoor** — `alaq` (this package).
- **Reactive core** — `@alaq/quark`, `@alaq/nucl`, `@alaq/atom`, `@alaq/fx`.
- **Plugins** (kind-based extensions of reactive core) — `@alaq/plugin-logi` (observability), `@alaq/plugin-idb` (persistence), `@alaq/plugin-tauri` (IPC).
- **alaqlink stack** — one *track inside* v6, not a synonym for v6. SDL-driven synchronized state for distributed apps: write a `.aql` schema once, `@alaq/graph` compiles it to IR, `@alaq/graph-*` generators emit typed TS clients/servers/Rust-Zenoh handlers, `@alaq/link` + `@alaq/link-state` are the runtime. See [`../../PHILOSOPHY.md`](../../PHILOSOPHY.md) for the full ecosystem map.
- **Utilities** — `@alaq/bitmask`, `@alaq/queue`, `@alaq/rune`, `@alaq/datastruct`, `@alaq/deep-state`.
- **UI adapters** — `@alaq/link-state-vue`, `@alaq/xstate`.
- **AI tooling** — `@alaq/mcp` (the MCP server `alaq mcp start` spawns).

Full layout and dependency rules: [`../../architecture.yaml`](../../architecture.yaml). Role of each package: see its own `README.md`.

## License

Dual-license, matching the rest of the repo:

- **Source code** (what you see on GitHub): governed by the TVR license — see the root `LICENSE` in the [alak monorepo](https://github.com/carabins/alak/blob/master/LICENSE).
- **Published npm artifact** (`alaq` on the npm registry): released under **Apache-2.0**.

If you installed from npm, Apache-2.0 applies. If you cloned the repo, TVR applies.

## Contributing

Before any change, read [`../../AGENTS.md`](../../AGENTS.md) (normative rules) and [`../../CHECK.md`](../../CHECK.md) (verification procedure). Ecosystem philosophy: [`../../PHILOSOPHY.md`](../../PHILOSOPHY.md). What "AI-first" means physically: [`../../AI_FIRST.md`](../../AI_FIRST.md). Contribution workflow: [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md). This package's design: [`./DESIGN.md`](./DESIGN.md). Local agent context: [`./AGENTS.md`](./AGENTS.md).
