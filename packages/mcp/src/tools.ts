// Tool implementations — pure async functions. Decoupled from the MCP
// transport so they can be unit-tested directly.

import { compileSources, type MultiFileInput, type CompileResult } from '../../graph/src/index'
import { diffIR, type DiffReport } from './diff'
import { resolve, isAbsolute, sep } from 'node:path'
import { readFile } from 'node:fs/promises'

// ────────────────────────────────────────────────────────────────
// Path resolution — accepts either inline {path, source} pairs or
// {paths[], rootDir}. With rootDir, every path is resolved against it
// and must stay inside (no .. traversal). Without rootDir, paths must
// already be absolute. Returns MultiFileInput[] ready for compileSources.

export interface PathSource {
  paths: string[]
  rootDir?: string
}

async function loadFromPaths(args: PathSource, toolName: string): Promise<MultiFileInput[]> {
  if (!Array.isArray(args.paths) || args.paths.length === 0) {
    throw new Error(`${toolName}: "paths" must be a non-empty string array`)
  }
  const root = args.rootDir ? resolve(args.rootDir) : null
  const inputs: MultiFileInput[] = []
  for (const p of args.paths) {
    if (typeof p !== 'string') {
      throw new Error(`${toolName}: every path must be a string`)
    }
    let abs: string
    if (root) {
      abs = resolve(root, p)
      const rootWithSep = root.endsWith(sep) ? root : root + sep
      if (abs !== root && !abs.startsWith(rootWithSep)) {
        throw new Error(
          `${toolName}: path "${p}" escapes rootDir "${root}" — refusing to read`,
        )
      }
    } else {
      if (!isAbsolute(p)) {
        throw new Error(
          `${toolName}: path "${p}" is not absolute and no rootDir was given`,
        )
      }
      abs = p
    }
    const source = await readFile(abs, 'utf8')
    inputs.push({ path: abs, source })
  }
  return inputs
}

function validateInlineInputs(inputs: unknown, toolName: string): MultiFileInput[] {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new Error(`${toolName}: "inputs" must be a non-empty array of {path, source}`)
  }
  for (const i of inputs as MultiFileInput[]) {
    if (!i || typeof i.path !== 'string' || typeof i.source !== 'string') {
      throw new Error(`${toolName}: every input must have string {path, source}`)
    }
  }
  return inputs as MultiFileInput[]
}

// ────────────────────────────────────────────────────────────────
// schema_compile

export interface SchemaCompileInput {
  /** Inline mode: provide source text directly. */
  inputs?: MultiFileInput[]
  /** Filesystem mode: read these paths from disk. */
  paths?: string[]
  /** Resolve `paths` relative to this directory (sandbox boundary). */
  rootDir?: string
}

export interface SchemaCompileOutput {
  ok: boolean
  ir: CompileResult['ir']
  diagnostics: CompileResult['diagnostics']
  files: string[]
}

export async function schemaCompile(args: SchemaCompileInput): Promise<SchemaCompileOutput> {
  if (!args) throw new Error('schema_compile: arguments required')
  let inputs: MultiFileInput[]
  if (args.paths) {
    inputs = await loadFromPaths({ paths: args.paths, rootDir: args.rootDir }, 'schema_compile')
  } else {
    inputs = validateInlineInputs(args.inputs, 'schema_compile')
  }
  const res = compileSources(inputs)
  const errCount = res.diagnostics.filter(d => d.severity === 'error').length
  return {
    ok: errCount === 0 && res.ir !== null,
    ir: res.ir,
    diagnostics: res.diagnostics,
    files: Object.keys(res.files),
  }
}

// ────────────────────────────────────────────────────────────────
// schema_diff

export interface SchemaDiffSide {
  inputs?: MultiFileInput[]
  paths?: string[]
  rootDir?: string
}

export interface SchemaDiffInput {
  before: MultiFileInput[] | SchemaDiffSide
  after: MultiFileInput[] | SchemaDiffSide
}

export interface SchemaDiffOutput {
  ok: boolean
  report: DiffReport | null
  diagnostics: { before: number; after: number }
  message?: string
}

async function resolveSide(
  side: MultiFileInput[] | SchemaDiffSide,
  toolName: string,
): Promise<MultiFileInput[]> {
  if (Array.isArray(side)) return validateInlineInputs(side, toolName)
  if (side.paths) {
    return loadFromPaths({ paths: side.paths, rootDir: side.rootDir }, toolName)
  }
  return validateInlineInputs(side.inputs, toolName)
}

export async function schemaDiff(args: SchemaDiffInput): Promise<SchemaDiffOutput> {
  if (!args || !args.before || !args.after) {
    throw new Error('schema_diff: "before" and "after" are required')
  }
  const beforeInputs = await resolveSide(args.before, 'schema_diff')
  const afterInputs = await resolveSide(args.after, 'schema_diff')
  const beforeRes = compileSources(beforeInputs)
  const afterRes = compileSources(afterInputs)
  const beforeErr = beforeRes.diagnostics.filter(d => d.severity === 'error').length
  const afterErr = afterRes.diagnostics.filter(d => d.severity === 'error').length

  if (!beforeRes.ir || !afterRes.ir) {
    return {
      ok: false,
      report: null,
      diagnostics: { before: beforeErr, after: afterErr },
      message: 'one or both schemas failed to compile — see diagnostics counts',
    }
  }

  return {
    ok: true,
    report: diffIR(beforeRes.ir, afterRes.ir),
    diagnostics: { before: beforeErr, after: afterErr },
  }
}

// runtime_observe — connects to a LinkServer over WebSocket and collects
// SNAPSHOT messages for the requested duration. Imported lazily so the MCP
// server starts even when @alaq/link's WebSocket dep can't be resolved
// (e.g. in CI without ws lib).

export interface RuntimeObserveInput {
  url: string
  scope?: string
  durationMs?: number
}

export interface RuntimeObserveOutput {
  ok: boolean
  url: string
  scope: string | null
  durationMs: number
  snapshots: unknown[]
  message?: string
}

export async function runtimeObserve(args: RuntimeObserveInput): Promise<RuntimeObserveOutput> {
  if (!args || typeof args.url !== 'string') {
    throw new Error('runtime_observe: "url" (string) is required')
  }
  const durationMs = Math.max(100, Math.min(args.durationMs ?? 2000, 30_000))
  const scope = args.scope ?? null
  const snapshots: unknown[] = []

  const WS = (globalThis as any).WebSocket
  if (!WS) {
    return {
      ok: false,
      url: args.url,
      scope,
      durationMs,
      snapshots,
      message: 'no global WebSocket — run on Bun 1.3+ or Node 22+',
    }
  }

  return await new Promise<RuntimeObserveOutput>(resolve => {
    let ws: any
    let timer: any
    const finish = (message?: string) => {
      try {
        ws?.close()
      } catch {}
      clearTimeout(timer)
      resolve({ ok: !message, url: args.url, scope, durationMs, snapshots, message })
    }
    try {
      ws = new WS(args.url)
    } catch (e: any) {
      return finish(`connect failed: ${e?.message ?? e}`)
    }
    ws.onerror = (e: any) => finish(`socket error: ${e?.message ?? 'unknown'}`)
    ws.onopen = () => {
      if (scope) {
        try {
          ws.send(JSON.stringify({ op: 'SUBSCRIBE', scope }))
        } catch {}
      }
      timer = setTimeout(() => finish(), durationMs)
    }
    ws.onmessage = (ev: any) => {
      try {
        const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
        snapshots.push(data)
      } catch {
        snapshots.push({ raw: String(ev.data) })
      }
    }
  })
}
