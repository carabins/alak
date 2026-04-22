# Contributing to alaqlink

Thanks for considering a contribution. A few rules first — read before opening a PR.

## Licensing (read this)

This repository operates under a two-layer license model:

- **TVR License** (`LICENSE`) — applies to the repository as a whole: docs, specs, build scripts, and development artifacts.
- **Apache License 2.0** (`LICENSE-APACHE`) — applies to published source code inside `packages/*/src/` and to any npm artifacts built from it (`@alaq/graph`, `@alaq/mcp`, …).

By submitting a pull request you agree that your contribution is licensed as follows:

| Where you changed files | License your contribution is made under |
|---|---|
| `packages/*/src/` | **Apache-2.0** |
| `packages/*/test/`, `packages/*/README.md`, `packages/*/SPEC.md` | Apache-2.0 if the package ships them, otherwise TVR |
| Everything else (`scripts/`, `AGENTS.md`, `PHILOSOPHY.md`, `CHECK.md`, `architecture.yaml`, root configs, other docs) | **TVR** |

This is the standard "inbound = outbound" policy. No separate CLA required.

You must have the right to submit the code you're contributing (original work, or compatibly-licensed work with attribution preserved).

## Before opening a PR

1. Read `AGENTS.md` — the normative rules for this repo. They apply to human contributors too.
2. Read `PHILOSOPHY.md` if you're proposing a direction change.
3. Read `packages/graph/SPEC.md` if you're touching SDL behaviour.
4. Run the relevant package tests (`cd packages/<pkg> && bun test`).
5. If you modified the pipeline end-to-end, run `CHECK.md` section 2 (package health).

## What we merge fast

- Bug fixes with a test reproducing the bug.
- Missing/clarified diagnostics in `@alaq/graph`.
- Additional `schema_diff` classifier cases in `@alaq/mcp` with tests.
- Doc fixes (typos, unclear passages, missing cross-refs).

## What needs discussion first

- New SDL directives (requires `SPEC.md` bump).
- New generator plugins (`packages/graph-<target>/`) — open an issue first, plugin naming rule is strict (see `AGENTS.md`).
- Changes to `@alaq/mcp` tool surface or input schemas.
- Anything that touches `architecture.yaml`.

Open an issue with your proposal. Wait for a direction ack before writing code. Reference: `PHILOSOPHY.md` §1–2 (SDL as single truth, plugins by transport not product).

## What we do not merge

- Product-named generator plugins (`graph-kotelok`, `graph-valkyrie` — forbidden per `AGENTS.md`).
- Directives embedded in `@alaq/graph` that target a specific runtime (they belong in the plugin).
- TS AST parsing to extract schemas (schemas live in `.aql`, not in code).
- Reviving the deleted `packages/state.draft/` or `packages/gql.replaced/` experiments (directories were removed; do not recreate under those names or their concepts verbatim).

## Questions

Open an issue. If the question is "is this direction welcome" — ask before the code. If the question is "is this bug real" — a failing test is the best possible question.
