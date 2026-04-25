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

  // SPEC §7.21 (codegen completed v0.3.10): @bootstrap(mode: ...) is
  // schema-level. Emit a const so the runtime can pick the handshake
  // mode at composite-doc subscribe time. Default `crdt_sync` matches
  // SPEC R290 — closes the offline-resurrection bug. `full_snapshot`
  // is opt-in for clients that want a fresh load.
  const bootstrapDir = (schema.directives ?? []).find(d => d.name === 'bootstrap')
  if (bootstrapDir) {
    const mode = typeof bootstrapDir.args?.mode === 'string'
      ? (bootstrapDir.args.mode as string)
      : 'crdt_sync'
    buf.blank()
    buf.line(`/// Composite-document handshake mode (SPEC §7.21). Read by`)
    buf.line(`/// the runtime when subscribing to a \`<Doc>Doc\` topic to pick`)
    buf.line(`/// between Automerge sync handshake (\`crdt_sync\`) and a fresh`)
    buf.line(`/// document load (\`full_snapshot\`).`)
    buf.line(`pub const BOOTSTRAP_MODE: &'static str = "${mode}";`)
  }

  buf.dedent()
  buf.line(`}`)
  buf.blank()
}
