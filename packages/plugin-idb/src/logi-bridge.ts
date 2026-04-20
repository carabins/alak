/**
 * Optional bridge to @alaq/plugin-logi. If plugin-logi's runtime is registered,
 * we emit frames through it; otherwise this is a noop.
 *
 * We import `emitFrame` statically — the import is resolved at build time,
 * but `emitFrame` itself is a noop when plugin-logi's runtime is not
 * configured (see plugin-logi/src/plugin.ts). That means users who skip
 * plugin-logi entirely still pay nothing at runtime.
 */

import { emitFrame } from '@alaq/plugin-logi'

export interface IdbLogiMeta {
  realm: string
  atom: string
  prop: string
  kind: 'lifecycle' | 'error'
  message: string
  duration_ms?: number
  extra?: Record<string, string>
  numeric?: Record<string, number>
}

export function logIdb(meta: IdbLogiMeta): void {
  const extra: Record<string, string> = { ...(meta.extra ?? {}) }
  if (meta.numeric) {
    for (const [k, v] of Object.entries(meta.numeric)) extra[`numeric.${k}`] = String(v)
  }
  emitFrame({
    kind: meta.kind,
    realm: meta.realm,
    atom: meta.atom,
    prop: meta.prop,
    message: meta.message,
    duration_ms: meta.duration_ms,
    extra: Object.keys(extra).length ? extra : undefined,
  })
}
