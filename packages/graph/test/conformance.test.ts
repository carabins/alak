import { test, expect, describe } from 'bun:test'
import { parseSource } from '../src/index'

describe('§13 conformance', () => {
  test('13.1: minimal schema', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nrecord R { id: ID! }'
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    expect(ir!.schemas['s']!.records['R']).toBeDefined()
  })

  test('13.2: record with directive', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nrecord R @sync(qos: RELIABLE) { id: ID!, name: String! }'
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    const rec = ir!.schemas['s']!.records['R']!
    expect(rec.directives?.[0]?.name).toBe('sync')
    expect(rec.directives?.[0]?.args.qos).toBe('RELIABLE')
  })

  test('13.3: unknown directive → E001', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nrecord R @frobnicate { id: ID! }'
    const { diagnostics } = parseSource(src)
    const codes = diagnostics.map(d => d.code)
    expect(codes).toContain('E001')
  })

  test('13.4: LWW crdt without key → E004', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nrecord R @crdt(type: LWW_MAP) { id: ID!, updated_at: Timestamp! }'
    const { diagnostics } = parseSource(src)
    const codes = diagnostics.map(d => d.code)
    expect(codes).toContain('E004')
  })

  test('13.5: @this without scope → E006', () => {
    const src = 'schema S { version: 1, namespace: "s" }\naction Join { input: { roomId: ID! @this } output: Boolean! }'
    const { diagnostics } = parseSource(src)
    const codes = diagnostics.map(d => d.code)
    expect(codes).toContain('E006')
  })

  test('13.6: extend record merges fields', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nrecord R { id: ID! }\nextend record R { name: String! }'
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    expect(ir!.schemas['s']!.records['R']!.fields.length).toBe(2)
  })

  test('13.7: duplicate field via extend → E010', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nrecord R { id: ID! }\nextend record R { id: ID! }'
    const { diagnostics } = parseSource(src)
    const codes = diagnostics.map(d => d.code)
    expect(codes).toContain('E010')
  })

  test('13.8: REALTIME on composite field → W001', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nrecord Inner { x: Int! }\nrecord R { data: Inner! @sync(qos: REALTIME) }'
    const { diagnostics } = parseSource(src)
    const errors = diagnostics.filter(d => d.severity === 'error')
    expect(errors).toEqual([])
    const codes = diagnostics.map(d => d.code)
    expect(codes).toContain('W001')
  })

  // v0.3 conformance — Map type
  test('13.9: valid nested Map<ID, Map<ID, Enum>>', () => {
    const src = `schema S { version: 1, namespace: "s" }
enum VoteDir { UP DOWN }
record R { votes: Map<ID, Map<ID, VoteDir>>! }`
    const { ir, diagnostics } = parseSource(src)
    const errors = diagnostics.filter(d => d.severity === 'error')
    expect(errors).toEqual([])
    const field = ir!.schemas['s']!.records['R']!.fields[0]!
    expect(field.map).toBe(true)
    expect(field.mapKey?.type).toBe('ID')
    expect(field.mapValue?.map).toBe(true)
    expect(field.mapValue?.mapKey?.type).toBe('ID')
    expect(field.mapValue?.mapValue?.type).toBe('VoteDir')
  })

  test('13.10: Map<Record, V> → E022', () => {
    const src = `schema S { version: 1, namespace: "s" }
record Player { id: ID! }
record R { bad: Map<Player, Int>! }`
    const { diagnostics } = parseSource(src)
    const codes = diagnostics.map(d => d.code)
    expect(codes).toContain('E022')
  })
})
