// @alaq/graph — public entry point.
//
// Tiny orchestrator on top of lexer → parser → IR builder → validator.
// Zero runtime dependencies.

import { lex } from './lexer'
import { parse } from './parser'
import { buildIR } from './ir'
import { validate } from './validator'
import { link, prelink } from './linker'
import type { IR, Diagnostic, FileAST, SchemaDeclNode } from './types'
import { diag, MSG } from './errors'

export interface ParseResult {
  ir: IR | null
  diagnostics: Diagnostic[]
  /** Raw AST — exposed for tooling; generators should consume IR. */
  ast?: FileAST
}

export function parseSource(source: string, filename?: string): ParseResult {
  const diagnostics: Diagnostic[] = []

  // 1. Lex
  const lexRes = lex(source, filename)
  diagnostics.push(...lexRes.diagnostics)

  // 2. Parse
  const parseRes = parse(lexRes.tokens, filename)
  diagnostics.push(...parseRes.diagnostics)
  const ast = parseRes.ast

  // 3. Post-parse structural checks that depend on a valid AST
  if (ast.schema) {
    // E018 — missing required schema fields
    if (!ast.schema.hasNamespace) {
      diagnostics.push(diag('E018', MSG.E018('namespace'), ast.schema.loc))
    }
    if (!ast.schema.hasVersion) {
      diagnostics.push(diag('E018', MSG.E018('version'), ast.schema.loc))
    }
  } else {
    // No `schema` block — per Variant A (task brief) → E018.
    diagnostics.push(
      diag('E018', MSG.E018('schema block'), { file: filename, line: 1, column: 1 }),
    )
  }

  // 4. Build IR (only if we have a schema and a namespace)
  let ir: IR | null = null
  if (ast.schema && ast.schema.namespace) {
    ir = buildIR(ast)

    // 5. Validate (uses AST for source locations + richer analysis)
    const importedTypes = new Set<string>()
    for (const u of ast.uses) {
      for (const imp of u.imports) importedTypes.add(imp)
    }
    diagnostics.push(...validate(ir, { ast, importedTypes, skipUseResolution: true }))
  }

  // Dedup E018 in case both parser and validator emitted the same.
  const seen = new Set<string>()
  const deduped: Diagnostic[] = []
  for (const d of diagnostics) {
    const k = `${d.code}:${d.line}:${d.column}:${d.message}`
    if (seen.has(k)) continue
    seen.add(k)
    deduped.push(d)
  }

  return { ir, diagnostics: deduped, ast }
}

export async function parseFile(path: string): Promise<ParseResult> {
  // Node/Bun-neutral read: prefer Bun's fast reader when present.
  let source: string
  if (typeof (globalThis as any).Bun !== 'undefined') {
    source = await (globalThis as any).Bun.file(path).text()
  } else {
    const fs = await import('node:fs/promises')
    source = await fs.readFile(path, 'utf8')
  }
  return parseSource(source, path)
}

export function validateIR(ir: IR): Diagnostic[] {
  // Re-exported for consumers holding an IR directly. Loses source-location
  // fidelity and skips AST-only checks (E010, E011 partly, W001, E018).
  return validate(ir, { skipUseResolution: true })
}

// Aliased export to match the task brief name.
export { validateIR as validate }

// ────────────────────────────────────────────────────────────────
// Multi-file compilation
// ────────────────────────────────────────────────────────────────

export interface MultiFileInput {
  /** Absolute or relative filesystem path. */
  path: string
  /** File contents (no BOM). */
  source: string
}

export interface CompileResult {
  /** Merged IR across all files, or null if no namespace was found. */
  ir: IR | null
  /** All diagnostics: per-file + link-time. */
  diagnostics: Diagnostic[]
  /** Per-file IR keyed by the input path (before merge). */
  files: Record<string, IR | null>
}

/**
 * Compile pre-loaded file sources into a single merged IR. Pure function —
 * does not touch the filesystem. Used by `compileFiles` under the hood and
 * by tests that want full determinism.
 */
export function compileSources(inputs: MultiFileInput[]): CompileResult {
  const { perFile, linkerFiles, diagnostics: parseDiags } = prelink(
    inputs.map(i => ({ path: i.path, source: i.source })),
    parseSource,
  )

  // If nothing was parseable, return early.
  if (linkerFiles.length === 0) {
    return { ir: null, diagnostics: parseDiags, files: perFile }
  }

  const { merged, diagnostics: linkDiags } = link(linkerFiles)

  // If no namespace was produced by merge, surface null IR.
  const ir = Object.keys(merged.schemas).length > 0 ? merged : null

  return {
    ir,
    diagnostics: [...parseDiags, ...linkDiags],
    files: perFile,
  }
}

/**
 * Compile by reading from the filesystem. Thin wrapper around
 * `compileSources` that preserves the input order.
 */
export async function compileFiles(paths: string[]): Promise<CompileResult> {
  const inputs: MultiFileInput[] = []
  for (const p of paths) {
    let source: string
    if (typeof (globalThis as any).Bun !== 'undefined') {
      source = await (globalThis as any).Bun.file(p).text()
    } else {
      const fs = await import('node:fs/promises')
      source = await fs.readFile(p, 'utf8')
    }
    inputs.push({ path: p, source })
  }
  return compileSources(inputs)
}

export type {
  IR,
  Diagnostic,
  DiagnosticCode,
  FileAST,
  IRDirective,
  IRTypeRef,
  IRField,
  IRRecord,
  IRAction,
  IREnum,
  IRScalar,
  IROpaque,
  IREvent,
  IRSchema,
} from './types'
