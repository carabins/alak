// @alaq/graph-zenoh — composite CRDT document codegen tests (v0.3.6).
//
// Covers SPEC §7.15 / §7.16 / §7.17 plus the `Any` → `serde_cbor::Value`
// mapping. The rt crate (`alaq-graph-zenoh-rt`) is not yet shipped in
// E2.2 — these tests assert on the *generated* Rust, not on a compiled
// toolchain. `cargo check` integration lands in E2.4.

import { describe, expect, test } from 'bun:test'
import { compileSources } from '../../graph/src/index'
import { generate } from '../src/index'

function compile(src: string, namespace: string) {
  const res = compileSources([{ path: 't.aql', source: src }])
  const errs = res.diagnostics.filter(d => d.severity === 'error')
  expect(errs).toEqual([])
  const gen = generate(res.ir!, { namespace })
  expect(gen.files.length).toBe(1)
  return { rust: gen.files[0]!.content, diags: gen.diagnostics }
}

describe('`Any` field → serde_cbor::Value', () => {
  test('bare `Any` field maps to serde_cbor::Value', () => {
    const src = `
      schema S { version: 1, namespace: "any_one" }
      record R { payload: Any! }
    `
    const { rust } = compile(src, 'any_one')
    expect(rust).toContain('pub payload: serde_cbor::Value,')
  })

  test('`Map<String, Any>` value maps through', () => {
    const src = `
      schema S { version: 1, namespace: "any_map" }
      record R { extras: Map<String, Any>! }
    `
    const { rust } = compile(src, 'any_map')
    // mapFieldType wraps Map as Vec<(K, V)>-ish helper; check the value
    // type is present in the struct.
    expect(rust).toContain('serde_cbor::Value')
  })

  test('`Any` pulls serde_cbor into Cargo deps', () => {
    const src = `
      schema S { version: 1, namespace: "any_dep" }
      record R { payload: Any! }
    `
    const { rust } = compile(src, 'any_dep')
    expect(rust).toContain('serde_cbor = "0.11"')
    expect(rust).toContain('use serde_cbor;')
  })

  test('no `Any` anywhere → no serde_cbor (unless @atomic is used)', () => {
    const src = `
      schema S { version: 1, namespace: "no_any" }
      record R { id: ID! }
    `
    const { rust } = compile(src, 'no_any')
    expect(rust).not.toContain('serde_cbor::Value')
    expect(rust).not.toContain('serde_cbor = "0.11"')
  })
})

describe('Composite CRDT document — single-member', () => {
  const SRC = `
    schema S @crdt_doc_topic(doc: "Single", pattern: "ns/{id}/patch") {
      version: 1
      namespace: "single_mem"
    }
    record Item @crdt_doc_member(doc: "Single", map: "items",
                                  soft_delete: { flag: "is_deleted", ts_field: "updated_at" })
                @crdt(type: LWW_MAP, key: "updated_at") {
      id: ID!
      is_deleted: Boolean!
      updated_at: Timestamp!
      name: String!
    }
  `

  test('emits SingleDoc wrapper struct', () => {
    const { rust } = compile(SRC, 'single_mem')
    expect(rust).toContain('pub struct SingleDoc {')
    expect(rust).toContain('inner: CrdtDoc,')
  })

  test('emits TOPIC_PATTERN constant from @crdt_doc_topic', () => {
    const { rust } = compile(SRC, 'single_mem')
    expect(rust).toContain('pub const TOPIC_PATTERN: &\'static str = "ns/{id}/patch";')
  })

  test('SCHEMA_VERSION const is emitted (0 when no @schema_version)', () => {
    const { rust } = compile(SRC, 'single_mem')
    expect(rust).toContain('pub const SCHEMA_VERSION: u32 = 0 as u32 /* no @schema_version declared */;')
  })

  test('emits new() / load_or_init / save / merge_remote', () => {
    const { rust } = compile(SRC, 'single_mem')
    expect(rust).toContain('pub fn new() -> Self {')
    // v0.3.7 — load_or_init is fallible (CrdtDoc side returns Result<...>).
    expect(rust).toContain(
      'pub fn load_or_init(bytes: Option<&[u8]>) -> anyhow::Result<(Self, bool)>',
    )
    expect(rust).toContain('pub fn save(&mut self) -> Vec<u8>')
    expect(rust).toContain('pub fn merge_remote(&mut self, other: &[u8]) -> anyhow::Result<()>')
  })

  test('emits upsert / delete / list for each map', () => {
    const { rust } = compile(SRC, 'single_mem')
    expect(rust).toContain('pub fn upsert_items(&mut self, entry: &Item) -> anyhow::Result<()>')
    expect(rust).toContain('pub fn delete_items(&mut self, id: &str, tombstone_ts: i64)')
    expect(rust).toContain('pub fn list_items(&self) -> anyhow::Result<Vec<Item>>')
  })

  test('upsert uses serde_json::to_string (wire-parity per R232)', () => {
    const { rust } = compile(SRC, 'single_mem')
    expect(rust).toContain('let json = serde_json::to_string(entry)?;')
    // v0.3.7: upsert_json takes the LWW field name as the final arg so the
    // runtime can locate the cell without the wrapper leaking generics.
    expect(rust).toContain(
      'self.inner.upsert_json("items", id, &json, lww, "updated_at")',
    )
  })

  test('member record loses per-record publisher', () => {
    const { rust } = compile(SRC, 'single_mem')
    expect(rust).not.toContain('pub async fn publish_item(')
    expect(rust).not.toContain('pub async fn subscribe_item(')
  })

  test('member record keeps lww_key helper but loses per-record merge()', () => {
    const { rust } = compile(SRC, 'single_mem')
    expect(rust).toContain('pub fn lww_key(&self) -> i64')
    expect(rust).not.toContain('pub fn merge(a: &Self, b: &Self) -> Self')
  })

  test('composite doc gets publish_<doc>/subscribe_<doc>', () => {
    const { rust } = compile(SRC, 'single_mem')
    expect(rust).toContain('pub async fn publish_single(')
    expect(rust).toContain('pub async fn subscribe_single<F>(')
  })

  test('use alaq_graph_zenoh_rt::CrdtDoc imported', () => {
    const { rust } = compile(SRC, 'single_mem')
    expect(rust).toContain('use alaq_graph_zenoh_rt::CrdtDoc;')
  })

  test('Cargo footer pins automerge and lists rt path dep', () => {
    const { rust } = compile(SRC, 'single_mem')
    expect(rust).toContain('automerge = "=0.6.0"')
    expect(rust).toContain('alaq-graph-zenoh-rt = { path = "../alaq-graph-zenoh-rt" }')
  })
})

describe('Composite CRDT document — two members + @schema_version', () => {
  const SRC = `
    schema Busynca @transport(kind: "zenoh")
                   @crdt_doc_topic(doc: "GroupSync", pattern: "valkyrie/{group}/sync/patch")
                   @schema_version(doc: "GroupSync", value: 2) {
      version: 1
      namespace: "valkyrie"
    }
    record SyncPoint @crdt_doc_member(doc: "GroupSync", map: "points",
                                      soft_delete: { flag: "is_deleted", ts_field: "updated_at" })
                     @crdt(type: LWW_MAP, key: "updated_at") {
      id: ID!
      is_deleted: Boolean!
      updated_at: Timestamp!
      extras: Map<String, Any>!
    }
    record DeviceEntry @crdt_doc_member(doc: "GroupSync", map: "devices",
                                        soft_delete: { flag: "is_deleted", ts_field: "ts" })
                       @crdt(type: LWW_MAP, key: "ts") {
      id: ID!
      is_deleted: Boolean!
      ts: Timestamp!
      name: String!
    }
  `

  test('GroupSyncDoc wrapper declares SCHEMA_VERSION = 2', () => {
    const { rust } = compile(SRC, 'valkyrie')
    expect(rust).toContain('pub struct GroupSyncDoc {')
    expect(rust).toContain('pub const SCHEMA_VERSION: u32 = 2 as u32;')
  })

  test('two separate map slots are emitted with distinct upsert helpers', () => {
    const { rust } = compile(SRC, 'valkyrie')
    expect(rust).toContain('pub fn upsert_points(&mut self, entry: &SyncPoint)')
    // v0.3.7: 5-arg signature with the LWW field name tail.
    expect(rust).toContain(
      'self.inner.upsert_json("points", id, &json, lww, "updated_at")',
    )
    expect(rust).toContain('pub fn upsert_devices(&mut self, entry: &DeviceEntry)')
    expect(rust).toContain(
      'self.inner.upsert_json("devices", id, &json, lww, "ts")',
    )
  })

  test('LWW key on DeviceEntry reads the `ts` field (not default updated_at)', () => {
    const { rust } = compile(SRC, 'valkyrie')
    // DeviceEntry.lww_key() returns self.ts, not self.updated_at.
    const idx = rust.indexOf('impl DeviceEntry {')
    expect(idx).toBeGreaterThan(-1)
    const tail = rust.slice(idx)
    expect(tail).toContain('pub fn lww_key(&self) -> i64 {')
    // Grab just the DeviceEntry impl window (next `impl ` or EOF).
    const nextImplAt = tail.indexOf('\nimpl ', 1)
    const window = nextImplAt === -1 ? tail : tail.slice(0, nextImplAt)
    expect(window).toContain('self.ts')
    expect(window).not.toContain('self.updated_at')
  })

  test('TOPIC_PATTERN is the schema-level pattern', () => {
    const { rust } = compile(SRC, 'valkyrie')
    expect(rust).toContain(
      'pub const TOPIC_PATTERN: &\'static str = "valkyrie/{group}/sync/patch";'
    )
  })

  test('Any field on SyncPoint maps to serde_cbor::Value inside the struct', () => {
    const { rust } = compile(SRC, 'valkyrie')
    // mapFieldType wraps Map in Vec<(K, V)>-style — check the value type
    // is reachable either as a direct field or as a map value.
    expect(rust).toContain('serde_cbor::Value')
  })

  test('No per-record publish_sync_point / publish_device_entry', () => {
    const { rust } = compile(SRC, 'valkyrie')
    expect(rust).not.toContain('publish_sync_point')
    expect(rust).not.toContain('publish_device_entry')
  })

  test('publish_group_sync / subscribe_group_sync emitted once', () => {
    const { rust } = compile(SRC, 'valkyrie')
    expect(rust).toContain('pub async fn publish_group_sync(')
    expect(rust).toContain('pub async fn subscribe_group_sync<F>(')
  })

  test('subscribe callback surfaces the rebuilt flag for drop-and-rebuild', () => {
    const { rust } = compile(SRC, 'valkyrie')
    expect(rust).toContain('F: FnMut(GroupSyncDoc, /* rebuilt */ bool)')
    // v0.3.7: load_or_init is fallible; subscribe task matches Ok(...)
    // and silently drops decode failures to keep the loop alive.
    expect(rust).toContain(
      'if let Ok((doc, rebuilt)) = GroupSyncDoc::load_or_init(Some(&bytes)) {',
    )
    expect(rust).toContain('callback(doc, rebuilt);')
  })
})

describe('Non-composite schemas stay unchanged', () => {
  test('plain @crdt(LWW_MAP) without @crdt_doc_member still emits per-record merge/publish', () => {
    const src = `
      schema S { version: 1, namespace: "plain_crdt" }
      record Msg @crdt(type: LWW_MAP, key: "updated_at") {
        id: ID!
        text: String!
        updated_at: Timestamp!
      }
    `
    const { rust } = compile(src, 'plain_crdt')
    expect(rust).toContain('pub fn merge(a: &Self, b: &Self) -> Self')
    expect(rust).toContain('pub async fn publish_msg(')
    expect(rust).not.toContain('use alaq_graph_zenoh_rt::CrdtDoc;')
    expect(rust).not.toContain('alaq-graph-zenoh-rt = {')
  })
})

// v0.3.7 — @rename_case on enum / record
describe('@rename_case (v0.3.7)', () => {
  test('enum without @rename_case keeps pre-0.3.7 SCREAMING_SNAKE_CASE', () => {
    const src = `
      schema S { version: 1, namespace: "rc_enum_default" }
      enum Status { ACTIVE, PAUSED }
    `
    const { rust } = compile(src, 'rc_enum_default')
    expect(rust).toContain('#[serde(rename_all = "SCREAMING_SNAKE_CASE")]')
  })

  test('enum with @rename_case(kind: PASCAL) emits PascalCase', () => {
    const src = `
      schema S { version: 1, namespace: "rc_enum_pascal" }
      enum PointKind @rename_case(kind: PASCAL) { TARGET OBSERVATION GROUP_POSITION GROUND_STATION }
    `
    const { rust } = compile(src, 'rc_enum_pascal')
    expect(rust).toContain('#[serde(rename_all = "PascalCase")]')
    expect(rust).not.toContain('#[serde(rename_all = "SCREAMING_SNAKE_CASE")]')
  })

  test('enum with @rename_case(kind: CAMEL) emits camelCase', () => {
    const src = `
      schema S { version: 1, namespace: "rc_enum_camel" }
      enum E @rename_case(kind: CAMEL) { A B }
    `
    const { rust } = compile(src, 'rc_enum_camel')
    expect(rust).toContain('#[serde(rename_all = "camelCase")]')
  })

  test('record without @rename_case keeps per-field #[serde(rename = ...)] for camelCase', () => {
    // Pre-0.3.7 behaviour — record has no rename_all, per-field rename
    // attributes appear for camelCase SDL field names.
    const src = `
      schema S { version: 1, namespace: "rc_rec_default" }
      record R { fcConnected: Boolean! }
    `
    const { rust } = compile(src, 'rc_rec_default')
    // No record-level rename_all.
    expect(rust).not.toMatch(/#\[serde\(rename_all = "[^"]+"\)\]\s*pub struct R/)
    // Per-field rename for camelCase SDL.
    expect(rust).toContain('#[serde(rename = "fcConnected")]')
  })

  test('record with @rename_case(kind: CAMEL) emits struct-level rename_all + drops per-field rename', () => {
    // Sokol/v1 legacy shape — SDL fields stay snake_case, rename_all gives
    // them camelCase on the wire without per-field overrides.
    const src = `
      schema S { version: 1, namespace: "rc_rec_camel" }
      record GotoCmd @rename_case(kind: CAMEL) {
        lat: Float!
        lon: Float!
        alt: Float!
        sender_id: String!
        ts: Timestamp!
      }
    `
    const { rust } = compile(src, 'rc_rec_camel')
    expect(rust).toContain('#[serde(rename_all = "camelCase")]')
    expect(rust).toContain('pub sender_id: String,')
    // No per-field rename — struct-level rename_all covers it.
    expect(rust).not.toContain('#[serde(rename = "senderId")]')
  })

  test('record with @rename_case(kind: SNAKE) emits snake_case', () => {
    const src = `
      schema S { version: 1, namespace: "rc_rec_snake" }
      record R @rename_case(kind: SNAKE) { x: Int!, y: Int! }
    `
    const { rust } = compile(src, 'rc_rec_snake')
    expect(rust).toContain('#[serde(rename_all = "snake_case")]')
  })
})

// v0.3.7 — soft_delete in composite-doc wrappers
describe('@crdt_doc_member soft_delete (v0.3.7)', () => {
  const SRC_SOFT = `
    schema S @crdt_doc_topic(doc: "D", pattern: "ns/{id}/patch")
             @schema_version(doc: "D", value: 2) {
      version: 1
      namespace: "soft_del"
    }
    record SyncPoint @crdt_doc_member(doc: "D", map: "points",
                                      lww_field: "updated_at",
                                      soft_delete: { flag: "is_deleted", ts_field: "updated_at" })
                     @crdt(type: LWW_MAP, key: "updated_at") {
      id: ID!
      is_deleted: Boolean!
      updated_at: Timestamp!
    }
  `

  test('upsert_points passes lww_field name as fifth arg', () => {
    const { rust } = compile(SRC_SOFT, 'soft_del')
    expect(rust).toContain(
      'self.inner.upsert_json("points", id, &json, lww, "updated_at").map_err(Into::into)',
    )
    // LWW is read directly from the typed field, not through lww_key().
    expect(rust).toContain('let lww: i64 = entry.updated_at;')
  })

  test('delete_points emits SoftDeleteSpec { flag, ts_field } and Some(spec)', () => {
    const { rust } = compile(SRC_SOFT, 'soft_del')
    expect(rust).toContain('let spec = alaq_graph_zenoh_rt::SoftDeleteSpec {')
    expect(rust).toContain('flag: "is_deleted",')
    expect(rust).toContain('ts_field: "updated_at",')
    expect(rust).toContain(
      'self.inner.delete_entry("points", id, tombstone_ts, Some(spec)).map_err(Into::into)',
    )
  })

  test('list_points filters soft-deleted entries in Rust (tombstone flag true → skip)', () => {
    const { rust } = compile(SRC_SOFT, 'soft_del')
    // The list iterator filters on `!v.is_deleted`.
    expect(rust).toContain('.filter(|r| match r { Ok(v) => !v.is_deleted, Err(_) => true })')
  })

  test('hard-delete record (no soft_delete arg) passes None to rt', () => {
    // v0.3.9 R236 forbids hard-delete on @crdt_doc_member; the
    // @breaking_change opt-out keeps the codegen path exercised so that
    // pre-existing wire contracts (Busynca DeviceEntry) stay reproducible.
    const src = `
      schema S @crdt_doc_topic(doc: "D", pattern: "ns/{id}/patch") {
        version: 1
        namespace: "hard_del"
      }
      record DeviceEntry @crdt_doc_member(doc: "D", map: "devices",
                                          lww_field: "ts")
                         @breaking_change(reason: "hard-delete fixture for soft_delete=None codegen path")
                         @crdt(type: LWW_MAP, key: "ts") {
        id: ID!
        ts: Timestamp!
      }
    `
    const { rust } = compile(src, 'hard_del')
    expect(rust).toContain(
      'self.inner.delete_entry("devices", id, tombstone_ts, None).map_err(Into::into)',
    )
    expect(rust).not.toContain('SoftDeleteSpec')
  })

  test('lww_field reads from the declared field (ts, not updated_at)', () => {
    const src = `
      schema S @crdt_doc_topic(doc: "D", pattern: "ns/{id}/patch") {
        version: 1
        namespace: "lww_ts_field"
      }
      record DeviceEntry @crdt_doc_member(doc: "D", map: "devices",
                                          lww_field: "ts")
                         @breaking_change(reason: "lww_field test fixture — no soft_delete (R236 opt-out)")
                         @crdt(type: LWW_MAP, key: "ts") {
        id: ID!
        ts: Timestamp!
      }
    `
    const { rust } = compile(src, 'lww_ts_field')
    expect(rust).toContain('let lww: i64 = entry.ts;')
    expect(rust).toContain(
      'self.inner.upsert_json("devices", id, &json, lww, "ts")',
    )
  })
})
