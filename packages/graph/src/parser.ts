// @alaq/graph — recursive descent parser. Consumes Token[] → FileAST.
//
// Mirrors EBNF §2 with one function per production. R003: trailing comma OR
// comma-less fields both valid. The parser keeps going on errors by panicking
// to the nearest closing brace, so a single syntax mistake does not mask the
// rest of the file.
//
// v0.3.2 — COMMENT tokens are transparent to structural parsing: `peek` and
// friends skip over them automatically. The top-level loop is the ONLY place
// that inspects COMMENTs directly, so it can attach consecutive `#` lines
// immediately preceding a top-level declaration as `leadingComments`. Inside
// bodies (fields, directive args, action blocks, etc.) comments are silently
// dropped — this preserves R001 "not part of the parse tree" semantics while
// giving generators a read-only view of author-intended markers on
// definitions.

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
  EventNode,
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

  // Skip over any COMMENT tokens at `pos`. Called by peek/accept/expect to
  // make the parser's structural view transparent to comments. The top-level
  // loop uses `rawPeek` to inspect comments before this skip kicks in.
  const skipComments = () => {
    while (pos < tokens.length && tokens[pos]!.kind === 'COMMENT') pos++
  }

  /** Raw token at `pos` without skipping COMMENTs. Used by the top-level
   *  definition harvester to attach `leadingComments`. */
  const rawPeek = (off = 0): Token =>
    tokens[Math.min(pos + off, tokens.length - 1)]!

  const peek = (off = 0): Token => {
    skipComments()
    // Also skip COMMENTs that are interleaved in the logical offset window —
    // `peek(n)` is rare (only used for Map<…> lookahead) so a small linear
    // scan is fine.
    let cursor = pos
    let remaining = off
    while (cursor < tokens.length) {
      const t = tokens[cursor]!
      if (t.kind === 'COMMENT') { cursor++; continue }
      if (remaining === 0) return t
      remaining--
      cursor++
    }
    return tokens[tokens.length - 1]!
  }
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
    skipComments()
    const t = peek()
    if (t.kind !== kind || (value !== undefined && t.value !== value)) {
      fail(
        `expected ${value ? `"${value}"` : kind}, got ${t.kind === 'EOF' ? 'EOF' : `"${t.value}"`}`,
        t,
      )
    }
    pos++
    // Deliberately DO NOT skipComments() after advancing: at the end of a
    // top-level declaration the very next COMMENT token might belong to the
    // NEXT declaration (via harvestLeadingComments). The top-level loop
    // inspects raw token positions before any peek()/expect() would swallow
    // them. Other call sites see comments transparently because the next
    // peek/expect/accept call does its own leading skipComments().
    return t
  }

  const accept = (kind: Token['kind'], value?: string): Token | null => {
    skipComments()
    const t = peek()
    if (t.kind !== kind) return null
    if (value !== undefined && t.value !== value) return null
    pos++
    // See note in `expect` about not skipping trailing comments.
    return t
  }

  const isKeyword = (name: string) =>
    peek().kind === 'KEYWORD' && peek().value === name

  /**
   * Accept either an `IDENTIFIER` or a `KEYWORD` token at the current position
   * and advance past it. Used in positions where the grammar calls for an
   * identifier (field names, enum members, arg names) but the token might
   * carry the value of a reserved word like `version`, `scope`, `input`.
   *
   * v0.3.3 — contextual keywords. Reserved words remain keywords in the
   * structural positions the parser looks for (after `schema`, after `action`,
   * inside `opaque stream`, etc.), but anywhere the grammar wants an
   * identifier they're treated as ordinary identifiers. This lets users
   * declare `record R { version: String! }` without workarounds while keeping
   * `schema X { version: 1 }` unambiguous.
   *
   * Strict keywords that drive structure (`schema`, `record`, `extend`,
   * `action`, `enum`, `scalar`, `opaque`, `stream`, `use`, `true`, `false`)
   * are accepted by this helper as well — there is no grammar position where
   * the helper is called and a structural keyword would be valid, so
   * accepting them here is a no-op in practice. The list of contextual
   * keywords the tests cover is `version`, `scope`, `input`, `output`, `qos`,
   * `max_size`, `namespace` — see SPEC §2 "Reserved names".
   */
  const expectIdentOrKeyword = (): Token => {
    skipComments()
    const t = peek()
    if (t.kind !== 'IDENTIFIER' && t.kind !== 'KEYWORD') {
      fail(
        `expected identifier, got ${t.kind === 'EOF' ? 'EOF' : `"${t.value}"`}`,
        t,
      )
    }
    pos++
    return t
  }

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

  /**
   * Harvest the run of `#`-comment tokens starting at the current raw `pos`
   * and decide whether to attach them to the next top-level declaration.
   *
   * Attach rules (v0.3.2):
   *   - Comments must appear on consecutive source lines (no blank line
   *     between them).
   *   - The last comment's line + 1 must equal the next non-comment token's
   *     line — a blank line between block and keyword detaches.
   *   - Detached comments are dropped (consumed, but not returned), matching
   *     R001 ("not part of the parse tree") for anything the author did not
   *     intend as a marker on a definition.
   *
   * Returns `undefined` if no comments were attached so the caller can leave
   * `leadingComments` off the AST node entirely (we avoid empty-array noise).
   */
  const harvestLeadingComments = (): string[] | undefined => {
    if (rawPeek().kind !== 'COMMENT') return undefined
    const collected: { line: number; text: string }[] = []
    while (rawPeek().kind === 'COMMENT') {
      const t = rawPeek()
      // Detach on any non-consecutive gap within the comment run.
      if (collected.length > 0) {
        const prevLine = collected[collected.length - 1]!.line
        if (t.line !== prevLine + 1) {
          // Gap within the run — everything collected so far is orphaned,
          // start a fresh run from this comment onward.
          collected.length = 0
        }
      }
      collected.push({ line: t.line, text: t.value })
      pos++
    }
    // pos now sits on a non-COMMENT token (or EOF). Require the run to be
    // adjacent to it: last comment line + 1 === next token line.
    const next = rawPeek()
    if (collected.length === 0) return undefined
    const lastLine = collected[collected.length - 1]!.line
    if (next.kind === 'EOF' || next.line !== lastLine + 1) return undefined
    return collected.map(c => c.text)
  }

  const parseFile = (): FileAST => {
    const uses: UseDeclNode[] = []
    const definitions: Definition[] = []
    let schema: SchemaDeclNode | null = null

    // Skip leading `use` or `schema` in any order — tolerant:
    // SPEC requires SchemaDecl first, but being lenient here means better
    // diagnostics. We still enforce "one schema per file" (E017).
    //
    // NOTE: we use rawPeek-based termination here so that leading COMMENT
    // tokens are NOT skipped by the isEOF() check — otherwise harvesting
    // would see pos already past the comments. Inside the loop body we
    // switch back to peek-based helpers once the harvest finishes.
    while (rawPeek().kind !== 'EOF') {
      // Harvest any pending leading comments before dispatching. Attached to
      // record/extend/action/enum/scalar/opaque only; dropped otherwise.
      const pendingComments = harvestLeadingComments()
      // If the file ends with trailing orphan comments, harvest consumed
      // them; bail out cleanly.
      if (rawPeek().kind === 'EOF') break

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
        isKeyword('opaque') ||
        // v0.3.4 (W9): `event Name { … }` is dispatched here too.
        isKeyword('event')
      ) {
        const d = tryParse(parseDefinition)
        if (d) {
          if (pendingComments) d.leadingComments = pendingComments
          definitions.push(d)
        }
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

  // ─── SchemaDecl = "schema" Identifier { Directive } "{" SchemaField+ "}"
  //
  // v0.3.4 (W8): schema-level directives between the identifier and the
  // opening brace. Mirrors `record Name @dir { … }` placement so authors
  // learning SDL transfer the mental model directly. Unknown schema-level
  // directives are reported by the validator via the usual E001 path, not
  // here — the parser's job is to accept the grammar and preserve the
  // annotation for downstream consumers.

  const parseSchemaDecl = (): SchemaDeclNode => {
    const kw = expect('KEYWORD', 'schema')
    const nameTok = expect('IDENTIFIER')
    const directives = parseDirectives()
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

    const node: SchemaDeclNode = {
      name: nameTok.value,
      version,
      namespace,
      hasVersion,
      hasNamespace,
      loc: locOf(kw),
    }
    // v0.3.4 additive: only emit `directives` when at least one directive was
    // parsed, so pre-0.3.4 AST consumers observe the same shape for schemas
    // without directives.
    if (directives.length > 0) node.directives = directives
    return node
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
    // v0.3.4 (W9): first-class `event Name { … }` declaration.
    if (isKeyword('event')) return parseEventDecl()
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

  // ─── EventDecl = "event" Identifier { Directive } "{" { Field } "}"
  //
  // v0.3.4 (W9). Shape-identical to RecordDecl by design: events are a
  // broadcast/pub-sub payload declaration, not a state record. Reusing
  // parseFieldList + parseDirectives keeps the grammar tight — any field
  // syntax that works in a record works here too. Differences are purely
  // semantic and enforced downstream (IR bucket, generator wiring,
  // validator's E024 rejecting `@scope` — events are never scoped in
  // v0.3.4).

  const parseEventDecl = (): EventNode => {
    const kw = expect('KEYWORD', 'event')
    const nameTok = expect('IDENTIFIER')
    const directives = parseDirectives()
    expect('LBRACE')
    const fields = parseFieldList()
    expect('RBRACE')
    return {
      kind: 'event',
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
    // Field names accept contextual keywords (v0.3.3): e.g. `version: String!`
    // is a valid field declaration even though `version` is a reserved word
    // in schema-block position. See SPEC §2 "Reserved names".
    const nameTok = expectIdentOrKeyword()
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
    //
    // v0.3.4 — Map key is always required (SPEC §4.8 R023). We parse any `!`
    // the author put on the key position for diagnostic fidelity, then force
    // `keyType.required = true` before handing the node up. This mirrors
    // JSON/CBOR map semantics (a map key cannot be null) and lets generators
    // emit `HashMap<K, V>` rather than `HashMap<Option<K>, V>`. Syntactic `!`
    // on the key is redundant but accepted; no diagnostic is emitted (silent
    // no-op) to keep existing SDL like `Map<String, String>!` valid.
    if (t.kind === 'IDENTIFIER' && t.value === 'Map' && peek(1).kind === 'LT') {
      pos++ // consume "Map"
      expect('LT')
      const keyType = parseTypeExpr()
      // R023: pin key.required = true regardless of what the author wrote.
      keyType.required = true
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
      // Enum members accept contextual keywords (v0.3.3): e.g.
      // `enum E { version, scope, input }` is valid — the members become the
      // literal identifiers `version`, `scope`, `input`. See SPEC §2.
      values.push(expectIdentOrKeyword().value)
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
