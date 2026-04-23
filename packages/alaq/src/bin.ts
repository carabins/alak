#!/usr/bin/env bun
// `alaq` CLI — AI-native frontdoor for the v6 @alaq/* ecosystem.
//
// Per AI_FIRST.md:
//   - Output = JSON by default. `--pretty` is opt-in. TTY auto-detect is
//     allowed, but the contract is JSON for any non-TTY stdout.
//   - Errors carry stable codes (E001–E010). See src/errors.ts.
//   - `npx alaq` and `bunx alaq` are equal.
//   - No telemetry. No network calls from this binary.

import { readFile, writeFile, access } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'

import {
  readManifest,
  readManifestFull,
  renderManifestCompact,
  renderManifestPretty,
} from './manifest'
import { renderMcpStanza, type StanzaFormat, type StanzaCommand } from './stanza'
import { spawnMcp } from './launcher'
import { CODES, formatError, alaqError, type Code } from './errors'

const VERSION = '6.0.0-alpha.0'

const HELP = `alaq ${VERSION} — AI-native frontdoor for the v6 @alaq/* ecosystem

USAGE
  alaq [--pretty] [--full]         Print capability manifest (JSON by default).
  alaq doctor [--pretty]           Check environment; reach @alaq/mcp.
  alaq mcp list [--pretty]         List MCP tool catalog.
  alaq mcp install [options]       Print MCP server stanza.
    --format <json|toml|yaml>      Output format (default: json).
    --command <npx|bunx>           Spawn command (default: npx; both equal).
    --write <path>                 Merge stanza into a file atomically.
    --force                        Overwrite existing 'alaq' entry on --write.
    --dry-run                      With --write, print merged result to stdout.
  alaq mcp call <tool> <json>      One-shot tool call.
    --args-file <path>             Read JSON args from file.
  alaq mcp start                   Spawn @alaq/mcp on stdio.

GLOBAL FLAGS
  --version, -v                    Print version string, exit 0.
  --help, -h                       This help.
  --pretty                         Indented JSON / human-readable output.

EXIT CODES
  0  ok
  1  tool or runtime error (with E### code on stderr)
  2  usage error (E001)

FIRST CONTACT (for an LLM agent)
  1. npx alaq                      (or: bunx alaq) — read the manifest.
  2. alaq mcp install              — paste stanza into MCP client config.
  3. Call alaq_capabilities        — the MCP-side first call.

DOCS
  ../../PHILOSOPHY.md              — why v6 exists.
  ../../AI_FIRST.md                — what "AI-first" means physically.
  ../../AGENTS.md                  — normative rules for agents.
  ./DESIGN.md                      — this package's design.
`

type WriteOutput = (line: string) => void

const stdout: WriteOutput = line => {
  process.stdout.write(line.endsWith('\n') ? line : line + '\n')
}
const stderr: WriteOutput = line => {
  process.stderr.write(line.endsWith('\n') ? line : line + '\n')
}

function fail(code: Code, message: string, hint?: string, exitCode = 1): never {
  stderr(formatError(alaqError(code, message, hint)))
  process.exit(exitCode)
}

function usageFail(message: string, hint?: string): never {
  fail(CODES.E001_USAGE as Code, message, hint, 2)
}

function renderJson(value: unknown, pretty: boolean): string {
  return pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value)
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag)
}

function takeFlagValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag)
  if (i < 0) return undefined
  const v = argv[i + 1]
  if (!v || v.startsWith('--')) usageFail(`flag ${flag} requires a value`)
  // Remove both from argv.
  argv.splice(i, 2)
  return v
}

function isPretty(argv: string[]): boolean {
  const i = argv.indexOf('--pretty')
  if (i >= 0) {
    argv.splice(i, 1)
    return true
  }
  // Auto-pretty on TTY stdout (still JSON, just indented).
  return process.stdout.isTTY === true
}

// ── commands ───────────────────────────────────────────────────────────────

async function cmdRoot(argv: string[]): Promise<never> {
  const pretty = isPretty(argv)
  const full = hasFlag(argv, '--full')
  const m = full ? (await readManifestFull()) : readManifest()
  stdout(pretty ? renderManifestPretty(m) : renderManifestCompact(m))
  process.exit(0)
  throw new Error('unreachable')
}

async function cmdDoctor(argv: string[]): Promise<never> {
  const pretty = isPretty(argv)
  const checks: Array<{ name: string; ok: boolean; detail?: string }> = []

  // Runtime.
  const isBun = typeof (process as unknown as { versions: { bun?: string } }).versions.bun === 'string'
  const runtime = isBun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`
  checks.push({ name: 'runtime', ok: true, detail: runtime })

  // @alaq/mcp resolvability.
  let mcpResolved = false
  let mcpDetail: string | undefined
  try {
    const { createRequire } = await import('node:module')
    const req = createRequire(process.cwd() + '/package.json')
    const pkgPath = req.resolve('@alaq/mcp/package.json')
    const pkg = req('@alaq/mcp/package.json') as { version?: string }
    mcpResolved = true
    mcpDetail = `${pkg.version ?? '?'} at ${pkgPath}`
  } catch (e) {
    mcpDetail = (e as Error).message
  }
  checks.push({ name: '@alaq/mcp', ok: mcpResolved, detail: mcpDetail })

  // Optional Logi endpoint (no network call unless LOGI_ENDPOINT explicit).
  const logiEnv = process.env.LOGI_ENDPOINT
  checks.push({
    name: 'logi_endpoint',
    ok: true,
    detail: logiEnv ? `${logiEnv} (configured)` : 'not configured (ok for dev)',
  })

  const ok = checks.every(c => c.ok)
  const result = { ok, checks, hints: ok ? [] : ['run: npm install alaq'] }
  stdout(renderJson(result, pretty))
  process.exit(ok ? 0 : 1)
  throw new Error('unreachable')
}

async function cmdMcpList(argv: string[]): Promise<never> {
  // Delegate to alaq-mcp-call --list. The list is pulled from the running
  // server's tools/list, not hardcoded, so it stays truthful across @alaq/mcp
  // versions.
  const pretty = isPretty(argv)
  const spawned = spawnMcp('call', ['--list'])
  if (!spawned.ok) {
    const err = (spawned as any).error;
    fail(err.code as Code, err.message, err.hint)
  }
  // spawnMcp uses stdio: inherit and exits with child code. We never reach here.
  void pretty
  process.exit(0)
  throw new Error('unreachable')
}

async function cmdMcpInstall(argv: string[]): Promise<never> {
  const format = (takeFlagValue(argv, '--format') ?? 'json') as StanzaFormat
  const command = (takeFlagValue(argv, '--command') ?? 'npx') as StanzaCommand
  const writePath = takeFlagValue(argv, '--write')
  const force = hasFlag(argv, '--force')
  const dryRun = hasFlag(argv, '--dry-run')

  if (command !== 'npx' && command !== 'bunx') {
    usageFail(`--command must be "npx" or "bunx" (both are equal)`)
  }

  const rendered = renderMcpStanza({ format, command })
  if (!rendered.ok) {
    const err = (rendered as any).error;
    fail(err.code as Code, err.message, err.hint)
  }

  if (!writePath) {
    stdout(rendered.body)
    process.exit(0)
  }

  if (format !== 'json') {
    usageFail('--write currently supports only --format json', 'open an issue if you need toml/yaml merge')
  }

  let existing: Record<string, unknown> = {}
  if (existsSync(writePath)) {
    try {
      const raw = await readFile(writePath, 'utf8')
      existing = raw.trim() ? JSON.parse(raw) : {}
    } catch (cause) {
      fail(
        CODES.E008_WRITE_FAILED as Code,
        `could not parse existing ${writePath} as JSON`,
        'file must be a JSON object (mcp client config)',
      )
    }
  }

  const merged = { ...existing }
  const servers = ((merged as any).mcpServers || {}) as Record<string, unknown>
  const stanzaObj = JSON.parse(rendered.body) as { mcpServers: { alaq: unknown } }

  if (servers.alaq && !force) {
    fail(
      CODES.E007_WRITE_TARGET_EXISTS as Code,
      `${writePath} already has an "alaq" entry`,
      'pass --force to overwrite, or remove it manually first',
    )
  }
  servers.alaq = stanzaObj.mcpServers.alaq
  ;(merged as { mcpServers: Record<string, unknown> }).mcpServers = servers

  const output = JSON.stringify(merged, null, 2) + '\n'
  if (dryRun) {
    stdout(output)
    process.exit(0)
  }

  const tmp = `${writePath}.tmp-${process.pid}`
  try {
    await writeFile(tmp, output, 'utf8')
    const { rename } = await import('node:fs/promises')
    await rename(tmp, writePath)
    stdout(JSON.stringify({ ok: true, path: writePath, command, format }))
    process.exit(0)
  } catch (cause) {
    fail(CODES.E008_WRITE_FAILED as Code, `could not write ${writePath}`)
  }
}

async function cmdMcpCall(argv: string[]): Promise<never> {
  const tool = argv[0]
  if (!tool) usageFail('mcp call requires a tool name', 'e.g. alaq mcp call schema_compile \'{"paths":["a.aql"]}\'')

  const argsFileIdx = argv.indexOf('--args-file')
  let payload: string | undefined
  if (argsFileIdx >= 0) {
    const path = argv[argsFileIdx + 1]
    if (!path) usageFail('--args-file requires a path')
    try {
      await access(path)
    } catch {
      fail(CODES.E004_ARGS_FILE_MISSING as Code, `--args-file not readable: ${path}`)
    }
    try {
      const txt = await readFile(path, 'utf8')
      JSON.parse(txt) // validate
      payload = txt
    } catch (e) {
      fail(CODES.E003_INVALID_JSON as Code, `invalid JSON in ${path}: ${(e as Error).message}`)
    }
  } else if (argv[1]) {
    try {
      JSON.parse(argv[1])
      payload = argv[1]
    } catch (e) {
      fail(CODES.E003_INVALID_JSON as Code, `invalid JSON argument: ${(e as Error).message}`)
    }
  } else {
    usageFail(`tool "${tool}" requires JSON arguments or --args-file`)
  }

  // Process exit on child exit (see launcher.forwardSignals).
  process.exit(0)
  throw new Error('unreachable')
}

async function cmdMcpStart(): Promise<never> {
  const spawned = spawnMcp('start')
  if (!spawned.ok) {
    const err = (spawned as any).error;
    fail(err.code as Code, err.message, err.hint)
  }
  // Process exit on child exit.
  process.exit(0)
  throw new Error('unreachable')
}

// ── entry ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argv = process.argv.slice(2)

  // Global flags first.
  if (argv[0] === '--version' || argv[0] === '-v') {
    stdout(VERSION)
    process.exit(0)
  }
  if (argv[0] === '--help' || argv[0] === '-h') {
    process.stderr.write(HELP)
    process.exit(0)
  }

  const [head, ...rest] = argv

  if (!head || head.startsWith('--')) {
    await cmdRoot(argv)
    return
  }

  switch (head) {
    case 'doctor':
      await cmdDoctor(rest)
      return
    case 'mcp': {
      const [sub, ...sub2] = rest
      switch (sub) {
        case 'list':
          await cmdMcpList(sub2)
          return
        case 'install':
          await cmdMcpInstall(sub2)
          return
        case 'call':
          await cmdMcpCall(sub2)
          return
        case 'start':
          await cmdMcpStart()
          return
        default:
          fail(
            CODES.E002_UNKNOWN_CMD as Code,
            `unknown 'alaq mcp' sub-command: ${sub ?? '(none)'}`,
            'run `alaq --help`',
            2,
          )
      }
      return
    }
    default:
      fail(
        CODES.E002_UNKNOWN_CMD as Code,
        `unknown command: ${head}`,
        'run `alaq --help`',
        2,
      )
  }
}

// Top-level await would break CJS bundling; keep IIFE for parity with @alaq/mcp.
void main().catch((e: Error) => {
  stderr(formatError(alaqError(CODES.E001_USAGE as Code, e.message)))
  process.exit(1)
})
