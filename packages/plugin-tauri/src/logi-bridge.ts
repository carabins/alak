/**
 * Optional bridge to @alaq/plugin-logi. If the logi runtime is configured,
 * frames are emitted; otherwise `emitFrame` is a silent noop (cost: one
 * branch). That lets this plugin treat plugin-logi as a pure observer —
 * absence of observability is not a failure mode.
 *
 * See plugin-idb's logi-bridge for the reference pattern.
 */

import { emitFrame } from '@alaq/plugin-logi'

export interface TauriLogiMeta {
  realm: string
  atom: string
  prop: string
  kind: 'lifecycle' | 'error'
  message: string
  duration_ms?: number
  extra?: Record<string, string>
  numeric?: Record<string, number>
}

export function logTauri(meta: TauriLogiMeta): void {
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
