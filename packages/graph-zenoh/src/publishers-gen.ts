// @alaq/graph-zenoh — publisher / subscriber helpers for records.
//
// For every record we emit two async helpers that use zenoh `put` and
// `declare_subscriber`. Scoped records take an `id: &str`; unscoped
// records compute their topic from `namespace` alone.
//
// Payload encoding follows the SDL mapping:
//   • @atomic record → CBOR bytes
//   • any other      → JSON bytes (serde_json)
//
// This matches SPEC §11 for the default generator and is the simplest
// interop surface that still round-trips through any JSON-aware peer.

import type { IRRecord, IRSchema } from '@alaq/graph'
import {
  LineBuffer,
  collectCrdtDocGroups,
  crdtDocSuffix,
  crdtDocWrapperName,
  findDirective,
  getRecordScope,
  hasDirective,
  isCrdtDocMember,
  snakeCase,
} from './utils'

function encodeExpr(isAtomic: boolean): string {
  return isAtomic
    ? `value.encode_cbor().map_err(|e| zenoh::Error::from(format!("cbor encode: {e}")))?`
    : `serde_json::to_vec(value).map_err(|e| zenoh::Error::from(format!("json encode: {e}")))?`
}

function decodeExpr(typeName: string, isAtomic: boolean): string {
  return isAtomic
    ? `${typeName}::decode_cbor(&bytes).ok()`
    : `serde_json::from_slice::<${typeName}>(&bytes).ok()`
}

export function emitRecordPubSub(buf: LineBuffer, rec: IRRecord) {
  const scope = getRecordScope(rec)
  const isAtomic = hasDirective(rec.directives, 'atomic')
  const fnSuffix = snakeCase(rec.name)
  // v0.3.7 fix: records with a custom `@topic(pattern: ...)` emit only a
  // `TOPIC_PATTERN` constant — no `X::topic(...)` method. The publisher
  // accepts a pre-resolved `topic: &str` from the caller instead (same
  // shape composite-doc helpers use). Without this branch the generator
  // emitted `X::topic(namespace)` calls for records that never defined
  // that method, breaking cargo check on any fixture that used @topic.
  const hasCustomTopic =
    !scope && hasDirective(rec.directives, 'topic')

  // ── Publisher ──
  if (scope) {
    buf.line(`/// Publish a \`${rec.name}\` snapshot to its scoped zenoh topic.`)
    buf.line(`pub async fn publish_${fnSuffix}(`)
    buf.indent()
    buf.line(`session: &Session,`)
    buf.line(`namespace: &str,`)
    buf.line(`id: &str,`)
    buf.line(`value: &${rec.name},`)
    buf.dedent()
    buf.line(`) -> zenoh::Result<()> {`)
    buf.indent()
    buf.line(`let key = ${rec.name}::topic(namespace, id);`)
  } else if (hasCustomTopic) {
    buf.line(`/// Publish a \`${rec.name}\` snapshot to \`topic\`.`)
    buf.line(`/// The caller resolves \`${rec.name}::TOPIC_PATTERN\` placeholders.`)
    buf.line(`pub async fn publish_${fnSuffix}(`)
    buf.indent()
    buf.line(`session: &Session,`)
    buf.line(`topic: &str,`)
    buf.line(`value: &${rec.name},`)
    buf.dedent()
    buf.line(`) -> zenoh::Result<()> {`)
    buf.indent()
    // Own the key as a String so the &key passed into session.put is
    // &String (which zenoh's KeyExpr accepts) rather than &&str (which
    // it does not).
    buf.line(`let key = topic.to_string();`)
  } else {
    buf.line(`/// Publish a \`${rec.name}\` snapshot to its unscoped zenoh topic.`)
    buf.line(`pub async fn publish_${fnSuffix}(`)
    buf.indent()
    buf.line(`session: &Session,`)
    buf.line(`namespace: &str,`)
    buf.line(`value: &${rec.name},`)
    buf.dedent()
    buf.line(`) -> zenoh::Result<()> {`)
    buf.indent()
    buf.line(`let key = ${rec.name}::topic(namespace);`)
  }
  buf.line(`let payload: Vec<u8> = ${encodeExpr(isAtomic)};`)
  buf.line(`session.put(&key, payload).res().await?;`)
  buf.line(`Ok(())`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()

  // ── Subscriber ──
  if (scope) {
    buf.line(`/// Subscribe to a scoped \`${rec.name}\` topic and invoke \`callback\` on updates.`)
    buf.line(`pub async fn subscribe_${fnSuffix}<F>(`)
    buf.indent()
    buf.line(`session: Arc<Session>,`)
    buf.line(`namespace: &str,`)
    buf.line(`id: &str,`)
    buf.line(`mut callback: F,`)
    buf.dedent()
    buf.line(`) -> zenoh::Result<()>`)
    buf.line(`where`)
    buf.indent()
    buf.line(`F: FnMut(${rec.name}) + Send + 'static,`)
    buf.dedent()
    buf.line(`{`)
    buf.indent()
    buf.line(`let key = ${rec.name}::topic(namespace, id);`)
  } else if (hasCustomTopic) {
    buf.line(`/// Subscribe to a pre-resolved \`${rec.name}\` topic.`)
    buf.line(`/// The caller resolves \`${rec.name}::TOPIC_PATTERN\` placeholders.`)
    buf.line(`pub async fn subscribe_${fnSuffix}<F>(`)
    buf.indent()
    buf.line(`session: Arc<Session>,`)
    buf.line(`topic: String,`)
    buf.line(`mut callback: F,`)
    buf.dedent()
    buf.line(`) -> zenoh::Result<()>`)
    buf.line(`where`)
    buf.indent()
    buf.line(`F: FnMut(${rec.name}) + Send + 'static,`)
    buf.dedent()
    buf.line(`{`)
    buf.indent()
    buf.line(`let key = topic.clone();`)
  } else {
    buf.line(`/// Subscribe to the unscoped \`${rec.name}\` topic and invoke \`callback\` on updates.`)
    buf.line(`pub async fn subscribe_${fnSuffix}<F>(`)
    buf.indent()
    buf.line(`session: Arc<Session>,`)
    buf.line(`namespace: &str,`)
    buf.line(`mut callback: F,`)
    buf.dedent()
    buf.line(`) -> zenoh::Result<()>`)
    buf.line(`where`)
    buf.indent()
    buf.line(`F: FnMut(${rec.name}) + Send + 'static,`)
    buf.dedent()
    buf.line(`{`)
    buf.indent()
    buf.line(`let key = ${rec.name}::topic(namespace);`)
  }
  buf.line(`let subscriber = session.declare_subscriber(&key).res().await?;`)
  buf.line(`tokio::spawn(async move {`)
  buf.indent()
  buf.line(`while let Ok(sample) = subscriber.recv_async().await {`)
  buf.indent()
  buf.line(`let bytes = sample.value.payload.contiguous().to_vec();`)
  buf.line(`if let Some(v) = ${decodeExpr(rec.name, isAtomic)} {`)
  buf.indent()
  buf.line(`callback(v);`)
  buf.dedent()
  buf.line(`}`)
  buf.dedent()
  buf.line(`}`)
  buf.dedent()
  buf.line(`});`)
  buf.line(`Ok(())`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitAllPubSub(buf: LineBuffer, records: Record<string, IRRecord>) {
  const names = Object.keys(records).sort()
  for (const name of names) {
    const rec = records[name]
    // v0.3.6: composite-doc members don't get a per-record publisher —
    // publishing happens at the document level via `publish_<doc>`.
    if (isCrdtDocMember(rec)) continue
    emitRecordPubSub(buf, rec)
  }
}

// ────────────────────────────────────────────────────────────────
// v0.3.6 — Composite CRDT document pub/sub
// ────────────────────────────────────────────────────────────────
//
// For every composite document (SPEC §7.15/§7.16) we emit:
//   publish_<doc_snake>(session, topic, doc) — serialises the whole
//     Automerge blob and puts it on the topic. The topic argument is the
//     already-resolved key expression (TOPIC_PATTERN placeholders are the
//     caller's responsibility in v0.1).
//   subscribe_<doc_snake>(session, topic, callback) — hands each incoming
//     Automerge blob to the callback as a freshly-loaded <Doc>Doc value.

export function emitCompositePubSub(
  buf: LineBuffer,
  schema: IRSchema,
  _diagnostics: { severity: 'error' | 'warning'; message: string }[],
) {
  const groups = collectCrdtDocGroups(schema)
  if (groups.length === 0) return

  for (const g of groups) {
    const wrapperName = crdtDocWrapperName(g.docName)
    const suffix = crdtDocSuffix(g.docName)

    // ── Publisher ──
    buf.line(`/// Publish the current snapshot of \`${wrapperName}\` to \`topic\`.`)
    buf.line(`/// The caller resolves \`${wrapperName}::TOPIC_PATTERN\` placeholders.`)
    buf.line(`pub async fn publish_${suffix}(`)
    buf.indent()
    buf.line(`session: &Session,`)
    buf.line(`topic: &str,`)
    buf.line(`doc: &mut ${wrapperName},`)
    buf.dedent()
    buf.line(`) -> zenoh::Result<()> {`)
    buf.indent()
    buf.line(`let payload: Vec<u8> = doc.save();`)
    buf.line(`session.put(topic, payload).res().await?;`)
    buf.line(`Ok(())`)
    buf.dedent()
    buf.line(`}`)
    buf.blank()

    // ── Subscriber ──
    buf.line(`/// Subscribe to \`topic\` and invoke \`callback\` with a freshly-loaded`)
    buf.line(`/// \`${wrapperName}\` on every incoming blob. Rebuild-on-mismatch is`)
    buf.line(`/// handled by \`${wrapperName}::load_or_init\`; callers that care about`)
    buf.line(`/// rebuild events should wrap this helper.`)
    buf.line(`pub async fn subscribe_${suffix}<F>(`)
    buf.indent()
    buf.line(`session: Arc<Session>,`)
    buf.line(`topic: String,`)
    buf.line(`mut callback: F,`)
    buf.dedent()
    buf.line(`) -> zenoh::Result<()>`)
    buf.line(`where`)
    buf.indent()
    buf.line(`F: FnMut(${wrapperName}, /* rebuilt */ bool) + Send + 'static,`)
    buf.dedent()
    buf.line(`{`)
    buf.indent()
    buf.line(`let subscriber = session.declare_subscriber(&topic).res().await?;`)
    buf.line(`tokio::spawn(async move {`)
    buf.indent()
    buf.line(`while let Ok(sample) = subscriber.recv_async().await {`)
    buf.indent()
    buf.line(`let bytes = sample.value.payload.contiguous().to_vec();`)
    // v0.3.7: load_or_init is fallible now (Result<(Self, bool),
    // CrdtError>); on decode failure we skip the sample silently rather
    // than poisoning the subscribe task. Callers that want stricter
    // diagnostics should wrap the helper or stream samples directly.
    buf.line(`if let Ok((doc, rebuilt)) = ${wrapperName}::load_or_init(Some(&bytes)) {`)
    buf.indent()
    buf.line(`callback(doc, rebuilt);`)
    buf.dedent()
    buf.line(`}`)
    buf.dedent()
    buf.line(`}`)
    buf.dedent()
    buf.line(`});`)
    buf.line(`Ok(())`)
    buf.dedent()
    buf.line(`}`)
    buf.blank()
  }
}
