// @alaq/graph-tauri — events emitter (v0.3.4 / W9).
//
// For each `event Name { … }` in the IR we emit:
//
//   1. A payload interface `I<EventName>` — already written by the types
//      emitter (`emitEventInterfaces`).
//   2. A typed `on<EventName>(handler)` helper that wraps Tauri v2's
//      `listen`. The wire name matches the Rust `emit_<snake_name>` helper
//      emitted by `@alaq/graph-tauri-rs` so the two ends are naturally
//      paired.
//
// Caller example:
//
//   import { onDownloadProgress, type IDownloadProgress } from './ns.tauri.generated'
//
//   const off = await onDownloadProgress(p => { progress.value = p.bytes / p.total })
//   // later: off()        — unregisters the listener
//
// The `listen` import comes from `@tauri-apps/api/event` (Tauri v2). We
// import from there directly — `@alaq/plugin-tauri` does not currently
// re-export `listen`; see the `pluginImport` option on the generator if you
// later swap this in.

import type { IRSchema, IREvent } from '@alaq/graph'
import type { GenerateDiagnostic } from './index'
import { LineBuffer, snakeCase } from './utils'

function hasEvents(schema: IRSchema): boolean {
  return Object.keys(schema.events).length > 0
}

export function emitEventsStub(
  buf: LineBuffer,
  schema: IRSchema,
  diagnostics: GenerateDiagnostic[],
) {
  if (!hasEvents(schema)) {
    // Schema declares no events. Keep a tiny placeholder so downstream
    // imports of the generated module are stable, and so adding the first
    // event later doesn't shuffle file structure for readers. No warning —
    // there's nothing to be done.
    buf.line(`// No \`event\` declarations in this namespace. Add one with`)
    buf.line(`// \`event Name { … }\` in the .aql source to grow this section.`)
    buf.blank()
    return
  }

  buf.line(`import { listen, type UnlistenFn } from '@tauri-apps/api/event'`)
  buf.blank()

  buf.line(`// Typed listen-wrappers for SDL events. Pairs with Rust-side`)
  buf.line(`// \`emit_<snake_name>\` helpers emitted by @alaq/graph-tauri-rs.`)
  buf.blank()

  const names = Object.keys(schema.events).sort()
  for (const name of names) {
    const ev = schema.events[name]!
    emitEventListener(buf, ev)
  }

  // No diagnostics: events are now a real, typed surface. `__eventsNotSupported`
  // no longer fits — we keep it omitted. Callers who used to rely on it should
  // migrate to the typed `on<EventName>` helpers.
  void diagnostics
}

function emitEventListener(buf: LineBuffer, ev: IREvent) {
  const wire = snakeCase(ev.name)
  const iface = `I${ev.name}`
  const fname = `on${ev.name}`

  buf.line(`// SDL: event ${ev.name} (wire: "${wire}")`)
  buf.line(`/**`)
  buf.line(` * Listen for \`${ev.name}\` broadcasts. Returns an \`UnlistenFn\` that`)
  buf.line(` * removes the handler when called.`)
  buf.line(` */`)
  buf.line(
    `export function ${fname}(`,
  )
  buf.indent()
  buf.line(`handler: (payload: ${iface}) => void,`)
  buf.dedent()
  buf.line(`): Promise<UnlistenFn> {`)
  buf.indent()
  buf.line(`return listen<${iface}>('${wire}', ev => handler(ev.payload))`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}
