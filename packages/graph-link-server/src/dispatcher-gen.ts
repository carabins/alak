// @alaq/graph-link-server — dispatcher emitter.
//
// Turns `ActionHandlers` + `ActionContext` into a function shaped like
// `createLinkServer`'s `onAction` callback (see packages/link/server/index.ts:10):
//
//   (action: string, path: string, args: any, peerId: string) => Promise<any>
//
// The generated dispatcher:
//   • routes by action name (a switch/case);
//   • extracts the scope id from the wire `path` (e.g. `room.abc-123` → `abc-123`);
//   • passes a fresh ActionContext with the correct peerId for each call
//     (the base ctx from the caller is shallow-merged, so per-request peerId
//     doesn't mutate shared state);
//   • awaits whatever the handler returns (addresses FINDING 6.2 at the
//     call-site — even if the underlying server forgets to await, the
//     dispatcher always resolves to a concrete value);
//   • bounces unknown actions to `onUnknownAction` (default: throw) and
//     catches handler errors via `onError` (default: rethrow). Neither
//     hook is required, but both make logging/metrics easy to layer in.

import type { IRAction } from '../../graph/src/types'
import {
  LineBuffer,
  camelCase,
} from './utils'
import { renderInputType } from './handlers-gen'
import type { TypeContext } from './utils'

/**
 * Emit a small, hand-readable helper that strips the scope prefix from a
 * wire path. The path convention (`<scope>.<id>`) lives at FINDING 3.7
 * in Kotelok-2 — we reify it here so a typo in the scope name surfaces at
 * generator time, not silently-at-runtime.
 */
function emitPathHelper(buf: LineBuffer) {
  buf.line(`/**`)
  buf.line(` * Strip the "\${scope}." prefix from a wire path. Returns the raw`)
  buf.line(` * path when the prefix does not match — the handler will likely`)
  buf.line(` * treat that as invalid and throw, but we stay permissive so a`)
  buf.line(` * misrouted message can't crash the server.`)
  buf.line(` */`)
  buf.line(`function extractScopeId(path: string, scope: string): string {`)
  buf.indent()
  buf.line(`const prefix = scope + '.'`)
  buf.line(`return path.startsWith(prefix) ? path.slice(prefix.length) : path`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

function emitDispatcherOptions(buf: LineBuffer) {
  buf.line(`export interface DispatcherOptions {`)
  buf.indent()
  buf.line(`/** Handler table. One method per action in the SDL. */`)
  buf.line(`handlers: ActionHandlers`)
  buf.line(`/** Base context. The dispatcher shallow-overrides \`peerId\` per call. */`)
  buf.line(`ctx: Omit<ActionContext, 'peerId'> & { peerId?: string }`)
  buf.line(`/** Called when no handler matches. Default: throw. */`)
  buf.line(`onUnknownAction?: (action: string, path: string) => unknown`)
  buf.line(`/** Called when a handler throws. Default: rethrow. */`)
  buf.line(`onError?: (action: string, error: unknown) => unknown`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

/**
 * One case arm in the dispatch switch. Keeps the switch readable when a
 * schema grows past a dozen actions — every action expands to ~5 lines
 * and nothing escapes its case block.
 */
function emitDispatchCase(
  buf: LineBuffer,
  action: IRAction,
  ctx: TypeContext,
) {
  const method = camelCase(action.name)
  const inputTs = renderInputType(action, ctx)

  buf.line(`case '${action.name}': {`)
  buf.indent()
  if (action.scope) {
    buf.line(`const scopeId = extractScopeId(path, '${action.scope}')`)
  }
  if (inputTs) {
    buf.line(`const input = args as ${inputTs}`)
  }
  const args: string[] = ['peerCtx']
  if (action.scope) args.push('scopeId')
  if (inputTs) args.push('input')
  buf.line(`return await options.handlers.${method}(${args.join(', ')})`)
  buf.dedent()
  buf.line(`}`)
}

export function emitDispatcher(
  buf: LineBuffer,
  actions: Record<string, IRAction>,
  ctx: TypeContext,
) {
  emitDispatcherOptions(buf)
  emitPathHelper(buf)

  buf.line(`/**`)
  buf.line(` * Wire generated handlers to createLinkServer()'s onAction callback.`)
  buf.line(` *`)
  buf.line(` * Usage:`)
  buf.line(` *   const server = createLinkServer({`)
  buf.line(` *     port: 3456,`)
  buf.line(` *     onAction: createActionDispatcher({ handlers, ctx }),`)
  buf.line(` *   })`)
  buf.line(` */`)
  buf.line(`export function createActionDispatcher(options: DispatcherOptions) {`)
  buf.indent()
  buf.line(`return async (`)
  buf.indent()
  buf.line(`action: string,`)
  buf.line(`path: string,`)
  buf.line(`args: unknown,`)
  buf.line(`peerId: string,`)
  buf.dedent()
  buf.line(`): Promise<unknown> => {`)
  buf.indent()
  // Per-call ActionContext — shallow merge so the base ctx's broadcastToRoom
  // et al stay bound to their captured linkServer reference.
  buf.line(`const peerCtx: ActionContext = { ...options.ctx, peerId }`)
  buf.line(`try {`)
  buf.indent()
  buf.line(`switch (action) {`)
  buf.indent()

  const names = Object.keys(actions).sort()
  for (const name of names) {
    emitDispatchCase(buf, actions[name], ctx)
  }

  buf.line(`default: {`)
  buf.indent()
  buf.line(`if (options.onUnknownAction) return options.onUnknownAction(action, path)`)
  buf.line("throw new Error(`[dispatcher] unknown action: ${action}`)")
  buf.dedent()
  buf.line(`}`)

  buf.dedent()
  buf.line(`}`)
  buf.dedent()
  buf.line(`} catch (err) {`)
  buf.indent()
  buf.line(`if (options.onError) return options.onError(action, err)`)
  buf.line(`throw err`)
  buf.dedent()
  buf.line(`}`)

  buf.dedent()
  buf.line(`}`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}
