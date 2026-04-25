// End-to-end: the Busynca GroupSync fixture — compile the SDL through
// `@alaq/graph`, generate Rust through `@alaq/graph-zenoh`, snapshot the
// output, and (E2.4.3) type-check the result in a sibling cargo sandbox.
//
// Snapshot path: __fixtures__/busynca-groupsync.rs — writes on first
// run, diffs on subsequent runs. Matches the shape of kotelok.test.ts.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, test } from 'bun:test'
import { compileSources } from '../../graph/src/index'
import { generate } from '../src/index'

const FIXTURE_DIR = join(import.meta.dir, '__fixtures__')
const SDL_PATH = join(FIXTURE_DIR, 'busynca-groupsync.aql')
const SNAPSHOT = join(FIXTURE_DIR, 'busynca-groupsync.rs')

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

  const gen = generate(res.ir!, { namespace: 'valkyrie' })
  expect(gen.files.length).toBe(1)
  rust = gen.files[0].content
  diagnostics = gen.diagnostics

  // Snapshot: create on first run, compare on subsequent runs.
  if (!existsSync(SNAPSHOT)) {
    writeFileSync(SNAPSHOT, rust)
  } else {
    const prev = readFileSync(SNAPSHOT, 'utf8')
    if (prev !== rust) {
      // Helpful failure message — write the new output next to the
      // snapshot so the author can diff manually, but fail the test.
      writeFileSync(SNAPSHOT + '.new', rust)
      throw new Error(
        `Busynca snapshot drift: see ${SNAPSHOT}.new and diff. ` +
        `Accept by overwriting ${SNAPSHOT} if the change is intended.`,
      )
    }
  }
})

describe('Busynca GroupSync — codegen snapshot', () => {
  test('no generator-level errors', () => {
    const errs = diagnostics.filter(d => d.severity === 'error')
    expect(errs).toEqual([])
  })

  test('header advertises automerge + rt path dep', () => {
    expect(rust).toContain('automerge = "=0.6.0"')
    expect(rust).toContain('alaq-graph-zenoh-rt = { path = "../alaq-graph-zenoh-rt" }')
    expect(rust).toContain('use alaq_graph_zenoh_rt::CrdtDoc;')
  })

  test('PointKind enum → #[serde(rename_all = "PascalCase")]', () => {
    const idx = rust.indexOf('pub enum PointKind')
    expect(idx).toBeGreaterThan(-1)
    // Scan backwards for the rename_all attribute above the enum decl.
    const head = rust.slice(0, idx)
    expect(head.endsWith('#[serde(rename_all = "PascalCase")]\n')).toBe(true)
  })

  test('DeviceRole enum → #[serde(rename_all = "PascalCase")]', () => {
    const idx = rust.indexOf('pub enum DeviceRole')
    expect(idx).toBeGreaterThan(-1)
    const head = rust.slice(0, idx)
    expect(head.endsWith('#[serde(rename_all = "PascalCase")]\n')).toBe(true)
  })

  test('GroupSyncDoc wrapper has SCHEMA_VERSION = 2 and topic pattern', () => {
    expect(rust).toContain('pub struct GroupSyncDoc {')
    expect(rust).toContain('pub const SCHEMA_VERSION: u32 = 2 as u32;')
    expect(rust).toContain(
      'pub const TOPIC_PATTERN: &\'static str = "valkyrie/{group}/sync/patch";',
    )
  })

  test('MAP_KEYS is emitted pre-sorted and threaded into new / load_or_init', () => {
    // Sorted alphabetically: "devices" < "points".
    expect(rust).toContain(
      "pub const MAP_KEYS: &'static [&'static str] = &[\"devices\", \"points\"];",
    )
    expect(rust).toContain(
      'Self { inner: CrdtDoc::new(Self::SCHEMA_VERSION, Self::MAP_KEYS) }',
    )
    expect(rust).toContain(
      'let (inner, rebuilt) = CrdtDoc::load_or_init(b, Self::SCHEMA_VERSION, Self::MAP_KEYS)?;',
    )
  })

  test('upsert_points uses id field + updated_at LWW + "updated_at" name', () => {
    // SPEC §7.15 R230: id field is required ID! — here named `id`.
    expect(rust).toContain('let id = &entry.id;')
    expect(rust).toContain('let lww: i64 = entry.updated_at;')
    expect(rust).toContain(
      'self.inner.upsert_json("points", id, &json, lww, "updated_at")',
    )
  })

  test('upsert_devices uses device_id field + ts LWW + "ts" name', () => {
    // DeviceEntry names its required ID! field `device_id`, not `id`.
    // Generator MUST pick up the first required `ID!` field (R230).
    expect(rust).toContain('let id = &entry.device_id;')
    expect(rust).toContain('let lww: i64 = entry.ts;')
    expect(rust).toContain(
      'self.inner.upsert_json("devices", id, &json, lww, "ts")',
    )
  })

  test('delete_points is soft-delete with { flag: "is_deleted", ts_field: "updated_at" }', () => {
    expect(rust).toContain('flag: "is_deleted",')
    expect(rust).toContain('ts_field: "updated_at",')
    expect(rust).toContain(
      'self.inner.delete_entry("points", id, tombstone_ts, Some(spec))',
    )
  })

  test('delete_devices is hard-delete (None)', () => {
    expect(rust).toContain(
      'self.inner.delete_entry("devices", id, tombstone_ts, None)',
    )
  })

  test('list_points filters soft-deleted entries', () => {
    expect(rust).toContain(
      '.filter(|r| match r { Ok(v) => !v.is_deleted, Err(_) => true })',
    )
  })

  test('list_devices has no soft-delete filter (hard-delete semantics)', () => {
    const idx = rust.indexOf('pub fn list_devices')
    expect(idx).toBeGreaterThan(-1)
    // Window from list_devices to the next `pub fn` or end of impl.
    const tail = rust.slice(idx)
    const next = tail.indexOf('\n    pub fn ', 1)
    const window = next === -1 ? tail : tail.slice(0, next)
    expect(window).not.toContain('.filter')
  })

  test('PositionMsg is a per-record @atomic publisher (not a composite member)', () => {
    expect(rust).toContain('pub struct PositionMsg {')
    expect(rust).toContain('pub fn encode_cbor(&self)')
    expect(rust).toContain('pub async fn publish_position_msg(')
  })

  test('StatusMsg likewise has @atomic CBOR codec + publisher', () => {
    expect(rust).toContain('pub struct StatusMsg {')
    expect(rust).toContain('pub async fn publish_status_msg(')
  })

  test('SyncPoint.extras: Map<String, Any!>! → BTreeMap<String, serde_cbor::Value>', () => {
    // Fixture writes `Map<String, Any!>!` — value slot is required,
    // matching Busynca's `BTreeMap<String, serde_cbor::Value>` exactly
    // (no Option wrap).
    expect(rust).toContain(
      'pub extras: std::collections::BTreeMap<String, serde_cbor::Value>,',
    )
  })

  test('publish_group_sync / subscribe_group_sync are emitted once', () => {
    expect(rust).toContain('pub async fn publish_group_sync(')
    expect(rust).toContain('pub async fn subscribe_group_sync<F>(')
  })
})

// ────────────────────────────────────────────────────────────────
// E2.4.3 — type-check the generated Rust against alaq-graph-zenoh-rt.
// ────────────────────────────────────────────────────────────────
//
// The sandbox is a tiny crate at test/cargo-sandbox/ that `include!`s
// the generated file and depends (via a path dep) on the rt crate.
// `cargo check` verifies signatures and imports — no runtime behaviour
// is exercised (rt bodies are still `unimplemented!()`).

describe('Busynca GroupSync — cargo sandbox type-check', () => {
  test('cargo check succeeds on the generated Rust', () => {
    if (!existsSync(SANDBOX_MANIFEST)) {
      throw new Error(
        `cargo sandbox manifest missing: ${SANDBOX_MANIFEST}. ` +
        `E2.4.3 did not run or was partially applied.`,
      )
    }
    if (!existsSync(SNAPSHOT)) {
      throw new Error(
        `generated Rust snapshot missing: ${SNAPSHOT}. ` +
        `Run the generator (E2.4.2) before the cargo check step.`,
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
