// @alaq/mcp launcher.
//
// Per DESIGN.md §3.5.1 (Launcher decision tree), `alaq mcp start` and
// `alaq mcp call` route through this module. The decision:
//
//   1. Detect host runtime (process.versions.bun → Bun, else Node).
//   2. Resolve @alaq/mcp.
//   3. Under Bun, spawn the upstream Bun-source entry. Under Node, spawn
//      the bundled Node-compatible copy shipped in dist/ (future).
//
// Current alpha: we only use path (a) — resolve @alaq/mcp from node_modules
// and spawn it with the active runtime (Bun or Node).
// The Node-bundled fallback is a later concern; see DESIGN.md §7.0.

import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'

import type { Code } from './errors'
import { alaqError, CODES, type AlaqError } from './errors'

export type MCPMode = 'start' | 'call'

export interface SpawnMcpResult {
  ok: true
  child: ChildProcess
}

export interface SpawnMcpError {
  ok: false
  error: AlaqError
}

/**
 * Spawns @alaq/mcp on stdio. Forwards SIGINT/SIGTERM. The caller is
 * responsible for piping stdin/stdout and for handling the exit code.
 *
 * Deliberately thin — MCP is a framed stdio protocol and this function
 * must not buffer or mangle lines.
 */
export function spawnMcp(mode: MCPMode = 'start', extraArgs: string[] = []): SpawnMcpResult | SpawnMcpError {
  const entry = resolveUpstreamEntry()
  if (!entry) {
    return {
      ok: false,
      error: alaqError(
        CODES.E005_MCP_SPAWN_FAILED as Code,
        '@alaq/mcp could not be resolved',
        'ensure `npm install alaq` finished and node_modules is intact',
      ),
    }
  }

  const bin = mode === 'call' ? entry.callBin : entry.startBin
  if (!bin || !existsSync(bin)) {
    return {
      ok: false,
      error: alaqError(
        CODES.E006_MCP_BUNDLE_MISSING as Code,
        `@alaq/mcp entry for mode "${mode}" not found on disk`,
        `looked for: ${bin ?? '(no bin field)'}`,
      ),
    }
  }

  const runtime = process.execPath // active `bun` or `node`
  const opts: SpawnOptions = { stdio: 'inherit', windowsHide: true }
  try {
    const child = spawn(runtime, [bin, ...extraArgs], opts)
    forwardSignals(child)
    return { ok: true, child }
  } catch (cause) {
    return {
      ok: false,
      error: alaqError(
        CODES.E005_MCP_SPAWN_FAILED as Code,
        `failed to spawn: ${runtime} ${bin}`,
        undefined,
        cause,
      ),
    }
  }
}

/** Resolves @alaq/mcp's bin entries from the package.json `bin` field. */
function resolveUpstreamEntry(): { root: string; startBin: string | null; callBin: string | null } | null {
  try {
    // createRequire against a file path that exists in this package.
    const req = createRequire(join(process.cwd(), 'package.json'))
    const pkgPath = req.resolve('@alaq/mcp/package.json')
    const pkg = req('@alaq/mcp/package.json') as {
      bin?: Record<string, string> | string
    }
    const root = dirname(pkgPath)
    const bin = normalizeBin(pkg.bin)
    return {
      root,
      startBin: bin['alaq-mcp'] ? join(root, bin['alaq-mcp']) : null,
      callBin: bin['alaq-mcp-call'] ? join(root, bin['alaq-mcp-call']) : null,
    }
  } catch {
    return null
  }
}

function normalizeBin(bin: Record<string, string> | string | undefined): Record<string, string> {
  if (!bin) return {}
  if (typeof bin === 'string') return { 'alaq-mcp': bin }
  return bin
}

function forwardSignals(child: ChildProcess): void {
  const forward = (sig: NodeJS.Signals) => () => {
    if (!child.killed) child.kill(sig)
  }
  process.on('SIGINT', forward('SIGINT'))
  process.on('SIGTERM', forward('SIGTERM'))
  child.on('exit', code => {
    // Propagate child's exit code unchanged.
    process.exit(code ?? 0)
  })
}
