// @alaq/graph-zenoh — topic constants.
//
// One `pub mod topics` module per namespace. Records' default topics live
// in `impl Record { topic(...) }` (see types-gen.ts); this module collects
// schema-level constants that do not depend on scope identifiers:
//
//   • NAMESPACE            — the schema's namespace
//   • ACTION_PREFIX        — "{namespace}/action"
//   • OPAQUE_PREFIX        — "{namespace}/stream"
//
// Generators in the future may hoist `@topic(pattern: ...)` patterns here.

import type { IRSchema } from '@alaq/graph'
import { LineBuffer } from './utils'

export function emitTopicsModule(buf: LineBuffer, schema: IRSchema) {
  buf.line(`pub mod topics {`)
  buf.indent()
  buf.line(`//! Compile-time topic-prefix constants derived from the SDL schema.`)
  buf.line(`//! Per-record and per-action helpers live on the type themselves.`)
  buf.blank()
  buf.line(`/// Schema namespace (topic root).`)
  buf.line(`pub const NAMESPACE: &'static str = "${schema.namespace}";`)
  buf.line(`/// Prefix for unscoped actions: "{namespace}/action".`)
  buf.line(`pub const ACTION_PREFIX: &'static str = "${schema.namespace}/action";`)
  buf.line(`/// Prefix for opaque streams: "{namespace}/stream".`)
  buf.line(`pub const OPAQUE_PREFIX: &'static str = "${schema.namespace}/stream";`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}
