// MCP server stanza renderer.
//
// Per AI_FIRST.md "Runtime parity: bun and npx are equal", the stanza's
// `command` can be "npx" or "bunx" — both spawn the same CLI through the same
// launcher. Neither is canonical; the user picks what matches how their MCP
// client launches subprocesses.
//
// Output formats: json (default), toml, yaml. All three encode the same shape.
// The rendering here is hand-rolled to stay zero-dep — the stanza is a fixed
// 3-level object; any YAML/TOML library would be overkill.

import type { Code } from './errors'
import { alaqError, CODES, type AlaqError } from './errors'

export type StanzaFormat = 'json' | 'toml' | 'yaml'
export type StanzaCommand = 'npx' | 'bunx'

export interface StanzaOptions {
  /** `npx` or `bunx`. Both are equal — `npx` is the common-machine default. */
  command?: StanzaCommand
  /** Output format. JSON is the MCP-standard config shape. */
  format?: StanzaFormat
  /** Optional env overrides. The default includes LOGI_ENDPOINT. */
  env?: Record<string, string>
}

export interface StanzaResult {
  ok: true
  format: StanzaFormat
  body: string
}

export interface StanzaError {
  ok: false
  error: AlaqError
}

const DEFAULT_ENV: Record<string, string> = {
  LOGI_ENDPOINT: 'http://localhost:2025',
}

/**
 * Renders the standard MCP server stanza for pasting into an MCP client's
 * config. Returns either a rendered body or a structured error.
 *
 * The stanza shape is stable across format choice:
 *
 *   mcpServers:
 *     alaq:
 *       command: npx | bunx
 *       args:    [-y, alaq, mcp, start]
 *       env:     { LOGI_ENDPOINT: ... }
 */
export function renderMcpStanza(opts: StanzaOptions = {}): StanzaResult | StanzaError {
  const command = opts.command ?? 'npx'
  const format = opts.format ?? 'json'
  const env = { ...DEFAULT_ENV, ...(opts.env ?? {}) }
  const args =
    command === 'bunx' ? ['alaq', 'mcp', 'start'] : ['-y', 'alaq', 'mcp', 'start']

  const shape = {
    mcpServers: {
      alaq: {
        command,
        args,
        env,
      },
    },
  }

  switch (format) {
    case 'json':
      return { ok: true, format, body: JSON.stringify(shape, null, 2) + '\n' }
    case 'toml':
      return { ok: true, format, body: toToml(shape) }
    case 'yaml':
      return { ok: true, format, body: toYaml(shape) }
    default:
      return {
        ok: false,
        error: alaqError(
          CODES.E010_UNSUPPORTED_FORMAT as Code,
          `unsupported stanza format: ${format as string}`,
          'use one of: json | toml | yaml',
        ),
      }
  }
}

// ── hand-rolled encoders for the fixed stanza shape ────────────────────────

function toToml(shape: { mcpServers: { alaq: { command: string; args: string[]; env: Record<string, string> } } }): string {
  const a = shape.mcpServers.alaq
  const argsArr = a.args.map(s => `"${escape(s)}"`).join(', ')
  const envLines = Object.entries(a.env)
    .map(([k, v]) => `${k} = "${escape(v)}"`)
    .join('\n')
  return [
    '[mcpServers.alaq]',
    `command = "${escape(a.command)}"`,
    `args = [${argsArr}]`,
    '',
    '[mcpServers.alaq.env]',
    envLines,
    '',
  ].join('\n')
}

function toYaml(shape: { mcpServers: { alaq: { command: string; args: string[]; env: Record<string, string> } } }): string {
  const a = shape.mcpServers.alaq
  const argsLines = a.args.map(s => `      - ${yamlScalar(s)}`).join('\n')
  const envLines = Object.entries(a.env)
    .map(([k, v]) => `      ${k}: ${yamlScalar(v)}`)
    .join('\n')
  return [
    'mcpServers:',
    '  alaq:',
    `    command: ${yamlScalar(a.command)}`,
    '    args:',
    argsLines,
    '    env:',
    envLines,
    '',
  ].join('\n')
}

function yamlScalar(s: string): string {
  // Quote if it starts with a reserved YAML character or contains special chars.
  if (/^[^"'#&*!|>%@`\s][^"#&*!|>\s]*$/.test(s) && !/^[-0-9]/.test(s)) return s
  return `"${escape(s)}"`
}

function escape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
