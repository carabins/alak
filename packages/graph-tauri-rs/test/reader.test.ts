// Smoke test for @alaq/graph-tauri-rs — reads Belladonna's reader.aql through
// @alaq/graph, feeds the IR into generate(), and asserts the basic file
// shape (six files per namespace, non-empty content, no error diagnostics).
//
// This is intentionally coarse-grained; unit-level assertions on emitted
// Rust text live in dedicated test files once the generator stabilises.

import { test, expect, describe, beforeAll } from 'bun:test'
import { parseSource } from '../../graph/src/index'
import { generate } from '../src/index'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const READER_AQL = join(
  import.meta.dir,
  '..', '..', '..', '..',
  'pharos', 'Belladonna', 'schema', 'reader.aql',
)

let generated: ReturnType<typeof generate>

beforeAll(() => {
  const src = readFileSync(READER_AQL, 'utf8')
  const res = parseSource(src, 'reader.aql')
  expect(res.ir).not.toBeNull()
  const errs = res.diagnostics.filter(d => d.severity === 'error')
  expect(errs).toEqual([])
  generated = generate(res.ir!, { namespace: 'belladonna.reader' })
})

describe('reader.aql → @alaq/graph-tauri-rs (smoke)', () => {
  test('no error diagnostics', () => {
    const errs = generated.diagnostics.filter(d => d.severity === 'error')
    expect(errs).toEqual([])
  })

  test('emits six-file layout under generated/<ns_flat>/', () => {
    const paths = generated.files.map(f => f.path).sort()
    const base = 'generated/belladonna_reader'
    expect(paths).toEqual([
      `${base}/commands.rs`,
      `${base}/events.rs`,
      `${base}/handlers.rs`,
      `${base}/mod.rs`,
      `${base}/register.rs`,
      `${base}/types.rs`,
    ])
  })

  test('every emitted file has non-empty content', () => {
    for (const f of generated.files) {
      expect(f.content.length).toBeGreaterThan(0)
    }
  })

  test('types.rs carries records + Input structs + AppError re-export', () => {
    const types = generated.files.find(f => f.path.endsWith('/types.rs'))!
    expect(types.content).toContain('pub struct TocEntry')
    expect(types.content).toContain('pub struct RenderedDoc')
    expect(types.content).toContain('pub struct ViewHistoryEntry')
    expect(types.content).toContain('pub struct BundleManifest')
    expect(types.content).toContain('pub struct RenderMarkdownInput')
    expect(types.content).toContain('pub struct GetViewHistoryInput')
    // C3: AppError is NOT emitted per-namespace — it's re-exported from the
    // runtime crate so 10 consumers don't get 10 identical enum copies.
    expect(types.content).not.toContain('pub enum AppError')
    expect(types.content).toContain('pub use alaq_graph_tauri_rt::AppError;')
  })

  // v0.3.4 (W5, SPEC §4.8 R023) — `Map<String, String>!` must emit
  // `HashMap<String, String>` (no `Option<String>` on K). Pre-0.3.4 the
  // IR had `mapKey.required === false`, which forced the generator to
  // emit `HashMap<Option<String>, Option<String>>` — semantically wrong
  // because a map key can never be null.
  test('types.rs: Map<String, String>! → HashMap<String, Option<String>> (R023)', () => {
    const types = generated.files.find(f => f.path.endsWith('/types.rs'))!
    // Key side must NOT be Option<>.
    expect(types.content).not.toContain('HashMap<Option<String>')
    // Outer map required → plain HashMap (no outer Option<>).
    // Value side in BundleManifest.contexts: `Map<String, String>` (no !) → Option<String> on V.
    expect(types.content).toMatch(
      /pub contexts:\s*std::collections::HashMap<String,\s*Option<String>>,/,
    )
  })

  test('handlers.rs declares the <Ns>Handlers async trait', () => {
    const h = generated.files.find(f => f.path.endsWith('/handlers.rs'))!
    expect(h.content).toContain('#[async_trait::async_trait]')
    expect(h.content).toContain('pub trait BelladonnaReaderHandlers')
    // Each action becomes a method
    expect(h.content).toContain('async fn render_markdown(')
    expect(h.content).toContain('async fn record_view(')
    expect(h.content).toContain('async fn get_view_history(')
    expect(h.content).toContain('async fn open_in_explorer(')
    expect(h.content).toContain('async fn open_bundle(')
  })

  test('commands.rs emits #[tauri::command] delegators with snake_case names', () => {
    const c = generated.files.find(f => f.path.endsWith('/commands.rs'))!
    expect(c.content).toContain('#[tauri::command]')
    expect(c.content).toContain('pub async fn render_markdown(')
    expect(c.content).toContain('pub async fn get_view_history(')
    // list output shape preserved from IR outputList
    expect(c.content).toContain('Vec<ViewHistoryEntry>')
    // boolean output
    expect(c.content).toContain('-> Result<bool, AppError>')
  })

  test('register.rs defines the register_<ns>_commands! macro', () => {
    const r = generated.files.find(f => f.path.endsWith('/register.rs'))!
    expect(r.content).toContain('macro_rules! register_belladonna_reader_commands')
    expect(r.content).toContain('tauri::generate_handler!')
    // All five action idents referenced
    for (const n of ['render_markdown', 'record_view', 'get_view_history', 'open_in_explorer', 'open_bundle']) {
      expect(r.content).toContain(`::commands::${n}`)
    }
  })

  test('mod.rs wires every submodule', () => {
    const m = generated.files.find(f => f.path.endsWith('/mod.rs'))!
    for (const sub of ['types', 'handlers', 'commands', 'register', 'events']) {
      expect(m.content).toContain(`pub mod ${sub};`)
    }
  })

  test('events.rs has a no-events placeholder when the schema has none', () => {
    // reader.aql currently declares no `event` blocks. W9 onwards, the
    // events generator leaves an informative placeholder instead of a
    // stub module — the schema simply has nothing to emit.
    const e = generated.files.find(f => f.path.endsWith('/events.rs'))!
    expect(e.content).toContain('No `event` declarations in namespace')
    const errs = generated.diagnostics.filter(d => d.severity === 'error')
    expect(errs).toEqual([])
  })
})

// ────────────────────────────────────────────────────────────────
// Opt-in: compile-check the emitted tree via `cargo check`.
// Enable with ALAK_INT_TESTS=1. Skipped by default — cargo is slow and
// tauri's dependency graph is heavy, so the check is only useful when
// the caller explicitly asks for it. See stress.md C5.
// ────────────────────────────────────────────────────────────────

const INT_TESTS = process.env.ALAK_INT_TESTS === '1'

describe.if(INT_TESTS)('reader.aql → cargo check (integration)', () => {
  test('emitted module compiles inside a minimal tauri crate', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'alak-taurirs-int-'))
    try {
      const srcDir = join(tmp, 'src')
      mkdirSync(srcDir, { recursive: true })
      for (const f of generated.files) {
        const dst = join(srcDir, f.path)
        mkdirSync(dirname(dst), { recursive: true })
        writeFileSync(dst, f.content)
      }
      writeFileSync(
        join(srcDir, 'lib.rs'),
        [
          '#![allow(dead_code, unused_imports)]',
          'pub mod generated { pub mod belladonna_reader; }',
          '',
        ].join('\n'),
      )
      writeFileSync(
        join(tmp, 'Cargo.toml'),
        [
          '[package]',
          'name = "alak_taurirs_int"',
          'version = "0.0.0"',
          'edition = "2021"',
          '',
          '[lib]',
          'path = "src/lib.rs"',
          '',
          '[dependencies]',
          'serde = { version = "1", features = ["derive"] }',
          'serde_json = "1"',
          'async-trait = "0.1"',
          'tauri = { version = "2", default-features = false, features = ["wry"] }',
          '',
        ].join('\n'),
      )
      const r = spawnSync('cargo', ['check', '--quiet'], {
        cwd: tmp,
        encoding: 'utf8',
        stdio: 'pipe',
      })
      if (r.status !== 0) {
        console.error('cargo check stderr:\n' + r.stderr)
        console.error('cargo check stdout:\n' + r.stdout)
      }
      expect(r.status).toBe(0)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  }, 300_000)
})
