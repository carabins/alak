// @alaq/graph-link-server — ActionContext type emitter.
//
// The generator emits the *interface* — the runtime (or a hand-written
// adapter around `createLinkServer`) provides the *implementation*. This
// split is intentional: the runtime already has `peers`, `broadcast` and
// `sendTo` internally (see packages/link/server/index.ts) but didn't expose
// them as a unified "action context" — hence FINDING 6.3 ("late-bound
// holder pattern"). The generated ActionContext is the type-side half of
// the fix; the companion runtime helper `makeActionContext(linkServer)` is
// left to the consumer in v0.1 (see README in the spawn-target).

import type { LineBuffer } from './utils'

export function emitActionContext(buf: LineBuffer) {
  buf.line(`/**`)
  buf.line(` * Ambient context passed to every action handler. Implementations live`)
  buf.line(` * outside the generator — usually a thin adapter around`)
  buf.line(` * createLinkServer() that captures the peer map and codec.`)
  buf.line(` *`)
  buf.line(` * v0.1: no CRDT helpers, no request/reply timeout. See TODO.`)
  buf.line(` */`)
  buf.line(`export interface ActionContext<TPeerId = string> {`)
  buf.indent()
  buf.line(`/** The peer who originated this action. Set by the dispatcher. */`)
  buf.line(`readonly peerId: TPeerId`)
  buf.line(``)
  buf.line(`/**`)
  buf.line(` * Broadcast a raw (type, payload) message to every peer whose metadata`)
  buf.line(` * puts them in the given scope id. Pass excludeSelf=true to skip the`)
  buf.line(` * originator — useful for "notify others" style echoes.`)
  buf.line(` */`)
  buf.line(`broadcastToRoom(`)
  buf.indent()
  buf.line(`roomId: string,`)
  buf.line(`type: number,`)
  buf.line(`payload: unknown,`)
  buf.line(`excludeSelf?: boolean,`)
  buf.dedent()
  buf.line(`): void`)
  buf.line(``)
  buf.line(`/** Send a direct message to one peer by id. No-op if the peer is gone. */`)
  buf.line(`sendTo(peerId: TPeerId, type: number, payload: unknown): void`)
  buf.line(``)
  buf.line(`/** Iterate connected peer ids. Snapshot at call time — don't retain. */`)
  buf.line(`peers(): Iterable<TPeerId>`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}
