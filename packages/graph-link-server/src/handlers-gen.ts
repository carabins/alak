// @alaq/graph-link-server — ActionHandlers interface + embedded record
// value types.
//
// For every action in the IR we emit one method on `ActionHandlers`. Scoped
// actions take `roomId: string` (or whatever the scope name is) as an
// explicit second argument — the generator reifies the `path` convention
// from the wire protocol into a named parameter, so handlers never touch
// the raw path string.
//
// Every handler is async-or-sync (return `T | Promise<T>`), to match the
// await-the-Promise fix in link/server/index.ts §6.2. The dispatcher awaits
// whichever is returned.

import type { IRAction, IRField, IRRecord } from '../../graph/src/types'
import {
  LineBuffer,
  TypeContext,
  camelCase,
  mapFieldType,
  mapFieldTypeOptional,
} from './utils'

// ────────────────────────────────────────────────────────────────
// Embedded record value interfaces
// ────────────────────────────────────────────────────────────────
//
// We emit minimal `I<Record>` shapes so the generated server file is
// *self-contained* — no import from the client bundle (see emit.ts). For
// v0.1 we emit only the records whose types are reachable from an action's
// input or output; the rest would be dead weight on the server. This is the
// same "needed surface" rule `@alaq/graph-link-state` applies to unused
// enum members — keep the file lean, let the caller regenerate when the
// surface grows.

function collectReachableRecords(
  actions: Record<string, IRAction>,
  records: Record<string, IRRecord>,
): Set<string> {
  const reachable = new Set<string>()
  const queue: string[] = []

  const enqueueType = (typeName: string) => {
    if (records[typeName] && !reachable.has(typeName)) {
      reachable.add(typeName)
      queue.push(typeName)
    }
  }

  for (const a of Object.values(actions)) {
    if (a.output) enqueueType(a.output)
    for (const f of a.input ?? []) {
      enqueueType(f.type)
      if (f.mapKey) enqueueType(f.mapKey.type)
      if (f.mapValue) enqueueType(f.mapValue.type)
    }
  }

  // Walk record → record references transitively (GameRoom → Player).
  while (queue.length > 0) {
    const name = queue.shift()!
    const rec = records[name]
    if (!rec) continue
    for (const f of rec.fields) {
      if (records[f.type]) enqueueType(f.type)
      if (f.mapKey && records[f.mapKey.type]) enqueueType(f.mapKey.type)
      if (f.mapValue && records[f.mapValue.type]) enqueueType(f.mapValue.type)
    }
  }
  return reachable
}

export function emitEmbeddedRecords(
  buf: LineBuffer,
  actions: Record<string, IRAction>,
  records: Record<string, IRRecord>,
  ctx: TypeContext,
) {
  const reachable = collectReachableRecords(actions, records)
  if (reachable.size === 0) return

  const names = [...reachable].sort()
  for (const name of names) {
    const rec = records[name]
    buf.line(`export interface I${rec.name} {`)
    buf.indent()
    for (const f of rec.fields) {
      const ts = mapFieldTypeOptional(f, ctx)
      const opt = f.required ? '' : '?'
      buf.line(`readonly ${f.name}${opt}: ${ts}`)
    }
    buf.dedent()
    buf.line(`}`)
    buf.blank()
  }
}

// ────────────────────────────────────────────────────────────────
// Per-action handler signatures
// ────────────────────────────────────────────────────────────────

/**
 * Inline object literal for action input. Returns `''` when the action has
 * no input — caller elides the parameter entirely.
 */
export function renderInputType(action: IRAction, ctx: TypeContext): string {
  const inputs = action.input ?? []
  if (inputs.length === 0) return ''
  const fields = inputs.map((f: IRField) => {
    const ts = mapFieldType(f, ctx)
    const opt = f.required ? '' : '?'
    return `${f.name}${opt}: ${ts}`
  })
  return `{ ${fields.join('; ')} }`
}

export function renderOutputType(action: IRAction, ctx: TypeContext): string {
  if (!action.output) return 'void'
  // Synthesize a pseudo-field so we can reuse the list/map-aware mapper.
  const fake: IRField = {
    name: '_',
    type: action.output,
    required: action.outputRequired === true,
    list: false,
  }
  return mapFieldTypeOptional(fake, ctx)
}

/**
 * Render one handler method signature, including JSDoc. The signature
 * variant depends on whether the action is scoped / has input / has output.
 *
 * Scoped, with I/O:       name(ctx, roomId, input): Promise<Out> | Out
 * Scoped, no input:       name(ctx, roomId): Promise<Out> | Out
 * Unscoped, with input:   name(ctx, input): Promise<Out> | Out
 * Unscoped, no input:     name(ctx): Promise<Out> | Out
 *
 * When output is void the return type collapses to `void | Promise<void>`
 * to emphasize the fire-and-forget shape.
 */
export function renderHandlerSignature(
  action: IRAction,
  ctx: TypeContext,
  scopeParamName: (scope: string) => string,
): { jsdoc: string[]; signature: string } {
  const inputTs = renderInputType(action, ctx)
  const outTs = renderOutputType(action, ctx)
  const method = camelCase(action.name)

  const params: string[] = ['ctx: ActionContext']
  if (action.scope) {
    params.push(`${scopeParamName(action.scope)}: string`)
  }
  if (inputTs) {
    params.push(`input: ${inputTs}`)
  }

  const ret = outTs === 'void'
    ? 'void | Promise<void>'
    : `${outTs} | Promise<${outTs}>`

  const jsdoc: string[] = [`/**`]
  jsdoc.push(` * action ${action.name}${action.scope ? ` (scope "${action.scope}")` : ' (unscoped)'}`)
  if (inputTs) jsdoc.push(` * input: ${inputTs}`)
  if (action.output) {
    jsdoc.push(` * output: ${outTs}`)
  } else {
    jsdoc.push(` * output: void (fire-and-forget)`)
  }
  jsdoc.push(` */`)

  return {
    jsdoc,
    signature: `${method}(${params.join(', ')}): ${ret}`,
  }
}

/**
 * Emit the `ActionHandlers` interface. The interface is the *contract*
 * consumers fulfil — one method per action, typed per the SDL.
 */
export function emitActionHandlers(
  buf: LineBuffer,
  actions: Record<string, IRAction>,
  ctx: TypeContext,
  scopeParamName: (scope: string) => string,
) {
  buf.line(`/**`)
  buf.line(` * One method per action in the schema. Consumers `)
  buf.line(` * implement this interface and pass it to createActionDispatcher().`)
  buf.line(` * Handlers may be sync or async; the dispatcher awaits either shape.`)
  buf.line(` */`)
  buf.line(`export interface ActionHandlers {`)
  buf.indent()

  const names = Object.keys(actions).sort()
  let first = true
  for (const name of names) {
    const action = actions[name]
    if (!first) buf.blank()
    first = false
    const { jsdoc, signature } = renderHandlerSignature(action, ctx, scopeParamName)
    for (const line of jsdoc) buf.line(line)
    buf.line(signature)
  }

  buf.dedent()
  buf.line(`}`)
  buf.blank()
}
