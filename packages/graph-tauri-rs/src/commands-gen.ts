// @alaq/graph-tauri-rs — `commands.rs` emitter.
//
// For every SDL action we emit a thin `#[tauri::command]` adapter function
// that:
//   1. Takes Tauri state `State<'_, Arc<dyn <Namespace>Handlers>>`
//   2. Takes `tauri::AppHandle` (useful for window/emit/state access)
//   3. Takes `input: <Action>Input` (when the action has input)
//   4. Delegates to `handlers.<snake_name>(&app, input).await`
//   5. Returns `Result<<Output>, AppError>`
//
// Invoke-name convention: snake_case(ActionName). TS side calls
// `invoke('download_version', { input: {...} })`. See C.1 decisions.

import type { IRAction } from '@alaq/graph'
import {
  LineBuffer,
  TypeContext,
  mapActionOutput,
  rustIdent,
  snakeCase,
} from './utils'
import { handlersTraitName } from './handlers-gen'

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

export function emitCommand(
  buf: LineBuffer,
  schemaName: string,
  action: IRAction,
  ctx: TypeContext,
) {
  const traitName = handlersTraitName(schemaName)
  const cmd = snakeCase(action.name)
  const ret = outputType(action, ctx)

  buf.line(`/// \`${action.name}\` action — Tauri command \`${cmd}\`.`)
  buf.line(`///`)
  buf.line(`/// TS side: \`invoke('${cmd}'${hasInput(action) ? `, { input: { /* … */ } }` : ``})\`.`)
  buf.line(`#[tauri::command]`)
  buf.line(`pub async fn ${rustIdent(cmd)}(`)
  buf.indent()
  buf.line(`handlers: tauri::State<'_, std::sync::Arc<dyn ${traitName}>>,`)
  buf.line(`app: tauri::AppHandle,`)
  if (hasInput(action)) {
    buf.line(`input: ${action.name}Input,`)
  }
  buf.dedent()
  buf.line(`) -> Result<${ret}, AppError> {`)
  buf.indent()
  if (hasInput(action)) {
    buf.line(`handlers.${rustIdent(cmd)}(&app, input).await`)
  } else {
    buf.line(`handlers.${rustIdent(cmd)}(&app).await`)
  }
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitCommands(
  buf: LineBuffer,
  schemaName: string,
  actions: Record<string, IRAction>,
  ctx: TypeContext,
) {
  const names = Object.keys(actions).sort()
  for (const name of names) emitCommand(buf, schemaName, actions[name], ctx)
}
