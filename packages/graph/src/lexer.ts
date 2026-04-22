// @alaq/graph — hand-written tokenizer. Follows EBNF §2.
//
// Produces a flat Token[] stream (plus EOF sentinel). Whitespace is skipped.
// Line/column tracking is 1-based.
//
// v0.3.2 — comments are emitted as `COMMENT` tokens (payload = comment body
// with leading `#` and one optional space stripped). Per SPEC R001 comments
// are still "not part of the parse tree" — the parser skips them for
// structural purposes, but may harvest them as `leadingComments` on top-level
// declarations. Pre-0.3.2 lexer dropped them entirely.
//
// The lexer is permissive: it reports lexical errors through diagnostics
// (never throws) and emits a best-effort token stream so the parser can
// continue and report further problems.

import { KEYWORDS, type Diagnostic, type Token, type TokenKind } from './types'
import { diag, MSG } from './errors'

export interface LexResult {
  tokens: Token[]
  diagnostics: Diagnostic[]
}

export function lex(source: string, file?: string): LexResult {
  const tokens: Token[] = []
  const diagnostics: Diagnostic[] = []

  let i = 0
  let line = 1
  let column = 1
  const len = source.length

  const peek = (off = 0) => (i + off < len ? source[i + off] : '')
  const advance = () => {
    const ch = source[i++]
    if (ch === '\n') {
      line++
      column = 1
    } else {
      column++
    }
    return ch
  }

  const push = (kind: TokenKind, value: string, l: number, c: number) => {
    tokens.push({ kind, value, line: l, column: c })
  }

  const isLetter = (ch: string) =>
    (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_'
  const isDigit = (ch: string) => ch >= '0' && ch <= '9'
  const isIdentChar = (ch: string) => isLetter(ch) || isDigit(ch)

  while (i < len) {
    const ch = peek()

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      advance()
      continue
    }

    // Comments: # ... \n  (R001). v0.3.2: emit as COMMENT token so the parser
    // can optionally attach leading comments to top-level declarations. The
    // newline itself is NOT consumed — whitespace handling above consumes it
    // on the next iteration, so the parser can still see line numbers to
    // determine adjacency (comment on line N vs keyword on line N+1 vs
    // blank line between them).
    if (ch === '#') {
      const cLine = line
      const cCol = column
      advance() // consume '#'
      // Preserve the raw comment body verbatim, then strip one optional
      // leading space for readability (`# foo` → `foo`, `#foo` → `foo`).
      // Trailing whitespace is trimmed; interior whitespace untouched.
      let body = ''
      while (i < len && peek() !== '\n') body += advance()
      if (body.length > 0 && body.charCodeAt(0) === 0x20) body = body.slice(1)
      // Trim trailing whitespace (spaces, tabs, \r) but not interior.
      body = body.replace(/[ \t\r]+$/u, '')
      push('COMMENT', body, cLine, cCol)
      continue
    }

    const startLine = line
    const startCol = column

    // Punctuation
    switch (ch) {
      case '{': advance(); push('LBRACE', '{', startLine, startCol); continue
      case '}': advance(); push('RBRACE', '}', startLine, startCol); continue
      case '[': advance(); push('LBRACKET', '[', startLine, startCol); continue
      case ']': advance(); push('RBRACKET', ']', startLine, startCol); continue
      case '(': advance(); push('LPAREN', '(', startLine, startCol); continue
      case ')': advance(); push('RPAREN', ')', startLine, startCol); continue
      case ':': advance(); push('COLON', ':', startLine, startCol); continue
      case ',': advance(); push('COMMA', ',', startLine, startCol); continue
      case '!': advance(); push('BANG', '!', startLine, startCol); continue
      case '=': advance(); push('EQ', '=', startLine, startCol); continue
      case '@': advance(); push('AT', '@', startLine, startCol); continue
      case '<': advance(); push('LT', '<', startLine, startCol); continue
      case '>': advance(); push('GT', '>', startLine, startCol); continue
    }

    // String literal: "..."  (R011)
    if (ch === '"') {
      advance()
      let s = ''
      let terminated = false
      while (i < len) {
        const c = peek()
        if (c === '"') { advance(); terminated = true; break }
        if (c === '\\') {
          advance()
          const esc = peek()
          advance()
          switch (esc) {
            case 'n': s += '\n'; break
            case 't': s += '\t'; break
            case 'r': s += '\r'; break
            case '\\': s += '\\'; break
            case '"': s += '"'; break
            default: s += esc
          }
          continue
        }
        if (c === '\n') break // unterminated
        s += c
        advance()
      }
      if (!terminated) {
        diagnostics.push(
          diag('E000', MSG.E000('unterminated string literal'), { file, line: startLine, column: startCol }),
        )
      }
      push('STRING_LIT', s, startLine, startCol)
      continue
    }

    // Numeric: [-]? digit+ ( . digit+ )?
    if (isDigit(ch) || (ch === '-' && isDigit(peek(1)))) {
      let numStr = ''
      if (ch === '-') { numStr += '-'; advance() }
      while (i < len && isDigit(peek())) { numStr += advance() }
      if (peek() === '.' && isDigit(peek(1))) {
        numStr += advance() // consume .
        while (i < len && isDigit(peek())) { numStr += advance() }
        push('FLOAT_LIT', numStr, startLine, startCol)
      } else {
        push('INT_LIT', numStr, startLine, startCol)
      }
      continue
    }

    // Identifier / keyword / bool literal
    if (isLetter(ch)) {
      let id = ''
      while (i < len && isIdentChar(peek())) id += advance()
      if (id === 'true' || id === 'false') {
        push('BOOL_LIT', id, startLine, startCol)
      } else if (KEYWORDS.has(id)) {
        push('KEYWORD', id, startLine, startCol)
      } else {
        push('IDENTIFIER', id, startLine, startCol)
      }
      continue
    }

    // Unknown character
    diagnostics.push(
      diag('E000', MSG.E000(`unexpected character "${ch}"`), { file, line: startLine, column: startCol }),
    )
    advance()
  }

  tokens.push({ kind: 'EOF', value: '', line, column })
  return { tokens, diagnostics }
}
