import { test, expect, describe } from 'bun:test'
import { lex } from '../src/lexer'
import { parse } from '../src/parser'
import { parseSource } from '../src/index'
import { buildIR } from '../src/ir'

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

  // v0.3.4 (W5) — Map inner quantifiers: key is always required (R023),
  // value follows the syntactic `!` on V. Parser normalises both
  // `Map<K, V>` and `Map<K!, V>` to the same IR shape.
  describe('Map inner quantifiers (R023, v0.3.4)', () => {
    test('Map<String, String> — key forced required, value optional', () => {
      const src = 'schema S { version: 1, namespace: "s" }\nrecord R { m: Map<String, String>! }'
      const { ast, diagnostics } = parseOk(src)
      expect(diagnostics).toEqual([])
      const f = (ast.definitions[0] as any).fields[0]
      expect(f.type.map).toBe(true)
      expect(f.type.required).toBe(true)          // outer `!`
      expect(f.type.keyType.required).toBe(true)  // R023
      expect(f.type.valueType.required).toBe(false)
    })

    test('Map<String, String!> — key required, value required', () => {
      const src = 'schema S { version: 1, namespace: "s" }\nrecord R { m: Map<String, String!>! }'
      const { ast, diagnostics } = parseOk(src)
      expect(diagnostics).toEqual([])
      const f = (ast.definitions[0] as any).fields[0]
      expect(f.type.keyType.required).toBe(true)
      expect(f.type.valueType.required).toBe(true)
    })

    test('Map<String!, String!> — syntactic `!` on K is redundant, no-op', () => {
      const src = 'schema S { version: 1, namespace: "s" }\nrecord R { m: Map<String!, String!>! }'
      const { ast, diagnostics } = parseOk(src)
      expect(diagnostics).toEqual([])
      const f = (ast.definitions[0] as any).fields[0]
      expect(f.type.keyType.required).toBe(true)
      expect(f.type.valueType.required).toBe(true)
    })

    test('Map<String, String> (no outer !) — outer optional, key still required', () => {
      const src = 'schema S { version: 1, namespace: "s" }\nrecord R { m: Map<String, String> }'
      const { ast, diagnostics } = parseOk(src)
      expect(diagnostics).toEqual([])
      const f = (ast.definitions[0] as any).fields[0]
      expect(f.type.required).toBe(false)         // outer — no `!`
      expect(f.type.keyType.required).toBe(true)  // R023 — always
      expect(f.type.valueType.required).toBe(false)
    })

    test('IR shape — mapKey.required is always true (R023 at IR boundary)', () => {
      // Check both bare and redundantly-banged keys produce identical IR.
      const { ir: bare } = parseSource('schema S { version: 1, namespace: "s" }\nrecord R { m: Map<String, String>! }')
      const { ir: banged } = parseSource('schema S { version: 1, namespace: "s" }\nrecord R { m: Map<String!, String>! }')
      const bareField = bare!.schemas['s']!.records['R']!.fields[0]!
      const bangedField = banged!.schemas['s']!.records['R']!.fields[0]!
      expect(bareField.mapKey?.required).toBe(true)
      expect(bangedField.mapKey?.required).toBe(true)
      // Value side also identical — both lack `!` on V.
      expect(bareField.mapValue?.required).toBe(false)
      expect(bangedField.mapValue?.required).toBe(false)
    })

    test('Nested Map<K, Map<K2, V>> — every key level required', () => {
      const src = `schema S { version: 1, namespace: "s" }
record R { m: Map<ID, Map<String, Int>>! }`
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const f = ir!.schemas['s']!.records['R']!.fields[0]!
      expect(f.mapKey?.required).toBe(true)           // outer key
      expect(f.mapValue?.map).toBe(true)
      expect(f.mapValue?.mapKey?.required).toBe(true) // inner key
    })

    test('Map<Int, String> — Int is a scalar key, no E022', () => {
      // Covered by validator.test.ts too, but asserted here to ensure the
      // R023 normalisation does not disturb scalar-key validation.
      const src = 'schema S { version: 1, namespace: "s" }\nrecord R { m: Map<Int, String>! }'
      const { diagnostics } = parseSource(src)
      expect(diagnostics.map(d => d.code)).not.toContain('E022')
    })
  })

  // ── v0.3.2 — leadingComments on top-level definitions (P.1) ────────
  //
  // The lexer no longer drops `#`-comments; the parser harvests any run of
  // consecutive comment lines immediately preceding a top-level decl and
  // exposes them on the AST / IR as `leadingComments`. A blank line between
  // the comment block and the keyword detaches the comments (they become
  // R001-style pure noise and are dropped).

  test('single leading comment attaches to record', () => {
    const src = 'schema S { version: 1, namespace: "s" }\n# comment\nrecord R { id: ID! }'
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    const r = ast.definitions[0] as any
    expect(r.leadingComments).toEqual(['comment'])
  })

  test('two consecutive leading comments attach in source order', () => {
    const src = 'schema S { version: 1, namespace: "s" }\n# line1\n# line2\nrecord R { id: ID! }'
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    expect((ast.definitions[0] as any).leadingComments).toEqual(['line1', 'line2'])
  })

  test('blank line between comment and keyword detaches — no leadingComments', () => {
    const src = 'schema S { version: 1, namespace: "s" }\n# orphan\n\nrecord R { id: ID! }'
    const { ast, diagnostics } = parseOk(src)
    expect(diagnostics).toEqual([])
    expect((ast.definitions[0] as any).leadingComments).toBeUndefined()
  })

  test('leading comment above action → IR.actions[name].leadingComments', () => {
    const src = `schema S { version: 1, namespace: "s" }
# @stream: Chunk
action DoThing { input: { name: String! } output: Boolean! }`
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    expect(ir!.schemas['s']!.actions['DoThing']!.leadingComments).toEqual(['@stream: Chunk'])
  })

  test('leading comment above enum → IR.enums[name].leadingComments', () => {
    const src = 'schema S { version: 1, namespace: "s" }\n# color choices\nenum Color { RED GREEN BLUE }'
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    expect(ir!.schemas['s']!.enums['Color']!.leadingComments).toEqual(['color choices'])
  })

  test('leading comment above scalar → IR.scalars[name].leadingComments', () => {
    const src = 'schema S { version: 1, namespace: "s" }\n# opaque handle\nscalar DownloadHandle'
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    expect(ir!.schemas['s']!.scalars['DownloadHandle']!.leadingComments).toEqual(['opaque handle'])
  })

  test('trailing inline comment on field does NOT become leadingComments of next record', () => {
    const src = `schema S { version: 1, namespace: "s" }
record A { name: String! # trailing
}
record B { id: ID! }`
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    // A itself has no leading comments — the `# trailing` is inside the field body.
    expect(ir!.schemas['s']!.records['A']!.leadingComments).toBeUndefined()
    // B has no leading comments either — the trailing comment belongs to A's
    // field line, not to B.
    expect(ir!.schemas['s']!.records['B']!.leadingComments).toBeUndefined()
  })

  test('record without comments has no leadingComments field at all (not [])', () => {
    const src = 'schema S { version: 1, namespace: "s" }\nrecord R { id: ID! }'
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    const rec = ir!.schemas['s']!.records['R']!
    expect('leadingComments' in rec).toBe(false)
  })

  // ── v0.3.3 — contextual keywords (W4) ─────────────────────────────
  //
  // The lexer classifies `version`, `scope`, `input`, `output`, `qos`,
  // `max_size`, `namespace` (and a few more) as keywords because they drive
  // structure inside `schema`, `action`, and `opaque stream` blocks. Prior
  // to v0.3.3 this made them unusable as field names / enum members even in
  // plain user records — Arsenal's stress-test F-01 hit this with
  // `record VersionRef { version: String! }` and had to rename the field to
  // `semver`. Contextual treatment in the parser fixes that: a keyword token
  // becomes just an identifier when the surrounding grammar asks for one.

  test('W4 — record with all contextual keywords as field names', () => {
    const src = `schema S { version: 1, namespace: "s" }
record R {
  version: String!
  scope: String!
  input: String!
  output: String!
  qos: String!
  max_size: Int!
  namespace: String!
}`
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    const r = ir!.schemas['s']!.records['R']!
    const names = r.fields.map(f => f.name)
    expect(names).toEqual([
      'version', 'scope', 'input', 'output', 'qos', 'max_size', 'namespace',
    ])
  })

  test('W4 — action input/output with keyword field names', () => {
    const src = `schema S { version: 1, namespace: "s" }
record Payload { version: String! }
action A {
  input: { version: String! }
  output: Payload!
}`
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    const a = ir!.schemas['s']!.actions['A']!
    expect(a.input).toEqual([
      { name: 'version', type: 'String', required: true, list: false },
    ])
    expect(a.output).toBe('Payload')
    const payload = ir!.schemas['s']!.records['Payload']!
    expect(payload.fields[0]!.name).toBe('version')
  })

  test('W4 — enum with keyword members', () => {
    const src = `schema S { version: 1, namespace: "s" }
enum E { version, scope, input, namespace }`
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    expect(ir!.schemas['s']!.enums['E']!.values).toEqual([
      'version', 'scope', 'input', 'namespace',
    ])
  })

  test('W4 — contextual: keyword still keyword in schema block', () => {
    // `version: 1` and `namespace: "s"` must continue to be parsed as
    // schema-level fields (not as record fields, not as enum members —
    // there is no such ambiguity here). This is the classic happy path.
    const src = 'schema X { namespace: "foo", version: 7 }'
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    expect(ir!.schemas['foo']!.version).toBe(7)
    expect(ir!.schemas['foo']!.namespace).toBe('foo')
  })

  test('W4 — contextual: keyword still keyword in action block', () => {
    // `scope:` / `input:` / `output:` remain the action-block structural
    // keywords. We add a plain-name field to prove the action parses. A
    // scoped record of scope "room" is included to keep E019 out of the
    // diagnostics list (validator requires at least one record in the same
    // scope).
    const src = `schema S { version: 1, namespace: "s" }
record Room @scope(name: "room") { id: ID! }
action A {
  scope: "room"
  input: { x: Int! }
  output: Boolean!
}`
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    const a = ir!.schemas['s']!.actions['A']!
    expect(a.scope).toBe('room')
    expect(a.input?.[0]?.name).toBe('x')
    expect(a.output).toBe('Boolean')
  })

  test('W4 — contextual: keyword still keyword in opaque stream block', () => {
    const src = `schema S { version: 1, namespace: "s" }
opaque stream Frames {
  qos: best_effort_push
  max_size: 8192
}`
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    const op = ir!.schemas['s']!.opaques['Frames']!
    expect(op.qos).toBe('best_effort_push')
    expect(op.maxSize).toBe(8192)
  })

  test('W4 — keyword field name carries directives normally', () => {
    const src = `schema S { version: 1, namespace: "s" }
record R { version: String! @default(value: "0") }`
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    const f = ir!.schemas['s']!.records['R']!.fields[0]!
    expect(f.name).toBe('version')
    expect(f.directives?.[0]?.name).toBe('default')
    expect(f.directives?.[0]?.args?.value).toBe('0')
  })

  // ── v0.3.4 — W9 — `event Name { … }` as a first-class top-level decl ───
  //
  // Events mirror records in shape. They live on `IRSchema.events` so
  // generators targeting broadcast / pub-sub (Tauri, Zenoh) fan out
  // emit/listen helpers next to (not mixed with) state records. The
  // validator rejects `@scope` on an event (E024) since broadcast payloads
  // are not lifecycle-bound. See SPEC §5.5.

  test('W9 — basic event parses and lands in IR.events', () => {
    const src = `schema S { version: 1, namespace: "s" }
event DownloadProgress {
  handle: String!
  bytes: Int!
  total: Int!
}`
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    const ev = ir!.schemas['s']!.events['DownloadProgress']!
    expect(ev).toBeDefined()
    expect(ev.name).toBe('DownloadProgress')
    expect(ev.fields.map(f => f.name)).toEqual(['handle', 'bytes', 'total'])
    expect(ev.fields.every(f => f.required)).toBe(true)
    // Not a record — the same name must not leak into records.
    expect(ir!.schemas['s']!.records['DownloadProgress']).toBeUndefined()
  })

  test('W9 — event with leadingComments is harvested', () => {
    const src = `schema S { version: 1, namespace: "s" }
# Progress ticks during a large download.
event DownloadProgress {
  handle: String!
  bytes: Int!
}`
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    const ev = ir!.schemas['s']!.events['DownloadProgress']!
    expect(ev.leadingComments).toEqual([
      'Progress ticks during a large download.',
    ])
  })

  test('W9 — event with directives (e.g. @deprecated) preserves them', () => {
    const src = `schema S { version: 1, namespace: "s" }
event LegacyEvent @deprecated(since: "1", reason: "use NewEvent") {
  note: String!
}`
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    const ev = ir!.schemas['s']!.events['LegacyEvent']!
    expect(ev.directives?.[0]?.name).toBe('deprecated')
    expect(ev.directives?.[0]?.args?.since).toBe('1')
  })

  test('W9 — event with @scope is rejected (E024)', () => {
    const src = `schema S { version: 1, namespace: "s" }
event Ping @scope(name: "room") {
  ts: Timestamp!
}`
    const { diagnostics } = parseSource(src)
    const e024 = diagnostics.find(d => d.code === 'E024')
    expect(e024).toBeDefined()
  })

  test('W9 — Map field inside an event is permitted', () => {
    const src = `schema S { version: 1, namespace: "s" }
event Announce {
  labels: Map<String, String>!
}`
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    const ev = ir!.schemas['s']!.events['Announce']!
    expect(ev.fields[0]!.map).toBe(true)
  })

  test('W9 — record + event coexist in the same namespace', () => {
    const src = `schema S { version: 1, namespace: "s" }
record VersionRef { semver: String! }
event PublishedVersion { ref: VersionRef! }`
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics).toEqual([])
    expect(Object.keys(ir!.schemas['s']!.records)).toEqual(['VersionRef'])
    expect(Object.keys(ir!.schemas['s']!.events)).toEqual(['PublishedVersion'])
  })

  test('W9 — `event` is a strict keyword: cannot name a record `event`', () => {
    const src = `schema S { version: 1, namespace: "s" }
record event { id: ID! }`
    const { diagnostics } = parseSource(src)
    // Parser reports a structural parse error — `record` must be followed by
    // a user identifier, and `event` (strict keyword) isn't one.
    expect(diagnostics.some(d => d.code === 'E000')).toBe(true)
  })
})
