import { test, expect, describe } from 'bun:test'
import { lex } from '../src/lexer'

describe('lexer', () => {
  test('keywords and identifiers', () => {
    const { tokens, diagnostics } = lex('schema record Foo')
    expect(diagnostics).toEqual([])
    const kinds = tokens.map(t => t.kind)
    expect(kinds).toEqual(['KEYWORD', 'KEYWORD', 'IDENTIFIER', 'EOF'])
    expect(tokens[0]!.value).toBe('schema')
    expect(tokens[1]!.value).toBe('record')
    expect(tokens[2]!.value).toBe('Foo')
  })

  test('string literal', () => {
    const { tokens } = lex('"hello world"')
    expect(tokens[0]!.kind).toBe('STRING_LIT')
    expect(tokens[0]!.value).toBe('hello world')
  })

  test('string with escape', () => {
    const { tokens } = lex('"a\\nb"')
    expect(tokens[0]!.kind).toBe('STRING_LIT')
    expect(tokens[0]!.value).toBe('a\nb')
  })

  test('unterminated string emits diagnostic', () => {
    const { diagnostics } = lex('"oops')
    expect(diagnostics.length).toBeGreaterThan(0)
    expect(diagnostics[0]!.code).toBe('E000')
  })

  test('integer literals', () => {
    const { tokens } = lex('42 -7')
    expect(tokens[0]).toMatchObject({ kind: 'INT_LIT', value: '42' })
    expect(tokens[1]).toMatchObject({ kind: 'INT_LIT', value: '-7' })
  })

  test('float literal', () => {
    const { tokens } = lex('3.14')
    expect(tokens[0]).toMatchObject({ kind: 'FLOAT_LIT', value: '3.14' })
  })

  test('boolean literals', () => {
    const { tokens } = lex('true false')
    expect(tokens[0]).toMatchObject({ kind: 'BOOL_LIT', value: 'true' })
    expect(tokens[1]).toMatchObject({ kind: 'BOOL_LIT', value: 'false' })
  })

  test('punctuation', () => {
    const { tokens } = lex('{ } [ ] ( ) : , ! = @')
    const kinds = tokens.map(t => t.kind)
    expect(kinds.slice(0, -1)).toEqual([
      'LBRACE', 'RBRACE', 'LBRACKET', 'RBRACKET',
      'LPAREN', 'RPAREN', 'COLON', 'COMMA',
      'BANG', 'EQ', 'AT',
    ])
  })

  test('comments are skipped', () => {
    const { tokens, diagnostics } = lex('# line comment\nrecord X')
    expect(diagnostics).toEqual([])
    expect(tokens.map(t => t.value).slice(0, -1)).toEqual(['record', 'X'])
  })

  test('line/column tracking', () => {
    const { tokens } = lex('schema\n  Foo')
    expect(tokens[0]).toMatchObject({ line: 1, column: 1 })
    expect(tokens[1]).toMatchObject({ line: 2, column: 3 })
  })

  test('unknown character produces E000', () => {
    const { diagnostics } = lex('?')
    expect(diagnostics.length).toBeGreaterThan(0)
    expect(diagnostics[0]!.code).toBe('E000')
  })
})
