# alaq — design (v6.0.0-alpha.0)

This document specifies the shape of the `alaq` npm package for the v6 ecosystem. It is normative for the implementor. It is not a tutorial; see `README.md` for user-facing text and `PHILOSOPHY.md` / `AGENTS.md` for the ecosystem rules it slots into.

`alaq` is the **unscoped**, **AI-first frontdoor** for the `@alaq/*` v6 ecosystem. Everything else in the monorepo is scoped (`@alaq/graph`, `@alaq/mcp`, `@alaq/atom`, …). `alaq` — no scope, no family suffix — is deliberately reserved as the single entry point an LLM or a curious human reaches for first.

---

## 1. What `alaq` is

- An **LLM-first CLI**. The first audience is an AI agent dropped into a fresh repo; humans are a degenerate case (an agent with fewer tools). Output is machine-readable by default; pretty output is opt-in.
- A **capability manifest publisher**. `alaq` and `alaq mcp list` print a compact, diffable JSON manifest describing the ecosystem at the installed version. Agents paste this into context to learn what exists.
- An **MCP wiring tool**. `alaq mcp install` prints the standard MCP server stanza that any MCP-compatible client can consume. It is the shortest path from "I installed alaq" to "my agent can call `schema_compile`".
- A **shell fallback** to MCP. `alaq mcp call <tool> <args>` invokes the server one-shot, for humans and CI. It subsumes `alaq-mcp-call` from `@alaq/mcp`.

`alaq` is **not** a runtime. It does not re-export `@alaq/graph` / `@alaq/atom` APIs at v6.0.0 (see §7). It does not embed an LLM. It does not manage project code.

---

## 2. User stories

### 2.1. AI agent in a fresh Claude Code session

The agent is handed a repo with no prior knowledge of alaq. Its first contact:

```
$ npx alaq
```

Prints the capability manifest (JSON, ~1.5 KB) — ecosystem version, list of `@alaq/*` packages with roles, MCP tool catalog with one-line descriptions, pointers to `schema_compile` and `schema_diff`. The agent reads this, understands the surface, and decides whether to continue. Next call:

```
$ npx alaq mcp install
```

Prints the standard MCP server stanza to stdout (JSON). The agent pipes or pastes it into whatever config file its host MCP client uses. From here on the agent uses MCP tools directly. No further `alaq` invocations needed for most of the session.

### 2.2. Human developer who read a blog post

```
$ bun add alaq
$ bunx alaq doctor
```

`doctor` reports: Bun version OK, `@alaq/mcp` reachable, optional Logi endpoint status. Suggests `alaq mcp install` to print the stanza for the user's MCP client of choice. User pastes the stanza into their client's config file, restarts the client, and the tools appear.

### 2.3. CI pipeline running schema_diff on a PR

```yaml
- run: npx alaq mcp call schema_diff --args-file ./ci/diff-args.json > diff.json
- run: node ./ci/gate.js diff.json  # fails if report.summary.breaking > 0
```

The CI runner never starts an MCP client. It gets the same structured output an agent would. Exit code is `0` if the tool returned ok, `1` on tool error, `2` on usage error (matches `alaq-mcp-call`).

### 2.4. User wiring alaq into an MCP client

The user types `alaq mcp install`. `alaq` prints the stanza to stdout. The user appends or merges it into their MCP client's config file (whatever path that client uses) and restarts the client. If the user passes `--write <path>`, `alaq` merges into the given file directly — but `alaq` does not resolve client-specific paths itself.

### 2.5. `alaq init` in a new project

```
$ mkdir myproj && cd myproj && npx alaq init
```

Creates `alaq.yaml` and `schema/`. The project is now alaq-aware: `alaq mcp call schema_compile` without arguments reads `alaq.yaml` for defaults (`schemaDir: ./schema`). If `~/.alaq/` does not exist, `init` creates it as a side effect so ambient state has a home.

---

## 3. CLI surface

All commands support `--json` (default for non-TTY stdout) and `--pretty` (default for TTY). Global flags: `--version`, `--help`, `--quiet`, `--cwd <path>`.

| Command | Purpose |
|---|---|
| `alaq` | Print capability manifest. |
| `alaq doctor` | Check environment. |
| `alaq init [path]` | Scaffold an alaq-aware project. |
| `alaq mcp install` | Print the standard MCP server stanza for any MCP client. |
| `alaq mcp start` | Spawn `@alaq/mcp` on stdio (delegate). |
| `alaq mcp call <tool> <args>` | One-shot tool call. |
| `alaq mcp list` | List MCP tools grouped by `compile_time` / `runtime_observation`. |

### 3.1. `alaq` (no args)

- Default: manifest JSON to stdout, one object (see §5).
- `--pretty`: human-readable tree of the same data.
- Exit 0 always unless the package itself is broken.

### 3.2. `alaq doctor`

Checks:

- Runtime: `bun --version` or `node --version` (engines: `bun >= 1.3`, `node >= 20`).
- Reachability: `@alaq/mcp` resolves (either bundled or peer-installed, see §7).
- Optional: Logi endpoint at `http://localhost:2025/health` if `LOGI_ENDPOINT` set or default reachable.

Output JSON: `{ ok: bool, checks: [{ name, ok, detail }], hints: [...] }`. Exit 0 if all `ok`, 1 otherwise.

### 3.3. `alaq init [path]`

Arguments: path (default `.`).

Flags: `--template <name>` (v6.0: only `minimal`; future: `tauri`, `spa`), `--force` (overwrite existing files).

Creates (see §6 for content):

```
<path>/
  alaq.yaml
  schema/
    .gitkeep
```

Side effect: if `~/.alaq/` does not exist, it is created (empty). No files are written inside the project for ambient state — that lives in `~/.alaq/` (§6).

Prints the list of created files, JSON array by default.

### 3.4. `alaq mcp install`

Prints the standard MCP server stanza to stdout. No client argument: MCP is a protocol, and `alaq` does not privilege any vendor.

Flags:

- `--format <json|toml|yaml>` — output format (default `json`). For clients that consume non-JSON configs.
- `--write <path>` — instead of stdout, merge the stanza into the file at `<path>`. `alaq` does not know which client that path belongs to; the user picks it. Merge is atomic (temp file + rename), preserves unknown keys, and refuses to clobber an existing `alaq` entry unless `--force`.
- `--force` — overwrite an existing `alaq` entry when writing.
- `--dry-run` — with `--write`, print the merged file to stdout instead of writing.

See §4 for the stanza shape.

### 3.5. `alaq mcp start`

Spawns the `@alaq/mcp` server on stdio. Forwards stdin/stdout/stderr. This is what `command: "alaq"`, `args: ["mcp", "start"]` resolves to in the printed stanza — so the wired entry never references file paths inside `node_modules`.

Dual-runtime is `alaq`'s problem, not `@alaq/mcp`'s. `@alaq/mcp` stays Bun-source (`bin: bun src/bin.ts`); `alaq` is the piece that must run cleanly under **both** Bun and Node. To make that work, `alaq` ships with a pre-bundled Node-compatible copy of the MCP server — see §3.5.1 for the launcher logic and §9.1 for how the bundle is produced.

Exit code matches the child.

### 3.5.1. Launcher decision tree

Applies to both `alaq mcp start` and `alaq mcp call` (they share one launcher function; `call` wraps a one-shot stdio session around it).

1. **Detect host runtime.** `typeof process.versions.bun === "string"` ⇒ Bun host; else Node host. `BUN_INSTALL` / argv[0] are not consulted — `process.versions.bun` is authoritative.
2. **Resolve upstream `@alaq/mcp`.** `require.resolve("@alaq/mcp/package.json")` (or the ESM equivalent). If resolvable, read its `version`.
3. **Pick target.**
   - Bun host **and** upstream resolves ⇒ spawn `process.execPath` (the active `bun`) with `[<resolved>/src/bin.ts]`. Source-level, zero bundling cost, honors whatever `@alaq/mcp` version the user installed.
   - Bun host **and** upstream does not resolve ⇒ fall through to bundled Node copy, still spawned under `bun` (Bun runs plain ESM JS fine). Emit a one-line stderr notice: `alaq: @alaq/mcp not installed, using bundled fallback`.
   - Node host ⇒ always spawn `process.execPath` (the active `node`) with `[<alaq>/dist/mcp-server.node.mjs]`. The upstream Bun source is not invokable under Node; the bundled copy is the only option.
4. **Version coupling.** When upstream resolves and its version is `>=` the bundled snapshot's version, upstream wins (under Bun) — the user's explicit install is respected. If upstream is older than the snapshot, `alaq` still prefers upstream under Bun and logs a one-line hint to stderr; downgrades are the user's call, not `alaq`'s.
5. **stdio + signals.** `stdio: "inherit"`, `SIGINT` / `SIGTERM` forwarded, exit code propagated. No buffering, no line-mangling — MCP is a framed stdio protocol.

Failure modes: Node host with the bundled file missing is a packaging bug, exits `3` with a clear message. Bun host with neither upstream nor bundle resolvable is the same. Everything else (spawn failure, non-zero child exit) propagates the child's exit code unchanged.

### 3.6. `alaq mcp call <tool> <args>`

One-shot tool call. Mirrors `alaq-mcp-call` exactly:

- `alaq mcp call schema_compile '{"paths":["a.aql"],"rootDir":"./schema"}'`
- `alaq mcp call schema_diff --args-file ./diff-args.json`
- `alaq mcp list` (covered as a separate command below — do not also accept `alaq mcp call --list`; one syntax per concept).

Output: unwrapped tool payload JSON. Exit: 0 ok / 1 tool error / 2 usage error. If `alaq.yaml` is present in the project root and the tool supports `rootDir`, `alaq` injects it as a default. Project-local `alaq.yaml` drives schema defaults; ambient agent state lives in `~/.alaq/` (§6).

### 3.7. `alaq mcp list`

Prints the MCP tool catalog, grouped:

```json
{
  "compile_time": [
    { "name": "schema_compile", "summary": "Compile .aql → IR." },
    { "name": "schema_diff",    "summary": "Breaking-change report between SDL snapshots." }
  ],
  "runtime_observation": [
    { "name": "alaq_capabilities", "summary": "What alaq sees; self-describing entry point." },
    { "name": "alaq_trace",        "summary": "Span tree for an action id." },
    ...
  ]
}
```

Pulled from `@alaq/mcp`'s `tools/list` at runtime, not hardcoded — the list stays truthful across `@alaq/mcp` versions.

---

## 4. MCP wiring design

`alaq mcp install` emits one stanza, client-agnostic. MCP is a protocol; `alaq` does not ship a list of vendor adapters. The user (or agent) pastes the stanza into whatever config file their MCP client reads.

Stanza (JSON, default):

```json
{
  "mcpServers": {
    "alaq": {
      "command": "npx",
      "args": ["-y", "alaq", "mcp", "start"],
      "env": {
        "LOGI_ENDPOINT": "http://localhost:2025"
      }
    }
  }
}
```

`env.LOGI_ENDPOINT` is written with the default value. `alaq mcp install` does not probe the network to auto-fill it; silent modification of config is riskier than a one-line edit by the user.

**`npx` and `bunx` are equal.** The default `command` is `"npx"` because it is the more common entry on fresh machines; the Bun equivalent `"bunx"` is produced by `--command bunx`. Both launch the same CLI and route through the same launcher (§3.5.1) — the choice is a match to how the user's MCP client spawns subprocesses, not a preference of `alaq`. If documentation ever suggests one runtime is canonical, that is a bug (see [`../../AI_FIRST.md`](../../AI_FIRST.md) §"Runtime parity").

`--format toml` and `--format yaml` emit the equivalent structure. `--write <path>` merges into the given file atomically (temp + rename), preserving unknown keys; an existing `alaq` entry is kept unless `--force`. With `--dry-run`, the merged result is printed to stdout instead of written.

Uninstall is a user action: delete the `alaq` entry from the client config. `alaq` does not ship an `uninstall` command because it would require the same per-client path resolution that `install` deliberately avoids.

---

## 5. Capability manifest

Printed by `alaq` (no args). Target: **under 2 KB gzipped**, ~1.5 KB typical. Stable across patch versions; minor-bumps additively.

```json
{
  "alaq": { "version": "6.0.0-alpha.0", "node": ">=20", "bun": ">=1.3" },
  "ecosystem": {
    "version": "6.0.0-alpha.0",
    "packages": [
      { "name": "@alaq/graph",    "role": "spec-core",      "layer": "compile-time" },
      { "name": "@alaq/mcp",      "role": "ai-tooling",     "layer": "tooling"      },
      { "name": "@alaq/quark",    "role": "core-primitive", "layer": "runtime"      },
      { "name": "@alaq/nucl",     "role": "primitive",      "layer": "runtime"      },
      { "name": "@alaq/atom",     "role": "state-model",    "layer": "runtime"      },
      { "name": "@alaq/plugin-logi", "role": "plugin-observability", "layer": "runtime" },
      { "name": "@alaq/plugin-idb",  "role": "plugin-persistence",   "layer": "runtime" },
      { "name": "@alaq/plugin-tauri","role": "plugin-ipc",           "layer": "runtime" }
    ]
  },
  "mcp": {
    "server": "@alaq/mcp",
    "tool_groups": {
      "compile_time": ["schema_compile", "schema_diff"],
      "runtime_observation": [
        "alaq_capabilities", "alaq_trace", "alaq_atom_activity",
        "alaq_hot_atoms", "alaq_idb_stores", "alaq_idb_store_stats", "alaq_idb_errors"
      ]
    },
    "transport": "stdio"
  },
  "hints": {
    "first_call_for_agents": "alaq_capabilities",
    "wire_up": "alaq mcp install",
    "schema_dir_default": "./schema"
  }
}
```

### Requirements

- **Self-describing.** Everything an LLM needs to know to act is here. No follow-up docs required for basic usage.
- **Diffable.** Sort keys, stable ordering. Two agents comparing `alaq@6.0.0-alpha.0` vs `alaq@6.0.0-beta.1` can see exactly what changed.
- **Small.** ≤ 2 KB gzipped. No prose, no examples, no markdown. Descriptions belong in `alaq mcp list`, not here.
- **Truthful.** `ecosystem.packages` and `mcp.tool_groups` are generated from the installed `@alaq/mcp` at build time, not hand-maintained.

Package list is deliberately **not exhaustive** — 8 entries vs ~22 in `architecture.yaml`. Utilities (`bitmask`, `queue`, `rune`, `datastruct`, `deep-state`) and ui adapters are omitted from the manifest; they are not first-contact concerns. The full set is available via `alaq --full` (pretty-print tree).

---

## 6. Project config and ambient state

Two separate things, different homes:

- **Project-local config** — `alaq.yaml` at the project root. Committed. Read by `alaq mcp call` for defaults like `schemaDir`.
- **Ambient agent state** — `~/.alaq/` in the user's home dir. Not committed anywhere. Ephemeral scratch space for the agent across projects.

### 6.1. `alaq.yaml` (project root, committed)

```yaml
alaq: 1                 # config schema version
schemaDir: ./schema     # default rootDir for schema_compile / schema_diff
mcp:
  server: "@alaq/mcp"
  env:
    LOGI_ENDPOINT: http://localhost:2025
    LOGI_PROJECT:  demo_project_token
```

### 6.2. `~/.alaq/` (user home, never committed)

```
~/.alaq/
  state.json           # ephemeral: last-seen ecosystem version, last doctor run
  cache/               # manifest cache, gzipped
```

Home-scoped because it is agent-personal memory that outlives any individual project. Nothing in `~/.alaq/` belongs in a repo, so there is no gitignore concern — no project ever references it.

### 6.3. Rationale

- A single YAML for human-edited project config is boring and correct.
- Ambient state lives in the user's home so an agent can carry context across projects without polluting repos.
- The directory is just ephemeral state + cache; no append-only logs, no reserved future files.

---

## 7. Distribution strategy

### 7.0. Tarball layout

The published `alaq` tarball, once installed at `node_modules/alaq/`, contains:

```
node_modules/alaq/
  package.json
  src/            # TS sources (bin, index, manifest, launcher)
  dist/
    index.d.ts
    mcp-server.node.mjs   # bundled Node-runnable copy of @alaq/mcp's server, shebang #!/usr/bin/env node
```

`dist/mcp-server.node.mjs` is produced by `alaq`'s own build pipeline at publish time (see §9.1). It is a single-file ESM bundle of `@alaq/mcp/src/bin.ts` + its transitive TS imports (`server.ts`, `tools.ts`, `tools-runtime.ts`, `diff.ts`, and the subset of `@alaq/graph` they reach), compiled to JS targeting Node 20. Bundle is fully self-contained: `@alaq/mcp` is hand-rolled stdio JSON-RPC with no third-party deps, and `@alaq/graph` is zero-dep TS. Only Node stdlib is external.

### 7.1. Runtime API re-exports: **no**

`alaq` at v6.0.0 does **not** re-export TS APIs from `@alaq/graph`, `@alaq/atom`, etc. Two reasons:

1. **Cognitive confusion.** Consumers of reactive runtime code should `import { Atom } from '@alaq/atom'` — the import tells them which package they depend on. `from 'alaq'` loses that mapping.
2. **Coupling risk.** `alaq`'s job is CLI + MCP wiring. Re-exporting runtime APIs welds it to the shape of every reactive package; every refactor of `@alaq/atom` becomes an `alaq` release.

`main: ./src/index.ts` exposes only:
- `readManifest(): CapabilityManifest` — the object printed by `alaq`.
- `renderMcpStanza(opts): string` — the stanza emitted by `alaq mcp install`.
- `spawnMcp(): ChildProcess` — used by `alaq mcp start`.

These are for tooling authors, not application code.

### 7.2. `dependencies`: minimal

`alaq` depends on `@alaq/mcp` at runtime **and** at build time, but for different reasons:

- **`dependencies`** — `@alaq/mcp` stays a regular runtime dep so that under Bun the launcher resolves the user-installed source directly (preferred path, §3.5.1). Dropping it would force every user onto the bundled fallback and defeat the point of `@alaq/mcp` being a first-class package.
- **`devDependencies`** — `@alaq/mcp` (and `@alaq/graph`) are also consumed by `alaq`'s build pipeline to produce `dist/mcp-server.node.mjs`. Since the runtime `dependencies` entry already brings them into the dev tree, no separate `devDependencies` entry is needed; the build simply imports from the hoisted workspace copy.

```yaml
dependencies:
  "@alaq/mcp": "6.0.0-alpha.0"
```

Everything else in the ecosystem (`@alaq/atom`, `@alaq/plugin-logi`, etc.) is **not** a dependency. `alaq` lists them in its manifest but does not install them. An agent running `alaq mcp install` on a cold machine gets `alaq + @alaq/mcp + @alaq/graph` — three packages, small install, fast.

Adding plugins is the user's project concern, not the frontdoor's: `npm i @alaq/plugin-logi` lives in the user's `package.json`, not dragged in transitively by `alaq`.

Install-size budget: **under 2 MB unpacked** for `alaq + @alaq/mcp + @alaq/graph` combined. The bundled `dist/mcp-server.node.mjs` is budgeted at **≤ 200 KB minified, ≤ 60 KB gzipped**; it counts against `alaq`'s own tarball size, not the aggregate.

---

## 8. Non-goals (v6.0.0)

- **Not a runtime aggregator.** No re-exports of `@alaq/atom`, `@alaq/nucl`, `@alaq/quark`, `@alaq/link*`.
- **Not a scaffolder for apps.** `alaq init` creates a minimal alaq-aware project, not a Vue/Tauri/Bun app.
- **No embedded LLM.** `alaq` does not ship a model binary or API key, and does not call one.
- **No per-client MCP adapters.** `alaq mcp install` prints a single stanza; it does not resolve vendor-specific config paths or drive editor extension marketplaces.
- **No Logi deployment.** `alaq doctor` can detect a running Logi endpoint, but it does not start one. `docker compose up -d` in `A:/source/logi` is a user action.
- **No `graph` runtime wrapper.** `schema_compile` is reached via MCP or `alaq mcp call`, not `alaq compile` — one concept, one syntax.
- **No telemetry.** `alaq` sends nothing over the network. Logi is a user-configured endpoint, not a vendor hook.

---

## 9. Implementation notes

1. **Dual-runtime support lives in `alaq`, not in `@alaq/mcp`.** `@alaq/mcp` stays Bun-source (`bin: bun src/bin.ts`) — no Node build step, no second shebang, no changes to its `package.yaml`. `alaq` owns the cross-runtime story: at its own publish time, `alaq`'s build pipeline bundles `@alaq/mcp/src/bin.ts` and its transitive TS imports (the reached subset of `@alaq/graph` plus `@alaq/mcp`'s own zero-dep stdio JSON-RPC implementation) into `dist/mcp-server.node.mjs` — single-file ESM, Node-20 target, `#!/usr/bin/env node` shebang. Nothing external: `@alaq/mcp` is hand-rolled (no `@modelcontextprotocol/sdk` dependency), so the bundle is fully self-contained. Bundler choice (esbuild / `bun build` / rollup) is whatever the monorepo build pipeline already uses; this is a workspace-build question, not an `alaq` design question. The launcher (§3.5.1) picks upstream Bun source under Bun and the bundled Node file under Node; users and agents see one command, `alaq mcp start`, on both runtimes.

---

## 10. Version stamp

Target: `alaq@6.0.0-alpha.0`. Pre-GA contract: behaviour and CLI surface may change between alphas. Post-GA: semver on the CLI surface and manifest schema. Manifest schema version is tracked separately in the top-level `alaq` field (future: `"alaq": { "version": "6.1.0", "manifest_schema": 2 }`).
