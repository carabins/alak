// Wave 0 regression suite — Rust mirror of the TS suite.
// Exercises:
//   · built-in scalars (String/i64/f64/bool via Int/Timestamp/Float/Boolean/UUID/ID)
//   · enum emission with #[serde(rename_all = ...)] + PascalCase variants
//   · list at field + at output (Vec<T>, Vec<Option<T>>, Option<Vec<T>>)
//   · Map<K,V> → HashMap<K,V>
//   · Rust keyword action name (`Type`) → raw-identifier method
//   · Empty-input action
//   · Action with no output (`()`)
//
// Live compile-check via `cargo check` is opt-in behind ALAK_INT_TESTS=1 —
// the real runtime crate `alaq-link-http-client` lives in ../../crates/ and
// we build against it to guarantee the emitted signatures actually line up.

import { describe, expect, test, beforeAll } from 'bun:test'
import {
  readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { parseSource } from '../../graph/src/index'
import { generate } from '../src/index'

const FIXTURE = readFileSync(join(import.meta.dir, 'regression.aql'), 'utf8')

let generated: string

beforeAll(() => {
  const parsed = parseSource(FIXTURE, 'regression.aql')
  expect(parsed.diagnostics.filter(d => d.severity === 'error')).toEqual([])
  expect(parsed.ir).not.toBeNull()
  const { files } = generate(parsed.ir!, { namespace: 'regression.ns' })
  expect(files.length).toBe(1)
  generated = files[0]!.content
})

describe('@alaq/graph-link-http-rs — scalar mapping', () => {
  test('Int maps to i64 (matches graph-axum), not i32, not raw `Int`', () => {
    expect(generated).toMatch(/pub count: i64,/)
    expect(generated).not.toMatch(/pub count: i32,/)
    expect(generated).not.toMatch(/pub count: Int,/)
  })

  test('Timestamp/Duration map to i64', () => {
    expect(generated).toMatch(/pub updated_at: i64,/)
    expect(generated).not.toMatch(/pub updated_at: Timestamp,/)
  })

  test('UUID/ID map to String', () => {
    expect(generated).toMatch(/pub id: String,/)
  })

  test('Boolean maps to bool', () => {
    expect(generated).toMatch(/pub active: bool,/)
    expect(generated).not.toMatch(/pub active: Boolean,/)
  })

  test('Float maps to f64', () => {
    expect(generated).toMatch(/pub ratio: f64,/)
  })
})

describe('@alaq/graph-link-http-rs — enum mapping', () => {
  test('enum has rename_all for snake_case SDL values', () => {
    expect(generated).toContain('#[serde(rename_all = "snake_case")]')
    expect(generated).toMatch(/pub enum Channel \{[\s\S]*?Master,[\s\S]*?Test,[\s\S]*?Dev,[\s\S]*?\}/)
    expect(generated).toMatch(/pub enum Platform \{[\s\S]*?WindowsMsi,[\s\S]*?LinuxDeb,[\s\S]*?AndroidApk,[\s\S]*?\}/)
  })

  test('enum used as field type emits bare name', () => {
    expect(generated).toMatch(/pub channel: Channel,/)
  })
})

describe('@alaq/graph-link-http-rs — list + map handling', () => {
  test('record field `[Tag!]!` emits `Vec<Tag>` (not bare `Tag`)', () => {
    expect(generated).toMatch(/pub tags: Vec<Tag>,/)
  })

  test('record field `Tag` (nullable) emits `Option<Tag>`', () => {
    expect(generated).toMatch(/pub optional_tag: Option<Tag>,/)
  })

  test('record field `[Tag]` (nullable list of nullable) emits `Option<Vec<Option<Tag>>>`', () => {
    expect(generated).toMatch(/pub optional_tags: Option<Vec<Option<Tag>>>,/)
  })

  test('Map<String, String>! emits HashMap<String, String>', () => {
    expect(generated).toMatch(/pub metadata: std::collections::HashMap<String, String>,/)
  })

  test('action output `[Item!]!` emits `Result<Vec<Item>, AlaqHttpError>`', () => {
    expect(generated).toMatch(/pub async fn list\(&self, input: ListInput\) -> Result<Vec<Item>, AlaqHttpError>/)
  })

  test('action with no output emits `Result<\(\), AlaqHttpError>`', () => {
    expect(generated).toMatch(/pub async fn fire_and_forget\(&self, input: FireAndForgetInput\) -> Result<\(\), AlaqHttpError>/)
  })
})

describe('@alaq/graph-link-http-rs — reserved-word handling', () => {
  test('action `Type` emits method `r#type` (raw-identifier)', () => {
    expect(generated).toContain('pub async fn r#type(')
    expect(generated).not.toMatch(/pub async fn type\(/)
  })

  test('action `Type` wire name stays snake_case `type`', () => {
    expect(generated).toContain('self.inner.call_action("type", input).await')
  })

  test('action `Delete` (not a Rust keyword) stays unmangled', () => {
    expect(generated).toMatch(/pub async fn delete\(&self, input: DeleteInput\)/)
  })
})

describe('@alaq/graph-link-http-rs — struct derives', () => {
  test('no blanket #[derive(Default)] on *Input (enum fields break it)', () => {
    // Scan all *Input blocks — none should carry Default.
    const inputBlocks = generated.match(/pub struct \w+Input [\s\S]*?\}/g) ?? []
    for (const block of inputBlocks) {
      expect(block).not.toContain('Default')
    }
  })

  test('records derive PartialEq for ergonomics', () => {
    expect(generated).toMatch(/#\[derive\([^)]*PartialEq[^)]*\)\]\s*\npub struct Item/)
    expect(generated).toMatch(/#\[derive\([^)]*PartialEq[^)]*\)\]\s*\npub struct Tag/)
  })
})

// Integration: opt-in via ALAK_INT_TESTS=1. Writes generated mod.rs into a
// temp crate, wires it up with `alaq-link-http-client` from the workspace,
// runs `cargo check`.
const INT_TESTS = process.env.ALAK_INT_TESTS === '1'

describe.if(INT_TESTS)('@alaq/graph-link-http-rs — cargo check', () => {
  test('generated mod.rs compiles against alaq-link-http-client runtime', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'alak-int-http-rs-'))
    try {
      mkdirSync(join(tmp, 'src'), { recursive: true })
      mkdirSync(join(tmp, 'src', 'regression_ns'), { recursive: true })
      writeFileSync(join(tmp, 'src', 'regression_ns', 'mod.rs'), generated)

      writeFileSync(
        join(tmp, 'src', 'lib.rs'),
        '#![allow(dead_code, unused_imports)]\npub mod regression_ns;\n',
      )

      // Point at the workspace's runtime crate via path dep.
      const rtPath = join(
        import.meta.dir, '..', '..', '..', 'crates', 'alaq-link-http-client',
      ).replace(/\\/g, '/')

      writeFileSync(
        join(tmp, 'Cargo.toml'),
        [
          '[package]',
          'name = "alak_link_http_rs_int"',
          'version = "0.0.0"',
          'edition = "2021"',
          '',
          '[lib]',
          'path = "src/lib.rs"',
          '',
          '[dependencies]',
          'serde = { version = "1", features = ["derive"] }',
          'serde_json = "1"',
          `alaq-link-http-client = { path = "${rtPath}" }`,
          '',
        ].join('\n'),
      )

      const r = spawnSync('cargo', ['check', '--quiet'], {
        cwd: tmp,
        encoding: 'utf8',
        stdio: 'pipe',
      })
      if (r.status !== 0) {
        console.error('cargo check stdout:\n' + r.stdout)
        console.error('cargo check stderr:\n' + r.stderr)
      }
      expect(r.status).toBe(0)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  }, 300_000)
})
