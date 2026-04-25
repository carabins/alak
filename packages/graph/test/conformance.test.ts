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

  // v0.3.1 additive — action.output carries list/itemRequired flags.
  // Pre-fix IR dropped these, so generators could not distinguish
  // `output: Foo` from `output: [Foo!]!`. See stress.md Arsenal/C.0 + P.0.
  describe('13.11: action output list shape (v0.3.1)', () => {
    test('output: [Foo!]! → outputList=true, outputRequired=true, outputListItemRequired=true', () => {
      const src = `schema S { version: 1, namespace: "s" }
record Foo { id: ID! }
action X { output: [Foo!]! }`
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const a = ir!.schemas['s']!.actions['X']!
      expect(a.output).toBe('Foo')
      expect(a.outputRequired).toBe(true)
      expect(a.outputList).toBe(true)
      expect(a.outputListItemRequired).toBe(true)
    })

    test('output: [Foo] → outputList=true, outputRequired=false, outputListItemRequired=false', () => {
      const src = `schema S { version: 1, namespace: "s" }
record Foo { id: ID! }
action X { output: [Foo] }`
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const a = ir!.schemas['s']!.actions['X']!
      expect(a.output).toBe('Foo')
      expect(a.outputRequired).toBe(false)
      expect(a.outputList).toBe(true)
      expect(a.outputListItemRequired).toBe(false)
    })

    test('output: Foo! → outputRequired=true, outputList absent/false', () => {
      const src = `schema S { version: 1, namespace: "s" }
record Foo { id: ID! }
action X { output: Foo! }`
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const a = ir!.schemas['s']!.actions['X']!
      expect(a.output).toBe('Foo')
      expect(a.outputRequired).toBe(true)
      expect(a.outputList ?? false).toBe(false)
      expect(a.outputListItemRequired ?? false).toBe(false)
    })
  })

  // v0.3.3 additive — IRDirective.argTypes tags each directive arg with its
  // source literal kind. Closes stress-journal О18 (enum-literal vs string-
  // literal indistinguishable in IR). Pre-0.3.3 consumers ignore.
  describe('13.12: directive arg literal kinds (v0.3.3)', () => {
    test('@default(value: UNKNOWN) on enum field → argTypes.value = "enum_ref"', () => {
      const src = `schema S { version: 1, namespace: "s" }
enum K { A, UNKNOWN }
record R { k: K! @default(value: UNKNOWN) }`
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const f = ir!.schemas['s']!.records['R']!.fields[0]!
      const dflt = f.directives!.find(d => d.name === 'default')!
      expect(dflt.args.value).toBe('UNKNOWN')
      expect(dflt.argTypes?.value).toBe('enum_ref')
    })

    test('@default(value: "hello") on String field → argTypes.value = "string"', () => {
      const src = `schema S { version: 1, namespace: "s" }
record R { name: String! @default(value: "hello") }`
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const f = ir!.schemas['s']!.records['R']!.fields[0]!
      const dflt = f.directives!.find(d => d.name === 'default')!
      expect(dflt.args.value).toBe('hello')
      expect(dflt.argTypes?.value).toBe('string')
    })

    test('@range(min: 1, max: 10) → argTypes.min = "int", argTypes.max = "int"', () => {
      const src = `schema S { version: 1, namespace: "s" }
record R { n: Int! @range(min: 1, max: 10) }`
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const f = ir!.schemas['s']!.records['R']!.fields[0]!
      const rng = f.directives!.find(d => d.name === 'range')!
      expect(rng.argTypes?.min).toBe('int')
      expect(rng.argTypes?.max).toBe('int')
    })

    test('@sync(qos: REALTIME, atomic: true) → enum_ref + bool', () => {
      const src = `schema S { version: 1, namespace: "s" }
record R { x: Int! @sync(qos: REALTIME, atomic: true) }`
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const f = ir!.schemas['s']!.records['R']!.fields[0]!
      const sync = f.directives!.find(d => d.name === 'sync')!
      expect(sync.argTypes?.qos).toBe('enum_ref')
      expect(sync.argTypes?.atomic).toBe('bool')
    })

    test('@default(value: [1, 2, 3]) on list field → argTypes.value = "list"', () => {
      const src = `schema S { version: 1, namespace: "s" }
record R { xs: [Int!]! @default(value: [1, 2, 3]) }`
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const f = ir!.schemas['s']!.records['R']!.fields[0]!
      const dflt = f.directives!.find(d => d.name === 'default')!
      expect(dflt.argTypes?.value).toBe('list')
    })

    test('zero-arg directive → argTypes absent (pre-0.3.3 shape preserved)', () => {
      const src = `schema S { version: 1, namespace: "s" }
record R { x: Int! @atomic }`
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const f = ir!.schemas['s']!.records['R']!.fields[0]!
      const at = f.directives!.find(d => d.name === 'atomic')!
      expect(at.argTypes).toBeUndefined()
    })

    test('@deprecated(since: "0.2", reason: "x") → both "string"', () => {
      const src = `schema S { version: 1, namespace: "s" }
record R { x: Int! @deprecated(since: "0.2", reason: "x") }`
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const f = ir!.schemas['s']!.records['R']!.fields[0]!
      const dep = f.directives!.find(d => d.name === 'deprecated')!
      expect(dep.argTypes?.since).toBe('string')
      expect(dep.argTypes?.reason).toBe('string')
    })
  })

  // v0.3.4 (W8) — `@transport` schema-level directive: parses, projects
  // IRSchema.transport, validator rejects unknown kinds. Closes Q15.
  describe('13.13: @transport schema-level directive (v0.3.4)', () => {
    test('@transport(kind: "tauri") → IRSchema.transport === "tauri"', () => {
      const src = `schema S @transport(kind: "tauri") { version: 1, namespace: "s" }
record R { id: ID! }`
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      expect(ir!.schemas['s']!.transport).toBe('tauri')
      // Directive is also preserved on the raw list.
      expect(ir!.schemas['s']!.directives?.[0]?.name).toBe('transport')
      expect(ir!.schemas['s']!.directives?.[0]?.args.kind).toBe('tauri')
    })

    test('@transport(kind: "http") → IRSchema.transport === "http"', () => {
      const src = `schema S @transport(kind: "http") { version: 1, namespace: "s" }`
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      expect(ir!.schemas['s']!.transport).toBe('http')
    })

    test('@transport(kind: "zenoh") → IRSchema.transport === "zenoh"', () => {
      const src = `schema S @transport(kind: "zenoh") { version: 1, namespace: "s" }`
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      expect(ir!.schemas['s']!.transport).toBe('zenoh')
    })

    test('@transport(kind: "any") → IRSchema.transport === "any"', () => {
      const src = `schema S @transport(kind: "any") { version: 1, namespace: "s" }`
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      expect(ir!.schemas['s']!.transport).toBe('any')
    })

    test('no @transport → IRSchema.transport absent (back-compat)', () => {
      const src = `schema S { version: 1, namespace: "s" }`
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      expect(ir!.schemas['s']!.transport).toBeUndefined()
      expect(ir!.schemas['s']!.directives).toBeUndefined()
    })

    test('@transport(kind: "bogus") → E003 (closed kind set)', () => {
      const src = `schema S @transport(kind: "bogus") { version: 1, namespace: "s" }`
      const { diagnostics } = parseSource(src)
      const codes = diagnostics.map(d => d.code)
      expect(codes).toContain('E003')
    })

    test('@transport without kind → E023 (required arg missing)', () => {
      const src = `schema S @transport { version: 1, namespace: "s" }`
      const { diagnostics } = parseSource(src)
      const codes = diagnostics.map(d => d.code)
      expect(codes).toContain('E023')
    })

    test('@unknownSchemaDir on schema → E001', () => {
      const src = `schema S @frobnicate { version: 1, namespace: "s" }`
      const { diagnostics } = parseSource(src)
      const codes = diagnostics.map(d => d.code)
      expect(codes).toContain('E001')
    })
  })

  // v0.3.6 — §7.15 / §7.16 / §7.17 composite CRDT document directives land
  // in IR in the same flattened shape as any other directive: args mapped by
  // name, required fields present.
  describe('§7.15–§7.17 composite CRDT directives — IR round-trip', () => {
    test('IR preserves @crdt_doc_topic and @schema_version on schema', () => {
      const src =
        'schema S @crdt_doc_topic(doc: "GroupSync", pattern: "valkyrie/{group}/sync/patch")\n' +
        '         @schema_version(doc: "GroupSync", value: 2) {\n' +
        '  version: 1, namespace: "s"\n' +
        '}\n' +
        'record P @crdt_doc_member(doc: "GroupSync", map: "points")\n' +
        '         @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const schema = ir!.schemas['s']!
      const schemaDirs = schema.directives ?? []
      const topicDir = schemaDirs.find(d => d.name === 'crdt_doc_topic')
      expect(topicDir).toBeDefined()
      expect(topicDir!.args.doc).toBe('GroupSync')
      expect(topicDir!.args.pattern).toBe('valkyrie/{group}/sync/patch')
      const schemaVerDir = schemaDirs.find(d => d.name === 'schema_version')
      expect(schemaVerDir).toBeDefined()
      expect(schemaVerDir!.args.doc).toBe('GroupSync')
      expect(schemaVerDir!.args.value).toBe(2)
    })

    test('IR preserves @crdt_doc_member on record', () => {
      const src =
        'schema S @crdt_doc_topic(doc: "D", pattern: "ns/x") { version: 1, namespace: "s" }\n' +
        'record P @crdt_doc_member(doc: "D", map: "points")\n' +
        '         @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const memDir = ir!.schemas['s']!.records['P']!.directives!
        .find(d => d.name === 'crdt_doc_member')
      expect(memDir).toBeDefined()
      expect(memDir!.args.doc).toBe('D')
      expect(memDir!.args.map).toBe('points')
    })

    test('missing required args fire E023', () => {
      const onlyDoc = 'schema S @crdt_doc_topic(doc: "X") { version: 1, namespace: "s" }'
      expect(parseSource(onlyDoc).diagnostics.map(d => d.code)).toContain('E023')
      const onlyPat = 'schema S @crdt_doc_topic(pattern: "x") { version: 1, namespace: "s" }'
      expect(parseSource(onlyPat).diagnostics.map(d => d.code)).toContain('E023')
      const noDoc = 'schema S @schema_version(value: 2) { version: 1, namespace: "s" }'
      expect(parseSource(noDoc).diagnostics.map(d => d.code)).toContain('E023')
    })

    test('@crdt_doc_topic wrong arg type fires E003', () => {
      const src = 'schema S @crdt_doc_topic(doc: 42, pattern: "x") { version: 1, namespace: "s" }'
      expect(parseSource(src).diagnostics.map(d => d.code)).toContain('E003')
    })

    test('@schema_version with non-int value fires E003', () => {
      const src = 'schema S @schema_version(doc: "D", value: "two") { version: 1, namespace: "s" }'
      expect(parseSource(src).diagnostics.map(d => d.code)).toContain('E003')
    })
  })

  // v0.3.7 — @rename_case on enum/record (SPEC §7.18) + object-literal values
  describe('§7.18 @rename_case — IR round-trip', () => {
    test('IR preserves @rename_case on enum', () => {
      const src = 'schema S { version: 1, namespace: "s" }\n' +
                  'enum PointKind @rename_case(kind: PASCAL) { Target Observation }'
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const e = ir!.schemas['s']!.enums['PointKind']!
      expect(e.directives).toBeDefined()
      const d = e.directives!.find(x => x.name === 'rename_case')
      expect(d).toBeDefined()
      expect(d!.args.kind).toBe('PASCAL')
    })

    test('IR preserves @rename_case on record', () => {
      const src = 'schema S { version: 1, namespace: "s" }\n' +
                  'record R @rename_case(kind: CAMEL) { id: ID!, fc_connected: Boolean! }'
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const r = ir!.schemas['s']!.records['R']!
      const d = r.directives!.find(x => x.name === 'rename_case')
      expect(d).toBeDefined()
      expect(d!.args.kind).toBe('CAMEL')
    })

    test('enum without directives keeps .directives absent (back-compat)', () => {
      const src = 'schema S { version: 1, namespace: "s" }\n' +
                  'enum E { A B }'
      const { ir } = parseSource(src)
      expect(ir!.schemas['s']!.enums['E']!.directives).toBeUndefined()
    })
  })

  describe('§7.15 @crdt_doc_member — v0.3.7 extended args', () => {
    test('IR preserves lww_field + soft_delete object', () => {
      const src =
        'schema S @crdt_doc_topic(doc: "D", pattern: "ns/{id}/patch") { version: 1, namespace: "s" }\n' +
        'record P @crdt_doc_member(doc: "D", map: "points",\n' +
        '                          lww_field: "updated_at",\n' +
        '                          soft_delete: { flag: "is_deleted", ts_field: "updated_at" })\n' +
        '         @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  is_deleted: Boolean!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const mem = ir!.schemas['s']!.records['P']!.directives!
        .find(d => d.name === 'crdt_doc_member')!
      expect(mem.args.doc).toBe('D')
      expect(mem.args.map).toBe('points')
      expect(mem.args.lww_field).toBe('updated_at')
      // object-literal value flattens to a plain record in IR.
      expect(mem.args.soft_delete).toEqual({
        flag: 'is_deleted',
        ts_field: 'updated_at',
      })
      // argTypes reflects the object kind so generators can distinguish.
      expect(mem.argTypes!.soft_delete).toBe('object')
    })

    test('soft_delete: { } empty object → E027 downstream, but IR shape is parseable', () => {
      const src =
        'schema S @crdt_doc_topic(doc: "D", pattern: "ns/x") { version: 1, namespace: "s" }\n' +
        'record P @crdt_doc_member(doc: "D", map: "points", soft_delete: { })\n' +
        '         @crdt(type: LWW_MAP, key: "updated_at") {\n' +
        '  id: ID!\n' +
        '  updated_at: Timestamp!\n' +
        '}'
      const { ir, diagnostics } = parseSource(src)
      expect(ir).not.toBeNull()
      // Validator flags the empty object (missing flag / ts_field keys).
      expect(diagnostics.map(d => d.code)).toContain('E027')
    })
  })

  // v0.3.6 — `Any` as a built-in scalar (SPEC §4.1)
  describe('§4.1 Any — parse + IR', () => {
    test('`Any` is accepted as a field type', () => {
      const src = 'schema S { version: 1, namespace: "s" }\n' +
                  'record R { payload: Any! }'
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const field = ir!.schemas['s']!.records['R']!.fields[0]!
      expect(field.name).toBe('payload')
      expect(field.type).toBe('Any')
      expect(field.required).toBe(true)
    })

    test('`Map<String, Any>` is accepted', () => {
      const src = 'schema S { version: 1, namespace: "s" }\n' +
                  'record R { extras: Map<String, Any>! }'
      const { ir, diagnostics } = parseSource(src)
      expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
      const field = ir!.schemas['s']!.records['R']!.fields[0]!
      expect(field.map).toBe(true)
      expect(field.mapKey!.type).toBe('String')
      expect(field.mapValue!.type).toBe('Any')
    })
  })
})
