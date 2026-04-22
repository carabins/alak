// @alaq/graph-tauri — plain typed `invoke` wrappers per action.
//
// Convention (согласовано C.1 + C.2):
//   • invoke-name  — `snake_case(ActionName)`         (`RenderMarkdown` → `render_markdown`)
//   • export name  — `camelCase(ActionName)`          (`RenderMarkdown` → `renderMarkdown`)
//   • payload      — `{ input: { ...fields } }`       (single wrapper, matches Rust `fn foo(input: FooInput)`)
//   • field case   — snake_case, as declared in SDL   (no serde rename on either side)
//   • output type  — strict from IR's list/itemRequired; no wrapper newtype
//
// Each wrapper is a plain `async function`. No nucl, no FX, no retries, no
// caching. If a consumer wants reactive behaviour, it stacks a store on top;
// this file stays mechanical.

import type { IRAction } from '@alaq/graph'
import {
  LineBuffer,
  TypeContext,
  camelCase,
  mapActionOutputType,
  renderDirectiveComment,
  snakeCase,
} from './utils'

function actionSignatureHasInput(action: IRAction): boolean {
  return (action.input ?? []).length > 0
}

export function emitAction(
  buf: LineBuffer,
  action: IRAction,
  ctx: TypeContext,
) {
  const dirs = (action.directives ?? []).map(renderDirectiveComment)
  const scopeNote = action.scope ? `scope: "${action.scope}"` : 'unscoped'
  buf.line(
    `// SDL: action ${action.name} (${scopeNote})${dirs.length ? ' ' + dirs.join(' ') : ''}`,
  )

  const fname = camelCase(action.name)
  const invokeName = snakeCase(action.name)
  const outTs = mapActionOutputType(action, ctx)
  const inputTypeName = `I${action.name}Input`
  const hasInput = actionSignatureHasInput(action)

  if (hasInput) {
    buf.line(
      `export async function ${fname}(input: ${inputTypeName}): Promise<${outTs}> {`,
    )
    buf.indent()
    if (action.output) {
      buf.line(
        `return invoke<${outTs}>('${invokeName}', { input })`,
      )
    } else {
      // Fire-and-forget: we still wait for the invoke to resolve so callers
      // can chain on completion, but the resolved value is discarded.
      buf.line(`await invoke('${invokeName}', { input })`)
    }
    buf.dedent()
  } else {
    buf.line(`export async function ${fname}(): Promise<${outTs}> {`)
    buf.indent()
    if (action.output) {
      buf.line(`return invoke<${outTs}>('${invokeName}')`)
    } else {
      buf.line(`await invoke('${invokeName}')`)
    }
    buf.dedent()
  }
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
    emitAction(buf, actions[name], ctx)
  }
}
