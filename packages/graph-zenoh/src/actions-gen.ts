// @alaq/graph-zenoh — action request/reply helpers.
//
// For every SDL action we emit:
//   • An input struct             (`<Action>Input`) — `#[derive(Serialize, Deserialize)]`
//     Skipped when `input` is empty.
//   • An output newtype           (`<Action>Output`) — wraps the reply payload.
//     Skipped when `output` is omitted (fire-forget).
//   • An `impl <Action>Input` block with a `topic(...)` helper:
//       - unscoped: `"{namespace}/action/<Action>"`
//       - scoped:   `"{namespace}/{scope}/{id}/action/<Action>"`
//   • A `call_<action>(...)` async helper that does:
//       - fire-forget (no output): `session.put(key, payload)`
//       - request-reply:           `session.get(selector).with_value(payload)` then
//                                  decodes the first reply.
//
// Matches SPEC §11:
//   action A              → Topic "n/action/A", request-reply
//   action A { scope: r } → "n/r/{id}/action/A"
//   action A w/o output   → fire-forget

import type { IRAction } from '@alaq/graph'
import {
  LineBuffer,
  TypeContext,
  mapFieldType,
  mapScalarReturnType,
  snakeCase,
  rustIdent,
} from './utils'

function hasInput(action: IRAction): boolean {
  return (action.input ?? []).length > 0
}

function hasOutput(action: IRAction): boolean {
  return !!action.output
}

function emitInputStruct(buf: LineBuffer, action: IRAction, ctx: TypeContext) {
  if (!hasInput(action)) return
  buf.line(`#[derive(Debug, Clone, Serialize, Deserialize)]`)
  buf.line(`pub struct ${action.name}Input {`)
  buf.indent()
  for (const f of action.input!) {
    const snake = snakeCase(f.name)
    if (snake !== f.name) {
      buf.line(`#[serde(rename = "${f.name}")]`)
    }
    buf.line(`pub ${rustIdent(snake)}: ${mapFieldType(f, ctx)},`)
  }
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

function emitOutputType(buf: LineBuffer, action: IRAction, ctx: TypeContext) {
  if (!hasOutput(action)) return
  const ty = mapScalarReturnType(action.output!, action.outputRequired === true, ctx)
  buf.line(`/// Reply payload newtype. Transparent for simple scalars.`)
  buf.line(`#[derive(Debug, Clone, Serialize, Deserialize)]`)
  buf.line(`#[serde(transparent)]`)
  buf.line(`pub struct ${action.name}Output(pub ${ty});`)
  buf.blank()
}

function emitInputTopicImpl(buf: LineBuffer, action: IRAction) {
  // Topic helper lives on the input type when it exists; otherwise it's a
  // free-standing function so fire-forget no-input actions still get a topic.
  if (hasInput(action)) {
    buf.line(`impl ${action.name}Input {`)
    buf.indent()
    if (action.scope) {
      buf.line(
        `pub fn topic(namespace: &str, id: &str) -> String {`,
      )
      buf.indent()
      buf.line(
        `format!("{}/${action.scope}/{}/action/${action.name}", namespace, id)`,
      )
      buf.dedent()
      buf.line(`}`)
    } else {
      buf.line(`pub fn topic(namespace: &str) -> String {`)
      buf.indent()
      buf.line(`format!("{}/action/${action.name}", namespace)`)
      buf.dedent()
      buf.line(`}`)
    }
    buf.dedent()
    buf.line(`}`)
    buf.blank()
  } else {
    // No input struct — emit a free-standing ${name}_topic helper.
    const fn = `${snakeCase(action.name)}_topic`
    if (action.scope) {
      buf.line(`pub fn ${fn}(namespace: &str, id: &str) -> String {`)
      buf.indent()
      buf.line(`format!("{}/${action.scope}/{}/action/${action.name}", namespace, id)`)
      buf.dedent()
      buf.line(`}`)
    } else {
      buf.line(`pub fn ${fn}(namespace: &str) -> String {`)
      buf.indent()
      buf.line(`format!("{}/action/${action.name}", namespace)`)
      buf.dedent()
      buf.line(`}`)
    }
    buf.blank()
  }
}

function emitCallHelper(buf: LineBuffer, action: IRAction, ctx: TypeContext) {
  const snake = snakeCase(action.name)
  const scoped = !!action.scope
  const withInput = hasInput(action)
  const withOutput = hasOutput(action)
  const outType = withOutput
    ? `${action.name}Output`
    : `()`

  buf.line(`/// Invoke the \`${action.name}\` action over zenoh.`)
  if (!withOutput) buf.line(`/// Fire-forget: publishes to the action topic without waiting for a reply.`)
  else buf.line(`/// Request/reply: publishes and decodes the first response.`)

  buf.line(`pub async fn call_${snake}(`)
  buf.indent()
  buf.line(`session: &Session,`)
  buf.line(`namespace: &str,`)
  if (scoped) buf.line(`id: &str,`)
  if (withInput) buf.line(`input: &${action.name}Input,`)
  buf.dedent()
  buf.line(`) -> zenoh::Result<${outType}> {`)
  buf.indent()

  // Topic
  if (withInput) {
    buf.line(
      `let key = ${action.name}Input::topic(namespace${scoped ? ', id' : ''});`,
    )
  } else {
    const fn = `${snake}_topic`
    buf.line(`let key = ${fn}(namespace${scoped ? ', id' : ''});`)
  }

  // Payload
  if (withInput) {
    buf.line(
      `let payload: Vec<u8> = serde_json::to_vec(input).map_err(|e| zenoh::Error::from(format!("json encode: {e}")))?;`,
    )
  } else {
    buf.line(`let payload: Vec<u8> = Vec::new();`)
  }

  if (!withOutput) {
    // Fire-forget
    buf.line(`session.put(&key, payload).res().await?;`)
    buf.line(`Ok(())`)
  } else {
    // Request/reply via zenoh get + value. The payload goes in `with_value`.
    buf.line(`let replies = session`)
    buf.indent()
    buf.line(`.get(&key)`)
    buf.line(`.with_value(payload)`)
    buf.line(`.res()`)
    buf.line(`.await?;`)
    buf.dedent()
    buf.line(`if let Ok(reply) = replies.recv_async().await {`)
    buf.indent()
    buf.line(`let sample = reply.sample.map_err(|e| zenoh::Error::from(format!("reply error: {e:?}")))?;`)
    buf.line(`let bytes = sample.value.payload.contiguous().to_vec();`)
    buf.line(
      `let out: ${action.name}Output = serde_json::from_slice(&bytes).map_err(|e| zenoh::Error::from(format!("json decode: {e}")))?;`,
    )
    buf.line(`Ok(out)`)
    buf.dedent()
    buf.line(`} else {`)
    buf.indent()
    buf.line(`Err(zenoh::Error::from("no reply received"))`)
    buf.dedent()
    buf.line(`}`)
  }

  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitAction(buf: LineBuffer, action: IRAction, ctx: TypeContext) {
  const scopeNote = action.scope ? `scope: "${action.scope}"` : 'unscoped'
  const replyNote = hasOutput(action) ? 'request-reply' : 'fire-forget'
  buf.line(`// SDL: action ${action.name} (${scopeNote}, ${replyNote})`)
  emitInputStruct(buf, action, ctx)
  emitOutputType(buf, action, ctx)
  emitInputTopicImpl(buf, action)
  emitCallHelper(buf, action, ctx)
}

export function emitActions(
  buf: LineBuffer,
  actions: Record<string, IRAction>,
  ctx: TypeContext,
) {
  const names = Object.keys(actions).sort()
  for (const name of names) emitAction(buf, actions[name], ctx)
}
