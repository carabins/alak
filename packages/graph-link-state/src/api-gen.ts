// @alaq/graph-link-state — root ApiClient emitter.
//
// One entry point (`createApi(store)`) exposes three namespaces:
//   • `state`   — factories for every record, scoped or global
//   • `actions` — unscoped actions (scoped ones live on node facades)
//
// For scoped records the factory takes the instance id; for unscoped
// records it defaults to the record's camelCased name as the path root,
// matching the "topic root is namespace/record" convention of the default
// wire mapping. The caller is free to pass any path.

import type { IRAction, IRRecord } from '@alaq/graph'
import { LineBuffer, camelCase } from './utils'
import { getRecordScope } from './nodes-gen'

export function emitApi(
  buf: LineBuffer,
  records: Record<string, IRRecord>,
  actions: Record<string, IRAction>,
) {
  buf.line(`export function createApi(store: SyncStore) {`)
  buf.indent()
  buf.line(`return {`)
  buf.indent()

  // ── state ──
  buf.line(`state: {`)
  buf.indent()
  const recNames = Object.keys(records).sort()
  for (const name of recNames) {
    const rec = records[name]
    const scope = getRecordScope(rec)
    const key = scope ? scope : camelCase(name)
    if (scope) {
      buf.line(`${key}: (id: string) => create${name}Node(store, id),`)
    } else {
      buf.line(`${key}: (path: string = '${key}') => create${name}Node(store, path),`)
    }
  }
  buf.dedent()
  buf.line(`},`)

  // ── actions ──
  buf.line(`actions: {`)
  buf.indent()
  const actNames = Object.keys(actions).sort()
  for (const name of actNames) {
    const a = actions[name]
    if (a.scope) continue // bound as node method
    const fname = camelCase(a.name)
    const hasInput = (a.input ?? []).length > 0
    if (hasInput) {
      buf.line(`${fname}: (input: Parameters<typeof ${fname}>[1]) => ${fname}(store, input),`)
    } else {
      buf.line(`${fname}: () => ${fname}(store),`)
    }
  }
  buf.dedent()
  buf.line(`},`)

  buf.dedent()
  buf.line(`}`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}
