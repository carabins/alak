// @alaq/graph-axum — handlers.rs emitter.
//
// Emits a single `#[async_trait] pub trait Handlers` per namespace, with one
// `async fn <action>(&self, ctx: ActionContext, input: <Action>Input)`
// method per SDL action. Return type is spelled inline (no newtype), via
// `mapActionOutputType`:
//   • no output          → `Result<(), HandlerError>`
//   • scalar output      → `Result<T, HandlerError>` / `Result<Option<T>, …>`
//   • list output        → `Result<Vec<T>, HandlerError>` (and friends when
//                          the outer/inner are optional)
//
// The user implements this trait once per application. The generated router
// (routes.rs) is generic over `H: Handlers` and dispatches JSON bodies via
// `serde`. `ActionContext` and `HandlerError` come from the runtime crate
// (see `alaq-graph-axum-rt`).
//
// Naming: method names are snake_cased action names (C.1/C.2 convention).

import type { IRAction, IRSchema } from '@alaq/graph'
import {
  LineBuffer,
  buildTypeContext,
  mapActionOutputType,
  snakeCase,
} from './utils'

function hasInput(action: IRAction): boolean {
  return (action.input ?? []).length > 0
}

export function emitHandlersTrait(
  buf: LineBuffer,
  schema: IRSchema,
  runtimeCrate: string,
  typesMod: string,
) {
  const actions = schema.actions
  const ctx = buildTypeContext(schema)

  buf.line(`use ${runtimeCrate}::{async_trait, ActionContext, HandlerError};`)
  buf.line(`use super::${typesMod}::*;`)
  buf.blank()
  buf.line(`/// Implement this trait once per application. One method per SDL`)
  buf.line(`/// action — the generated router (super::routes::router) dispatches`)
  buf.line(`/// JSON bodies into these calls.`)
  buf.line(`#[async_trait]`)
  buf.line(`pub trait Handlers: Send + Sync + 'static {`)
  buf.indent()

  const names = Object.keys(actions).sort()
  for (let i = 0; i < names.length; i++) {
    const a = actions[names[i]]
    const fn = snakeCase(a.name)
    const ret = mapActionOutputType(a, ctx)
    // C2 (2026-04-21): actions with no `input` declared drop the `input`
    // parameter entirely — mirrors the dispatcher's `Json<Input>` extractor
    // being conditional, and implementers only list args they can use.
    if (hasInput(a)) {
      const inputTy = `${a.name}Input`
      buf.line(
        `async fn ${fn}(&self, ctx: ActionContext, input: ${inputTy}) -> Result<${ret}, HandlerError>;`,
      )
    } else {
      buf.line(
        `async fn ${fn}(&self, ctx: ActionContext) -> Result<${ret}, HandlerError>;`,
      )
    }
    if (i < names.length - 1) buf.blank()
  }

  if (names.length === 0) {
    // Keep the trait compilable even for schemas with no actions.
    buf.line(`// (no actions declared in the SDL)`)
  }

  buf.dedent()
  buf.line(`}`)
  buf.blank()
}
