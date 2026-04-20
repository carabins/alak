# alaq — design (v6.0.0-alpha.0)

This document specifies the shape of the `alaq` npm package for the v6 ecosystem. It is normative for the implementor. It is not a tutorial; see `README.md` for user-facing text and `PHILOSOPHY.md` / `AGENTS.md` for the ecosystem rules it slots into.

`alaq` is the **unscoped**, **AI-first frontdoor** for the `@alaq/*` v6 ecosystem. Everything else in the monorepo is scoped (`@alaq/graph`, `@alaq/mcp`, `@alaq/atom`, …). `alaq` — no scope, no family suffix — is deliberately reserved as the single entry point an LLM or a curious human reaches for first.

---

## 1. What `alaq` is

- An **LLM-first CLI**. The first audience is an AI agent dropped into a fresh repo; humans are a degenerate case (an agent with fewer tools). Output is machine-readable by default; pretty output is opt-in.
- A **capability manifest publisher**. `alaq` and `alaq mcp list` print a compact, diffable JSON manifest describing the ecosystem at the installed version. Agents paste this into context to learn what exists.
- An **MCP wiring tool**. `alaq mcp install <client>` writes the stanza that connects `@alaq/mcp` to Claude Desktop, Claude Code, Cursor, etc. It is the shortest path from "I installed alaq" to "my agent can call `schema_compile`".
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
$ npx alaq mcp install claude-code
```

The agent's host is Claude Code; `alaq` edits the local `.mcp.json` (or user-scoped equivalent) and reports the exact path and merged config. From here on the agent uses MCP tools directly. No further `alaq` invocations needed for most of the session.

### 2.2. Human developer who read a blog post

```
$ bun add alaq
$ bunx alaq doctor
```

`doctor` reports: Bun version OK, `@alaq/mcp` reachable, no MCP clients detected, suggests `alaq mcp install claude-desktop`. User runs it, restarts Claude Desktop, opens a chat, types "list the alaq tools" — the MCP client responds with nine tools. From curious to usable in under a minute.

### 2.3. CI pipeline running schema_diff on a PR

```yaml
- run: npx alaq mcp call schema_diff --args-file ./ci/diff-args.json > diff.json
- run: node ./ci/gate.js diff.json  # fails if report.summary.breaking > 0
```

The CI runner never starts an MCP client. It gets the same structured output a Claude agent would. Exit code is `0` if the tool returned ok, `1` on tool error, `2` on usage error (matches `alaq-mcp-call`).

### 2.4. Claude Desktop user wiring alaq

The user types `alaq mcp install claude-desktop`. `alaq`:

1. Resolves the Claude Desktop config path (`%APPDATA%/Claude/claude_desktop_config.json` on Windows, `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `~/.config/Claude/claude_desktop_config.json` on Linux).
2. Loads the JSON (or creates `{ "mcpServers": {} }` if missing).
3. Merges an `alaq` entry. If one exists, prompts (interactive) or refuses (`--no-interactive`) unless `--force`.
4. Writes atomically (temp file + rename). Prints the final path and diff.
5. Tells the user to restart Claude Desktop.

### 2.5. `alaq init` in a new project

```
$ mkdir myproj && cd myproj && npx alaq init
```

Creates `alaq.yaml`, `schema/`, `.alaq/` state dir. The project is now alaq-aware: `alaq mcp call schema_compile` without arguments reads `alaq.yaml` for defaults (`schemaDir: ./schema`). The LLM in that repo has a well-known place to stash decisions (see §6).

---

## 3. CLI surface

All commands support `--json` (default for non-TTY stdout) and `--pretty` (default for TTY). Global flags: `--version`, `--help`, `--quiet`, `--cwd <path>`.

| Command | Purpose |
|---|---|
| `alaq` | Print capability manifest. |
| `alaq doctor` | Check environment. |
| `alaq init [path]` | Scaffold an alaq-aware project. |
| `alaq mcp install <client>` | Wire `@alaq/mcp` into a client. |
| `alaq mcp uninstall <client>` | Reverse of install. |
| `alaq mcp start` | Spawn `@alaq/mcp` on stdio (delegate). |
| `alaq mcp call <tool> <args>` | One-shot tool call. |
| `alaq mcp list` | List MCP tools grouped by `compile_time` / `runtime_observation`. |
| `alaq decide <question>` | **v6.1+ placeholder.** Ecosystem-advisor query. |

### 3.1. `alaq` (no args)

- Default: manifest JSON to stdout, one object (see §5).
- `--pretty`: human-readable tree of the same data.
- Exit 0 always unless the package itself is broken.

### 3.2. `alaq doctor`

Checks:

- Runtime: `bun --version` or `node --version` (engines: `bun >= 1.3`, `node >= 20`).
- Reachability: `@alaq/mcp` resolves (either bundled or peer-installed, see §7).
- MCP clients found: Claude Desktop, Claude Code, Cursor, Continue — by probing known config paths.
- Optional: Logi endpoint at `http://localhost:8080/health` if `LOGI_ENDPOINT` set or default reachable.

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
  .alaq/
    state.json
    decisions.jsonl    # append-only, for `alaq decide`
  .gitignore           # if missing; appends .alaq/cache/
```

Prints the list of created files, JSON array by default.

### 3.4. `alaq mcp install <client>`

`<client>` ∈ `claude-desktop`, `claude-code`, `cursor`, `continue` (v1). Future: `zed`, `windsurf`, `vscode-copilot`.

Flags: `--scope user|project` (where applicable), `--force`, `--no-interactive`, `--dry-run` (prints the merged config to stdout, writes nothing).

Per-client behaviour detailed in §4.

### 3.5. `alaq mcp start`

Spawns `@alaq/mcp` on stdio. Forwards stdin/stdout/stderr. This is what `command: "alaq"`, `args: ["mcp", "start"]` resolves to in the generated config — so the wired entry never references file paths inside `node_modules`.

Exit code matches the child.

### 3.6. `alaq mcp call <tool> <args>`

One-shot tool call. Mirrors `alaq-mcp-call` exactly:

- `alaq mcp call schema_compile '{"paths":["a.aql"],"rootDir":"./schema"}'`
- `alaq mcp call schema_diff --args-file ./diff-args.json`
- `alaq mcp list` (covered as a separate command below — do not also accept `alaq mcp call --list`; one syntax per concept).

Output: unwrapped tool payload JSON. Exit: 0 ok / 1 tool error / 2 usage error. If `alaq.yaml` is present and the tool supports `rootDir`, `alaq` injects it as a default.

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

### 3.8. `alaq decide <question>` (v6.1+)

Placeholder. Shape designed now so `alaq init` writes the right files:

```
alaq decide "do I need @alaq/plugin-logi for this project?"
```

Reads `alaq.yaml` + `.alaq/state.json`, composes a prompt with the manifest + the question, calls an LLM (via the user's configured MCP client or a direct Anthropic/OpenAI key — **TBD**), appends the exchange to `.alaq/decisions.jsonl`, prints the decision summary. **Not implemented in v6.0.0.** Reserved in CLI so the command exists and returns a stub: `{ status: "unimplemented", eta: "6.1.0" }`.

---

## 4. MCP wiring design

Target-file and merge semantics per client. All writers use atomic write (temp file + rename) and preserve unknown keys.

### 4.1. `claude-desktop`

Path:
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

File may not exist — create as `{ "mcpServers": {} }`.

Generated stanza:

```json
{
  "mcpServers": {
    "alaq": {
      "command": "npx",
      "args": ["-y", "alaq", "mcp", "start"],
      "env": {
        "LOGI_ENDPOINT": "http://localhost:8080"
      }
    }
  }
}
```

`env.LOGI_ENDPOINT` included only if present in caller env or `alaq.yaml`. `command: "npx"` chosen over `bun` because Claude Desktop users overwhelmingly have Node; Bun detection is a `--command bun` flag override.

Collision: if `mcpServers.alaq` exists, prompt (interactive) or refuse (`--no-interactive`) unless `--force`.

### 4.2. `claude-code`

Project-scoped by default — writes to `./.mcp.json` at `--cwd`. User-scoped — writes to `~/.claude.json` with `--scope user`. Same stanza shape as 4.1.

Collision: same rule as 4.1.

### 4.3. `cursor`

Path: `~/.cursor/mcp.json` (user-scoped) or `./.cursor/mcp.json` (project-scoped). Same stanza shape.

### 4.4. Future

`continue`, `zed`, `windsurf`, `vscode-copilot` — handwave. Each client gets a small adapter module that resolves path(s) and knows the enclosing JSON shape. The merge logic is shared.

### 4.5. Uninstall

`alaq mcp uninstall <client>` removes only the `alaq` entry. Leaves other servers untouched. If the resulting `mcpServers` is empty and the file was created by `alaq`, the file is kept (less surprising).

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
    "wire_up": "alaq mcp install <client>",
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

## 6. `.alaq/` project state

`alaq init` creates a hybrid: one top-level YAML (readable, diff-friendly) plus a hidden dir for mutable state.

### 6.1. `alaq.yaml` (project root, committed)

```yaml
alaq: 1                 # config schema version
schemaDir: ./schema     # default rootDir for schema_compile / schema_diff
mcp:
  server: "@alaq/mcp"
  env:
    LOGI_ENDPOINT: http://localhost:8080
    LOGI_PROJECT:  demo_project_token
decide:                 # v6.1+ placeholder, keys reserved
  provider: null
  model: null
```

### 6.2. `.alaq/` (project root, gitignore by default except decisions.jsonl)

```
.alaq/
  state.json           # ephemeral: last-seen ecosystem version, last doctor run
  decisions.jsonl      # append-only, committed — decisions made via `alaq decide`
  cache/               # ignored; manifest cache, gzipped
```

`decisions.jsonl` is committed so the team shares reasoning. `cache/` and `state.json` are ignored. `alaq init` appends to `.gitignore` if present.

### 6.3. Rationale

- A single YAML for human-edited config is boring and correct.
- A hidden dir for machine-written artifacts keeps the top level clean.
- `decisions.jsonl` is the scaffolding for future AI workflows (§3.8). Reserving it now costs nothing.

---

## 7. Distribution strategy

### 7.1. Runtime API re-exports: **no**

`alaq` at v6.0.0 does **not** re-export TS APIs from `@alaq/graph`, `@alaq/atom`, etc. Two reasons:

1. **Cognitive confusion.** Consumers of reactive runtime code should `import { Atom } from '@alaq/atom'` — the import tells them which package they depend on. `from 'alaq'` loses that mapping.
2. **Coupling risk.** `alaq`'s job is CLI + MCP wiring. Re-exporting runtime APIs welds it to the shape of every reactive package; every refactor of `@alaq/atom` becomes an `alaq` release.

`main: ./src/index.ts` exposes only:
- `readManifest(): CapabilityManifest` — the object printed by `alaq`.
- `resolveMcpClient(client: string): { path: string, kind: string }` — used by `alaq mcp install`.
- `spawnMcp(): ChildProcess` — used by `alaq mcp start`.

These are for tooling authors, not application code.

### 7.2. `dependencies`: minimal

`alaq` depends only on `@alaq/mcp`. That brings in `@alaq/graph` transitively.

```yaml
dependencies:
  "@alaq/mcp": "6.0.0-alpha.0"
```

Everything else in the ecosystem (`@alaq/atom`, `@alaq/plugin-logi`, etc.) is **not** a dependency. `alaq` lists them in its manifest but does not install them. An agent running `alaq mcp install` on a cold machine gets `alaq + @alaq/mcp + @alaq/graph` — three packages, small install, fast.

Adding plugins is the user's project concern, not the frontdoor's: `npm i @alaq/plugin-logi` lives in the user's `package.json`, not dragged in transitively by `alaq`.

Install-size budget: **under 2 MB unpacked** for `alaq + @alaq/mcp + @alaq/graph` combined.

---

## 8. Non-goals (v6.0.0)

- **Not a runtime aggregator.** No re-exports of `@alaq/atom`, `@alaq/nucl`, `@alaq/quark`, `@alaq/link*`.
- **Not a scaffolder for apps.** `alaq init` creates a minimal alaq-aware project, not a Vue/Tauri/Bun app.
- **No embedded LLM.** `alaq decide` is a v6.1+ placeholder; it does not ship a model binary or API key.
- **No VS Code / JetBrains extension install.** MCP wiring writes config files; it does not drive editor extension marketplaces.
- **No Logi deployment.** `alaq doctor` can detect a running Logi endpoint, but it does not start one. `docker compose up -d` in `A:/source/logi` is a user action.
- **No `graph` runtime wrapper.** `schema_compile` is reached via MCP or `alaq mcp call`, not `alaq compile` — one concept, one syntax.
- **No telemetry.** `alaq` sends nothing over the network. Logi is a user-configured endpoint, not a vendor hook.

---

## 9. Open questions for the user

1. **Dual-runtime support for `@alaq/mcp`.** Per user decision, Bun and Node are first-class equals. Current `@alaq/mcp` bin is `bun src/bin.ts` — a Bun-only shebang. Before `alaq` v1 ships, `@alaq/mcp` must build a Node-runnable entry too (compiled `.js` + `#!/usr/bin/env node`). `alaq mcp start` picks the right one at runtime based on which interpreter launched the process. This is a task, not a choice.
2. **MCP clients in v1.** Design covers `claude-desktop`, `claude-code`, `cursor`, `continue`. Is that the shipping set? Drop any? Add `zed` or `windsurf` immediately?
3. **`.alaq/` location.** Project-local (current design) vs user-home (`~/.alaq/`) vs both. Project-local wins for team workflows; home-dir would be useful for agent-personal memory that outlives projects. Design allows both if we want — `alaq init --scope user` could write to `~/.alaq/`.
4. **Logi discovery at install.** Should `alaq mcp install` probe `localhost:8080` and auto-fill `LOGI_ENDPOINT` in the env block if found? Or always write the default and let users edit? Auto-fill is friendlier; silent modification of config is riskier.
5. **`alaq decide` provider.** When we ship v6.1, does it call through the user's existing MCP client (relay pattern), or take an `ANTHROPIC_API_KEY` directly? Relay is purer (no key management) but couples `alaq` to the client's availability. Direct key is simpler but duplicates auth.

---

## 10. Version stamp

Target: `alaq@6.0.0-alpha.0`. Pre-GA contract: behaviour and CLI surface may change between alphas. Post-GA: semver on the CLI surface and manifest schema. Manifest schema version is tracked separately in the top-level `alaq` field (future: `"alaq": { "version": "6.1.0", "manifest_schema": 2 }`).
