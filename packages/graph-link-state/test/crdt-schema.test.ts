// Unit tests for the CRDT schema emitter. Each test assembles a small IR
// by compiling a synthetic SDL string and inspects the generated schema
// const. Kept independent of the big Kotelok fixture so failures point at
// one feature.

import { test, expect, describe } from 'bun:test'
import { compileSources } from '../../graph/src/index'
import { generate } from '../src/index'
import { emitCrdtSchema, emitCrdtSchemaInto } from '../src/crdt-schema-gen'
import { LineBuffer } from '../src/utils'

function compile(sdl: string) {
  const { ir, diagnostics } = compileSources([{ path: 't.aql', source: sdl }])
  const errs = diagnostics.filter(d => d.severity === 'error')
  if (errs.length) {
    throw new Error('SDL errors:\n' + errs.map(e => e.message).join('\n'))
  }
  return ir!
}

function schemaBlockOf(src: string): string {
  // Extract everything between the `export const ...Schema = {` line and
  // the matching closing `}`. Returns '' if no schema block exists.
  const m = src.match(
    /export const \w+Schema: Record<string, FieldSchema> = \{[\s\S]*?\n\}/,
  )
  return m ? m[0] : ''
}

function schemaBodyOf(src: string): Record<string, string> {
  // Parse `'path': { type: 'x' }` lines into a plain object. Comment lines
  // and `// REALTIME ... (skipped)` entries are dropped.
  const block = schemaBlockOf(src)
  const body: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*'([^']+)':\s*(\{[^}]+\})/)
    if (m) body[m[1]] = m[2].trim()
  }
  return body
}

const HEADER = `schema T { version: 1, namespace: "t" }\n`

// ────────────────────────────────────────────────────────────────
// 1. Record-level @crdt + @scope
// ────────────────────────────────────────────────────────────────

describe('record-level @scope + @crdt(LWW_MAP)', () => {
  test('emits lww-map at the scope root and walks fields', () => {
    const ir = compile(HEADER + `
      record Doc @scope(name: "doc") @crdt(type: LWW_MAP, key: "updated_at") {
        id: ID!
        text: String!
        updated_at: Timestamp!
      }
    `)
    const src = generate(ir).files[0].content
    const body = schemaBodyOf(src)
    // Scope binds `doc.*`; fields LWW because record opts into replication
    // via scope + @crdt (see FINDINGS §4.2 + SPEC §7.2).
    expect(body['doc.*.id']).toBe(`{ type: 'lww' }`)
    expect(body['doc.*.text']).toBe(`{ type: 'lww' }`)
    expect(body['doc.*.updated_at']).toBe(`{ type: 'lww' }`)
  })
})

// ────────────────────────────────────────────────────────────────
// 2. Scalar @crdt(LWW_REGISTER)
// ────────────────────────────────────────────────────────────────

describe('scalar field with @crdt(type: LWW_REGISTER)', () => {
  test('emits { type: lww } at exact path', () => {
    const ir = compile(HEADER + `
      record R @scope(name: "r") @sync(qos: RELIABLE) {
        id: ID!
        count: Int! @crdt(type: LWW_REGISTER)
      }
    `)
    const body = schemaBodyOf(generate(ir).files[0].content)
    expect(body['r.*.count']).toBe(`{ type: 'lww' }`)
  })
})

// ────────────────────────────────────────────────────────────────
// 3. Map<K, V> → dual entry
// ────────────────────────────────────────────────────────────────

describe('Map<K, V> field without @crdt', () => {
  test('emits container lww-map + sub-key lww', () => {
    const ir = compile(HEADER + `
      record R @scope(name: "r") @sync(qos: RELIABLE) {
        id: ID!
        votes: Map<ID, Int>!
      }
    `)
    const body = schemaBodyOf(generate(ir).files[0].content)
    expect(body['r.*.votes']).toBe(`{ type: 'lww-map' }`)
    expect(body['r.*.votes.*']).toBe(`{ type: 'lww' }`)
  })

  test('Map<K, Map<K2, V>> emits nested lww-map at .*', () => {
    const ir = compile(HEADER + `
      record R @scope(name: "r") @sync(qos: RELIABLE) {
        id: ID!
        votes: Map<ID, Map<ID, Int>>!
      }
    `)
    const body = schemaBodyOf(generate(ir).files[0].content)
    expect(body['r.*.votes']).toBe(`{ type: 'lww-map' }`)
    expect(body['r.*.votes.*']).toBe(`{ type: 'lww-map' }`)
  })
})

// ────────────────────────────────────────────────────────────────
// 4. [T] → or-set default
// ────────────────────────────────────────────────────────────────

describe('list field without @crdt', () => {
  test('emits or-set at container and lww at .*', () => {
    const ir = compile(HEADER + `
      record R @scope(name: "r") @sync(qos: RELIABLE) {
        id: ID!
        tags: [String!]!
      }
    `)
    const body = schemaBodyOf(generate(ir).files[0].content)
    expect(body['r.*.tags']).toBe(`{ type: 'or-set' }`)
    expect(body['r.*.tags.*']).toBe(`{ type: 'lww' }`)
  })
})

// ────────────────────────────────────────────────────────────────
// 5. [T] with @crdt(type: RGA)
// ────────────────────────────────────────────────────────────────

describe('list field with @crdt(type: RGA)', () => {
  test('emits rga and does NOT emit a `.*` sub-entry (RGA is self-contained)', () => {
    const ir = compile(HEADER + `
      record R @scope(name: "r") @sync(qos: RELIABLE) {
        id: ID!
        log: [String!]! @crdt(type: RGA)
      }
    `)
    const body = schemaBodyOf(generate(ir).files[0].content)
    expect(body['r.*.log']).toBe(`{ type: 'rga' }`)
    // The explicit CRDT takes full ownership — no auto `.*` sub-entry.
    expect(body['r.*.log.*']).toBeUndefined()
  })
})

// ────────────────────────────────────────────────────────────────
// 6. Nested record → recursive path
// ────────────────────────────────────────────────────────────────

describe('nested record-typed field', () => {
  test('recurses under parent path without emitting container entry', () => {
    const ir = compile(HEADER + `
      record Inner {
        x: Int!
        y: Int!
      }
      record R @scope(name: "r") @sync(qos: RELIABLE) {
        id: ID!
        inner: Inner!
      }
    `)
    const body = schemaBodyOf(generate(ir).files[0].content)
    expect(body['r.*.inner.x']).toBe(`{ type: 'lww' }`)
    expect(body['r.*.inner.y']).toBe(`{ type: 'lww' }`)
    // Composite container itself has no entry: the bridge addresses fields.
    expect(body['r.*.inner']).toBeUndefined()
  })
})

// ────────────────────────────────────────────────────────────────
// 7. Ephemeral record (no @sync, no @crdt, no scope) → no entry
// ────────────────────────────────────────────────────────────────

describe('pure ephemeral records', () => {
  test('records without @sync/@crdt/@scope are skipped entirely', () => {
    const ir = compile(HEADER + `
      record Ephemeral {
        x: Int!
      }
    `)
    const src = generate(ir).files[0].content
    // Either no schema block at all, or the block does not reference
    // `Ephemeral.x`. The emitter chooses "no block" when every record
    // is ephemeral.
    expect(schemaBlockOf(src)).toBe('')
  })
})

// ────────────────────────────────────────────────────────────────
// 8. REALTIME → skipped with breadcrumb
// ────────────────────────────────────────────────────────────────

describe('REALTIME fields', () => {
  test('are omitted from the schema but leave a comment', () => {
    const ir = compile(HEADER + `
      record R @scope(name: "r") @sync(qos: RELIABLE) {
        id: ID!
        ping: Int! @sync(qos: REALTIME)
      }
    `)
    const src = generate(ir).files[0].content
    const body = schemaBodyOf(src)
    expect(body['r.*.ping']).toBeUndefined()
    expect(src).toContain(`r.*.ping — REALTIME`)
  })

  test('record-level REALTIME opts descendants out entirely', () => {
    const ir = compile(HEADER + `
      record R @sync(qos: REALTIME) {
        online: Int!
        ping: Int!
      }
    `)
    const src = generate(ir).files[0].content
    // Record-level REALTIME means the record is outright ephemeral — not
    // included in the schema at all.
    expect(schemaBlockOf(src)).toBe('')
  })
})

// ────────────────────────────────────────────────────────────────
// 9. Two namespaces → two separate exports
// ────────────────────────────────────────────────────────────────

describe('multi-namespace IR', () => {
  test('each namespace gets its own <ns>Schema export', () => {
    // compileSources groups by namespace; for multi-namespace we point at
    // two sources with distinct schema blocks.
    const { ir } = compileSources([
      { path: 'a.aql', source: `schema A { version: 1, namespace: "a" }\nrecord R @scope(name: "r") @sync(qos: RELIABLE) { id: ID! }` },
      { path: 'b.aql', source: `schema B { version: 1, namespace: "b" }\nrecord S @scope(name: "s") @sync(qos: RELIABLE) { id: ID! }` },
    ])
    const gen = generate(ir!)
    expect(gen.files.length).toBe(2)
    const a = gen.files.find(f => f.path === 'a.generated.ts')!.content
    const b = gen.files.find(f => f.path === 'b.generated.ts')!.content
    expect(a).toContain('export const aSchema: Record<string, FieldSchema>')
    expect(b).toContain('export const bSchema: Record<string, FieldSchema>')
    expect(a).not.toContain('bSchema')
    expect(b).not.toContain('aSchema')
  })
})

// ────────────────────────────────────────────────────────────────
// 10. Kotelok-shape snapshot — minimum set of paths
// ────────────────────────────────────────────────────────────────

describe('Kotelok-shape schema', () => {
  test('mirrors the hand-written Kotelok-2 paths (core subset)', () => {
    // This is what Kotelok-2's store.ts wrote by hand. The generator must
    // emit at least these entries. Extra entries (from richer recursion)
    // are fine — that's the win.
    const ir = compile(HEADER + `
      record Player {
        id: ID!
        name: String!
        clientId: String!
      }
      record GameRoom @scope(name: "room") @sync(qos: RELIABLE) {
        id: ID!
        players: [Player!]!
      }
    `)
    const body = schemaBodyOf(generate(ir).files[0].content)
    expect(body['room.*.id']).toBe(`{ type: 'lww' }`)
    expect(body['room.*.players']).toBe(`{ type: 'or-set' }`)
    expect(body['room.*.players.*.id']).toBe(`{ type: 'lww' }`)
    expect(body['room.*.players.*.name']).toBe(`{ type: 'lww' }`)
    expect(body['room.*.players.*.clientId']).toBe(`{ type: 'lww' }`)
  })
})

// ────────────────────────────────────────────────────────────────
// 11. @crdt type alias mapping
// ────────────────────────────────────────────────────────────────

describe('directive → CRDT string mapping', () => {
  test.each([
    ['LWW_REGISTER', 'lww'],
    ['LWW_MAP', 'lww-map'],
    ['OR_SET', 'or-set'],
    ['PN_COUNTER', 'pn-counter'],
    ['RGA', 'rga'],
  ])('@crdt(type: %s) → %s', (directiveType, expected) => {
    // Map the directive to a field-typed @crdt. OR_SET / RGA need a list;
    // counters / registers / maps prefer non-list — we use `Int!` everywhere
    // since the emitter doesn't validate the shape (that's the validator's
    // job).
    const fieldType = directiveType === 'OR_SET' || directiveType === 'RGA'
      ? '[String!]!'
      : directiveType === 'LWW_MAP'
        ? 'Map<ID, String>!'
        : 'Int!'
    const ir = compile(HEADER + `
      record R @scope(name: "r") @sync(qos: RELIABLE) {
        id: ID!
        f: ${fieldType} @crdt(type: ${directiveType})
      }
    `)
    const body = schemaBodyOf(generate(ir).files[0].content)
    expect(body['r.*.f']).toBe(`{ type: '${expected}' }`)
  })

  test('@crdt(type: G_COUNTER) is collapsed to pn-counter', () => {
    // The runtime's FieldSchema union doesn't include g-counter; a G-Counter
    // is a positive-only special case of PN-Counter. Emit pn-counter so the
    // generated file stays valid TS.
    const ir = compile(HEADER + `
      record R @scope(name: "r") @sync(qos: RELIABLE) {
        id: ID!
        hits: Int! @crdt(type: G_COUNTER)
      }
    `)
    const body = schemaBodyOf(generate(ir).files[0].content)
    expect(body['r.*.hits']).toBe(`{ type: 'pn-counter' }`)
  })
})

// ────────────────────────────────────────────────────────────────
// 12. Standalone emitCrdtSchema() entry
// ────────────────────────────────────────────────────────────────

describe('emitCrdtSchema standalone API', () => {
  test('returns a source fragment for one IRSchema', () => {
    const ir = compile(HEADER + `
      record R @scope(name: "r") @sync(qos: RELIABLE) {
        id: ID!
      }
    `)
    const schema = ir.schemas['t']
    const out = emitCrdtSchema(schema)
    expect(out).toContain(`export const tSchema: Record<string, FieldSchema>`)
    expect(out).toContain(`'r.*.id': { type: 'lww' }`)
  })

  test('returns empty string when the namespace is fully ephemeral', () => {
    const ir = compile(HEADER + `
      record R @sync(qos: REALTIME) {
        x: Int!
      }
    `)
    const schema = ir.schemas['t']
    expect(emitCrdtSchema(schema)).toBe('')
  })

  test('custom constName is respected', () => {
    const ir = compile(HEADER + `
      record R @scope(name: "r") @sync(qos: RELIABLE) {
        id: ID!
      }
    `)
    const schema = ir.schemas['t']
    const buf = new LineBuffer()
    const emitted = emitCrdtSchemaInto(buf, schema, { constName: 'customSchema' })
    expect(emitted).toBe(true)
    expect(buf.toString()).toContain(`export const customSchema: Record<string, FieldSchema>`)
  })
})

// ────────────────────────────────────────────────────────────────
// 13. crdtSchema: false opts out entirely (pre-v0.3 shape)
// ────────────────────────────────────────────────────────────────

describe('crdtSchema: false', () => {
  test('no schema block, no FieldSchema import', () => {
    const ir = compile(HEADER + `
      record R @scope(name: "r") @sync(qos: RELIABLE) {
        id: ID!
      }
    `)
    const src = generate(ir, { crdtSchema: false }).files[0].content
    expect(src).not.toContain('FieldSchema')
    expect(src).not.toContain('Schema: Record<string, FieldSchema>')
  })
})

// ────────────────────────────────────────────────────────────────
// 14. Default output (no opts) ships the schema
// ────────────────────────────────────────────────────────────────

describe('default generate() behavior', () => {
  test('crdtSchema defaults to true', () => {
    const ir = compile(HEADER + `
      record R @scope(name: "r") @sync(qos: RELIABLE) {
        id: ID!
      }
    `)
    const src = generate(ir).files[0].content
    expect(src).toContain('export const tSchema: Record<string, FieldSchema>')
  })
})

// ────────────────────────────────────────────────────────────────
// 15. Deterministic output across runs
// ────────────────────────────────────────────────────────────────

describe('determinism', () => {
  test('two consecutive generations produce byte-identical output', () => {
    const ir = compile(HEADER + `
      record Inner { x: Int! y: Int! }
      record R @scope(name: "r") @sync(qos: RELIABLE) {
        id: ID!
        inner: Inner!
        tags: [String!]!
        votes: Map<ID, Int>!
      }
    `)
    const a = generate(ir).files[0].content
    const b = generate(ir).files[0].content
    expect(a).toBe(b)
  })
})
