import { test, expect, describe } from 'bun:test'
import { parseSource } from '../src/index'

const base = 'schema S { version: 1, namespace: "s" }\n'

const codesOf = (src: string) =>
  parseSource(src).diagnostics.map(d => d.code)

describe('validator — errors E001–E020', () => {
  test('E001 unknown directive', () => {
    expect(codesOf(base + 'record R @frobnicate { id: ID! }')).toContain('E001')
  })

  test('E002 directive arg not in signature', () => {
    expect(codesOf(base + 'record R @sync(bogus: RELIABLE) { id: ID! }')).toContain('E002')
  })

  test('E003 directive arg wrong type', () => {
    expect(codesOf(base + 'record R @sync(qos: 42) { id: ID! }')).toContain('E003')
  })

  test('E004 LWW crdt without key', () => {
    expect(codesOf(base + 'record R @crdt(type: LWW_MAP) { id: ID!, updated_at: Timestamp! }')).toContain('E004')
  })

  test('E005 crdt key refers to nonexistent field', () => {
    expect(codesOf(base + 'record R @crdt(type: LWW_MAP, key: "nope") { id: ID!, updated_at: Timestamp! }')).toContain('E005')
  })

  test('E005 crdt key refers to wrong type', () => {
    expect(codesOf(base + 'record R @crdt(type: LWW_MAP, key: "name") { id: ID!, name: String!, updated_at: Timestamp! }')).toContain('E005')
  })

  test('E006 @this without scope', () => {
    expect(codesOf(base + 'action Join { input: { roomId: ID! @this } output: Boolean! }')).toContain('E006')
  })

  // E007 — cross-file namespace collision: not implemented for single-file.

  // E008 — `use` path resolution: deferred. Validator silently accepts.
  test('E008 — use paths silently accepted (deferred)', () => {
    const codes = codesOf(base + 'use "./nowhere" { X }')
    expect(codes).not.toContain('E008')
  })

  test('E009 field type references undefined type', () => {
    expect(codesOf(base + 'record R { x: NoSuchType! }')).toContain('E009')
  })

  test('E010 duplicate field across record and extend', () => {
    expect(codesOf(base + 'record R { id: ID! }\nextend record R { id: ID! }')).toContain('E010')
  })

  test('E010 duplicate field within a single record', () => {
    expect(codesOf(base + 'record R { id: ID!  id: ID! }')).toContain('E010')
  })

  test('E011 extend record without target', () => {
    expect(codesOf(base + 'extend record Missing { name: String! }')).toContain('E011')
  })

  test('E012 enum default not a member', () => {
    const src = base + 'enum C { RED, GREEN }\nrecord R { c: C! @default(value: BLUE) }'
    expect(codesOf(src)).toContain('E012')
  })

  test('E013 default value type mismatch', () => {
    expect(codesOf(base + 'record R { n: Int! @default(value: "oops") }')).toContain('E013')
  })

  // E014 — cyclic type dependency without LAZY break. Not implemented as a
  // hard-enforced validator (cycle detection would require a strongly-
  // connected-components pass). We do not emit E014 in v0.1.0-draft.
  test('E014 — cycle detection skipped (deferred)', () => {
    const codes = codesOf(base + 'record A { b: B! }\nrecord B { a: A! }')
    expect(codes).not.toContain('E014')
  })

  test('E015 @range on non-numeric', () => {
    expect(codesOf(base + 'record R { name: String! @range(min: 1, max: 10) }')).toContain('E015')
  })

  test('E016 @range min > max', () => {
    expect(codesOf(base + 'record R { n: Int! @range(min: 10, max: 1) }')).toContain('E016')
  })

  test('E017 two schema blocks', () => {
    const src = 'schema A { version: 1, namespace: "a" }\nschema B { version: 1, namespace: "b" }'
    expect(codesOf(src)).toContain('E017')
  })

  test('E018 missing namespace', () => {
    expect(codesOf('schema S { version: 1 }')).toContain('E018')
  })

  test('E018 missing version', () => {
    expect(codesOf('schema S { namespace: "s" }')).toContain('E018')
  })

  test('E018 missing schema block', () => {
    expect(codesOf('record R { id: ID! }')).toContain('E018')
  })

  test('E019 action scope with no scoped records', () => {
    expect(codesOf(base + 'action X { scope: "ghost" }')).toContain('E019')
  })

  test('E020 opaque stream max_size <= 0', () => {
    const src = base + 'opaque stream S { qos: best_effort_push max_size: 0 }'
    expect(codesOf(src)).toContain('E020')
  })

  // v0.3 — Map key must be scalar
  test('E022 — Map<RecordType, V> fires', () => {
    const src = base + `
      record Player { id: ID! }
      record R { m: Map<Player, String>! }`
    expect(codesOf(src)).toContain('E022')
  })

  test('E022 — Map<EnumType, V> fires (enums not wire-scalar)', () => {
    const src = base + `
      enum Dir { UP DOWN }
      record R { m: Map<Dir, String>! }`
    expect(codesOf(src)).toContain('E022')
  })

  test('Map<ID, V> — no E022, keys are scalar', () => {
    const src = base + `record R { m: Map<ID, String>! }`
    expect(codesOf(src)).not.toContain('E022')
  })

  test('Map<UserScalar, V> — user scalars are valid keys', () => {
    const src = base + `
      scalar DeviceID
      record R { m: Map<DeviceID, Int>! }`
    expect(codesOf(src)).not.toContain('E022')
  })

  test('E009 — Map<X, V> with unknown X still fires', () => {
    const src = base + `record R { m: Map<NoSuchType, String>! }`
    expect(codesOf(src)).toContain('E009')
  })

  // E023 — required directive args (v0.3.3, closes stress-journal О19).
  // SPEC §7.11 says `@deprecated(since: String!, ...)`; the `!` on `since`
  // was not enforced before W2 — see stress.md Belladonna step 3.
  describe('E023 — missing required directive args', () => {
    test('@added without `in` → E023', () => {
      expect(codesOf(base + 'record R { x: Int! @added }')).toContain('E023')
    })

    test('@added with `in` → clean', () => {
      expect(codesOf(base + 'record R { x: Int! @added(in: "0.2") }')).not.toContain('E023')
    })

    test('@deprecated without `since` → E023', () => {
      // `reason` alone is not enough; `since` is the required one.
      expect(codesOf(base + 'record R { x: Int! @deprecated(reason: "x") }')).toContain('E023')
    })

    test('@deprecated with `since` only → clean (`reason` is optional)', () => {
      expect(codesOf(base + 'record R { x: Int! @deprecated(since: "0.2") }')).not.toContain('E023')
    })

    test('@default without `value` → E023', () => {
      expect(codesOf(base + 'record R { x: Int! @default }')).toContain('E023')
    })

    test('@range without min → E023', () => {
      expect(codesOf(base + 'record R { n: Int! @range(max: 10) }')).toContain('E023')
    })

    test('@range without max → E023', () => {
      expect(codesOf(base + 'record R { n: Int! @range(min: 1) }')).toContain('E023')
    })

    test('@range with both → clean', () => {
      expect(codesOf(base + 'record R { n: Int! @range(min: 1, max: 10) }')).not.toContain('E023')
    })

    test('@scope without name → E023', () => {
      expect(codesOf(base + 'record R @scope { id: ID! }')).toContain('E023')
    })

    test('@topic without pattern → E023', () => {
      expect(codesOf(base + 'record R @topic { id: ID! }')).toContain('E023')
    })

    test('@liveness without source/timeout → E023 (two of them)', () => {
      const codes = codesOf(base + 'record R @liveness { id: ID! }')
      // Two required args missing → two diagnostics at the directive loc.
      expect(codes.filter(c => c === 'E023').length).toBe(2)
    })

    test('@liveness with source+timeout → clean (on_lost is optional)', () => {
      const src = base +
        'record R @liveness(source: "ws:x", timeout: 3000) { id: ID! }'
      expect(codesOf(src)).not.toContain('E023')
    })

    test('@sync without args — clean (all sync args optional)', () => {
      expect(codesOf(base + 'record R @sync { id: ID! }')).not.toContain('E023')
    })

    test('@auth without args — clean (both auth args optional)', () => {
      expect(codesOf(base + 'record R @auth { id: ID! }')).not.toContain('E023')
    })

    test('@atomic — zero-arg directive, never E023', () => {
      expect(codesOf(base + 'record R @atomic { id: ID! }')).not.toContain('E023')
    })

    test('@crdt without required — NOT E023 (LWW key handled by E004)', () => {
      // @crdt has no hard-required args at signature level. `key` becomes
      // required only for LWW_* types; that remains E004's job.
      expect(codesOf(base + 'record R @crdt(type: OR_SET) { id: ID!, updated_at: Timestamp! }'))
        .not.toContain('E023')
    })
  })

  // v0.3.6 — `Any` placement (SPEC §4.1 + E026)
  describe('E026 — `Any` placement', () => {
    test('`Any` as a record field → clean', () => {
      expect(codesOf(base + 'record R { x: Any }')).not.toContain('E026')
    })

    test('`Any!` (required) as a record field → clean', () => {
      expect(codesOf(base + 'record R { x: Any! }')).not.toContain('E026')
    })

    test('`Map<String, Any>` value → clean', () => {
      expect(codesOf(base + 'record R { extras: Map<String, Any>! }')).not.toContain('E026')
    })

    test('`Map<Any, String>` key → E026', () => {
      expect(codesOf(base + 'record R { m: Map<Any, String>! }')).toContain('E026')
    })

    test('`[Any]` list element → E026', () => {
      expect(codesOf(base + 'record R { xs: [Any] }')).toContain('E026')
    })

    test('`[Any!]!` required list of required Any → E026', () => {
      expect(codesOf(base + 'record R { xs: [Any!]! }')).toContain('E026')
    })

    test('`Any` in action input → E026', () => {
      const src = base +
        'record R { id: ID! }\n' +
        'action A { scope: "r", input: { payload: Any! } output: Boolean! }'
      expect(codesOf(src)).toContain('E026')
    })

    test('`Any` in action output → E026', () => {
      expect(codesOf(base + 'action A { output: Any! }')).toContain('E026')
    })

    test('`Any` in event field → E026', () => {
      expect(codesOf(base + 'event E { payload: Any! }')).toContain('E026')
    })

    test('`Map<String, [Any]>` — list-of-Any inside map value still fires E026', () => {
      expect(codesOf(base + 'record R { m: Map<String, [Any]>! }')).toContain('E026')
    })

    test('clean schema without Any — no E026 noise', () => {
      expect(codesOf(base + 'record R { id: ID!, name: String! }')).not.toContain('E026')
    })
  })

  // v0.3.6 — composite CRDT document consistency (SPEC §7.15–§7.17 + E027)
  describe('E027 — composite CRDT document', () => {
    const composite = (body: string) =>
      'schema S @crdt_doc_topic(doc: "D", pattern: "ns/{id}/patch") { version: 1, namespace: "s" }\n' + body

    test('topic + matching member + @crdt → clean', () => {
      const src = composite(
        'record P @crdt_doc_member(doc: "D", map: "points") @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      )
      expect(codesOf(src)).not.toContain('E027')
    })

    test('member without matching topic → E027', () => {
      const src = base +
        'record P @crdt_doc_member(doc: "Missing", map: "points") @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      expect(codesOf(src)).toContain('E027')
    })

    test('topic without any member → E027', () => {
      const src =
        'schema S @crdt_doc_topic(doc: "Orphan", pattern: "ns/x") { version: 1, namespace: "s" }\n' +
        'record R { id: ID! }'
      expect(codesOf(src)).toContain('E027')
    })

    test('member without @crdt → E027', () => {
      const src = composite(
        'record P @crdt_doc_member(doc: "D", map: "points") {\n' +
        '  id: ID!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      )
      expect(codesOf(src)).toContain('E027')
    })

    test('member with @scope → E027 (R233 forbids combo)', () => {
      const src = composite(
        'record P @crdt_doc_member(doc: "D", map: "points")\n' +
        '         @crdt(type: LWW_MAP, key: "updated_at")\n' +
        '         @scope(name: "room") {\n' +
        '  id: ID!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      )
      expect(codesOf(src)).toContain('E027')
    })

    test('two members of doc share same map slot → E027', () => {
      const src = composite(
        'record P @crdt_doc_member(doc: "D", map: "points") @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  updated_at: Timestamp!\n' +
        '}\n' +
        'record Q @crdt_doc_member(doc: "D", map: "points") @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      )
      expect(codesOf(src)).toContain('E027')
    })

    test('two topics for same doc → E027', () => {
      const src =
        'schema S @crdt_doc_topic(doc: "D", pattern: "a")\n' +
        '         @crdt_doc_topic(doc: "D", pattern: "b") {\n' +
        '  version: 1, namespace: "s"\n' +
        '}\n' +
        'record P @crdt_doc_member(doc: "D", map: "points") @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      expect(codesOf(src)).toContain('E027')
    })

    test('@schema_version without matching topic → E027', () => {
      const src =
        'schema S @schema_version(doc: "Missing", value: 2) { version: 1, namespace: "s" }\n' +
        'record R { id: ID! }'
      expect(codesOf(src)).toContain('E027')
    })

    test('@schema_version with matching topic + member → clean', () => {
      const src =
        'schema S @crdt_doc_topic(doc: "D", pattern: "ns/{id}/patch")\n' +
        '         @schema_version(doc: "D", value: 2) {\n' +
        '  version: 1, namespace: "s"\n' +
        '}\n' +
        'record P @crdt_doc_member(doc: "D", map: "points") @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      expect(codesOf(src)).not.toContain('E027')
    })

    test('two @schema_version for same doc → E027', () => {
      const src =
        'schema S @crdt_doc_topic(doc: "D", pattern: "ns/x")\n' +
        '         @schema_version(doc: "D", value: 1)\n' +
        '         @schema_version(doc: "D", value: 2) {\n' +
        '  version: 1, namespace: "s"\n' +
        '}\n' +
        'record P @crdt_doc_member(doc: "D", map: "points") @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      expect(codesOf(src)).toContain('E027')
    })

    test('full Busynca-like composite: two members, schema_version, topic → clean', () => {
      const src =
        'schema Busynca @crdt_doc_topic(doc: "GroupSync", pattern: "valkyrie/{group}/sync/patch")\n' +
        '               @schema_version(doc: "GroupSync", value: 2) {\n' +
        '  version: 1\n' +
        '  namespace: "valkyrie"\n' +
        '}\n' +
        'record SyncPoint @crdt_doc_member(doc: "GroupSync", map: "points")\n' +
        '                 @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  updated_at: Timestamp!\n' +
        '  extras: Map<String, Any>!\n' +
        '}\n' +
        'record DeviceEntry @crdt_doc_member(doc: "GroupSync", map: "devices")\n' +
        '                   @crdt(type: LWW_MAP, key: "ts") {\n' +
        '  device_id: ID!\n' +
        '  ts: Timestamp!\n' +
        '  name: String!\n' +
        '}'
      const codes = codesOf(src)
      expect(codes).not.toContain('E027')
      expect(codes).not.toContain('E026')
      expect(codes).not.toContain('E023')
      expect(codes).not.toContain('E004')
      expect(codes).not.toContain('E005')
    })
  })

  // v0.3.7 — @rename_case on enum/record (SPEC §7.18 + E028)
  describe('E028 — @rename_case placement', () => {
    test('@rename_case on enum → clean', () => {
      expect(codesOf(base + 'enum E @rename_case(kind: PASCAL) { A B }'))
        .not.toContain('E028')
    })

    test('@rename_case on record → clean', () => {
      expect(codesOf(base + 'record R @rename_case(kind: CAMEL) { id: ID! }'))
        .not.toContain('E028')
    })

    test('@rename_case on field → E028', () => {
      expect(codesOf(base + 'record R { id: ID! @rename_case(kind: CAMEL) }'))
        .toContain('E028')
    })

    test('@rename_case on action argument → E028', () => {
      const src = base +
        'record R { id: ID! }\n' +
        'action A { scope: "r", input: { x: Int! @rename_case(kind: SNAKE) } output: Boolean! }'
      expect(codesOf(src)).toContain('E028')
    })

    test('@rename_case on event → E028', () => {
      expect(codesOf(base + 'event E @rename_case(kind: PASCAL) { x: Int! }'))
        .toContain('E028')
    })

    test('@rename_case without kind → E023', () => {
      expect(codesOf(base + 'enum E @rename_case { A B }')).toContain('E023')
    })

    test('@rename_case(kind: BOGUS) → E003', () => {
      expect(codesOf(base + 'enum E @rename_case(kind: BOGUS) { A B }')).toContain('E003')
    })

    test('every closed-set kind accepted', () => {
      for (const kind of ['PASCAL', 'CAMEL', 'SNAKE', 'SCREAMING_SNAKE', 'KEBAB', 'LOWER', 'UPPER']) {
        const codes = codesOf(base + `enum E @rename_case(kind: ${kind}) { A B }`)
        expect(codes).not.toContain('E003')
        expect(codes).not.toContain('E028')
      }
    })
  })

  // v0.3.7 — @crdt_doc_member lww_field + soft_delete (SPEC §7.15 R234–R235)
  describe('E027 — lww_field / soft_delete consistency', () => {
    const compositeBase =
      'schema S @crdt_doc_topic(doc: "D", pattern: "ns/{id}/patch") { version: 1, namespace: "s" }\n'

    test('lww_field matching @crdt(key) → clean', () => {
      const src = compositeBase +
        'record P @crdt_doc_member(doc: "D", map: "points", lww_field: "updated_at")\n' +
        '         @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      expect(codesOf(src)).not.toContain('E027')
    })

    test('lww_field naming missing field → E027', () => {
      const src = compositeBase +
        'record P @crdt_doc_member(doc: "D", map: "points", lww_field: "nope")\n' +
        '         @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      expect(codesOf(src)).toContain('E027')
    })

    test('lww_field naming non-Timestamp/Int field → E027', () => {
      const src = compositeBase +
        'record P @crdt_doc_member(doc: "D", map: "points", lww_field: "label")\n' +
        '         @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  label: String!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      expect(codesOf(src)).toContain('E027')
    })

    test('lww_field disagreeing with @crdt(key) → E027', () => {
      const src = compositeBase +
        'record P @crdt_doc_member(doc: "D", map: "points", lww_field: "ts")\n' +
        '         @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  ts: Timestamp!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      expect(codesOf(src)).toContain('E027')
    })

    test('soft_delete well-formed → clean', () => {
      const src = compositeBase +
        'record P @crdt_doc_member(doc: "D", map: "points",\n' +
        '                          lww_field: "updated_at",\n' +
        '                          soft_delete: { flag: "is_deleted", ts_field: "updated_at" })\n' +
        '         @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  is_deleted: Boolean!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      expect(codesOf(src)).not.toContain('E027')
    })

    test('soft_delete.flag missing from record → E027', () => {
      const src = compositeBase +
        'record P @crdt_doc_member(doc: "D", map: "points",\n' +
        '                          soft_delete: { flag: "gone", ts_field: "updated_at" })\n' +
        '         @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      expect(codesOf(src)).toContain('E027')
    })

    test('soft_delete.flag pointing at non-Boolean → E027', () => {
      const src = compositeBase +
        'record P @crdt_doc_member(doc: "D", map: "points",\n' +
        '                          soft_delete: { flag: "name", ts_field: "updated_at" })\n' +
        '         @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  name: String!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      expect(codesOf(src)).toContain('E027')
    })

    test('soft_delete.ts_field pointing at missing field → E027', () => {
      const src = compositeBase +
        'record P @crdt_doc_member(doc: "D", map: "points",\n' +
        '                          soft_delete: { flag: "is_deleted", ts_field: "nope" })\n' +
        '         @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  is_deleted: Boolean!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      expect(codesOf(src)).toContain('E027')
    })

    test('soft_delete missing "flag" key → E027', () => {
      const src = compositeBase +
        'record P @crdt_doc_member(doc: "D", map: "points",\n' +
        '                          soft_delete: { ts_field: "updated_at" })\n' +
        '         @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  is_deleted: Boolean!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      expect(codesOf(src)).toContain('E027')
    })

    test('@crdt_doc_member without lww_field/soft_delete still works (0.3.6 shape)', () => {
      const src = compositeBase +
        'record P @crdt_doc_member(doc: "D", map: "points")\n' +
        '         @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      expect(codesOf(src)).not.toContain('E027')
    })
  })
})

describe('validator — warnings W001–W004', () => {
  test('W001 REALTIME on composite', () => {
    const src = base + 'record Inner { x: Int! }\nrecord R { d: Inner! @sync(qos: REALTIME) }'
    expect(codesOf(src)).toContain('W001')
  })

  test('W001 skipped for @atomic', () => {
    const src = base + 'record Inner { x: Int! }\nrecord R { d: Inner! @sync(qos: REALTIME) @atomic }'
    expect(codesOf(src)).not.toContain('W001')
  })

  test('W002 @store without @sync', () => {
    expect(codesOf(base + 'record R { name: String! @store }')).toContain('W002')
  })

  test('W003 @crdt without updated_at', () => {
    expect(codesOf(base + 'record R @crdt(type: OR_SET) { id: ID! }')).toContain('W003')
  })

  // W004 — advisory; reserved for generator context.
  test('W004 — not emitted by core validator (advisory)', () => {
    // Any valid schema — W004 should not appear.
    expect(codesOf(base + 'record R { id: ID! }')).not.toContain('W004')
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Wave 3A — DRIFT FIXES (v0.3.9)
// ──────────────────────────────────────────────────────────────────────────
//
// Four drifts found during Wave 2's §7 header pass:
//   DRIFT-1: `@auth(read/write)` closed-set was not enforced.
//   DRIFT-2: site-validation was scattered across bespoke per-directive
//            checks; centralised via `DirectiveSignature.sites` + E029.
//   DRIFT-3: `@crdt(key)` conditional-required encoded as a per-arg
//            `requiredIf` predicate (not a separate hard-coded rule).
//   DRIFT-4: `@range(min/max)` had `'any'` argType; now `'number'`.
describe('Wave 3A — drift fixes', () => {
  test('DRIFT-1: @auth(read: "blah") fires E003 (closed Access set)', () => {
    const src = base + 'record R @auth(read: "blah") { id: ID! }'
    expect(codesOf(src)).toContain('E003')
  })

  test('DRIFT-1: @auth(read: "owner") is clean', () => {
    const src = base + 'record R @auth(read: "owner") { id: ID! }'
    expect(codesOf(src)).not.toContain('E003')
  })

  test('DRIFT-1: @auth(write: "server") is clean', () => {
    const src = base + 'record R @auth(write: "server") { id: ID! }'
    expect(codesOf(src)).not.toContain('E003')
  })

  test('DRIFT-2: @scope on a field fires E029 (RECORD-only directive)', () => {
    const src = base + 'record R { id: ID! @scope(name: "room") }'
    expect(codesOf(src)).toContain('E029')
  })

  test('DRIFT-2: @atomic on a schema fires E029 (FIELD/RECORD-only)', () => {
    const src = 'schema S @atomic { version: 1, namespace: "s" }\nrecord R { id: ID! }'
    expect(codesOf(src)).toContain('E029')
  })

  test('DRIFT-2: @transport on a record fires E029 (SCHEMA-only)', () => {
    const src = base + 'record R @transport(kind: "tauri") { id: ID! }'
    expect(codesOf(src)).toContain('E029')
  })

  test('DRIFT-3: @crdt(type: LWW_MAP) without key still fires E004 (tailored)', () => {
    // `requiredIf` predicate fires, but the validator suppresses the generic
    // E023 in favour of the dedicated E004 message.
    const src = base + 'record R @crdt(type: LWW_MAP) { id: ID!, updated_at: Timestamp! }'
    const codes = codesOf(src)
    expect(codes).toContain('E004')
    expect(codes).not.toContain('E023')
  })

  test('DRIFT-3: @crdt(type: OR_SET) without key is clean (predicate is false)', () => {
    const src = base + 'record R @crdt(type: OR_SET) { id: ID! }'
    const codes = codesOf(src)
    expect(codes).not.toContain('E004')
    expect(codes).not.toContain('E023')
  })

  test('DRIFT-4: @range(min: "x", max: 10) on Int field fires E003 (number-typed)', () => {
    const src = base + 'record R { n: Int! @range(min: "x", max: 10) }'
    expect(codesOf(src)).toContain('E003')
  })

  test('DRIFT-4: @range(min: 1.5, max: 9.5) on Float field is clean', () => {
    const src = base + 'record R { f: Float! @range(min: 1.5, max: 9.5) }'
    const codes = codesOf(src)
    expect(codes).not.toContain('E003')
    expect(codes).not.toContain('E015')
  })
})
