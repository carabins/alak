// End-to-end: sokol/v1 legacy fixture — compile SDL, generate Rust,
// snapshot, type-check via cargo sandbox.
//
// Scope: Phase<0 busynca legacy types that keep shipping on the
// sokol/v1/* Zenoh topics. Every record except `Telemetry` carries
// `@rename_case(kind: CAMEL)` (busynca uses `#[serde(rename_all =
// "camelCase")]` on all of them). `Telemetry` has no rename_all so SDL
// leaves it off too.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, test } from 'bun:test'
import { compileSources } from '../../graph/src/index'
import { generate } from '../src/index'

const FIXTURE_DIR = join(import.meta.dir, '__fixtures__')
const SDL_PATH = join(FIXTURE_DIR, 'sokol-legacy.aql')
const SNAPSHOT = join(FIXTURE_DIR, 'sokol-legacy.rs')

const SANDBOX_DIR = join(import.meta.dir, 'cargo-sandbox')
const SANDBOX_MANIFEST = join(SANDBOX_DIR, 'Cargo.toml')

function loadFixture() {
  return [{
    path: SDL_PATH,
    source: readFileSync(SDL_PATH, 'utf8'),
  }]
}

let rust: string
let diagnostics: { severity: 'error' | 'warning'; message: string }[]

beforeAll(() => {
  const res = compileSources(loadFixture())
  expect(res.ir).not.toBeNull()
  const parseErrs = res.diagnostics.filter(d => d.severity === 'error')
  expect(parseErrs).toEqual([])

  const gen = generate(res.ir!, { namespace: 'sokol.v1' })
  expect(gen.files.length).toBe(1)
  rust = gen.files[0].content
  diagnostics = gen.diagnostics

  if (!existsSync(SNAPSHOT)) {
    writeFileSync(SNAPSHOT, rust)
  } else {
    const prev = readFileSync(SNAPSHOT, 'utf8')
    if (prev !== rust) {
      writeFileSync(SNAPSHOT + '.new', rust)
      throw new Error(
        `Sokol-legacy snapshot drift: see ${SNAPSHOT}.new and diff. ` +
        `Accept by overwriting ${SNAPSHOT} if the change is intended.`,
      )
    }
  }
})

describe('Sokol/v1 legacy — codegen snapshot', () => {
  test('no generator errors', () => {
    const errs = diagnostics.filter(d => d.severity === 'error')
    expect(errs).toEqual([])
  })

  test('Telemetry has NO rename_all (snake_case on the wire)', () => {
    const idx = rust.indexOf('pub struct Telemetry')
    expect(idx).toBeGreaterThan(-1)
    const head = rust.slice(0, idx)
    // The `#[serde(rename_all = ...)]` attr would sit right above the
    // struct if present. For Telemetry it MUST be absent (busynca has
    // no rename_all either).
    const lastAttrStart = head.lastIndexOf('#[serde(')
    const lastDerive = head.lastIndexOf('#[derive(')
    // The last #[serde(...)] above Telemetry must be OLDER than the last
    // #[derive(...)] — i.e. no rename_all between derive and struct.
    expect(lastDerive).toBeGreaterThan(lastAttrStart)
  })

  test('GpsInjectCmd is @rename_case(CAMEL) → camelCase wire', () => {
    const idx = rust.indexOf('pub struct GpsInjectCmd')
    expect(idx).toBeGreaterThan(-1)
    const head = rust.slice(0, idx)
    expect(head.endsWith('#[serde(rename_all = "camelCase")]\n')).toBe(true)
  })

  test('GotoCmdExtended @rename_case(CAMEL)', () => {
    const idx = rust.indexOf('pub struct GotoCmdExtended')
    expect(idx).toBeGreaterThan(-1)
    const head = rust.slice(0, idx)
    expect(head.endsWith('#[serde(rename_all = "camelCase")]\n')).toBe(true)
  })

  test('MeshModemStatus + nested types all camelCase', () => {
    for (const name of ['MeshModemStatus', 'MeshModemNode', 'TransmissionDelay']) {
      const idx = rust.indexOf(`pub struct ${name}`)
      expect(idx).toBeGreaterThan(-1)
      const head = rust.slice(0, idx)
      expect(head.endsWith('#[serde(rename_all = "camelCase")]\n')).toBe(true)
    }
  })

  test('BortSysTelemetry and every nested sub-record all camelCase', () => {
    for (const name of [
      'BortSysTelemetry',
      'CpuInfo', 'MemoryInfo', 'DiskInfo',
      'NetIface', 'SerialStatus', 'CollectorResult',
    ]) {
      const idx = rust.indexOf(`pub struct ${name}`)
      expect(idx).toBeGreaterThan(-1)
      const head = rust.slice(0, idx)
      expect(head.endsWith('#[serde(rename_all = "camelCase")]\n')).toBe(true)
    }
  })

  test('GpsInjectCmd fields stay snake_case on the Rust side', () => {
    // Struct-level rename_all drives the wire names; Rust fields stay
    // snake_case (the identifiers in the SDL source).
    expect(rust).toContain('pub sender_id: String,')
    expect(rust).toContain('pub fix_type: i64,')
    // SPEC 0.3.8: busynca uses f32 for hdop/vdop → SDL `Float32` → Rust f32.
    expect(rust).toContain('pub hdop: f32,')
  })

  test('@topic patterns emitted as TOPIC_PATTERN constants', () => {
    expect(rust).toContain(
      'pub const TOPIC_PATTERN: &\'static str = "sokol/v1/bort/{hw_id}/tele";',
    )
    expect(rust).toContain(
      'pub const TOPIC_PATTERN: &\'static str = "sokol/v1/bort/{hw_id}/sys";',
    )
    expect(rust).toContain(
      'pub const TOPIC_PATTERN: &\'static str = "sokol/v1/mesh/{modem_id}/status";',
    )
    expect(rust).toContain(
      'pub const TOPIC_PATTERN: &\'static str = "sokol/v1/bort/{hw_id}/cmd/gps_inject";',
    )
  })

  test('no composite-CRDT wrappers (legacy schema has none)', () => {
    expect(rust).not.toContain('CrdtDoc')
    expect(rust).not.toContain('alaq_graph_zenoh_rt')
  })

  test('BortSysTelemetry.load_avg maps to Vec<f32> (f32 wire-parity with [f32;3])', () => {
    // SPEC 0.3.8: SDL `[Float32!]!` lowers to `Vec<f32>` — matches busynca's
    // `load_avg: [f32; 3]` at f32 width (was Vec<f64> pre-0.3.8).
    expect(rust).toContain('pub load_avg: Vec<f32>,')
  })
})

// ────────────────────────────────────────────────────────────────
// Type-check the sokol-legacy.rs through the same sandbox.
// ────────────────────────────────────────────────────────────────
//
// The existing cargo-sandbox has busynca-groupsync.rs pulled in via
// `#[path]`; we add sokol-legacy.rs as a sibling module. Both files
// live under __fixtures__, both resolve against the same rt + zenoh
// deps.

describe('Sokol/v1 legacy — cargo sandbox type-check', () => {
  test('cargo check succeeds on the generated Rust', () => {
    if (!existsSync(SANDBOX_MANIFEST)) {
      throw new Error(
        `cargo sandbox manifest missing: ${SANDBOX_MANIFEST}.`,
      )
    }
    const res = spawnSync(
      'cargo',
      ['check', '--quiet', '--manifest-path', SANDBOX_MANIFEST],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    if (res.status !== 0) {
      const msg = [
        `cargo check failed (exit ${res.status}):`,
        '--- stdout ---', res.stdout ?? '', '',
        '--- stderr ---', res.stderr ?? '', '',
      ].join('\n')
      throw new Error(msg)
    }
  }, 600_000)
})
