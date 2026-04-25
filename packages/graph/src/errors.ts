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
  // v0.3.6: `Any` placement and composite-CRDT-document consistency.
  // Both are validator-emitted; see SPEC §4.1 (E026), §7.15–§7.17 (E027).
  E026: 'error',
  E027: 'error',
  // v0.3.7: `@rename_case` placement — enum or record only.
  E028: 'error',
  // v0.3.9 (Wave 3A — DRIFT-2): centralised site validation. Generic
  // fallback for directives appearing at a site outside their declared
  // `DirectiveSignature.sites`. E028/E006/E024 keep tailored messages.
  E029: 'error',
  // v0.3.9 (Wave 3B — R236): hard-delete forbidden on @crdt_doc_member.
  // `soft_delete: { flag, ts_field }` is required; missing → E030.
  E030: 'error',
  // v0.3.9 (Wave 3B — B7 baseline checker, deferred to v0.4): structural
  // changes against a baseline IR that would invalidate live consumers.
  // E031-E034 are reserved by the catalog; the full diff implementation
  // lands in v0.4. The CLI flag (`aqc build --baseline=<git-ref>`) accepts
  // the option today and emits W009 (stub-active) per file.
  E031: 'error',
  E032: 'error',
  E033: 'error',
  E034: 'error',
  W001: 'warning',
  W002: 'warning',
  W003: 'warning',
  W004: 'warning',
  // v0.3.9 (Wave 3B): backward-compat advisories.
  W007: 'warning',  // optional field added in middle of record
  W008: 'warning',  // @envelope override-coherence (e.g. stream + block_first)
  W009: 'warning',  // @deprecated_field used; baseline-checker stub active
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

  // v0.3.6: `Any` used outside its permitted positions.
  // `where` describes the offending site (e.g. "action input argument",
  // "event field", "list element", "map key").
  E026: (where: string) =>
    `\`Any\` is not permitted as ${where}; ` +
    `allowed positions are record fields and Map<K, Any> values (SPEC §4.1)`,

  // v0.3.6: composite CRDT document inconsistency.
  // `doc` is the document id; `detail` names the specific trigger.
  E027: (doc: string, detail: string) =>
    `composite CRDT document "${doc}": ${detail}`,

  // v0.3.7: @rename_case only applies to enum or record declarations.
  // `where` names the offending site (e.g. "field", "action", "scalar",
  // "opaque", "event").
  E028: (where: string) =>
    `@rename_case is only valid on \`enum\` or \`record\` declarations; ` +
    `applied to ${where}`,

  // v0.3.9 (Wave 3A — DRIFT-2): generic site-mismatch. `where` is the
  // canonical Site enum value the directive was found at; `allowed` is the
  // signature's permitted set.
  E029: (directive: string, where: string, allowed: readonly string[]) =>
    `directive @${directive} is not valid on ${where}; ` +
    `allowed sites: ${allowed.join(', ')}`,

  // v0.3.9 (Wave 3B — R236): @crdt_doc_member without soft_delete. Hard
  // delete is forbidden for composite-document members; tombstone-by-flag
  // (`soft_delete: { flag, ts_field }`) MUST be supplied so peers replay
  // deletes deterministically. Records that genuinely need hard delete
  // must opt out with `@breaking_change(reason: "...")`.
  E030: (record: string) =>
    `record "${record}" carries @crdt_doc_member but no soft_delete; ` +
    `hard-delete is forbidden (R236). ` +
    `Add soft_delete: { flag: "...", ts_field: "..." } or opt out with @breaking_change(reason: ...)`,

  // v0.3.9 (Wave 3B — B7, deferred to v0.4): backward-compat baseline-
  // checker error catalog. The CLI today accepts `--baseline=<git-ref>`
  // but only emits a stub warning; the full diff lives in v0.4. Messages
  // are placeholders so that catalog references resolve.
  E031: (field: string) =>
    `field "${field}" type changed in a wire-incompatible way without ` +
    `@breaking_change (deferred to v0.4 baseline-checker)`,
  E032: (doc: string) =>
    `topic for @crdt_doc_topic(doc: "${doc}") removed without @retired_topic ` +
    `(deferred to v0.4 baseline-checker)`,
  E033: (doc: string, was: number, now: number) =>
    `@schema_version(doc: "${doc}") downgraded from ${was} to ${now} ` +
    `(deferred to v0.4 baseline-checker)`,
  E034: (target: string) =>
    `@rename_case on ${target} changed without @breaking_change ` +
    `(deferred to v0.4 baseline-checker)`,

  W001: (field: string) =>
    `@sync(qos: REALTIME) on composite field "${field}" without @atomic`,
  W002: (field: string) => `@store on "${field}" without explicit @sync; defaults to RELIABLE`,
  W003: (record: string) =>
    `record ${record} has @crdt but no Timestamp! field named "updated_at"`,
  W004: (what: string) => `directive declared but target does not use it: ${what}`,
  // v0.3.9 (Wave 3B): backward-compat advisories.
  W007: (record: string, field: string) =>
    `optional field "${field}" added in the middle of record "${record}"; ` +
    `wire is CBOR-map keyed by name so order is normally tolerant, but ` +
    `array-frozen consumers (legacy or fixture-bound) break. Append at end ` +
    `or use @breaking_change`,
  W008: (envelopeKind: string, override: string) =>
    `@envelope(${envelopeKind}) overridden by @${override} — incoherent ` +
    `combination; preset defaults are likely better. ` +
    `If intentional, suppress with @breaking_change(reason: ...).`,
  W009: (field: string, replacedBy?: string) =>
    `field "${field}" is @deprecated_field` +
    (replacedBy ? ` (replaced by "${replacedBy}")` : '') +
    `; consumers should migrate before next major bump`,
}
