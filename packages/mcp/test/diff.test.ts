import { test, expect, describe } from 'bun:test'
import { compileSources } from '@alaq/graph'
import { diffIR } from '../src/diff'

function ir(source: string) {
  const res = compileSources([{ path: 't.aql', source }])
  if (!res.ir) throw new Error('compile failed: ' + JSON.stringify(res.diagnostics))
  return res.ir
}

const baseSchema = `schema S { version: 1, namespace: "s" }
record Player { id: ID!, name: String! }
record Game @scope(name: "room") { id: ID! }
action Join { scope: "room", input: { name: String! }, output: Player! }
enum Color { RED, GREEN }`

describe('diffIR', () => {
  test('identical schemas → no changes', () => {
    const a = ir(baseSchema)
    const b = ir(baseSchema)
    const r = diffIR(a, b)
    expect(r.changes).toHaveLength(0)
    expect(r.summary).toEqual({ breaking: 0, non_breaking: 0, review: 0 })
  })

  test('adding optional field is non-breaking', () => {
    const a = ir(baseSchema)
    const b = ir(baseSchema.replace('name: String!', 'name: String!, nick: String'))
    const r = diffIR(a, b)
    expect(r.summary.breaking).toBe(0)
    expect(r.summary.non_breaking).toBe(1)
    expect(r.changes[0].detail).toMatch(/field added/)
  })

  test('adding required field is breaking', () => {
    const a = ir(baseSchema)
    const b = ir(baseSchema.replace('name: String!', 'name: String!, age: Int!'))
    const r = diffIR(a, b)
    expect(r.summary.breaking).toBe(1)
    expect(r.changes[0].kind).toBe('breaking')
  })

  test('removing required field is breaking', () => {
    const a = ir(baseSchema)
    const b = ir(baseSchema.replace(', name: String!', ''))
    const r = diffIR(a, b)
    expect(r.summary.breaking).toBe(1)
    expect(r.changes[0].detail).toMatch(/field removed/)
  })

  test('removing record is breaking', () => {
    const a = ir(baseSchema)
    const b = ir(baseSchema.replace(/record Player [^}]+}/, ''))
    const r = diffIR(a, b)
    expect(r.changes.some(c => c.kind === 'breaking' && c.detail.includes('record removed'))).toBe(
      true,
    )
  })

  test('tightening optional → required is breaking (write-side)', () => {
    const a = ir(baseSchema.replace('name: String!', 'name: String'))
    const b = ir(baseSchema)
    const r = diffIR(a, b)
    expect(r.summary.breaking).toBe(1)
    expect(r.changes[0].detail).toMatch(/String → String!/)
    expect(r.changes[0].detail).toMatch(/writers/)
  })

  test('loosening required → optional is review (read-side hazard)', () => {
    const a = ir(baseSchema)
    const b = ir(baseSchema.replace('name: String!', 'name: String'))
    const r = diffIR(a, b)
    expect(r.summary.breaking).toBe(0)
    expect(r.summary.review).toBe(1)
    expect(r.changes[0].kind).toBe('review')
    expect(r.changes[0].detail).toMatch(/readers expecting non-null/)
  })

  test('list item loosening [T!]! → [T]! is review', () => {
    const src = baseSchema.replace(
      'record Game @scope(name: "room") { id: ID! }',
      'record Game @scope(name: "room") { id: ID!, players: [Player!]! }',
    )
    const a = ir(src)
    const b = ir(src.replace('[Player!]!', '[Player]!'))
    const r = diffIR(a, b)
    expect(r.summary.review).toBe(1)
    expect(r.changes[0].detail).toMatch(/\[Player!\]! → \[Player\]!/)
  })

  test('adding enum value is non-breaking', () => {
    const a = ir(baseSchema)
    const b = ir(baseSchema.replace('RED, GREEN', 'RED, GREEN, BLUE'))
    const r = diffIR(a, b)
    expect(r.summary.non_breaking).toBe(1)
    expect(r.changes[0].detail).toMatch(/value added: BLUE/)
  })

  test('removing enum value is breaking', () => {
    const a = ir(baseSchema)
    const b = ir(baseSchema.replace('RED, GREEN', 'RED'))
    const r = diffIR(a, b)
    expect(r.summary.breaking).toBe(1)
    expect(r.changes[0].detail).toMatch(/value removed: GREEN/)
  })

  test('action output type change is breaking', () => {
    const a = ir(baseSchema)
    const b = ir(baseSchema.replace('output: Player!', 'output: Game!'))
    const r = diffIR(a, b)
    expect(r.changes.some(c => c.kind === 'breaking' && c.detail.includes('output changed'))).toBe(
      true,
    )
  })

  test('schema version bump is review-class', () => {
    const a = ir(baseSchema)
    const b = ir(baseSchema.replace('version: 1', 'version: 2'))
    const r = diffIR(a, b)
    expect(r.summary.review).toBe(1)
    expect(r.changes[0].detail).toMatch(/1 → 2/)
  })

  test('new namespace is non-breaking', () => {
    const a = ir(baseSchema)
    const b: any = {
      schemas: {
        ...a.schemas,
        x: {
          name: 'X',
          namespace: 'x',
          version: 1,
          records: {},
          actions: {},
          enums: {},
          scalars: {},
          opaques: {},
        },
      },
    }
    const r = diffIR(a, b)
    expect(r.changes.some(c => c.detail === 'namespace added')).toBe(true)
  })
})
