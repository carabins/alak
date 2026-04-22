// @alaq/graph-tauri — state-on-Rust emitter (STUB in v0.1).
//
// `@alaq/plugin-tauri` (runtime) supports two nucl modes:
//   • `kind: 'tauri'`         — nucl wraps Rust-side atomic state
//   • `kind: 'tauri-command'` — nucl = last result of invoke
// A full generator would emit typed `createStateAtom<T>(config)` factories
// per record marked `@store`/`@scope` for Rust-side storage, wiring read /
// write commands and listen events through `@alaq/plugin-tauri/plugin`.
//
// v0.1 does NOT cover state-over-IPC — Arsenal v2 C.2 scoped the first
// iteration to plain invoke wrappers. The stub exists so the package file
// layout matches the design target (actions-gen / events-gen / state-gen)
// and future state support drops in without shuffling siblings.

import type { IRSchema } from '@alaq/graph'
import type { GenerateDiagnostic } from './index'
import { LineBuffer } from './utils'

export function emitStateStub(
  buf: LineBuffer,
  _schema: IRSchema,
  diagnostics: GenerateDiagnostic[],
) {
  buf.line(`// Rust-backed reactive state is not emitted by @alaq/graph-tauri v0.1.`)
  buf.line(`// For v0.1 callers that need nucl atoms over Tauri state, wire them`)
  buf.line(`// manually via \`@alaq/plugin-tauri\` \`tauriPlugin({ kind: 'tauri', ... })\`.`)
  buf.line(`export function __stateNotSupported(): string {`)
  buf.indent()
  buf.line(`return 'state not supported in v0.1'`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()

  diagnostics.push({
    severity: 'warning',
    message:
      'State (@alaq/plugin-tauri nucl atoms) is stubbed in @alaq/graph-tauri v0.1 — ' +
      'SDL-driven state factories will arrive in a later wave. Generated file exposes ' +
      'only a placeholder `__stateNotSupported` export.',
  })
}
