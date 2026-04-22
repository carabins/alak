// @alaq/graph-tauri-rs — `events.rs` emitter (v0.3.4 / W9).
//
// For each `event Name { … }` in the IR we emit:
//
//   1. A payload struct (same shape as a record) — already written by the
//      types emitter when we seed `types.rs` with events; kept separate so
//      that `events.rs` can `use super::types::*` and stay focused on the
//      emit helper.
//   2. A thin `emit_<snake_name>` function taking `&AppHandle<R>` and a
//      `&<EventName>` payload, delegating to Tauri v2's `Emitter` trait.
//
// Wire name: `snake_case(EventName)` — the same rule used for Tauri command
// invoke-names (see commands-gen.ts). Keeps one mental model for all
// SDL-to-Tauri names.
//
// Payload types live in `types.rs` — see types-gen.ts (`emitEventPayloads`).
//
// Non-goals in v0.3.4:
//   - Stream events (one payload per chunk). See SPEC §17 — remain
//     out-of-scope; the `opaque stream` type is still the correct place.
//   - Server-initiated request/response (not a broadcast shape).

import type { IREvent } from '@alaq/graph'
import { LineBuffer, TypeContext, snakeCase } from './utils'

function hasEvents(events: Record<string, IREvent>): boolean {
  return Object.keys(events).length > 0
}

/**
 * Emit the `events.rs` body. Must be called after `types.rs` has been
 * generated with the event-payload structs (they are imported via
 * `use super::types::*`).
 */
export function emitEvents(
  buf: LineBuffer,
  namespace: string,
  events: Record<string, IREvent>,
  _ctx: TypeContext,
) {
  if (!hasEvents(events)) {
    buf.line(`// No \`event\` declarations in namespace \`${namespace}\`.`)
    buf.line(`//`)
    buf.line(`// Nothing to emit. This file exists so \`mod.rs\` can keep a stable`)
    buf.line(`// \`pub mod events;\` line across schemas with or without events.`)
    buf.blank()
    return
  }

  buf.line(`use super::types::*;`)
  buf.line(`use tauri::Emitter;`)
  buf.blank()

  buf.line(`// Broadcast-event emitters. One helper per \`event Name { … }\` in the`)
  buf.line(`// SDL. Each helper wraps \`AppHandle::emit\` so callers do not write the`)
  buf.line(`// wire name by hand — SDL event names are the source of truth.`)
  buf.blank()

  const names = Object.keys(events).sort()
  for (const name of names) {
    const ev = events[name]!
    const wire = snakeCase(ev.name)
    buf.line(`/// Broadcast the \`${ev.name}\` event (wire name: \`${wire}\`) to all`)
    buf.line(`/// listeners. Mirrors \`app.emit("${wire}", payload)\` while keeping the`)
    buf.line(`/// payload type tied to the SDL declaration.`)
    buf.line(`///`)
    buf.line(`/// TS side: \`listen('${wire}', ev => …)\` — see the \`on${ev.name}\``)
    buf.line(`/// helper in the \`@alaq/graph-tauri\` output for a typed version.`)
    buf.line(`pub fn emit_${wire}<R: tauri::Runtime>(`)
    buf.indent()
    buf.line(`app: &tauri::AppHandle<R>,`)
    buf.line(`payload: &${ev.name},`)
    buf.dedent()
    buf.line(`) -> tauri::Result<()> {`)
    buf.indent()
    buf.line(`app.emit("${wire}", payload)`)
    buf.dedent()
    buf.line(`}`)
    buf.blank()
  }
}
