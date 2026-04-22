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
