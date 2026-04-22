// @alaq/graph-axum — end-to-end: compile `arsenal.aql` through @alaq/graph,
// pipe IR into generate(), assert on the 5 emitted Rust files per namespace.
//
// C5 (2026-04-21): byte-snapshots replaced with regex/contains smoke checks +
// an opt-in `cargo check` integration step (ALAK_INT_TESTS=1). Prior snapshot
// tests produced churn on every unrelated version bump (W6) and keyword-table
// edit (W4); the important invariants are (1) generator does not throw,
// (2) diagnostics contain no errors, (3) file set is the expected shape,
// (4) the key structural elements land in the expected files — anything
// stricter is test-noise.

import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { compileSources } from '../../graph/src/index'
import { generate } from '../src/index'

const ARSENAL_AQL = join(
  import.meta.dir,
  '..',
  '..',
  '..',
  '..',
  'rest.valkyrie',
  'arsenal',
  'schema',
  'arsenal.aql',
)

function compileArsenal() {
  const src = readFileSync(ARSENAL_AQL, 'utf8')
  const res = compileSources([{ path: 'arsenal.aql', source: src }])
  const errs = res.diagnostics.filter(d => d.severity === 'error')
  expect(errs).toEqual([])
  expect(res.ir).not.toBeNull()
  return res.ir!
}

describe('Arsenal — graph-axum emission', () => {
  const ir = compileArsenal()
  const gen = generate(ir)
  const byPath: Record<string, string> = {}
  for (const f of gen.files) byPath[f.path] = f.content

  test('emits exactly 5 files for the single namespace', () => {
    expect(gen.files.length).toBe(5)
  })

  test('paths are nested under rest_valkyrie_arsenal/', () => {
    const paths = gen.files.map(f => f.path).sort()
    expect(paths).toEqual([
      'rest_valkyrie_arsenal/handlers.rs',
      'rest_valkyrie_arsenal/mod.rs',
      'rest_valkyrie_arsenal/routes.rs',
      'rest_valkyrie_arsenal/state.rs',
      'rest_valkyrie_arsenal/types.rs',
    ])
  })

  test('every emitted file has non-empty content', () => {
    for (const f of gen.files) expect(f.content.length).toBeGreaterThan(0)
  })

  test('diagnostics contain no errors (warnings are informational)', () => {
    const errs = gen.diagnostics.filter(d => d.severity === 'error')
    expect(errs).toEqual([])
  })

  test('mod.rs declares the submodules + re-exports', () => {
    const s = byPath['rest_valkyrie_arsenal/mod.rs']
    expect(s).toContain('pub mod types;')
    expect(s).toContain('pub mod handlers;')
    expect(s).toContain('pub mod state;')
    expect(s).toContain('pub mod routes;')
    expect(s).toContain('pub use handlers::Handlers;')
    expect(s).toContain('pub use routes::router;')
    expect(s).toContain('pub use state::AppState;')
    expect(s).toContain('pub use types::*;')
  })

  test('types.rs: enums with snake rename_all + PascalCase variants', () => {
    const s = byPath['rest_valkyrie_arsenal/types.rs']
    expect(s).toMatch(/pub enum Channel\s*\{/)
    expect(s).toMatch(/pub enum Platform\s*\{/)
    expect(s).toMatch(/pub enum PackageKind\s*\{/)
    expect(s).toContain('#[serde(rename_all = "snake_case")]')
    expect(s).toMatch(/WindowsMsi,/)
    expect(s).toMatch(/Master,/)
  })

  test('types.rs: PackageMeta struct with expected fields', () => {
    const s = byPath['rest_valkyrie_arsenal/types.rs']
    expect(s).toMatch(/pub struct PackageMeta\s*\{/)
    expect(s).toMatch(/pub latest_versions:\s*Vec<VersionRef>,/)
    expect(s).toMatch(/pub description:\s*Option<String>,/)
  })

  test('types.rs: <Action>Input per action — Upload carries version/package', () => {
    const s = byPath['rest_valkyrie_arsenal/types.rs']
    for (const name of ['PackagesInput', 'VersionsInput', 'LatestInput', 'UploadInput', 'DeleteInput']) {
      expect(s).toMatch(new RegExp(`pub struct ${name}\\s*\\{`))
    }
    expect(s).toMatch(/pub struct UploadInput \{[\s\S]*?pub package: String,[\s\S]*?pub version: String,/)
  })

  test('handlers.rs: #[async_trait] trait with one method per action, inline output types', () => {
    const s = byPath['rest_valkyrie_arsenal/handlers.rs']
    expect(s).toContain('use alaq_graph_axum_rt::{async_trait, ActionContext, HandlerError};')
    expect(s).toContain('#[async_trait]')
    expect(s).toMatch(/pub trait Handlers:\s*Send\s*\+\s*Sync\s*\+\s*'static\s*\{/)
    // Inline output types (post-C1/C2/C3): list → Vec<T>, required scalar → bool, required record → T.
    expect(s).toMatch(/async fn packages\([^)]*PackagesInput\)\s*->\s*Result<Vec<PackageMeta>,\s*HandlerError>/)
    expect(s).toMatch(/async fn versions\([^)]*VersionsInput\)\s*->\s*Result<Vec<VersionRef>,\s*HandlerError>/)
    expect(s).toMatch(/async fn latest\([^)]*LatestInput\)\s*->\s*Result<VersionRef,\s*HandlerError>/)
    expect(s).toMatch(/async fn upload\([^)]*UploadInput\)\s*->\s*Result<UploadTicket,\s*HandlerError>/)
    expect(s).toMatch(/async fn delete\([^)]*DeleteInput\)\s*->\s*Result<bool,\s*HandlerError>/)
  })

  test('state.rs: AppState<H> + manual Clone', () => {
    const s = byPath['rest_valkyrie_arsenal/state.rs']
    expect(s).toMatch(/pub struct AppState<H: Handlers \+ \?Sized>/)
    expect(s).toMatch(/pub handlers:\s*Arc<H>,/)
    expect(s).toMatch(/impl<H: Handlers \+ \?Sized> Clone for AppState<H>/)
    expect(s).toContain('handlers: Arc::clone(&self.handlers)')
  })

  test('routes.rs: router wires POST /<snake> per action; inline Json::<T> dispatchers', () => {
    const s = byPath['rest_valkyrie_arsenal/routes.rs']
    expect(s).toMatch(/pub fn router<H: Handlers>\(state: AppState<H>\)\s*->\s*Router/)
    expect(s).toContain('.route("/packages", post(dispatch_packages::<H>))')
    expect(s).toContain('.route("/versions", post(dispatch_versions::<H>))')
    expect(s).toContain('.route("/latest", post(dispatch_latest::<H>))')
    expect(s).toContain('.route("/upload", post(dispatch_upload::<H>))')
    expect(s).toContain('.route("/delete", post(dispatch_delete::<H>))')
    expect(s).toMatch(/async fn dispatch_packages<H: Handlers>\(/)
    // After C1/C2/C3 the output type is inlined into the dispatcher's Json::<T>.
    expect(s).toMatch(/Json::<Vec<PackageMeta>>\(out\)/)
    expect(s).toMatch(/Json::<bool>\(out\)/)
  })
})

// ────────────────────────────────────────────────────────────────
// Opt-in: compile-check the emitted tree via `cargo check`.
// Enable with ALAK_INT_TESTS=1. Skipped by default — cargo is slow and
// may not be installed on every dev box. See stress.md C5.
// ────────────────────────────────────────────────────────────────

const INT_TESTS = process.env.ALAK_INT_TESTS === '1'

describe.if(INT_TESTS)('Arsenal — cargo check (integration)', () => {
  test('emitted module compiles inside a minimal cargo crate', () => {
    const ir = compileArsenal()
    const gen = generate(ir)

    const tmp = mkdtempSync(join(tmpdir(), 'alak-axum-int-'))
    try {
      mkdirSync(join(tmp, 'src'), { recursive: true })

      // Minimal runtime-crate stand-ins — the generated tree uses
      // `alaq_graph_axum_rt::{async_trait, ActionContext, HandlerError}`.
      // We cannot pull the real crate without a registry/workspace, so
      // expose a tiny shim module through `src/rt.rs` and point the
      // generator's `use alaq_graph_axum_rt::…` at it via `extern crate`.
      // Simplest: rewrite the import on disk before compiling.

      const srcDir = join(tmp, 'src')
      for (const f of gen.files) {
        const dst = join(srcDir, f.path)
        mkdirSync(dirname(dst), { recursive: true })
        // Swap the runtime crate path with a local module.
        const patched = f.content.replace(
          /use alaq_graph_axum_rt::\{([^}]+)\};/g,
          'use crate::rt::{$1};',
        )
        writeFileSync(dst, patched)
      }

      // lib.rs that includes the namespace + a shim runtime.
      writeFileSync(
        join(srcDir, 'lib.rs'),
        [
          '#![allow(dead_code, unused_imports)]',
          'pub mod rest_valkyrie_arsenal;',
          '',
          'pub mod rt {',
          '    pub use async_trait::async_trait;',
          '    #[derive(Debug, Clone)]',
          '    pub struct ActionContext;',
          '    #[axum::async_trait]',
          '    impl<S> axum::extract::FromRequestParts<S> for ActionContext where S: Send + Sync {',
          '        type Rejection = std::convert::Infallible;',
          '        async fn from_request_parts(_: &mut axum::http::request::Parts, _: &S) -> Result<Self, Self::Rejection> { Ok(ActionContext) }',
          '    }',
          '    #[derive(Debug)]',
          '    pub struct HandlerError;',
          '    impl std::fmt::Display for HandlerError { fn fmt(&self, f: &mut std::fmt::Formatter<\'_>) -> std::fmt::Result { write!(f, "HandlerError") } }',
          '    impl std::error::Error for HandlerError {}',
          '    impl axum::response::IntoResponse for HandlerError {',
          '        fn into_response(self) -> axum::response::Response {',
          '            (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "err").into_response()',
          '        }',
          '    }',
          '}',
          '',
        ].join('\n'),
      )

      writeFileSync(
        join(tmp, 'Cargo.toml'),
        [
          '[package]',
          'name = "alak_axum_int"',
          'version = "0.0.0"',
          'edition = "2021"',
          '',
          '[lib]',
          'path = "src/lib.rs"',
          '',
          '[dependencies]',
          'serde = { version = "1", features = ["derive"] }',
          'serde_json = "1"',
          'axum = "0.7"',
          'async-trait = "0.1"',
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
  }, 180_000)
})
