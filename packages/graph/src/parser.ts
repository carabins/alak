// @alaq/graph — recursive descent parser. Consumes Token[] → FileAST.
//
// Mirrors EBNF §2 with one function per production. R003: trailing comma OR
// comma-less fields both valid. The parser keeps going on errors by panicking
// to the nearest closing brace, so a single syntax mistake does not mask the
// rest of the file.

import type {
  Diagnostic,
  Token,
  FileAST,
  SchemaDeclNode,
  UseDeclNode,
  Definition,
  RecordNode,
  ExtendRecordNode,
  ActionNode,
  EnumNode,
  ScalarNode,
  OpaqueNode,
  FieldNode,
  DirectiveNode,
  DirectiveArg,
  TypeExprNode,
  Value,
  SourceLoc,
} from './types'
import { diag, MSG } from './errors'

class ParseError extends Error {}

export interface ParserResult {
  ast: FileAST
  diagnostics: Diagnostic[]
}

export function parse(tokens: Token[], file?: string): ParserResult {
  const diagnostics: Diagnostic[] = []
  let pos = 0

  const peek = (off = 0): Token => tokens[Math.min(pos + off, tokens.length - 1)]
  const isEOF = () => peek().kind === 'EOF'

  const locOf = (t: Token): SourceLoc => ({ file, line: t.line, column: t.column })

  const error = (code: 'E000' | 'E017' | 'E018', message: string, tok: Token) => {
    diagnostics.push(diag(code, message, locOf(tok)))
  }

  const fail = (msg: string, tok: Token = peek()): never => {
    error('E000', MSG.E000(msg), tok)
    throw new ParseError(msg)
  }

  const expect = (kind: Token['kind'], value?: string): Token => {
    const t = peek()
    if (t.kind !== kind || (value !== undefined && t.value !== value)) {
      fail(
        `expected ${value ? `"${value}"` : kind}, got ${t.kind === 'EOF' ? 'EOF' : `"${t.value}"`}`,
        t,
      )
    }
    pos++
    return t
  }

  const accept = (kind: Token['kind'], value?: string): Token | null => {
    const t = peek()
    if (t.kind !== kind) return null
    if (value !== undefined && t.value !== value) return null
    pos++
    return t
  }

  const isKeyword = (name: string) =>
    peek().kind === 'KEYWORD' && peek().value === name

  // Panic-mode recovery: skip until balanced '}' at depth 0 or EOF.
  const recoverToBlockEnd = () => {
    let depth = 0
    while (!isEOF()) {
      const t = peek()
      if (t.kind === 'LBRACE') depth++
      else if (t.kind === 'RBRACE') {
        if (depth === 0) { pos++; return }
        depth--
      }
      pos++
    }
  }

  // ─── File = SchemaDecl { UseDecl } { Definition }

  const parseFile = (): FileAST => {
    const uses: UseDeclNode[] = []
    const definitions: Definition[] = []
    let schema: SchemaDeclNode | null = null

    // Skip leading `use` or `schema` in any order — tolerant:
    // SPEC requires SchemaDecl first, but being lenient here means better
    // diagnostics. We still enforce "one schema per file" (E017).
    while (!isEOF()) {
      if (isKeyword('schema')) {
        const node = tryParse(parseSchemaDecl)
        if (node) {
          if (schema) error('E017', MSG.E017(), { line: node.loc.line, column: node.loc.column } as Token)
          else schema = node
        }
      } else if (isKeyword('use')) {
        const u = tryParse(parseUseDecl)
        if (u) uses.push(u)
      } else if (
        isKeyword('record') ||
        isKeyword('extend') ||
        isKeyword('action') ||
        isKeyword('enum') ||
        isKeyword('scalar') ||
        isKeyword('opaque')
      ) {
        const d = tryParse(parseDefinition)
        if (d) definitions.push(d)
      } else {
        error('E000', MSG.E000(`unexpected token "${peek().value}" at top level`), peek())
        pos++
      }
    }

    return { schema, uses, definitions }
  }

  function tryParse<T>(fn: () => T): T | null {
    const savedPos = pos
    try { return fn() }
    catch (e) {
      if (e instanceof ParseError) { recoverToBlockEnd(); return null }
      // unexpected: roll back and rethrow
      pos = savedPos
      throw e
    }
  }

  // ─── SchemaDecl = "schema" Identifier "{" SchemaField+ "}"

  const parseSchemaDecl = (): SchemaDeclNode => {
    const kw = expect('KEYWORD', 'schema')
    const nameTok = expect('IDENTIFIER')
    expect('LBRACE')

    let version: number | null = null
    let namespace: string | null = null
    let hasVersion = false
    let hasNamespace = false

    while (peek().kind !== 'RBRACE' && !isEOF()) {
      const key = peek()
      if (key.kind === 'KEYWORD' && key.value === 'version') {
        pos++; expect('COLON')
        const v = expect('INT_LIT')
        version = parseInt(v.value, 10)
        hasVersion = true
      } else if (key.kind === 'KEYWORD' && key.value === 'namespace') {
        pos++; expect('COLON')
        const v = expect('STRING_LIT')
        namespace = v.value
        hasNamespace = true
      } else {
        fail(`unexpected schema field "${key.value}"`, key)
      }
      accept('COMMA')
    }
    expect('RBRACE')

    return {
      name: nameTok.value,
      version,
      namespace,
      hasVersion,
      hasNamespace,
      loc: locOf(kw),
    }
  }

  // ─── UseDecl = "use" StringLit "{" Identifier { "," Identifier } "}"

  const parseUseDecl = (): UseDeclNode => {
    const kw = expect('KEYWORD', 'use')
    const pathTok = expect('STRING_LIT')
    expect('LBRACE')
    const imports: string[] = []
    if (peek().kind !== 'RBRACE') {
      imports.push(expect('IDENTIFIER').value)
      while (accept('COMMA')) {
        if (peek().kind === 'RBRACE') break // trailing comma
        imports.push(expect('IDENTIFIER').value)
      }
    }
    expect('RBRACE')
    return { path: pathTok.value, imports, loc: locOf(kw) }
  }

  // ─── Definition dispatch

  const parseDefinition = (): Definition => {
    const kw = peek()
    if (isKeyword('record')) return parseRecordDecl()
    if (isKeyword('extend')) return parseExtendDecl()
    if (isKeyword('action')) return parseActionDecl()
    if (isKeyword('enum')) return parseEnumDecl()
    if (isKeyword('scalar')) return parseScalarDecl()
    if (isKeyword('opaque')) return parseOpaqueDecl()
    fail(`expected definition, got "${kw.value}"`, kw)
  }

  // ─── RecordDecl = "record" Identifier { Directive } "{" { Field } "}"

  const parseRecordDecl = (): RecordNode => {
    const kw = expect('KEYWORD', 'record')
    const nameTok = expect('IDENTIFIER')
    const directives = parseDirectives()
    expect('LBRACE')
    const fields = parseFieldList()
    expect('RBRACE')
    return {
      kind: 'record',
      name: nameTok.value,
      directives,
      fields,
      loc: locOf(kw),
    }
  }

  // ─── ExtendDecl = "extend" "record" Identifier "{" { Field } "}"

  const parseExtendDecl = (): ExtendRecordNode => {
    const kw = expect('KEYWORD', 'extend')
    expect('KEYWORD', 'record')
    const nameTok = expect('IDENTIFIER')
    expect('LBRACE')
    const fields = parseFieldList()
    expect('RBRACE')
    return { kind: 'extend', name: nameTok.value, fields, loc: locOf(kw) }
  }

  // Parse zero-or-more Fields separated by optional commas.
  // R003: both trailing and comma-less styles are accepted.
  const parseFieldList = (): FieldNode[] => {
    const fields: FieldNode[] = []
    while (peek().kind !== 'RBRACE' && !isEOF()) {
      fields.push(parseField())
      accept('COMMA') // optional
    }
    return fields
  }

  const parseField = (): FieldNode => {
    const nameTok = expect('IDENTIFIER')
    expect('COLON')
    const type = parseTypeExpr()
    const directives = parseDirectives()
    return { name: nameTok.value, type, directives, loc: locOf(nameTok) }
  }

  // ─── TypeExpr = ( Identifier | ListType | MapType ) [ "!" ]
  //     ListType = "[" TypeExpr "]"
  //     MapType  = "Map" "<" TypeExpr "," TypeExpr ">"   (v0.3)

  const parseTypeExpr = (): TypeExprNode => {
    const t = peek()
    if (t.kind === 'LBRACKET') {
      pos++
      const inner = parseTypeExpr()
      expect('RBRACKET')
      const required = !!accept('BANG')
      return {
        name: 'List',
        required,
        list: true,
        inner,
        loc: locOf(t),
      }
    }
    // Map<K, V> — recognised by the literal identifier "Map" followed by "<".
    // Note: `Map` is not a reserved keyword; a user scalar named `Map` would
    // collide syntactically only when used as a type — flagged via E009 at
    // validation time. The parser is pragmatic: if we see `Map <`, it's a map.
    if (t.kind === 'IDENTIFIER' && t.value === 'Map' && peek(1).kind === 'LT') {
      pos++ // consume "Map"
      expect('LT')
      const keyType = parseTypeExpr()
      expect('COMMA')
      const valueType = parseTypeExpr()
      expect('GT')
      const required = !!accept('BANG')
      return {
        name: 'Map',
        required,
        list: false,
        map: true,
        keyType,
        valueType,
        loc: locOf(t),
      }
    }
    if (t.kind === 'IDENTIFIER' || t.kind === 'KEYWORD') {
      // Allow keyword-like type names (rare; no reserved words in type names
      // per R004, but this keeps the error messages about unknown types
      // higher up the stack rather than here).
      pos++
      const required = !!accept('BANG')
      return { name: t.value, required, list: false, loc: locOf(t) }
    }
    fail(`expected type, got "${t.value}"`, t)
  }

  // ─── Directive = "@" Identifier [ "(" ArgList ")" ]

  const parseDirectives = (): DirectiveNode[] => {
    const out: DirectiveNode[] = []
    while (peek().kind === 'AT') out.push(parseDirective())
    return out
  }

  const parseDirective = (): DirectiveNode => {
    const at = expect('AT')
    const nameTok = peek()
    if (nameTok.kind !== 'IDENTIFIER' && nameTok.kind !== 'KEYWORD') {
      fail(`expected directive name after @, got "${nameTok.value}"`, nameTok)
    }
    pos++
    const args: DirectiveArg[] = []
    if (accept('LPAREN')) {
      if (peek().kind !== 'RPAREN') {
        args.push(parseArg())
        while (accept('COMMA')) {
          if (peek().kind === 'RPAREN') break
          args.push(parseArg())
        }
      }
      expect('RPAREN')
    }
    return { name: nameTok.value, args, loc: locOf(at) }
  }

  const parseArg = (): DirectiveArg => {
    const nameTok = peek()
    if (nameTok.kind !== 'IDENTIFIER' && nameTok.kind !== 'KEYWORD') {
      fail(`expected argument name, got "${nameTok.value}"`, nameTok)
    }
    pos++
    expect('COLON')
    const value = parseValue()
    return { name: nameTok.value, value, loc: locOf(nameTok) }
  }

  const parseValue = (): Value => {
    const t = peek()
    if (t.kind === 'STRING_LIT') {
      pos++
      return { kind: 'string', value: t.value, loc: locOf(t) }
    }
    if (t.kind === 'INT_LIT') {
      pos++
      return { kind: 'int', value: parseInt(t.value, 10), loc: locOf(t) }
    }
    if (t.kind === 'FLOAT_LIT') {
      pos++
      return { kind: 'float', value: parseFloat(t.value), loc: locOf(t) }
    }
    if (t.kind === 'BOOL_LIT') {
      pos++
      return { kind: 'bool', value: t.value === 'true', loc: locOf(t) }
    }
    if (t.kind === 'LBRACKET') {
      pos++
      const values: Value[] = []
      if (peek().kind !== 'RBRACKET') {
        values.push(parseValue())
        while (accept('COMMA')) {
          if (peek().kind === 'RBRACKET') break
          values.push(parseValue())
        }
      }
      expect('RBRACKET')
      return { kind: 'list', values, loc: locOf(t) }
    }
    // Identifiers (bare) are enum literals
    if (t.kind === 'IDENTIFIER' || t.kind === 'KEYWORD') {
      pos++
      return { kind: 'enum', value: t.value, loc: locOf(t) }
    }
    fail(`expected value, got "${t.value}"`, t)
  }

  // ─── ActionDecl = "action" Identifier "{" ActionBody "}"

  const parseActionDecl = (): ActionNode => {
    const kw = expect('KEYWORD', 'action')
    const nameTok = expect('IDENTIFIER')
    expect('LBRACE')

    let scope: string | null = null
    let input: FieldNode[] | null = null
    let output: TypeExprNode | null = null

    while (peek().kind !== 'RBRACE' && !isEOF()) {
      const k = peek()
      if (k.kind === 'KEYWORD' && k.value === 'scope') {
        pos++; expect('COLON')
        scope = expect('STRING_LIT').value
      } else if (k.kind === 'KEYWORD' && k.value === 'input') {
        pos++; expect('COLON')
        expect('LBRACE')
        input = parseFieldList()
        expect('RBRACE')
      } else if (k.kind === 'KEYWORD' && k.value === 'output') {
        pos++; expect('COLON')
        output = parseTypeExpr()
      } else {
        fail(`unexpected action field "${k.value}"`, k)
      }
      accept('COMMA')
    }
    expect('RBRACE')

    return {
      kind: 'action',
      name: nameTok.value,
      scope,
      input,
      output,
      loc: locOf(kw),
    }
  }

  // ─── EnumDecl = "enum" Identifier "{" Identifier { [","] Identifier } "}"
  //
  // R003 (v0.3): commas between enum members are OPTIONAL, matching the
  // spec's "both styles are valid" pledge. Pre-0.3 parser required commas
  // — a bug found by the Kotelok live test. Both `{ A, B, C }` and
  // `{ A B C }` now parse to the same IR.

  const parseEnumDecl = (): EnumNode => {
    const kw = expect('KEYWORD', 'enum')
    const nameTok = expect('IDENTIFIER')
    expect('LBRACE')
    const values: string[] = []
    while (peek().kind !== 'RBRACE' && !isEOF()) {
      values.push(expect('IDENTIFIER').value)
      accept('COMMA') // optional separator (R003)
    }
    expect('RBRACE')
    return { kind: 'enum', name: nameTok.value, values, loc: locOf(kw) }
  }

  // ─── ScalarDecl = "scalar" Identifier

  const parseScalarDecl = (): ScalarNode => {
    const kw = expect('KEYWORD', 'scalar')
    const nameTok = expect('IDENTIFIER')
    return { kind: 'scalar', name: nameTok.value, loc: locOf(kw) }
  }

  // ─── OpaqueDecl = "opaque" "stream" Identifier "{" OpaqueField+ "}"

  const parseOpaqueDecl = (): OpaqueNode => {
    const kw = expect('KEYWORD', 'opaque')
    expect('KEYWORD', 'stream')
    const nameTok = expect('IDENTIFIER')
    expect('LBRACE')
    let qos = ''
    let maxSize: number | null = null
    while (peek().kind !== 'RBRACE' && !isEOF()) {
      const k = peek()
      if (k.kind === 'KEYWORD' && k.value === 'qos') {
        pos++; expect('COLON')
        const v = peek()
        if (v.kind !== 'IDENTIFIER' && v.kind !== 'KEYWORD') {
          fail(`expected qos value, got "${v.value}"`, v)
        }
        pos++
        qos = v.value
      } else if (k.kind === 'KEYWORD' && k.value === 'max_size') {
        pos++; expect('COLON')
        maxSize = parseInt(expect('INT_LIT').value, 10)
      } else {
        fail(`unexpected opaque stream field "${k.value}"`, k)
      }
      accept('COMMA')
    }
    expect('RBRACE')
    return { kind: 'opaque', name: nameTok.value, qos, maxSize, loc: locOf(kw) }
  }

  // ── Kick off

  const ast = parseFile()
  return { ast, diagnostics }
}
