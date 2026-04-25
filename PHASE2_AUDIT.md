# alak v1 — Phase 2A audit & plan

Snapshot: 2026-04-24. Author: alak-owner. Status: **proposal — awaiting Leader approval before execution.**

Scope: four HTTP-link packages (`graph-axum` server gen, `graph-link-http` TS client gen, `graph-link-http-rs` Rust client gen, `link-http-client` TS rt, `alaq-link-http-client` Rust rt, `alaq-graph-axum-rt` server rt), the SDL core (`@alaq/graph` + `aqc` CLI), integration with rest.valkyrie philosophy docs (`versioning.md`, `logi.md`).

Hard constraints:
- arsenal v0 stays green. Wrapped envelope is the default and will not flip.
- No consumer code is touched.
- Breaking changes to alak APIs are opt-in or minor-bumped.

## Revision log

- **2026-04-24 evening — post-Wave-0 sharpening.** Wave 0 landed (client-gen P0 port-in-place, cli-ui unblocked). Changes to this document reflect what Wave 0 taught us:
  - **Root cause of the client-gen P0 was sharper than "diverging mappers"**: both gens were reading a `type.kind === 'List'` / `type.kind === 'Scalar'` shape that **does not exist in the IR** (IR has flat flags: `list`, `listItemRequired`, `map`, plus `outputList` on actions — see `packages/graph/src/types.ts:272-336`). So the `List`/`Scalar` branches were dead code; every non-scalar type silently degraded to the bare identifier. Arsenal's simple schema masked this. **This strengthens the case for Wave 2 extraction** — if three generators re-implement type-walking, one of them will drift out-of-sync with the IR shape. That's what happened here, and the lag was invisible until cli-ui ran a real consumer.
  - **Wave 2's `@alaq/codegen-util` extraction is now more mechanical**, not less. Wave 0 ported the logic in-place; Wave 2 can delete the duplicates and re-route imports. Scope shrank from "~400 LOC new package + 3 generators migrated" to "extract + rewire imports, ~100 net LOC change, behaviour-preserving."
  - **Verified during Wave 0**: Rust runtime's 202 handling is a hard `if status == ACCEPTED` gate (`alaq-link-http-client/src/lib.rs:70`), so `Delete → bool!` on wrapped envelope returns `Ok(bool)` via the fall-through JSON path. Removed from the "needs verification" column. The 202 branch fires only when action declares no output (the graph-axum dispatcher emits `StatusCode::ACCEPTED.into_response()` in that case).
  - **New SDL contract gotcha surfaced**: parser treats `Map<K, V>` with an unadorned `V` as a nullable value. Required values need `!` explicitly: `Map<K, V!>`. Arsenal's SDL doesn't use Map so no exposure; Wave 2's Kotelok-axum integration should include Map fields so we pin this in tests.
  - **The `I` prefix on records stays for Wave 0+1** to avoid cli-ui churn (6 Vue files). Wave 2 drops it as part of codegen-util extraction, which bumps the alpha anyway.
  - **Client-gen P0 in the original plan is DONE** — Wave 0 landed it. The "P0 Parity of type mapping" and "P0 TS record name no `I` prefix" items below are marked with their current state (Wave 0 partial / Wave 2 completes).

## TL;DR findings

1. **Wire-format is aligned on the happy path.** `graph-axum` wrapped-default ↔ TS/Rust clients' hardcoded `{input}` — verified. Empty-input actions: server has no `Json` extractor, but axum silently ignores a body on a handler without one — confirmed by a standalone smoke (bodyless, `{}`, `{"input":{}}` all return 200). So **the "body-less POST" case is a test gap, NOT a live blocker**. Downgraded from P0 to P2.
2. **The two client generators were WRONG against the IR, not just diverging.** `graph-link-http` and `graph-link-http-rs` walked `type.kind === 'List' | 'Scalar'` — branches the IR doesn't produce (IR has flat `list`/`listItemRequired`/`map` flags on fields, `outputList`/`outputListItemRequired` on actions; `type` is always a bare identifier). So lists silently degraded to scalar names, non-primitive built-ins like `Timestamp` fell through to raw identifiers (`IInt` in TS, literal `Int` in Rust), and Map/enum serde/keyword-escape handling was absent entirely. **Wave 0 ported graph-axum's correct logic into each gen locally** (see Revision log). Wave 2 extracts `@alaq/codegen-util` and deletes the duplicate. Arsenal ships on the Wave 0 fix.
3. **Error schema: server emits `{error, code}`, both clients first probe `message` then fall back to `error`.** Defensive but undocumented. Either standardize the server on `message` (consistent with Error-like ergonomics) or pin the contract (`error`) on both clients and drop the `message` fallback. I recommend the latter for minimal churn.
4. **Observability seam missing.** `ActionContext` already carries `trace_id` (UUID v7-able, but today v4), `peer`, `admin` — a real starting point — but there's no `tracing` integration, no request-id in error body, no logi SDK hook. Handlers can't log-with-trace without manual plumbing. Philosophy says: every session/request should carry `VK_FULL_VERSION` and correlate in Logi. alak provides no seam today.
5. **Generator↔runtime version drift: narrower than audit claimed.** Only `alaq-graph-axum-rt` is at `0.1.0` — every other package in the quartet is on the unified `6.0.0-alpha.0` line, including `alaq-link-http-client`. So: **one crate to bump**, not a systemic crisis. But the underlying issue — there's no machinery enforcing generator↔runtime compatibility — remains.
6. **No end-to-end integration test** that spins up a `graph-axum` server and hits it with a `graph-link-http[-rs]` client. This is the single highest-leverage test we could add: would catch (2), (3), empty-input regressions, and any future envelope-format divergence in one shot.
7. **Documentation for the "canonical alak HTTP stack" as a system does not exist.** Each package has a local README, but nothing says "server = graph-axum + alaq-graph-axum-rt, client = graph-link-http[-rs] + {alaq-,@alaq/}link-http-client, wire = wrapped envelope." This is the first thing a new consumer needs.

---

## Package-by-package proposals

Format per item: **[PRIORITY] Title** — Problem · Change · Scope.

### `@alaq/graph-axum` (server gen)

- **[P1] Align `HandlerError` body with client expectations.**
  Problem: server emits `{error, code}`; TS/Rust clients look up `message` first, `error` second. A third-party reading only the server code would reasonably expect `message`.
  Change: pick one name and update both sides. My recommendation — **keep `error` on the server, drop `message` fallback in both clients**. Rationale: `error` matches REST conventions better than `message` (HTTP body's purpose is to describe the error, not be a message-like log string). Either way, document the contract in `alaq-graph-axum-rt/src/error.rs` module docs.
  Scope: ~30 lines across alaq-graph-axum-rt error.rs doc, link-http-client/src/index.ts, alaq-link-http-client/src/lib.rs. Test: end-to-end (see P0 item below).

- **[P1] Request ID in error body.**
  Problem: errors have no correlation id. Client can't say "I got error X and here's the trace id to look up". Blocks logi-based remote debugging.
  Change: add `request_id: Uuid` to `ErrorBody`, populate from `ActionContext.trace_id`. Requires plumbing ctx into error path — either make `IntoResponse` for `HandlerError` no-longer work standalone (construct via `ctx.error(e)` helper) or insert a middleware that patches outgoing error responses with `x-trace-id` header. The header approach is non-invasive and doesn't change the body schema — start there, add body field later if needed.
  Scope: middleware ~40 LOC in alaq-graph-axum-rt + doc. Non-breaking.

- **[P1] Tracing integration.**
  Problem: generated dispatchers don't emit a tracing span. Handlers that want to log with trace_id have to pull it from `ActionContext` and attach manually.
  Change: generate `let _span = tracing::info_span!("action", name=%<snake>, trace_id=%ctx.trace_id).entered();` at the top of each dispatcher. Pull `tracing` crate into `alaq-graph-axum-rt` and re-export (so generated code uses a single path). Behind a generator option `tracing: boolean` (default true for v1).
  Scope: ~10 LOC generator, ~5 LOC dependency. Generated code changes — **not breaking** because it's purely additive (a span at the entry). Test: compile a smoke + assert tracing-test sees the span.

- **[P2] `Envelope` struct naming leak into `types::*`.**
  Problem: currently private to `routes.rs` (good). But `buildTypesFile` could surface the intent — e.g. a marker doc-comment listing the wire contract. Low priority; mostly for human readers.
  Change: emit a `// Wire: {input: <T>} wrapped envelope` doc line in `routes.rs` header comment.
  Scope: 2 lines.

- **[P2] Transport directive enforcement.**
  Problem: `@transport(kind: "zenoh")` on a schema is currently E025-rejected by graph-axum (good, verified in code) but graph-zenoh is not audited here; consistency story exists only one-way.
  Change: audit reverse-direction later, when graph-zenoh work is in scope. Noted for completeness.

- **[P2] Empty-input regression test.**
  Problem: confirmed by live smoke that axum tolerates `{"input":{}}` on body-less handlers, but there's no unit test pinning that behavior. A future axum upgrade could tighten it.
  Change: add a test in `graph-axum` that uses `axum::Router` directly, sends a wrapped-empty body to an empty-input dispatcher, asserts 200/202. This needs `axum` as a dev-dep to the TS package's test harness — meaning this one test probably lives in `alaq-graph-axum-rt` instead (see `[P0]` integration test below which covers it).
  Scope: folded into the P0 integration suite.

### `@alaq/graph-link-http` + `@alaq/graph-link-http-rs` (client gens)

- **[DONE — Wave 0] Type mapping parity with `graph-axum`.** ✅ Ported graph-axum's `mapFieldType`/`mapBaseType`/`mapTypeRef`/`mapActionOutputType`/`enumVariantName`/`pickEnumRenameAll` into each client gen's local scope. Built-in scalars, lists at both field and output levels, Map<K,V>, required/nullable at list-outer + list-item, enum `#[serde(rename_all = "...")]`, Rust `r#keyword` raw-idents, TS reserved-word `_` suffix — all covered. Test fixtures in `packages/graph-link-http/test/regression.aql` and the Rust-gen sibling.
  Acceptance verified: `tsc --noEmit` on arsenal.aql output → clean. `cargo check` against real `alaq-link-http-client` runtime → zero errors, zero warnings.

- **[P1 — Wave 2] Extract `@alaq/codegen-util` + delete per-gen duplicates.**
  Problem: Wave 0 ported the logic in-place, creating three copies of the same type-mapping rules (axum + two client gens). If the IR shape changes again, all three must update in lockstep — the same kind of lag that produced the Wave 0 bug.
  Change: extract `mapBaseType`/`mapFieldType`/`mapTypeRef`/`mapActionOutputType` + `TypeContext` + scalar-set constants into a workspace-private `@alaq/codegen-util` package. Keep it language-agnostic (returns a neutral `MappedType` shape) OR have separate emitters per target language that share only the field-walking + optionality logic. Pick the narrower API.
  Scope: ~100 net LOC diff. Behaviour-preserving — all existing tests stay green.
  Blocked on: user policy answer #1 (new package name + privacy).

- **[P2 — Wave 2] Drop `I` prefix on TS records.**
  Problem: `IPackageMeta` is TS-only Hungarian and doesn't match the Rust gen's bare-name convention. Kept in Wave 0 only to avoid cli-ui's 6-Vue-file rename.
  Change: emit `export interface PackageMeta {}`. Coordinate with cli-ui (`find -replace IPackageMeta → PackageMeta`).
  Scope: ~3 LOC generator, ~12 LOC UI consumer.
  Can ship alongside Wave 2 codegen-util extraction (single alpha bump covers both).

- **[P2] Factory vs free-functions asymmetry.** (Downgraded post-Wave-0.)
  Problem: TS gen emits BOTH per-action free functions AND `createHttpApi()` factory. Rust gen emits only a client struct. Inconsistent but not harmful — cli-ui uses the factory form (`api.delete(...)`) and the free functions coexist as escape hatch.
  Change: pick factory-only for TS in Wave 2. Requires a cli-ui coordination step.
  Scope: ~40 LOC removed from graph-link-http generator.

- **[P1] Per-request headers in Rust client.**
  Problem: `alaq-link-http-client` only supports bearer token; TS rt supports async headers callback. Asymmetric.
  Change: add `HttpClient::with_headers(impl Fn() -> HashMap<String, String>)` builder method. Or better: expose `call_action_with_headers(name, input, &extra_headers)`. Pick the more minimal API.
  Scope: ~20 LOC. Test coverage.

- **[P1] Honor envelope option in the client gens.** (Unchanged. Wave 0 did not add this.)
  Problem: when `graph-axum` is called with `wireEnvelope: 'bare'`, the generated server expects bare bodies. Both client runtimes unconditionally wrap. A consumer pairing bare-server with alak-client silently breaks.
  Change: add `wireEnvelope: 'bare' | 'wrapped'` to **both** client generator GenerateOptions (default wrapped, matching server default). In wrapped mode the generated per-action method calls `callAction` / `call_action` (unchanged). In bare mode it calls `callActionBare` / `call_action_bare` which POSTs the input struct directly without wrapping. Add those helpers to the two runtimes.
  Scope: ~50 LOC across 4 files. Non-breaking.

- **[DONE — Wave 0] Enum serde parity.** ✅ Both gens now emit `#[serde(rename_all = "snake_case" | "SCREAMING_SNAKE_CASE")]` picked from SDL casing, PascalCase variants, matching `graph-axum`. Verified on arsenal.aql: `Channel` / `Platform` / `PackageKind` emit snake_case wire, round-trip with server.

- **[P2] Document SDL Map value-nullability gotcha.** (New, surfaced during Wave 0.)
  Problem: parser treats `Map<K, V>` with unadorned `V` as a nullable value — required values need `Map<K, V!>`. Arsenal doesn't use Map so it didn't bite. Next consumer with Map will.
  Change: add a one-paragraph note to `packages/graph/README.md` (or wherever SDL is documented) + a validator E-code warning if `V` is a primitive scalar without `!` (common author mistake).
  Scope: ~20 LOC parser warning + docs.

### `alaq-graph-axum-rt` (server runtime)

- **[P0] Bump to 6.0.0-alpha.0 to align with the rest of the quartet.**
  Problem: sole crate left at `0.1.0`. `Cargo.toml` line 3.
  Change: bump version. No API changes yet. Downstream server builds pick up the new version without code changes.
  Scope: 1 line + changelog note.

- **[P1] Enrich `HandlerError` with structured variants.**
  Problem: current variants are coarse (`BadRequest(String)`, `Internal(String)`). No way to distinguish "missing field `email`" from "field `email` invalid format" machine-readably. Philosophy/logi.md (§ Issues) says errors should be groupable by fingerprint — current design makes every `BadRequest` text a new Issue.
  Change: add `HandlerError::Validation { fingerprint: &'static str, message: String, field: Option<String> }` variant. Serializes to `{error, code:"validation", fingerprint, field}`. `fingerprint` is a compile-time constant string chosen by the handler author (e.g., `"upload.sha256_mismatch"`) — stable for grouping. Old variants remain for compat.
  Scope: ~30 LOC + docs. Non-breaking (additive variant; old consumers still work).

- **[P1] Tracing crate dep + span helpers.**
  Problem: see graph-axum `[P1] Tracing integration` — this is the other half.
  Change: add `tracing = "0.1"` to `alaq-graph-axum-rt/Cargo.toml`, re-export `tracing::{info_span, debug, info, warn, error}` through a `logging` module. Generator uses these paths so consumers only pull one crate.
  Scope: ~10 LOC + Cargo.toml.

- **[P2] Unit tests.**
  Problem: 0 unit tests. `ActionContext` header extraction, invalid UUID fallback, admin-flag parsing — untested. Low frequency of change, but easy wins.
  Change: ~6 unit tests in context.rs + error.rs.
  Scope: ~80 LOC.

### `@alaq/link-http-client` + `alaq-link-http-client` (client runtimes)

- **[P0] Shared error-body contract with server.**
  Problem: see main finding #3. Both clients currently do `data.message || data.error`, server emits only `error`.
  Change: drop `message` fallback in both, read `error` only. Document the contract in module docs.
  Scope: ~4 LOC across two files + docs.

- **[P1] Request ID injection by default.**
  Problem: runtimes don't auto-attach `x-trace-id`. Philosophy/logi.md wants session-scoped correlation.
  Change: generate UUID v4 per call if caller doesn't provide one via headers. Expose the generated id to caller via return type or callback. Start TS-only (fetch-based; trivial to add header), then Rust.
  Scope: ~15 LOC TS, ~20 LOC Rust. Add option to opt out.

- **[P2] Timeout + retry primitives.**
  Problem: neither runtime exposes timeout or retry. Arsenal-ctl rolled its own retry with exponential backoff (V0_STATUS §1.4). That's the canonical client-side pattern; should be in the runtime.
  Change: `HttpClientOptions.timeoutMs` + `retry: { max, backoffMs }`. Rust equivalent. Non-trivial but well-scoped.
  Scope: ~60 LOC each.

- **[P2] Re-export runtime error/types from generated client code.**
  Problem: consumer imports `AlaqHttpError` from runtime AND generated types from generated client module. Two import paths.
  Change: generated module re-exports `AlaqHttpError` + `HttpClientOptions` from the runtime.
  Scope: ~2 lines per generator.

### `@alaq/graph` + `aqc` CLI

- **[P1] `aqc` config file.**
  Problem: every consumer has to write their own `_generate_axum.ts` shell (see arsenal/schema/). `aqc.config.{json,ts}` would let a consumer say: "sources: ./schema/*.aql, targets: [{gen: axum, out: ./generated/rs, options: {wireEnvelope: wrapped}}, {gen: link-http, out: ./ui/src/generated}]" and run `aqc build` once.
  Change: add `aqc build` subcommand that reads `aqc.config.ts` (or `.json`). Keep existing `aqc gen <target> <aql>` for one-shots. TS config lets the user compute options programmatically.
  Scope: ~150 LOC. Pure additive.

- **[P1] `aqc watch`.**
  Problem: today consumers re-run generator manually on SDL edit. Kotelok-2 has an ad-hoc scripts/dev.ts. This belongs in the CLI.
  Change: `aqc watch` mode that reads config, subscribes to SDL file changes, regenerates on write, prints diagnostics. `chokidar` or similar; Bun has a built-in watcher.
  Scope: ~60 LOC on top of config.

- **[P2] Diagnostics rendering.**
  Problem: `aqc gen` prints diagnostics but not with source spans (SDL line:col → generator E-codes). SDL parser already produces spans (IRDiagnostic has positions); generators don't.
  Change: standardize diagnostic struct across all generators, render with source context like rustc. Gate behind `--pretty` to not break existing CI parsers.
  Scope: ~100 LOC once, then all generators benefit.

- **[P2] Generator-version marker check.**
  Problem: emitted files say `// AUTOGENERATED by @alaq/graph-axum v6.0.0-alpha.0`, but nothing verifies the file isn't stale vs the current generator.
  Change: add `aqc check` subcommand: diff config's current generator version against the marker in the first file of each output dir; warn on mismatch.
  Scope: ~40 LOC.

### Cross-cutting: versioning and logi

- **[P1] `VK_FULL_VERSION` passthrough in client runtimes.**
  Problem: philosophy/versioning.md § 8.5 says: "SDK получит только `CARGO_PKG_VERSION` — все сборки одного SemVer-core сольются в одну версию в Logi". alak's client runtimes are the obvious place to add "set `x-client-version` header from `VK_FULL_VERSION` if present in env". Then any alak-based consumer gets version-correlated Logi sessions for free.
  Change: TS runtime reads `import.meta.env.VK_FULL_VERSION` or `process.env.VK_FULL_VERSION` (build-time); Rust runtime reads `env!("VK_FULL_VERSION")` at compile time. Attach as `x-client-version` header on every request. Server's `ActionContext` extracts it into `ActionContext.client_version: Option<String>`. Handlers can log / forward to logi.
  Scope: ~30 LOC across all 4 runtime packages + 10 LOC ActionContext + test. Not breaking.

- **[P1] Logi SDK seam in `alaq-graph-axum-rt`.**
  Problem: logi.md describes how a Rust service integrates `logi-rs` for session + capture. alak's ActionContext is the natural place to hook in: the dispatcher could open a logi span per request, attach trace_id, and the error path could capture errors as logi events automatically.
  Change: feature-gated `logi` flag on `alaq-graph-axum-rt`. When enabled, `ActionContext::from_request_parts` uses existing logi session + creates a per-request span; error `IntoResponse` also emits `capture_error` with fingerprint from [P1 HandlerError::Validation].
  Scope: ~80 LOC behind a feature flag. No impact on consumers that don't enable the flag.

- **[P0] End-to-end integration test.**
  Problem: nothing cross-cuts server gen + client gens + wire + error paths. Every inconsistency found in this audit would have been caught by one test.
  Change: create `alak/Kotelok-axum/` (analogous to `Kotelok-2` for link-state) — a tiny workspace with:
  - a schema.aql with records (including Map + List of Optional), enums, actions with/without input, with/without output;
  - `aqc gen axum` → `server/` Rust bin exposing the router;
  - `aqc gen link-http` → `client-ts/`;
  - `aqc gen link-http-rs` → `client-rs/`;
  - smoke test: spin server on an ephemeral port, run TS client and Rust client against it, assert round-trip for each action type (ok path, error path, empty-input, void output).
  Scope: ~400 LOC. High payoff: one PR's worth of test infra pins every future regression.

- **[P2] "Canonical stack" README at alak root.**
  Problem: see finding #7.
  Change: a single `README.md` section at alak root: "The canonical HTTP stack". One diagram, one paragraph, two copy-paste commands. Link out to each package's detailed docs.
  Scope: ~60 lines of markdown.

---

## Proposed ordering

**Wave 0 — DONE (2026-04-24).** Client-gen P0: type mappers ported, `I`-prefix kept on records, string-literal-union enums, JS/Rust keyword escape, list-at-field-and-output, Map, enum serde rename_all. Full details in the TL;DR revision log.

No remaining work starts until Leader greenlights Waves 1-5 and user answers the 5 policy questions.

**Wave 1 — "arsenal v0 stays unbreakable" (safe, small, independent):**
1. P0 runtime version bump (alaq-graph-axum-rt 0.1.0 → 6.0.0-alpha.0).
2. P0 error-body contract (drop `message` fallback, standardize on `error`).
3. End-to-end Kotelok-axum test workspace + smoke (lands first so every subsequent change has a safety net). **This test would have caught the Wave 0 bugs in one pass — highest single leverage in the plan.**

**Wave 2 — "collapse Wave 0 duplication" (mechanical now that logic is pinned):**
4. P1 Extract `@alaq/codegen-util` + delete duplicates. Also drops TS record `I` prefix (cli-ui coordination) + factory-only emission. Scope dropped from ~400 to ~100 net LOC change because Wave 0 did the type-mapping thinking already.

**Wave 3 — "the runtime ergonomics":**
5. P1 wireEnvelope option on client gens + bare helpers.
6. P1 Rust client per-request headers.
7. P1 TS client factory-only.
8. P1 runtime re-exports.
9. P1 timeout + retry primitives (P2 deferrable; do if there's time).

**Wave 4 — "observability":**
10. P1 HandlerError::Validation with fingerprint.
11. P1 Tracing integration (graph-axum + runtime crate).
12. P1 Request ID in error header (via middleware, non-invasive).
13. P1 VK_FULL_VERSION pass-through + ActionContext.client_version.
14. P1 Logi feature flag in alaq-graph-axum-rt.

**Wave 5 — "developer experience":**
15. P1 `aqc.config.ts` + `aqc build`.
16. P1 `aqc watch`.
17. P2 Diagnostics rendering with source spans.
18. P2 Root-level canonical-stack README.
19. P2 Runtime unit tests.
20. P2 `aqc check` stale-generator detector.

Each wave is ~a day of work. Waves 1+2 together are the minimum "v1-ready core"; waves 3+4 are what makes alak feel production-grade; wave 5 is polish.

---

## Open questions for Leader

1. **New package `@alaq/codegen-util`** (proposal item [P0] in wave 2) — you said ask before new public packages. Proposal: start it **private** (`"private": true` in package.yaml, not published), used only as a workspace dep by the three generators. No blast radius on consumers. Fine?
2. **Breaking change: drop `I` prefix on TS records** (wave 2). At 6.0.0-alpha.0, technically pre-stable, no published consumers outside monorepo. Bump to 6.0.0-alpha.1 or go straight 6.1.0-alpha.0? Recommend latter — alpha numbers don't carry semver.
3. **`VK_FULL_VERSION` as an env var at compile time (Rust) vs runtime (TS)** — the TS `process.env` / `import.meta.env` pattern requires a bundler plugin; vite/bun both support `define`-style replacement. Acceptable? Or prefer runtime lookup from `window.__VK_FULL_VERSION__`?
4. **Kotelok-axum smoke directory** — put it under `A:\source\alak\Kotelok-axum\` parallel to existing `Kotelok-2\`, or nest as `A:\source\alak\integration\http-smoke\`? Kotelok-2 suggests the flat layout.
5. **Dropping the `message` fallback** — strict or lenient? The fallback shields us if the server ever changes. But it also hides bugs. Recommend strict (drop, document `error`), because we control both sides and the symmetry is worth more than future-proofing against ourselves.
