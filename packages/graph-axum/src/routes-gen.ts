// @alaq/graph-axum — routes.rs emitter.
//
// Emits:
//   • `pub fn router<H: Handlers>(state: AppState<H>) -> Router` — a fresh
//     axum::Router with one POST route per action + the state attached.
//   • One `async fn dispatch_<action><H: Handlers>(State(state), ctx,
//     [Json(input|env),]?) -> Result<Response, HandlerError>` helper per
//     action. The `Json<...>` extractor is only included when the action
//     declares input fields (C2 — 2026-04-21); empty-input actions accept a
//     body-less POST.
//
// Wire-format envelope (2026-04-24, unblock Arsenal v0):
//   * `wireEnvelope: 'wrapped'` (default, canonical alak) — request body is
//     `{ "input": <T> }`; dispatcher extracts `Json(env): Json<<Action>Envelope>`
//     and forwards `env.input` to the handler. Matches what
//     `@alaq/graph-link-http`, `@alaq/graph-link-http-rs`, and
//     `alaq-link-http-client` emit out of the box.
//   * `wireEnvelope: 'bare'` — request body IS the input struct;
//     dispatcher extracts `Json(input): Json<<Action>Input>`. Pre-envelope
//     behaviour; use when a non-alak client is on the other side.
//
// HTTP convention (v0.1):
//   * every action → `POST /<snake_action_name>`
//   * input body   → JSON per envelope mode above when input is declared;
//                    no body otherwise
//   * output 200   → JSON of the handler's return type (spelled inline via
//                    `mapActionOutputType`) when the action declares output
//   * output 202   → empty body when the action has no declared output
//
// Errors bubble through `HandlerError::IntoResponse` — status codes + JSON
// body are defined in the runtime crate.

import type { IRAction, IRSchema } from '@alaq/graph'
import {
  LineBuffer,
  buildTypeContext,
  mapActionOutputType,
  snakeCase,
  type TypeContext,
} from './utils'

export function emitRouterFn(
  buf: LineBuffer,
  schema: IRSchema,
  runtimeCrate: string,
  wireEnvelope: 'bare' | 'wrapped' = 'wrapped',
) {
  const actions = schema.actions
  const ctx = buildTypeContext(schema)

  buf.line(`use axum::{`)
  buf.indent()
  buf.line(`extract::{State, Json},`)
  buf.line(`http::StatusCode,`)
  buf.line(`response::{IntoResponse, Response},`)
  buf.line(`routing::post,`)
  buf.line(`Router,`)
  buf.dedent()
  buf.line(`};`)
  // `wrapped` mode emits per-action envelope structs, which need Deserialize.
  if (wireEnvelope === 'wrapped') {
    buf.line(`use serde::Deserialize;`)
  }
  buf.line(`use ${runtimeCrate}::{ActionContext, HandlerError};`)
  buf.line(`use super::handlers::Handlers;`)
  buf.line(`use super::state::AppState;`)
  buf.line(`use super::types::*;`)
  buf.blank()

  const names = Object.keys(actions).sort()

  // router() function
  buf.line(`/// Build a fresh \`axum::Router\` wired to the generated dispatchers.`)
  buf.line(`/// The returned router already carries \`state\`; layer your own`)
  buf.line(`/// middleware on top before handing it to \`axum::serve\`.`)
  buf.line(`pub fn router<H: Handlers>(state: AppState<H>) -> Router {`)
  buf.indent()
  buf.line(`Router::new()`)
  buf.indent()
  for (const name of names) {
    const snake = snakeCase(name)
    buf.line(`.route("/${snake}", post(dispatch_${snake}::<H>))`)
  }
  buf.line(`.with_state(state)`)
  buf.dedent()
  buf.dedent()
  buf.line(`}`)
  buf.blank()

  // Per-action dispatcher
  for (const name of names) {
    emitDispatcher(buf, actions[name], ctx, wireEnvelope)
  }
}

function emitDispatcher(
  buf: LineBuffer,
  action: IRAction,
  ctx: TypeContext,
  wireEnvelope: 'bare' | 'wrapped',
) {
  const snake = snakeCase(action.name)
  const hasInput = (action.input ?? []).length > 0
  const inputTy = `${action.name}Input`
  const envTy = `${action.name}Envelope`
  const hasOutput = !!action.output
  const outTy = hasOutput ? mapActionOutputType(action, ctx) : null

  // `wrapped` mode: emit a private per-action envelope struct just above the
  // dispatcher. Keeping the struct local to routes.rs avoids polluting the
  // public `types` surface with transport-level noise.
  if (wireEnvelope === 'wrapped' && hasInput) {
    buf.line(`#[derive(Deserialize)]`)
    buf.line(`struct ${envTy} { input: ${inputTy} }`)
    buf.blank()
  }

  buf.line(`/// Dispatcher for SDL action \`${action.name}\` — POST /${snake}.`)
  buf.line(`async fn dispatch_${snake}<H: Handlers>(`)
  buf.indent()
  buf.line(`State(state): State<AppState<H>>,`)
  buf.line(`ctx: ActionContext,`)
  // C2 (2026-04-21): pull `Json<...>` only when the action has input.
  // Empty-input actions skip the extractor entirely — axum handles a
  // body-less POST without trying to deserialize `{}`. Envelope mode
  // wraps input as `{ "input": T }`; bare mode takes input struct directly.
  if (hasInput) {
    if (wireEnvelope === 'wrapped') {
      buf.line(`Json(env): Json<${envTy}>,`)
    } else {
      buf.line(`Json(input): Json<${inputTy}>,`)
    }
  }
  buf.dedent()
  buf.line(`) -> Result<Response, HandlerError> {`)
  buf.indent()

  // Unwrap envelope before forwarding to the handler — handler signatures
  // never see the envelope type.
  if (hasInput && wireEnvelope === 'wrapped') {
    buf.line(`let input = env.input;`)
  }
  const callArgs = hasInput ? 'ctx, input' : 'ctx'
  if (hasOutput) {
    buf.line(`let out = state.handlers.${snake}(${callArgs}).await?;`)
    buf.line(`Ok((StatusCode::OK, Json::<${outTy}>(out)).into_response())`)
  } else {
    buf.line(`state.handlers.${snake}(${callArgs}).await?;`)
    buf.line(`Ok(StatusCode::ACCEPTED.into_response())`)
  }

  buf.dedent()
  buf.line(`}`)
  buf.blank()
}
