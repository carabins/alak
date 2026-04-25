// @alaq/graph-zenoh — Zenoh liveliness presence helpers (SPEC §7.26).
//
// For every record carrying `@liveliness_token(pattern: "...")` we emit
// two free functions:
//
//   declare_alive_<rec>(session, value) -> impl Drop
//     Resolves the pattern's `{field}` placeholders against the record
//     instance and declares a Zenoh liveliness token. The returned guard
//     is a `zenoh::liveliness::LivelinessToken`; dropping it (or session
//     loss) emits a `SampleKind::Delete` to subscribers.
//
//   subscribe_alive_<rec>(session, callback) -> impl Drop
//     Subscribes to the wildcard form of the pattern (every `{field}`
//     becomes `*`). The callback receives `(SampleKind, KeyExpr)` so the
//     consumer can inspect both presence/absence (PUT/DELETE) and the
//     concrete key the event fires on.
//
// Wire mapping is normative per WIRE.md (added in v0.3.10). The directive
// is orthogonal to `@envelope` / `@topic` — liveliness is session-tracking
// at the Zenoh-API level, not a payload contract.

import type { IRRecord } from '@alaq/graph'
import {
  LineBuffer,
  findDirective,
  hasDirective,
  rustIdent,
  snakeCase,
} from './utils'

/** Pull `@liveliness_token(pattern: "...")` off a record, or null. */
function getLivelinessPattern(rec: IRRecord): string | null {
  const dir = findDirective(rec.directives, 'liveliness_token')
  if (!dir) return null
  const p = dir.args?.pattern
  return typeof p === 'string' ? p : null
}

/** Replace every `{name}` placeholder in `pattern` with `*` for wildcard
 *  subscription. Used by `subscribe_alive_<rec>`. */
function wildcardPattern(pattern: string): string {
  return pattern.replace(/\{[A-Za-z_][A-Za-z0-9_]*\}/g, '*')
}

/** Extract `{field}` placeholders in source order. Order matters because
 *  we emit them as positional `format!` arguments. */
function extractPlaceholders(pattern: string): string[] {
  const out: string[] = []
  const re = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(pattern)) !== null) out.push(m[1]!)
  return out
}

/** Convert the SDL pattern into a `format!` template by replacing every
 *  `{name}` with `{}`. The named braces in zenoh KEs are not legal Rust
 *  format positions, so we strip them. */
function patternToFormatTemplate(pattern: string): string {
  return pattern.replace(/\{[A-Za-z_][A-Za-z0-9_]*\}/g, '{}')
}

/**
 * Emit `declare_alive_<rec>` + `subscribe_alive_<rec>` for one record.
 * Skips records without `@liveliness_token`.
 */
export function emitRecordLiveliness(buf: LineBuffer, rec: IRRecord) {
  const pattern = getLivelinessPattern(rec)
  if (pattern === null) return

  const placeholders = extractPlaceholders(pattern)
  const fnSuffix = snakeCase(rec.name)
  const template = patternToFormatTemplate(pattern)
  const wildcard = wildcardPattern(pattern)

  // ── Declare token ──
  buf.line(`/// Declare a Zenoh liveliness token for \`${rec.name}\`.`)
  buf.line(`/// Pattern: \`${pattern}\` — placeholders resolved from \`value\`.`)
  buf.line(`/// The returned token is a Drop-guard: dropping it (or losing the`)
  buf.line(`/// Zenoh session) emits \`SampleKind::Delete\` to all subscribers.`)
  buf.line(`pub async fn declare_alive_${fnSuffix}(`)
  buf.indent()
  buf.line(`session: &Session,`)
  buf.line(`value: &${rec.name},`)
  buf.dedent()
  buf.line(`) -> zenoh::Result<zenoh::liveliness::LivelinessToken<'static>> {`)
  buf.indent()
  if (placeholders.length === 0) {
    buf.line(`let key = "${pattern}".to_string();`)
  } else {
    const args = placeholders.map(p => `value.${rustIdent(snakeCase(p))}`).join(', ')
    buf.line(`let key = format!("${template}", ${args});`)
  }
  buf.line(`session.liveliness().declare_token(&key).res().await`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()

  // ── Subscribe to wildcard ──
  buf.line(`/// Subscribe to every \`${rec.name}\` liveliness token matching the`)
  buf.line(`/// wildcard form of the SDL pattern (\`${wildcard}\`).`)
  buf.line(`/// Callback receives \`(SampleKind, KeyExpr)\` — \`SampleKind::Put\``)
  buf.line(`/// on appearance, \`SampleKind::Delete\` on session-keepalive loss.`)
  buf.line(`pub async fn subscribe_alive_${fnSuffix}<F>(`)
  buf.indent()
  buf.line(`session: Arc<Session>,`)
  buf.line(`mut callback: F,`)
  buf.dedent()
  buf.line(`) -> zenoh::Result<()>`)
  buf.line(`where`)
  buf.indent()
  buf.line(`F: FnMut(zenoh::sample::SampleKind, zenoh::key_expr::KeyExpr<'static>) + Send + 'static,`)
  buf.dedent()
  buf.line(`{`)
  buf.indent()
  buf.line(`let key = "${wildcard}";`)
  buf.line(`let subscriber = session.liveliness().declare_subscriber(key).res().await?;`)
  buf.line(`tokio::spawn(async move {`)
  buf.indent()
  buf.line(`while let Ok(sample) = subscriber.recv_async().await {`)
  buf.indent()
  buf.line(`callback(sample.kind, sample.key_expr.into_owned());`)
  buf.dedent()
  buf.line(`}`)
  buf.dedent()
  buf.line(`});`)
  buf.line(`Ok(())`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitAllLiveliness(buf: LineBuffer, records: Record<string, IRRecord>) {
  const names = Object.keys(records).sort()
  for (const name of names) {
    emitRecordLiveliness(buf, records[name])
  }
}

/** True if any record in the schema's records map carries `@liveliness_token`. */
export function hasAnyLiveliness(records: Record<string, IRRecord>): boolean {
  for (const rec of Object.values(records)) {
    if (hasDirective(rec.directives, 'liveliness_token')) return true
  }
  return false
}
