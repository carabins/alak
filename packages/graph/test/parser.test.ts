import { test, expect, describe } from 'bun:test'
import { lex } from '../src/lexer'
import { parse } from '../src/parser'

const parseOk = (src: string) => {
  const { tokens, diagnostics: lexDiag } = lex(src)
  const { ast, diagnostics } = parse(tokens)
  return { ast, diagnostics: [...lexDiag, ...diagnostics] }
}

describe('parser', () => {
  test('schema decl with both fields', () => {
    const { ast, diagnostics } = parseOk('schema S { version: 1, namespace: "s" }')
    expect(diagnostics).toEqual([])
    expect(ast.schema?.name).toBe('S')
    expect(ast.schema?.version).toBe(1)
    expect(ast.schema?.namespace).toBe('s')
    expect(ast.schema?.hasVersion).toBe(true)
    expect(ast.schema?.hasNamespace).toBe(true)
  })

  test('schema decl without commas', () => {
    const { ast, diagnostics } = parseOk(`schema S {
      version: 1
      namespace: "s"
    }`)
    expect(diagnostics).toEqual([])
    expect(ast.schema?.version).toBe(1)
  })

  test('record with required and optional fields', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nrecord R { id: ID! name: String avatar: String }'
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    const r = ast.definitions.find(d => d.kind === 'record') as any
    expect(r.fields.length).toBe(3)
    expect(r.fields[0].type.required).toBe(true)
    expect(r.fields[1].type.required).toBe(false)
  })

  test('list types', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nrecord R { xs: [String!]! }'
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    const r = ast.definitions[0] as any
    const f = r.fields[0]
    expect(f.type.list).toBe(true)
    expect(f.type.required).toBe(true)
    expect(f.type.inner.name).toBe('String')
    expect(f.type.inner.required).toBe(true)
  })

  test('nested list types', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nrecord R { m: [[Float!]!]! }'
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    const f = (ast.definitions[0] as any).fields[0]
    expect(f.type.list).toBe(true)
    expect(f.type.inner.list).toBe(true)
    expect(f.type.inner.inner.name).toBe('Float')
  })

  test('directives with args', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nrecord R @sync(qos: RELIABLE, atomic: true) { id: ID! }'
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    const r = ast.definitions[0] as any
    expect(r.directives.length).toBe(1)
    expect(r.directives[0].name).toBe('sync')
    expect(r.directives[0].args.length).toBe(2)
  })

  test('use decl', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nuse "./core" { UUID, DeviceID }'
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    expect(ast.uses.length).toBe(1)
    expect(ast.uses[0]!.path).toBe('./core')
    expect(ast.uses[0]!.imports).toEqual(['UUID', 'DeviceID'])
  })

  test('action with scope/input/output', () => {
    const src = `schema S { version: 1, namespace: "s" }
action JoinRoom {
  scope: "room"
  input: { name: String! }
  output: Boolean!
}`
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    const a = ast.definitions.find(d => d.kind === 'action') as any
    expect(a.scope).toBe('room')
    expect(a.input.length).toBe(1)
    expect(a.output.name).toBe('Boolean')
  })

  test('enum decl', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nenum Color { RED, GREEN, BLUE }'
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    const e = ast.definitions[0] as any
    expect(e.values).toEqual(['RED', 'GREEN', 'BLUE'])
  })

  test('opaque stream', () => {
    const src = `schema S { version: 1, namespace: "s" }
opaque stream MediaFrames {
  qos: best_effort_push
  max_size: 65536
}`
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    const op = ast.definitions[0] as any
    expect(op.qos).toBe('best_effort_push')
    expect(op.maxSize).toBe(65536)
  })

  test('extend record', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nrecord R { id: ID! }\nextend record R { name: String! }'
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    expect(ast.definitions.length).toBe(2)
    expect(ast.definitions[1]!.kind).toBe('extend')
  })

  test('scalar decl', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nscalar DeviceID'
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    expect(ast.definitions[0]).toMatchObject({ kind: 'scalar', name: 'DeviceID' })
  })

  test('trailing comma in field list', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nrecord R { id: ID!, name: String!, }'
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    expect((ast.definitions[0] as any).fields.length).toBe(2)
  })

  test('list literal as default', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nrecord R { xs: [Int!]! @default(value: [1, 2, 3]) }'
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    const f = (ast.definitions[0] as any).fields[0]
    const arg = f.directives[0].args[0]
    expect(arg.value.kind).toBe('list')
    expect(arg.value.values.length).toBe(3)
  })

  // v0.3 — R003 comma-less enums
  test('R003 — enum members parse without commas', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nenum E { A B C }'
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    const e = ast.definitions[0] as any
    expect(e.values).toEqual(['A', 'B', 'C'])
  })

  test('R003 — both enum styles produce identical IR', () => {
    const withCommas = parseOk('schema S { version: 1, namespace: "s" }\nenum E { A, B, C }')
    const noCommas   = parseOk('schema S { version: 1, namespace: "s" }\nenum E { A B C }')
    expect(withCommas.diagnostics).toEqual([])
    expect(noCommas.diagnostics).toEqual([])
    const a = (withCommas.ast.definitions[0] as any).values
    const b = (noCommas.ast.definitions[0] as any).values
    expect(a).toEqual(b)
  })

  test('R003 — enum with mixed commas (trailing comma)', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nenum E { A, B, C, }'
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    expect((ast.definitions[0] as any).values).toEqual(['A', 'B', 'C'])
  })

  // v0.3 — Map<K, V>
  test('Map<ID, String> parses as a map type', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nrecord R { m: Map<ID, String>! }'
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    const f = (ast.definitions[0] as any).fields[0]
    expect(f.type.map).toBe(true)
    expect(f.type.required).toBe(true)
    expect(f.type.keyType.name).toBe('ID')
    expect(f.type.valueType.name).toBe('String')
  })

  test('Map<ID, Map<ID, VoteDir>> parses nested', () => {
    const src = `schema S { version: 1, namespace: "s" }
enum VoteDir { UP DOWN }
record R { m: Map<ID, Map<ID, VoteDir>>! }`
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    const f = (ast.definitions.find((d:any)=>d.kind==='record') as any).fields[0]
    expect(f.type.map).toBe(true)
    expect(f.type.valueType.map).toBe(true)
    expect(f.type.valueType.keyType.name).toBe('ID')
    expect(f.type.valueType.valueType.name).toBe('VoteDir')
  })

  test('Map<ID, RecordType> — value can be a record', () => {
    const src = `schema S { version: 1, namespace: "s" }
record Player { id: ID! }
record R { m: Map<ID, Player>! }`
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    const r = (ast.definitions.find((d:any)=>d.kind==='record' && d.name==='R') as any)
    expect(r.fields[0].type.valueType.name).toBe('Player')
  })
})
