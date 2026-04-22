# alak — open gaps

Living list of real gaps, grouped by priority. Crystallised from `stress-summary-2026-04-20.md` (wave 1) and `CHECK.md` known-issue notes. Stress journal entries live in `stress.md`; iteration digests in `DIGEST.md`.

## Priority 1 — additive IR fixes (cheap, unblocks generators)

- [ ] **Leading-comments in IR.** `IRRecord.leadingComments?` / `IRAction.leadingComments?` in `packages/graph/src/ir.ts`. Closes O8 (event-marker `# @event: Name`) and the stream-marker case in one fix. Unblocks `graph-tauri-rs` / `graph-tauri`. Update `SPEC §10` at the same time.
- [ ] **Sync SPEC §10 with impl.** `outputList` + `outputListItemRequired` are already emitted by the parser (v0.3.1 additive). SPEC schema for `Action` still lags — add them.

## Priority 2 — SPEC clarifications (small, normative)

- [ ] **Reserved names in SPEC §2.** Full lexer keyword list (`version`, `scope`, `namespace`, `input`, `output`, `qos`, `max_size`). Closes O6 cheaply — full contextual-keywords refactor is not required.
- [ ] **`Map<K, V>` semantics of `!` on K / V** — explicit rule in §4.8 (O4).
- [ ] **Required-args enforcement for directives.** §7.11 / §7.12 promise it; validator currently does not enforce (O19).

## Priority 3 — PHILOSOPHY normative clarification (one paragraph)

- [ ] Add an explicit paragraph: *"transport, auth, events may live outside SDL — in the generator config. SDL describes **data shape**; delivery mode, authorisation, and push semantics are conventions of the target generator."* Resolves three 🟡 signals (transport-marker, auth-scope, events) with a single normative stroke. Leaves room for `@local` / `@transport` / `@event` as future additive extensions.

## Priority 4 — known `@alaq/graph` bugs (from CHECK.md)

- [ ] **Multi-file linker spurious `E009`.** Two `.aql` files sharing a `schema { namespace }` and cross-referencing records fail to link: linker emits `E009 — field type references undefined type` even though both records are present in `ir.schemas.*.records`. Workaround: colocate cross-referencing records in one file. See `CHECK.md §3.2`.
- [ ] **`@alaq/graph-link-state` generator banner.** Header still reads `v0.1.0-draft`; bump to `6.0.0-alpha.0`. Cosmetic.
- [ ] *(optional)* Emit a runtime schema-as-`Record` constant from `@alaq/graph-link-state` — consumers currently have to read IR via `@alaq/graph` or `@alaq/mcp` for runtime schema metadata. See `CHECK.md §3.3`.

## Priority 5 — live e2e replacement

- [ ] **Reconstruct `CHECK.md §5`.** `Kotelok-2/` was extracted; the live server-boot / smoke-client / `WELCOME / CreateRoom / JoinRoom / SNAPSHOT` round-trip has no in-tree consumer. When a new reference consumer is in place, restore the section.

## Priority 6 — `alaq` frontdoor package

See `packages/alaq/DESIGN.md` for the seed design: `manifest.json` (ecosystem catalogue), `.alaq/project.json` (per-project memory, committed to git), `.alaq/runtime.json` (Logi snapshot, gitignored). CLI: `alaq new`, `alaq doctor`, `alaq install`, `alaq decide`, `alaq sync`.

- [ ] Implement `alaq` CLI against `packages/alaq/DESIGN.md`.
- [ ] Decide default preset for `alaq new` (open question).
- [ ] Merge strategy for `.alaq/project.json` when two agents write decisions in parallel (open question).

## Parked / post-GA

- First-class `event Name { ... }` in EBNF (wait for a second stress wave after leading-comments). (O8 α)
- Multi-axis `@scope` — Arsenal v2 closed the task without it. (O7)
- Contextual keywords — reserved-list in SPEC §2 is cheaper and sufficient. (O6)
- `@dto` / `@transient` markers — one consumer so far (Arsenal `UploadTicket`). (O15)
- `@alaq/plugin-tauri-prewarm` — revisit when a second Tauri product hits the same `<200ms` cold-start KPI. (O16, O17)

## Housekeeping

- [ ] Keep `CHECK.md §2` in sync as new packages gain test suites.
- [ ] Backfill `license: Apache-2.0` in any publishable `packages/*/package.yaml` that still leaves it unset (see `CHECK.md §7.8`).
