// Error code registry for `alaq` itself.
//
// Per AI_FIRST.md §2 (Structured error codes), every error the CLI surfaces
// carries a stable code. The code is the automation handle; the text may vary.
//
// Ownership:
//   E001–E099   — `alaq` CLI (this file)
//   E100+       — future sub-surfaces of the frontdoor
//
// Upstream tool errors (from @alaq/mcp, @alaq/graph) pass through with their
// own codes intact; this file does not re-wrap them.

export interface AlaqError {
  code: string
  message: string
  hint?: string
  cause?: unknown
}

export const CODES = {
  E001_USAGE: 'E001',
  E002_UNKNOWN_CMD: 'E002',
  E003_INVALID_JSON: 'E003',
  E004_ARGS_FILE_MISSING: 'E004',
  E005_MCP_SPAWN_FAILED: 'E005',
  E006_MCP_BUNDLE_MISSING: 'E006',
  E007_WRITE_TARGET_EXISTS: 'E007',
  E008_WRITE_FAILED: 'E008',
  E009_ARCHITECTURE_NOT_FOUND: 'E009',
  E010_UNSUPPORTED_FORMAT: 'E010',
} as const

export type CodeKey = keyof typeof CODES
export type Code = (typeof CODES)[CodeKey]

export const DESCRIPTIONS: Record<Code, string> = {
  E001: 'Usage error — flags or positional arguments are malformed.',
  E002: 'Unknown sub-command.',
  E003: 'Invalid JSON in --args-file or positional argument.',
  E004: '--args-file target does not exist or cannot be read.',
  E005: 'Failed to spawn @alaq/mcp server (resolve or exec step).',
  E006: 'Bundled Node fallback for @alaq/mcp is missing from dist/.',
  E007: '--write target already has an `alaq` entry; pass --force to overwrite.',
  E008: 'Atomic write to target path failed.',
  E009: 'architecture.yaml not found; manifest generation requires the monorepo checkout.',
  E010: 'Unsupported --format value; allowed: json | toml | yaml.',
}

export function alaqError(code: Code, message: string, hint?: string, cause?: unknown): AlaqError {
  return { code, message, hint, cause }
}

export function formatError(err: AlaqError): string {
  const base = `${err.code}: ${err.message}`
  return err.hint ? `${base}\n  hint: ${err.hint}` : base
}
