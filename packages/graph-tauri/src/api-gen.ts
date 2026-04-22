// @alaq/graph-tauri — root API factory.
//
// Emits a `createTauriApi()` that collects every action wrapper under one
// object. Usage:
//   const api = createTauriApi()
//   await api.renderMarkdown({ path: 'readme.md' })
//
// This is the mirror of `createApi(store)` in @alaq/graph-link-state, minus
// the store argument (plain invoke doesn't carry reactive state in v0.1).
// The returned object is a plain record of camelCased action names → bound
// functions; consumers can destructure it, wrap it, or pass it around.
//
// State/events placeholders are intentionally NOT attached here — they do
// not participate in v0.1's typed surface. When they land in later waves,
// `createTauriApi()` will grow `.state` / `.events` sub-objects.

import type { IRAction } from '@alaq/graph'
import { LineBuffer, camelCase } from './utils'

function actionHasInput(action: IRAction): boolean {
  return (action.input ?? []).length > 0
}

export function emitApi(
  buf: LineBuffer,
  actions: Record<string, IRAction>,
) {
  const names = Object.keys(actions).sort()
  buf.line(`export function createTauriApi() {`)
  buf.indent()
  buf.line(`return {`)
  buf.indent()
  for (const name of names) {
    const a = actions[name]
    const fname = camelCase(a.name)
    if (actionHasInput(a)) {
      buf.line(`${fname}: (input: I${a.name}Input) => ${fname}(input),`)
    } else {
      buf.line(`${fname}: () => ${fname}(),`)
    }
  }
  buf.dedent()
  buf.line(`}`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}
