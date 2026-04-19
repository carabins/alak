# @alaq/mcp

AI-first MCP server for alaqlink. Exposes the SDL pipeline as machine-readable tools.

**Status:** 6.0.0-alpha.0. Unstable; breaking changes expected before 6.0.0 GA.

## Why

Until now, alaqlink's compile tooling spoke only to humans (CLIs, file outputs). An AI agent had to scrape stdout and guess at structure. This package gives agents first-class tools so they can design schemas and reason about breaking changes without a human in the middle.

## Tools

All tools accept either **inline** sources or **filesystem** paths. Filesystem mode is preferred for anything more than a couple of files — it skips JSON-encoding the source text.

### `schema_compile`

Compile one or more `.aql` sources into IR.

Inline:
```json
{ "inputs": [{ "path": "p.aql", "source": "schema S { version: 1, namespace: \"s\" }" }] }
```

Filesystem (recommended):
```json
{ "paths": ["core.aql", "players.aql"], "rootDir": "/abs/path/to/schema" }
```

`rootDir` sandboxes reads — paths that escape via `..` are rejected. Absolute paths work without `rootDir`.

Returns `{ ok, ir, diagnostics, files }`. Diagnostics are structured: `{ code, severity, message, file, line, column }`.

### `schema_diff`

Compute a breaking-change report between two SDL snapshots. Each side accepts either an inline array of `{path,source}` or `{paths,rootDir}` for filesystem mode. Sides can mix modes.

```json
{
  "before": { "paths": ["p.aql"], "rootDir": "./schema" },
  "after":  [{ "path": "p.aql", "source": "..." }]
}
```

Returns `{ ok, report, diagnostics }`. `report.summary` has `{ breaking, non_breaking, review }` counts. Each `report.changes[i]` has `kind`, `category`, `name`, optional `field`, and a human-readable `detail` that explains *why* (e.g. "writers must now supply value", "readers expecting non-null may break").

Classification rules:
- **breaking**: removed/renamed declaration, removed required field, type change, optional → required (write-side), tightened list-item nullability, removed enum value, action output change, scope change.
- **non_breaking**: added optional field, new declaration, added enum value.
- **review**: required → optional (read-side hazard), loosened list-item nullability, schema version bump. *The agent must apply judgement — not all read-side relaxations are safe even though no writer breaks.*

## One-shot CLI (no MCP client needed)

For shell scripts and agents driving the server ad-hoc:

```bash
alaq-mcp-call --list                                         # list tools
alaq-mcp-call schema_compile '{"paths":["a.aql"],"rootDir":"./schema"}'
alaq-mcp-call schema_diff   --args-file ./diff-args.json     # avoid shell quoting
```

Output is the unwrapped tool payload (just the JSON, no MCP envelope). Exit code: 0 ok, 1 tool error, 2 usage error.

## Wire it up

Any MCP-aware client (Claude Desktop, Claude Code, etc.). Example config:

```json
{
  "mcpServers": {
    "alaq": {
      "command": "bun",
      "args": ["A:/source/alak/packages/mcp/src/bin.ts"]
    }
  }
}
```

## Run tests

```bash
cd A:/source/alak/packages/mcp && bun test
```

## License

This package ships under a dual-license arrangement. Read both before redistributing.

- **Source code** (what you see on GitHub): governed by the TVR license — see the root `LICENSE` file in the [alak monorepo](https://github.com/carabins/alak/blob/master/LICENSE).
- **Published npm artifact** (`@alaq/mcp` on the npm registry, the `lib/` / `legacy/` / `types/` output): released under **Apache-2.0**.

In practice: if you installed from npm, Apache-2.0 applies to the code you received. If you cloned the repo, TVR applies to the sources. This split is intentional — it keeps the upstream project's development terms intact while giving downstream npm consumers a conventional permissive license.
