// @alaq/graph-link-state — action call-site emitter.
//
// Unscoped actions become top-level async functions taking the store as
// their first argument. They delegate to `store.options.onAction(name,
// path, args)` — the runtime decides how the call travels.
//
// Scoped actions are emitted as methods on their record's `<Record>Node`
// (see nodes-gen.ts). This file only emits the unscoped variant.

import type { IRAction } from '@alaq/graph'
import {
  LineBuffer,
  TypeContext,
  camelCase,
  mapFieldType,
  mapFieldTypeOptional,
  renderDirectiveComment,
} from './utils'

function renderInputType(action: IRAction, ctx: TypeContext): string {
  const inputs = action.input ?? []
  if (inputs.length === 0) return ''
  const fields = inputs.map(f => {
    const ts = mapFieldType(f, ctx)
    const optional = f.required ? '' : '?'
    return `${f.name}${optional}: ${ts}`
  })
  return `{ ${fields.join(', ')} }`
}

function renderOutputType(action: IRAction, ctx: TypeContext): string {
  if (!action.output) return 'void'
  const fakeField = {
    name: '_',
    type: action.output,
    required: action.outputRequired === true,
    list: false,
  } as any
  return mapFieldTypeOptional(fakeField, ctx)
}

export function emitUnscopedAction(
  buf: LineBuffer,
  action: IRAction,
  ctx: TypeContext,
) {
  const dirs = (action.directives ?? []).map(renderDirectiveComment)
  const scopeNote = action.scope ? `scope: "${action.scope}"` : 'unscoped'
  buf.line(
    `// SDL: action ${action.name} (${scopeNote})${dirs.length ? ' ' + dirs.join(' ') : ''}`,
  )

  const inputTs = renderInputType(action, ctx)
  const outTs = renderOutputType(action, ctx)
  const fname = camelCase(action.name)

  if (inputTs) {
    buf.line(
      `export async function ${fname}(store: SyncStore, input: ${inputTs}): Promise<${outTs}> {`,
    )
  } else {
    buf.line(`export async function ${fname}(store: SyncStore): Promise<${outTs}> {`)
  }
  buf.indent()
  buf.line(`const onAction = (store as any).options?.onAction`)
  buf.line(`if (!onAction) {`)
  buf.indent()
  buf.line(`console.warn('No onAction handler in SyncStore for ${action.name}')`)
  buf.line(`return undefined as unknown as ${outTs}`)
  buf.dedent()
  buf.line(`}`)
  buf.line(
    `return onAction('${action.name}', '', ${inputTs ? 'input' : 'undefined'}) as Promise<${outTs}>`,
  )
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitActions(
  buf: LineBuffer,
  actions: Record<string, IRAction>,
  ctx: TypeContext,
) {
  const names = Object.keys(actions).sort()
  for (const name of names) {
    const a = actions[name]
    if (a.scope) continue // bound as record method elsewhere
    emitUnscopedAction(buf, a, ctx)
  }
}
