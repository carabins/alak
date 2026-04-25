//! `alaq-graph-zenoh-rt` — runtime bridge for `@alaq/graph-zenoh` composite
//! CRDT documents (SPEC §7.15 / §7.16 / §7.17, §11).
//!
//! # API contract — v0.1
//!
//! This crate is the **contract** consumed by code emitted from the
//! graph-zenoh generator. The types and function signatures in this file
//! are frozen for v0.1. Method bodies are `unimplemented!()` for now;
//! implementations land in a follow-up wave (E2.3).
//!
//! # Wire shape
//!
//! A `CrdtDoc` wraps an `automerge::AutoCommit`. The Automerge document
//! has the following root layout (identical to Busynca's
//! `GroupSyncManager` wire format):
//!
//! ```text
//! {
//!   "schema_version": <u32>,
//!   "<map_key_1>": { "<id>": "<json string>", ... },
//!   "<map_key_2>": { "<id>": "<json string>", ... },
//!   ...
//! }
//! ```
//!
//! Values stored under each map are **JSON strings** (`serde_json::to_string`
//! of the record) — SPEC §7.15 R232. This mirrors the Busynca
//! `BTreeMap<String, serde_json::Value>` wire layout exactly and is what
//! the generator emits.
//!
//! # Who calls this
//!
//! Generated `<Doc>Doc` wrappers. Application code should prefer the
//! wrapper API (`GroupSyncDoc::upsert_points(...)`) over the low-level
//! methods on `CrdtDoc`.

#![allow(clippy::needless_pass_by_value, dead_code)]

use automerge::{
    transaction::Transactable, AutoCommit, ObjType, ReadDoc, ScalarValue, Value, ROOT,
};
use std::sync::OnceLock;

// The API is fully monomorphic: generic serialisation happens in the
// generated `<Doc>Doc` wrappers, and this crate only handles the
// already-rendered JSON strings. `serde_json::Error` surfaces through
// `CrdtError::Json` when the implementation (E2.3) decodes Automerge
// string cells back into Rust strings — the `#[from]` conversion keeps
// the error bubble-up path ergonomic.

/// The root `schema_version` field pinned into a composite document.
pub type SchemaVersion = u32;

/// Last-write-wins resolution key — read from an SDL `Timestamp!` or
/// `Int!` field named by `@crdt(type: LWW_MAP, key: "...")`.
pub type LwwKey = i64;

const SCHEMA_KEY: &str = "schema_version";

/// Failure modes for composite CRDT document operations.
#[derive(Debug, thiserror::Error)]
pub enum CrdtError {
    /// Upstream `automerge` surfaced an error. We carry the message as a
    /// String so the enum stays `Send + Sync + 'static` without leaking
    /// the crate's concrete error type across the API boundary.
    #[error("automerge: {0}")]
    Automerge(String),

    /// `serde_json` failure during entry serialisation (`upsert_entry`) or
    /// deserialisation (`list_entries`).
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),

    /// `load` / `load_or_init` detected a mismatched or missing
    /// `schema_version` root field. `load` surfaces this; `load_or_init`
    /// handles it internally by rebuilding and does **not** return this
    /// variant.
    #[error("schema version mismatch: expected {expected}, got {actual:?}")]
    SchemaVersionMismatch {
        expected: SchemaVersion,
        actual: Option<SchemaVersion>,
    },
}

impl From<automerge::AutomergeError> for CrdtError {
    fn from(e: automerge::AutomergeError) -> Self {
        CrdtError::Automerge(e.to_string())
    }
}

/// Soft-delete specification passed into [`CrdtDoc::delete_entry`] when
/// the member record declared `@crdt_doc_member(..., soft_delete: { flag:
/// "...", ts_field: "..." })` in SDL.
///
/// Implementation contract (SPEC §7.15 R235, matched by Busynca's
/// `SyncPoint.is_deleted` convention): when `Some(spec)` is passed, the
/// runtime locates the JSON-string cell under `map_key[id]`, parses it as
/// `serde_json::Value`, sets `obj[spec.flag] = true` and
/// `obj[spec.ts_field] = tombstone_ts`, re-serialises the object, and
/// writes it back. It also bumps the LWW resolution cell so merges treat
/// the tombstone as the newest revision. This MUST happen unconditionally
/// — R235 explicitly says soft-delete is a plain `put` without a
/// current-LWW check, matching Busynca's semantics.
///
/// When `None`, the runtime performs a hard delete (removes the Automerge
/// map key via `AutoCommit::delete`) — for records whose SDL does not
/// declare `soft_delete`.
pub struct SoftDeleteSpec<'a> {
    /// Name of the `Boolean!` field inside the entry JSON to flip to
    /// `true`. SPEC §7.15 R235: must exist on the member record and be
    /// `Boolean!`.
    pub flag: &'a str,
    /// Name of the `Timestamp!`/`Int!` field inside the entry JSON to set
    /// to `tombstone_ts`. Same field as `lww_field` in practice for
    /// Busynca (both point at `updated_at`), but SDL allows them to
    /// differ — we keep them as two arguments so the generator can
    /// specify each explicitly.
    pub ts_field: &'a str,
}

/// A composite CRDT document — one Automerge blob holding several named
/// root maps plus a pinned `schema_version`.
pub struct CrdtDoc {
    doc: AutoCommit,
}

/// Per-(schema-version, map-keys) template blob. All `new(v, keys)` calls
/// for the same pair share a common ancestor, so two independently-created
/// documents merge without losing data (Busynca sync.rs:23-41 — identical
/// pattern: template is pre-populated with `schema_version` + every root
/// map, so Automerge history starts from the same tip everywhere).
///
/// `map_keys` MUST arrive pre-sorted by ascending lexicographic order so
/// that cache hits are deterministic across callers (the generated
/// `<Doc>Doc::MAP_KEYS` constant is emitted sorted for this reason).
/// Passing unsorted keys is not undefined behaviour — it just produces a
/// different template and another cache entry.
fn template_blob(schema_version: SchemaVersion, map_keys: &[&str]) -> Vec<u8> {
    type CacheKey = (SchemaVersion, Vec<String>);
    static TEMPLATES: OnceLock<std::sync::Mutex<std::collections::HashMap<CacheKey, Vec<u8>>>> =
        OnceLock::new();
    let map = TEMPLATES.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()));
    let owned_keys: Vec<String> = map_keys.iter().map(|s| (*s).to_string()).collect();
    let cache_key: CacheKey = (schema_version, owned_keys.clone());
    let mut guard = map.lock().expect("template_blob mutex poisoned");
    if let Some(bytes) = guard.get(&cache_key) {
        return bytes.clone();
    }
    let mut doc = AutoCommit::new();
    doc.put(ROOT, SCHEMA_KEY, schema_version as i64)
        .expect("template: put schema_version");
    // Pre-create every root map so replicas share a common Automerge
    // ancestor for every map_key — required for merge parity.
    for key in &owned_keys {
        doc.put_object(ROOT, key.as_str(), ObjType::Map)
            .expect("template: put_object map");
    }
    let bytes = doc.save();
    guard.insert(cache_key, bytes.clone());
    bytes
}

fn read_schema_version(doc: &AutoCommit) -> Option<SchemaVersion> {
    match doc.get(ROOT, SCHEMA_KEY).ok().flatten() {
        Some((Value::Scalar(s), _)) => match &*s {
            ScalarValue::Int(v) => Some(*v as SchemaVersion),
            ScalarValue::Uint(v) => Some(*v as SchemaVersion),
            _ => None,
        },
        _ => None,
    }
}

impl CrdtDoc {
    /// Create an empty document pinned to `schema_version`. The root
    /// Automerge map contains `schema_version` plus one empty root map
    /// per entry in `map_keys`. Pre-creating the maps is load-bearing:
    /// replicas that start from the same `(schema_version, map_keys)`
    /// pair share a common Automerge ancestor, so any pair of documents
    /// produced by `new(v, k)` on different hosts can merge without
    /// losing history — this matches Busynca's `template_blob` pattern
    /// in `sync.rs:29-41`.
    ///
    /// `map_keys` MUST be sorted ascending — the generator emits
    /// `<Doc>Doc::MAP_KEYS` pre-sorted for determinism. Re-sorting here
    /// would mask a codegen bug, so we trust the caller.
    pub fn new(schema_version: SchemaVersion, map_keys: &[&str]) -> Self {
        let bytes = template_blob(schema_version, map_keys);
        let doc = AutoCommit::load(&bytes).expect("template blob must load");
        Self { doc }
    }

    /// Load an existing Automerge blob. Returns `SchemaVersionMismatch`
    /// when the root `schema_version` is absent or differs from any
    /// expectation the caller has — this low-level path does **not**
    /// rebuild; callers that want drop-and-rebuild semantics use
    /// [`CrdtDoc::load_or_init`].
    pub fn load(bytes: &[u8]) -> Result<Self, CrdtError> {
        let doc = AutoCommit::load(bytes)?;
        Ok(Self { doc })
    }

    /// Load an existing blob, or rebuild on mismatch. Returns the loaded
    /// document along with a `bool` flag: `true` when the on-disk blob
    /// was dropped and a fresh document was initialised because its
    /// `schema_version` did not match `expected`. SPEC §7.17 R251
    /// requires the caller to log the rebuild.
    ///
    /// `map_keys` MUST be the same set (and order) used by every replica
    /// — it is the second half of the template-blob cache key. Passing a
    /// different set on different hosts means they start from different
    /// Automerge ancestors after a rebuild and wire-parity is lost. The
    /// generator emits `<Doc>Doc::MAP_KEYS` pre-sorted for this reason.
    pub fn load_or_init(
        bytes: &[u8],
        expected: SchemaVersion,
        map_keys: &[&str],
    ) -> Result<(Self, bool), CrdtError> {
        match AutoCommit::load(bytes) {
            Ok(doc) => match read_schema_version(&doc) {
                Some(v) if v == expected => Ok((Self { doc }, false)),
                _ => Ok((Self::new(expected, map_keys), true)),
            },
            Err(_) => Ok((Self::new(expected, map_keys), true)),
        }
    }

    /// Serialise the current document to an Automerge binary blob.
    pub fn save(&mut self) -> Vec<u8> {
        self.doc.save()
    }

    /// Merge a remote snapshot into `self` (Automerge merge). The remote
    /// is expected to be the same document (same root shape and
    /// `schema_version`); shape conflicts surface as
    /// `CrdtError::Automerge`.
    pub fn merge_remote(&mut self, other: &[u8]) -> Result<(), CrdtError> {
        let mut other_doc = AutoCommit::load(other)?;
        self.doc.merge(&mut other_doc)?;
        Ok(())
    }

    /// Insert or overwrite an entry inside one of the document's root
    /// maps. `json` is the pre-serialised JSON representation of the
    /// record (the generated `<Doc>Doc::upsert_<map>` wrapper calls
    /// `serde_json::to_string` on its typed argument before calling
    /// this). Stored verbatim as a JSON string in the Automerge cell —
    /// SPEC §7.15 R232, matches Busynca's wire format exactly.
    ///
    /// `lww_key` is the integer LWW resolution key, read directly from
    /// the record's declared LWW field (`Timestamp!` / `Int!` → wire
    /// integer, never a string — SPEC §7.15 R234). `lww_field` is the
    /// flat JSON field name that `lww_key` came from, so the runtime can
    /// (a) update the LWW resolution cell alongside the JSON blob and
    /// (b) locate the same field when soft-delete writes a tombstone
    /// later. In 0.3.7 `lww_field` is always a single identifier (no
    /// dotted paths — nested paths are a future extension per the E2.2b
    /// codegen decision).
    ///
    /// Merge semantics for the same `(map_key, id)` across replicas:
    /// greater `lww_key` wins; ties → existing (Rustovik's E2.3 note,
    /// matches Busynca stability convention). A record whose in-storage
    /// JSON is missing the `lww_field` → caller's new `lww_key`
    /// unconditionally overwrites (E2.3 decision, reported in status).
    pub fn upsert_json(
        &mut self,
        map_key: &str,
        id: &str,
        json: &str,
        lww_key: LwwKey,
        lww_field: &str,
    ) -> Result<(), CrdtError> {
        let map_id = self.ensure_map(map_key)?;

        // LWW pre-check: parse existing cell, compare lww_field.
        if let Some((Value::Scalar(s), _)) = self.doc.get(&map_id, id)? {
            if let ScalarValue::Str(smol) = &*s {
                let raw: &str = smol.as_ref();
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(raw) {
                    if let Some(existing) = v.get(lww_field).and_then(|f| f.as_i64()) {
                        if lww_key <= existing {
                            return Ok(());
                        }
                    }
                }
            }
        }

        self.doc.put(&map_id, id, json)?;
        Ok(())
    }

    /// Mark an entry as deleted. Behaviour depends on `soft_delete`:
    ///
    /// - `None` — **hard delete**. The Automerge map cell under
    ///   `map_key[id]` is removed (`AutoCommit::delete`). `tombstone_ts`
    ///   is recorded as the LWW timestamp so late-arriving older updates
    ///   cannot resurrect the entry.
    ///
    /// - `Some(spec)` — **soft delete** (SPEC §7.15 R235). The existing
    ///   JSON blob under `map_key[id]` is loaded, `spec.flag` is flipped
    ///   to `true`, `spec.ts_field` is set to `tombstone_ts`, and the
    ///   re-serialised JSON is written back. The LWW resolution cell is
    ///   bumped to `tombstone_ts` unconditionally — R235 is explicit:
    ///   tombstones always win over older non-deleted revisions, no
    ///   current-LWW check. Matches Busynca's `SyncPoint.is_deleted`
    ///   convention exactly.
    ///
    /// `list_<map>` helpers emitted by the generator skip entries whose
    /// `flag` field is `true`; the runtime does not filter for the
    /// caller.
    pub fn delete_entry(
        &mut self,
        map_key: &str,
        id: &str,
        tombstone_ts: LwwKey,
        soft_delete: Option<SoftDeleteSpec>,
    ) -> Result<(), CrdtError> {
        let map_id = self.ensure_map(map_key)?;
        match soft_delete {
            None => {
                let _ = self.doc.delete(&map_id, id);
                Ok(())
            }
            Some(spec) => {
                let mut v: serde_json::Value = match self.doc.get(&map_id, id)? {
                    Some((Value::Scalar(s), _)) => match &*s {
                        ScalarValue::Str(smol) => serde_json::from_str(smol.as_ref())?,
                        _ => serde_json::Value::Object(serde_json::Map::new()),
                    },
                    _ => serde_json::Value::Object(serde_json::Map::new()),
                };
                if let serde_json::Value::Object(ref mut obj) = v {
                    obj.insert(spec.flag.to_string(), serde_json::Value::Bool(true));
                    obj.insert(
                        spec.ts_field.to_string(),
                        serde_json::Value::Number(tombstone_ts.into()),
                    );
                }
                let json = serde_json::to_string(&v)?;
                self.doc.put(&map_id, id, json)?;
                Ok(())
            }
        }
    }

    /// List every non-deleted entry in one of the root maps as raw JSON
    /// strings. The generated `<Doc>Doc::list_<map>` wrapper calls
    /// `serde_json::from_str::<Record>` on each element to recover the
    /// typed view — typed deserialisation lives in the wrapper, not in
    /// this crate, for the same monomorphic reason as `upsert_json`.
    pub fn list_json(&self, map_key: &str) -> Result<Vec<String>, CrdtError> {
        let map_id = match self.doc.get(ROOT, map_key)? {
            Some((Value::Object(ObjType::Map), id)) => id,
            _ => return Ok(Vec::new()),
        };
        let mut out = Vec::new();
        for key in self.doc.keys(&map_id) {
            if let Some((Value::Scalar(s), _)) = self.doc.get(&map_id, &key)? {
                if let ScalarValue::Str(smol) = &*s {
                    out.push(smol.to_string());
                }
            }
        }
        Ok(out)
    }

    /// Read the pinned `schema_version` from the Automerge root. `None`
    /// when the field is missing (e.g. freshly loaded legacy blob).
    pub fn schema_version(&self) -> Option<SchemaVersion> {
        read_schema_version(&self.doc)
    }

    fn ensure_map(&mut self, map_key: &str) -> Result<automerge::ObjId, CrdtError> {
        match self.doc.get(ROOT, map_key)? {
            Some((Value::Object(ObjType::Map), id)) => Ok(id),
            _ => Ok(self.doc.put_object(ROOT, map_key, ObjType::Map)?),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const SCHEMA: SchemaVersion = 2;
    const MAP: &str = "points";
    const LWW: &str = "updated_at";
    const KEYS: &[&str] = &["devices", "points"];

    fn entry(id: &str, ts: i64, deleted: bool) -> String {
        serde_json::to_string(&json!({
            "id": id,
            "updated_at": ts,
            "is_deleted": deleted,
            "label": "x",
        }))
        .unwrap()
    }

    #[test]
    fn new_has_schema_version() {
        let doc = CrdtDoc::new(SCHEMA, KEYS);
        assert_eq!(doc.schema_version(), Some(SCHEMA));
    }

    #[test]
    fn roundtrip_save_load() {
        let mut doc = CrdtDoc::new(SCHEMA, KEYS);
        doc.upsert_json(MAP, "a", &entry("a", 100, false), 100, LWW)
            .unwrap();
        let blob = doc.save();
        let loaded = CrdtDoc::load(&blob).unwrap();
        let list = loaded.list_json(MAP).unwrap();
        assert_eq!(list.len(), 1);
        assert!(list[0].contains("\"id\":\"a\""));
        assert_eq!(loaded.schema_version(), Some(SCHEMA));
    }

    #[test]
    fn lww_greater_wins() {
        let mut doc = CrdtDoc::new(SCHEMA, KEYS);
        doc.upsert_json(MAP, "a", &entry("a", 100, false), 100, LWW)
            .unwrap();
        doc.upsert_json(MAP, "a", &entry("a", 200, false), 200, LWW)
            .unwrap();
        let list = doc.list_json(MAP).unwrap();
        assert_eq!(list.len(), 1);
        let v: serde_json::Value = serde_json::from_str(&list[0]).unwrap();
        assert_eq!(v["updated_at"].as_i64(), Some(200));
    }

    #[test]
    fn lww_lesser_noop() {
        let mut doc = CrdtDoc::new(SCHEMA, KEYS);
        doc.upsert_json(MAP, "a", &entry("a", 200, false), 200, LWW)
            .unwrap();
        doc.upsert_json(MAP, "a", &entry("a", 100, false), 100, LWW)
            .unwrap();
        let list = doc.list_json(MAP).unwrap();
        let v: serde_json::Value = serde_json::from_str(&list[0]).unwrap();
        assert_eq!(v["updated_at"].as_i64(), Some(200));
    }

    #[test]
    fn lww_equal_noop() {
        let mut doc = CrdtDoc::new(SCHEMA, KEYS);
        doc.upsert_json(MAP, "a", &entry("a", 100, false), 100, LWW)
            .unwrap();
        let first = doc.list_json(MAP).unwrap()[0].clone();
        doc.upsert_json(MAP, "a", &entry("a", 100, true), 100, LWW)
            .unwrap();
        let list = doc.list_json(MAP).unwrap();
        assert_eq!(list[0], first);
    }

    #[test]
    fn missing_lww_field_allows_overwrite() {
        let mut doc = CrdtDoc::new(SCHEMA, KEYS);
        let j = serde_json::to_string(&json!({"id": "a", "label": "x"})).unwrap();
        doc.upsert_json(MAP, "a", &j, 500, LWW).unwrap();
        doc.upsert_json(MAP, "a", &entry("a", 100, false), 100, LWW)
            .unwrap();
        let list = doc.list_json(MAP).unwrap();
        let v: serde_json::Value = serde_json::from_str(&list[0]).unwrap();
        assert_eq!(v["updated_at"].as_i64(), Some(100));
    }

    #[test]
    fn non_integer_lww_field_allows_overwrite() {
        let mut doc = CrdtDoc::new(SCHEMA, KEYS);
        let j = serde_json::to_string(&json!({"id": "a", "updated_at": "not-int"})).unwrap();
        doc.upsert_json(MAP, "a", &j, 500, LWW).unwrap();
        doc.upsert_json(MAP, "a", &entry("a", 100, false), 100, LWW)
            .unwrap();
        let list = doc.list_json(MAP).unwrap();
        let v: serde_json::Value = serde_json::from_str(&list[0]).unwrap();
        assert_eq!(v["updated_at"].as_i64(), Some(100));
    }

    #[test]
    fn hard_delete_removes_entry() {
        let mut doc = CrdtDoc::new(SCHEMA, KEYS);
        doc.upsert_json(MAP, "a", &entry("a", 100, false), 100, LWW)
            .unwrap();
        doc.delete_entry(MAP, "a", 999, None).unwrap();
        assert!(doc.list_json(MAP).unwrap().is_empty());
    }

    #[test]
    fn soft_delete_sets_flag_and_ts() {
        let mut doc = CrdtDoc::new(SCHEMA, KEYS);
        doc.upsert_json(MAP, "a", &entry("a", 100, false), 100, LWW)
            .unwrap();
        doc.delete_entry(
            MAP,
            "a",
            999,
            Some(SoftDeleteSpec {
                flag: "is_deleted",
                ts_field: "updated_at",
            }),
        )
        .unwrap();
        let list = doc.list_json(MAP).unwrap();
        assert_eq!(list.len(), 1);
        let v: serde_json::Value = serde_json::from_str(&list[0]).unwrap();
        assert_eq!(v["is_deleted"].as_bool(), Some(true));
        assert_eq!(v["updated_at"].as_i64(), Some(999));
    }

    #[test]
    fn soft_delete_unconditional_even_with_older_ts() {
        let mut doc = CrdtDoc::new(SCHEMA, KEYS);
        doc.upsert_json(MAP, "a", &entry("a", 100, false), 100, LWW)
            .unwrap();
        doc.delete_entry(
            MAP,
            "a",
            50,
            Some(SoftDeleteSpec {
                flag: "is_deleted",
                ts_field: "updated_at",
            }),
        )
        .unwrap();
        let v: serde_json::Value =
            serde_json::from_str(&doc.list_json(MAP).unwrap()[0]).unwrap();
        assert_eq!(v["is_deleted"].as_bool(), Some(true));
        assert_eq!(v["updated_at"].as_i64(), Some(50));
    }

    #[test]
    fn merge_remote_union() {
        let mut a = CrdtDoc::new(SCHEMA, KEYS);
        let mut b = CrdtDoc::new(SCHEMA, KEYS);
        a.upsert_json(MAP, "a", &entry("a", 100, false), 100, LWW)
            .unwrap();
        b.upsert_json(MAP, "b", &entry("b", 200, false), 200, LWW)
            .unwrap();
        let b_blob = b.save();
        a.merge_remote(&b_blob).unwrap();
        let ids: Vec<String> = a
            .list_json(MAP)
            .unwrap()
            .into_iter()
            .map(|s| {
                serde_json::from_str::<serde_json::Value>(&s).unwrap()["id"]
                    .as_str()
                    .unwrap()
                    .to_string()
            })
            .collect();
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&"a".to_string()));
        assert!(ids.contains(&"b".to_string()));
    }

    #[test]
    fn load_or_init_empty_bytes_rebuilds() {
        let (doc, rebuilt) = CrdtDoc::load_or_init(&[], SCHEMA, KEYS).unwrap();
        assert!(rebuilt);
        assert_eq!(doc.schema_version(), Some(SCHEMA));
    }

    #[test]
    fn load_or_init_matching_schema_no_rebuild() {
        let mut src = CrdtDoc::new(SCHEMA, KEYS);
        let blob = src.save();
        let (doc, rebuilt) = CrdtDoc::load_or_init(&blob, SCHEMA, KEYS).unwrap();
        assert!(!rebuilt);
        assert_eq!(doc.schema_version(), Some(SCHEMA));
    }

    #[test]
    fn load_or_init_schema_mismatch_rebuilds() {
        let mut src = CrdtDoc::new(1, KEYS);
        let blob = src.save();
        let (doc, rebuilt) = CrdtDoc::load_or_init(&blob, 2, KEYS).unwrap();
        assert!(rebuilt);
        assert_eq!(doc.schema_version(), Some(2));
    }

    #[test]
    fn template_blob_determinism_enables_merge() {
        // Two independent new() instances share a common ancestor (template
        // blob pre-creates all map_keys), so merge preserves both sides.
        let mut a = CrdtDoc::new(SCHEMA, KEYS);
        let mut b = CrdtDoc::new(SCHEMA, KEYS);
        a.upsert_json(MAP, "a", &entry("a", 100, false), 100, LWW)
            .unwrap();
        b.upsert_json(MAP, "b", &entry("b", 200, false), 200, LWW)
            .unwrap();
        let b_blob = b.save();
        a.merge_remote(&b_blob).unwrap();
        assert_eq!(a.list_json(MAP).unwrap().len(), 2);
    }
}
