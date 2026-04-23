# AI-First & Native — manifesto

> Version: 0.1.0-draft. Status: **concept**.
> Audience: an LLM agent opening `alak` in a new session. Secondary: a human reviewing the direction.
> Pair for Rust: lives outside this repo. This document is monorepo-internal.

---

## One line

`alak` is a TypeScript ecosystem designed so that **an LLM agent is the primary consumer**. A human is the degenerate case — an agent with fewer tools.

`alaq` (the frontdoor package) is the **physical embodiment** of that claim. Not a slogan, not a README header — the way the package is wired inside.

---

## AI-friendly vs AI-first vs AI-native

Three levels, not synonyms:

| Level | Definition | Example |
|-------|------------|---------|
| **AI-friendly** | A human product that happens to be usable by LLMs | README + JSDoc — the LLM reads what was written for humans |
| **AI-first** | Design decisions are made **assuming the LLM is the main consumer** | stdout=JSON by default, `--pretty` is opt-in |
| **AI-native** | The product's physics require an LLM on the other end | MCP server with a tool catalog; capability manifest; error codes for automation |

`alaq` is **AI-native**. The package is useless without an LLM consumer on the other side of stdio. A human can run `alaq` and get JSON — but the JSON is not for them; it is for the model whose context they paste it into.

---

## Pre-GA truth

Current: `6.0.0-alpha.0`. **There is no backward compatibility** before `6.0.0` GA:

- CLI surface may change between alphas.
- Manifest schema may gain and lose fields.
- MCP tool names may rename.
- Error codes may renumber.
- IR shape and directive set may shift.

Pin exact versions. Do not build long-lived automation on pre-GA shapes. Breaking changes are called out in the CHANGELOG, not silent — but they **are** breaking.

Once `6.0.0` GA ships, the seven physical properties below become normative under semver. Until then, they are **design intent**, not a contract.

---

## Seven physical properties (design intent)

Not slogans — mechanics.

### 1. Output = JSON, human = opt-in

CLIs print machine-readable JSON by default. `--pretty` is the flag for humans. TTY auto-detect is allowed, but the contract is JSON. The LLM never has to regex stdout.

### 2. Structured error codes

Errors carry codes (`E###` / `W###`) registered in a central table. The text may vary; the code is the automation handle.

### 3. Capability manifest ≤ 2 KB gzipped

An agent's first contact with the package is **one small JSON payload** that fits in context without a token budget. Anything wider is reached through MCP `tools/list`, not bolted onto the manifest.

### 4. MCP is the main interface; CLI is the fallback

MCP stdio gives structured tool calls. `alaq mcp call` exists for CI and shell, with the same schema. One concept, one syntax — no second surface area.

### 5. The sandbox is real

`rootDir` in MCP filesystem mode is not decoration. `../etc/passwd` is refused. The agent can trust it.

### 6. The `review` class is the agent's right to stop

When `schema_diff` classifies a change as `review`, that is a signal: *this requires judgement, not automation.* The agent stops and asks a human. Automating `review` is forbidden.

### 7. No telemetry

The package sends nothing over the network on its own. Logi endpoints are user-configured, not a vendor hook. The manifest is public; it is not tracking.

---

## Runtime parity: bun and npx are equal

`alaq` is usable identically under Node (via `npx`) and Bun (via `bunx`):

```sh
npx alaq
bunx alaq
```

Neither is the canonical form. Documentation shows both or neither, never one alone. The launcher picks the host runtime from `process.versions.bun`; the CLI surface, the manifest, and the MCP stanza are the same in both.

If an example in this repo promotes one over the other, that is a bug.

---

## When the whole picture is visible — do a salto, not steps

The ecosystem's companion methodology is step-by-step: one vector → one step → one visible result → next vector. That is correct **when the shape of the result is unpredictable** — when the next step is informed by the last.

But there is another mode: when **the whole picture is visible up front**, dependencies are explicit, and no node can invalidate another. Steps in that mode are lost throughput. The right move is a **salto** — build a dependency DAG and parallelize everything that can run in parallel.

### Conditions for a salto

All four must hold:

1. **Dependencies are explicit.** Each node declares inputs, outputs, and what blocks it.
2. **No reframe risk.** One node's result cannot cancel another. If it can, you are in the dance, not a salto.
3. **Each node is idempotent or atomic.** Re-running is safe; partial results are either visible or rolled back.
4. **Clear done criterion.** A node is green or red. No "mostly working."

Violate any one — back to steps. A salto on thin ice is not bravery, it is a fall.

### How a salto runs

1. **DAG, not a list.** Draw the graph: nodes are tasks, edges are dependencies. Leaves are what you can do *right now* in parallel. The longest path is the critical path.

2. **Batch-launch the independent.** Everything at the same DAG level goes out in a single message with multiple tool calls in parallel. Not "this one, then that one" — simultaneously.

3. **Sync only on edges.** Wait only where the next node physically needs the previous one's output. Do not wait "for order's sake."

4. **Fail-fast on the critical path.** If a critical-path node fails, stop everything and re-plan the graph. If an off-path node fails, continue — fix it on the side.

5. **One visible result per wave.** After the parallel burst, surface one combined snapshot: build green, tests pass, screenshot. Not a per-node report — a wave-level result.

### Fits a salto

- Compile five isolated TS packages — the graph is just leaves.
- Scaffold `package.yaml` + `README.md` + `DESIGN.md` for a new package — three parallel writes, zero dependencies.
- Run `cargo check` across seven independent crates.
- Read a set of files whose paths are known up front.

### Does not fit — dance instead

- Rewriting a real app against v6 — the target SDL's shape opens through the first pass; it is the dance.
- Designing a new generator — each step is informed by the last.
- Any architectural choice with reframe risk.

### Protocol

The agent **declares** a salto before executing: *"doing a salto, graph is A‖B‖C → D‖E → F"*. The human can say "no, let's step through it" and the agent returns to the dance.

A salto is a fast mode with a visible plan. It is not autonomy — it is parallelism with an announced DAG.

---

## Consequences for `@alaq/*` package owners

1. **Exposed MCP tools appear in the capability manifest** under `mcp.tool_groups`. Adding a tool means updating the manifest generator, not a separate registration.

2. **Errors have codes.** If an error says only "failed to parse", that is a bug — it must say `E012: failed to parse at <path>:<line>`.

3. **README is written for the LLM first.** Structure: one line → API surface → 60-second tour → link to full manifest. The human-friendly longform is secondary or lives elsewhere.

4. **No magic strings without codes.** Runtime log lines and errors use registered identifiers. Free-text is for humans only, in `--pretty` paths.

5. **`AGENTS.md` per package** — 50–150 lines of local context for an agent landing in that package. Not a copy of the root; the specific rules for this crate.

6. **No stray telemetry.** A package may call a user-configured endpoint (Logi). It may not call a package-author-configured endpoint.

---

## What AI-native does **not** mean

- **Not an embedded LLM.** `alaq` does not call OpenAI, Anthropic, or any model. The model is on the other end of stdio.
- **Not an agent.** `alaq` is tools, not a solver. The agent is whoever calls them.
- **Not a scaffolder.** `alaq init` creates a minimal alaq-aware project, not a Vue / Tauri / Bun app template.
- **Not a replacement for a human.** The `review` class exists precisely so the agent stops and asks.
- **Not a tracker.** The manifest is public. It says what the package is, not who uses it.

---

## Related documents (alak-internal)

| Document | Role |
|---|---|
| [`PHILOSOPHY.md`](./PHILOSOPHY.md) | Why v6 exists; the six-layer ecosystem map |
| [`AI_FIRST.md`](./AI_FIRST.md) (this) | What "AI-first" means physically, not as a slogan |
| [`AGENTS.md`](./AGENTS.md) | Normative rules for agent behavior in this repo |
| [`CHECK.md`](./CHECK.md) | Verification protocol for the current stack state |
| [`architecture.yaml`](./architecture.yaml) | Machine-readable registry of packages and edges |
| [`packages/alaq/DESIGN.md`](./packages/alaq/DESIGN.md) | The frontdoor package's normative shape |
| [`packages/graph/SPEC.md`](./packages/graph/SPEC.md) | SDL semantics (normative) |

---

## Roadmap for this manifesto

- **v0.1** — this draft, approved by the user before write.
- **v0.2** — cross-link from `packages/alaq/README.md`; audit each `@alaq/*` against the seven physical properties; open issues for non-compliance.
- **v0.3** — promote `6.0.0` GA: the seven properties move from *design intent* to *normative under semver*.

---

*Version: 0.1.0-draft.*
*Date: 2026-04-22.*
*Status: concept.*
