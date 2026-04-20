/**
 * @alaq/plugin-logi — observability for Nucl and Atom.
 *
 * AI-first design: every frame has a stable `fingerprint`, a `trace_id`
 * linking causally related mutations, and a `release` tag combining
 * version+build+reload so distinct dev runs don't blur together.
 *
 * Three entry points:
 *   1. `logiPlugin(config)` — configure transport + behavior (call once).
 *   2. Import `@alaq/plugin-logi/presets/logi` — register the 'logi' kind.
 *   3. `traceAction(realm, atom, action, fn)` — wrap actions for span tracing.
 */

export { logiPlugin, emitFrame } from './plugin'
export { traceAction } from './action'
export { beginSpan, endSpan, withTrace, current as currentTrace } from './context/trace'
export { shapeOf, shapesOf } from './shape'
export { getReload, getBuild, formatRelease } from './release'
export { createLogiBrowserTransport } from './transport/logi-browser'

export type {
  LogiFrame,
  LogiFrameKind,
  LogiLevel,
  LogiPluginConfig,
  LogiTransport,
  ValueShape,
} from './types'
export type { TraceFrame } from './context/trace'
