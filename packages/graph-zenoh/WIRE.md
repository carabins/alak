# @alaq/graph-zenoh — Wire Mapping

Normative wire contract for the **default Tier-2 generator** (`@alaq/graph-zenoh`). This table is authoritative for `@alaq/graph-zenoh` and serves as the reference shape for sibling generators; other generators (`graph-axum`, `graph-tauri`, `graph-tauri-rs`) document their own mappings in their own packages.

SPEC normative behaviour: see `../graph/SPEC.md` (§4 types, §5 actions, §5.5 events, §6 scopes, §7 directives, §11 wire-mapping anchor).

## 1. Mapping table

| SDL | Wire |
|-----|------|
| `schema X { namespace: "n" }` | Topic root `n/` |
| `record R` (unscoped, `@sync(qos: RELIABLE)`) | Topic `n/R`, reliable publisher |
| `record R @scope(name: "room")` | Topic family `n/room/{id}/R`, one replica per `{id}` |
| `record R @sync(qos: RELIABLE)` | Zenoh put/subscribe, reliable |
| `record R @sync(qos: REALTIME)` | Zenoh put/subscribe, best-effort |
| `field f @sync(qos: REALTIME)` on reliable record | Sub-topic `<parent-topic>/f`, best-effort |
| `record R @crdt(type: LWW_MAP, key: "updated_at")` | Automerge document keyed by record id, LWW by `updated_at` |
| `record R @crdt_doc_member(doc: "D", map: "M") @crdt(type: LWW_MAP, key: "updated_at")` | Root-map `M` inside Automerge document `D` (topic per `@crdt_doc_topic(doc: "D", ...)`). Entry values are JSON strings (SPEC R232). Multiple member records share one Automerge document, one Zenoh topic. |
| `record R @crdt_doc_member(..., lww_field: "f", soft_delete: { flag: "g", ts_field: "h" })` | Same as above plus soft-delete: `delete` writes `g: true` + `h: tombstone_ts` into the existing entry instead of removing the cell. The runtime bumps the LWW to `tombstone_ts`; `list_<map>` skips entries with `g == true`. |
| `enum E @rename_case(kind: K)` | Rust enum with `#[serde(rename_all = "<K>")]`. Wire variants in case `K`. Generator default when directive omitted: `SCREAMING_SNAKE_CASE` (R260). |
| `record R @rename_case(kind: K)` | Rust struct with `#[serde(rename_all = "<K>")]`. Wire field names in case `K`. Generator default when directive omitted: no `rename_all` attribute; per-field `@rename` overrides apply (R260). |
| `schema S @schema_version(doc: "D", value: N)` | Root field `schema_version: N` inside Automerge document `D`. On load-time mismatch the document is dropped and re-initialised (SPEC R251). |
| `field f: Any` or `Map<K, Any>` | Field payload is an opaque CBOR value (`serde_cbor::Value` in Rust). Encoded as a CBOR byte string inside the enclosing JSON payload (serde does this automatically for `serde_cbor::Value`) or as a raw CBOR sub-value when the enclosing encoding is already CBOR. |
| `record R @atomic` | CBOR blob, whole-record replace on change. (`@atomic ≡ @sync(atomic: true)` — SPEC R120.) |
| `event E { … }` | Topic `n/events/<snake_case(E)>`, fire-and-forget put. Wire name = `snake_case(EventName)` (SPEC R066). Per-target binding: SPEC §5.5 wire mapping. |
| `action A` (unscoped) | Topic `n/action/A`, request-reply |
| `action A { scope: "room" }` | Topic `n/room/{id}/action/A`, request-reply per room |
| `action A` without `output` | Fire-forget, no reply topic |
| `action A` with `output: T` | Request on `.../action/A`, reply on `.../action/A/reply/{req_id}` |
| `opaque stream S { qos: Q, max_size: N }` | Topic `n/stream/S`, pass-through, fragmented above `N` |
| `@liveness(source, timeout)` | Runtime presence loop publishes `on_lost` event after `timeout` of silence |
| `@auth(read: "owner")` | Generator emits ACL check; wire includes identity token in frame |
| `@store` | Runtime persists to storage backend; not visible on wire directly |
| `Map<K, V>` | CBOR map on the wire. With `@crdt(type: LWW_MAP)` → LWW-Map CRDT keyed by `K`. Default TS mapping: `Record<K, V>`. |

## 2. Field-vs-record `@sync` precedence

When a field has both record-level and field-level `@sync`, field-level wins (SPEC R100/R401).

## 3. Notes

- **Byte-identical wire across deployments** (historical R400) is **not yet enforced**. Two deployments running the same generator version against the same `.aql` *should* produce byte-identical wire traffic, but no conformance test verifies this end-to-end. Tracked for v0.4.
- **`specVersion` metadata in generated code** (historical R500/R501) is **not implemented**. Generators do not stamp the SPEC version into emitted files and runtimes do not verify SPEC compatibility on connect. Tracked for v0.4.
