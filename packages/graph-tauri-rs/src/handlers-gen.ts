// @alaq/graph-tauri-rs — `handlers.rs` emitter.
//
// Emits a single `<Namespace>Handlers` trait with one async method per SDL
// action. User code writes `impl <Namespace>Handlers for MyHandlers` and
// registers it into Tauri state as `Arc<dyn <Namespace>Handlers>`.
//
// Per the C.1 agreed contract:
//   - Method name: snake_case(ActionName)
//   - Method signature: `async fn <snake>(&self, app: &tauri::AppHandle,
//     input: <Action>Input) -> Result<<Output>, AppError>`
//     (when action has no input, `input` arg is omitted)
//   - `AppHandle` is always passed — handlers commonly need window, state,
//     plugins, etc. Passing it per-call keeps the trait object-safe and
//     avoids forcing the handler struct to hold a handle.
//
// The trait is marked `Send + Sync + 'static` so it can live in Tauri state
// as `Arc<dyn …>`. `#[async_trait::async_trait]` is applied because stable
// Rust (as of 2024) still lacks async trait methods in object-safe traits
// (`dyn Trait`). When AFIT + RPIT stabilise for object-safe dyn, we drop it.

import type { IRAction } from '@alaq/graph'
import {
  LineBuffer,
  TypeContext,
  mapActionOutput,
  mapFieldType,
  pascalCase,
  rustIdent,
  snakeCase,
} from './utils'

function hasInput(action: IRAction): boolean {
  return (action.input ?? []).length > 0
}

function outputType(action: IRAction, ctx: TypeContext): string {
  if (!action.output) return `()`
  return mapActionOutput(
    action.output,
    action.outputRequired === true,
    action.outputList === true,
    action.outputListItemRequired !== false,
    ctx,
  )
}

/**
 * Trait name derivation.
 *
 * Prefers the schema's own `name` (PascalCase per SDL convention —
 * `BelladonnaReader`, `Arsenal`, `Kotelok`) so the trait reads naturally
 * as `BelladonnaReaderHandlers` / `ArsenalHandlers`. Falls back to the
 * last dotted segment of the namespace if the caller only passes a
 * namespace string.
 */
export function handlersTraitName(schemaName: string): string {
  const last = schemaName.includes('.') ? (schemaName.split('.').pop() ?? schemaName) : schemaName
  return `${pascalCase(last)}Handlers`
}

export function emitHandlersTrait(
  buf: LineBuffer,
  schemaName: string,
  namespace: string,
  actions: Record<string, IRAction>,
  ctx: TypeContext,
) {
  const traitName = handlersTraitName(schemaName)
  const names = Object.keys(actions).sort()

  buf.line(`/// Handlers contract for namespace \`${namespace}\`.`)
  buf.line(`///`)
  buf.line(`/// User code implements this trait and registers it in Tauri state:`)
  buf.line(`///`)
  buf.line(`/// \`\`\`ignore`)
  buf.line(`/// .manage::<Arc<dyn ${traitName}>>(Arc::new(MyHandlers::default()))`)
  buf.line(`/// \`\`\``)
  buf.line(`///`)
  buf.line(`/// Every action becomes one async method. The Tauri \`AppHandle\` is`)
  buf.line(`/// forwarded so handlers can touch windows, state, plugins, and logs`)
  buf.line(`/// without tight-coupling to a specific struct layout.`)
  buf.line(`#[async_trait::async_trait]`)
  buf.line(`pub trait ${traitName}: Send + Sync + 'static {`)
  buf.indent()
  for (let i = 0; i < names.length; i++) {
    const a = actions[names[i]]
    const method = snakeCase(a.name)
    const ret = outputType(a, ctx)
    const lines: string[] = [`async fn ${rustIdent(method)}(`]
    lines.push(`    &self,`)
    lines.push(`    app: &tauri::AppHandle,`)
    if (hasInput(a)) {
      lines.push(`    input: ${a.name}Input,`)
    }
    lines.push(`) -> Result<${ret}, AppError>;`)
    for (const l of lines) buf.line(l)
    if (i < names.length - 1) buf.blank()
  }
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitHandlers(
  buf: LineBuffer,
  schemaName: string,
  namespace: string,
  actions: Record<string, IRAction>,
  ctx: TypeContext,
) {
  emitHandlersTrait(buf, schemaName, namespace, actions, ctx)
}
