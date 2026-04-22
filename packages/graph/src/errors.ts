// @alaq/graph — diagnostic factory. Error codes and message templates per §12.
import type { Diagnostic, DiagnosticCode, SourceLoc } from './types'

const SEVERITY: Record<DiagnosticCode, 'error' | 'warning'> = {
  E000: 'error',
  E001: 'error',
  E002: 'error',
  E003: 'error',
  E004: 'error',
  E005: 'error',
  E006: 'error',
  E007: 'error',
  E008: 'error',
  E009: 'error',
  E010: 'error',
  E011: 'error',
  E012: 'error',
  E013: 'error',
  E014: 'error',
  E015: 'error',
  E016: 'error',
  E017: 'error',
  E018: 'error',
  E019: 'error',
  E020: 'error',
  E021: 'error',
  E022: 'error',
  E023: 'error',
  E024: 'error',
  // v0.3.5 (C7): @transport mismatch is now an error (generator-emitted).
  // Supersedes W005 — see §7.14 R221/R224 and §15 Changelog.
  E025: 'error',
  W001: 'warning',
  W002: 'warning',
  W003: 'warning',
  W004: 'warning',
  // W005 is retired as of v0.3.5 (replaced by E025). The entry is kept so
  // DiagnosticCode stays a strict superset of historical codes and any
  // stored/cached diagnostic referencing 'W005' still types.
  W005: 'warning',
}

export function diag(
  code: DiagnosticCode,
  message: string,
  loc: SourceLoc | { line: number; column: number; file?: string },
): Diagnostic {
  return {
    code,
    severity: SEVERITY[code],
    message,
    file: loc.file,
    line: loc.line,
    column: loc.column,
  }
}

// Friendly message templates. Arguments are inlined rather than using
// printf-style tokens — simpler, and the caller provides concrete names.
export const MSG = {
  E000: (what: string) => `parse error: ${what}`,

  E001: (name: string) => `unknown directive @${name}`,
  E002: (directive: string, arg: string) =>
    `directive @${directive} has no argument named "${arg}"`,
  E003: (directive: string, arg: string, expected: string) =>
    `directive @${directive} argument "${arg}" must be ${expected}`,
  E004: () => `@crdt(type: LWW_*) requires argument "key"`,
  E005: (field: string) =>
    `@crdt(key: "${field}") refers to a field that does not exist or is not Timestamp!/Int!`,
  E006: () => `@this is only valid on arguments of an action with a "scope"`,
  E007: (ns: string) => `namespace collision: "${ns}" declared in multiple files`,
  E008: (path: string) => `use path cannot be resolved: "${path}"`,
  E009: (type: string) => `field type references undefined type "${type}"`,
  E010: (name: string) => `duplicate field "${name}" across record and/or extend record`,
  E011: (name: string) => `extend record "${name}" where "${name}" is not in scope`,
  E012: (enumName: string, value: string) =>
    `@default value "${value}" is not a member of enum ${enumName}`,
  E013: (field: string, expected: string) =>
    `@default value for field "${field}" does not match type ${expected}`,
  E014: (cycle: string) => `cyclic type dependency without @sync(mode: LAZY) break: ${cycle}`,
  E015: (field: string) => `@range on non-numeric field "${field}"`,
  E016: () => `@range(min, max) where min > max`,
  E017: () => `two schema blocks declared in one file`,
  E018: (field: string) => `missing required schema field: ${field}`,
  E019: (scope: string) =>
    `action declares scope "${scope}" but no scoped records of that scope exist`,
  E020: () => `opaque stream max_size must be > 0`,
  E021: (name: string, path: string) =>
    `'use' imports undeclared name '${name}' from '${path}'`,
  E022: (type: string) => `Map key type must be scalar (got '${type}')`,
  E023: (directive: string, arg: string) =>
    `directive @${directive} is missing required argument "${arg}"`,
  E024: (eventName: string) =>
    `event ${eventName} cannot carry @scope — events are broadcast payloads, not lifecycle-bound state`,
  // v0.3.5 (C7): @transport mismatch is generator-level, now an error.
  E025: (generator: string, schemaNamespace: string, schemaTransport: string, supported: string) =>
    `schema "${schemaNamespace}" declares @transport(kind: "${schemaTransport}") ` +
    `which is outside ${generator} supported transports [${supported}]; ` +
    `generation refused (E025). Set @transport(kind: "any") or omit the directive to opt out.`,

  W001: (field: string) =>
    `@sync(qos: REALTIME) on composite field "${field}" without @atomic`,
  W002: (field: string) => `@store on "${field}" without explicit @sync; defaults to RELIABLE`,
  W003: (record: string) =>
    `record ${record} has @crdt but no Timestamp! field named "updated_at"`,
  W004: (what: string) => `directive declared but target does not use it: ${what}`,
  // W005 retired as of v0.3.5 (replaced by E025). Message template kept
  // for back-compat tooling that reads historical diagnostics by code.
  W005: (generator: string, schemaTransport: string, supported: string) =>
    `schema @transport(kind: "${schemaTransport}") does not match ` +
    `${generator} supported transports [${supported}]; generation proceeds`,
}
