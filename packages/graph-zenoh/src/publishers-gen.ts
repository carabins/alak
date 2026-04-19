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

import type { IRRecord } from '@alaq/graph'
import {
  LineBuffer,
  findDirective,
  getRecordScope,
  hasDirective,
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
  for (const name of names) emitRecordPubSub(buf, records[name])
}
