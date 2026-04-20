/**
 * Plugin contract types. The plugin is transport-agnostic at its core —
 * it emits `LogiFrame` objects, and a transport decides what to do with them.
 * Default transport is `@logi/browser` (optional peer dep), but tests and
 * alternative runtimes can swap in their own.
 */

export type LogiFrameKind =
  | 'change'      // nucl value mutation
  | 'action'      // atom method invocation (span: begin/end)
  | 'fusion'      // computed recomputation
  | 'error'       // plugin-phase error or captured throw inside action
  | 'lifecycle'   // create / decay
  | 'bus'         // cross-atom event via quantumBus

export type LogiLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'

export type ValueShape =
  | { t: 'primitive', kind: 'string' | 'number' | 'boolean' | 'null' | 'undefined', len?: number }
  | { t: 'array', len: number }
  | { t: 'object', keys: number }
  | { t: 'function' }
  | { t: 'unknown' }

export interface LogiFrame {
  ts: number                 // epoch ms
  kind: LogiFrameKind
  level: LogiLevel
  realm: string              // atom realm, '' if standalone nucl
  atom: string               // atom name, '' if standalone nucl
  prop: string               // property name (or action / fusion name)
  fingerprint: string        // stable grouping key: `${realm}.${atom}.${prop}`
  trace_id: string           // span correlation — action boundary
  span_id: string            // this frame's span
  parent_span: string        // enclosing span (empty at top level)
  release: string            // `${version}+${build}.r${reload}`
  phase?: 'begin' | 'end'    // for 'action' frames
  message?: string           // human-readable hint for ИИ
  duration_ms?: number       // end-frame only
  prev_shape?: ValueShape
  next_shape?: ValueShape
  prev_value?: unknown       // only in dev-debug mode
  next_value?: unknown       // only in dev-debug mode
  args_shape?: ValueShape[]  // action args
  args_value?: unknown[]     // dev-debug only
  extra?: Record<string, string>
}

export interface LogiTransport {
  send(frame: LogiFrame): void
  flush?(): Promise<void>
}

export interface LogiPluginConfig {
  /** Transport. If omitted and `@logi/browser` is present, a default one is created. */
  transport?: LogiTransport
  /** Logi endpoint for the default transport. */
  endpoint?: string
  /** Project token for the default transport. */
  token?: string
  /** Service name. Defaults to `alaq`. */
  service?: string
  /** Environment: `dev` / `stage` / `prod`. Defaults to `dev`. */
  environment?: string
  /** Release version override. If omitted, read from package.json injection / globals. */
  version?: string
  /** Build id override. If omitted, read from `globalThis.__ALAQ_BUILD__`. */
  build?: string
  /**
   * Dev-debug mode: capture full `prev_value` / `next_value` / `args_value`.
   * Default: false. PII risk — enable only in dev.
   */
  debugValues?: boolean
  /**
   * Which frame kinds to send. Default: all except 'fusion'
   * (fusion recomputes can be very hot; opt-in).
   */
  kinds?: LogiFrameKind[]
  /** Sampling 0..1 for change frames on hot paths. 1 = all, 0 = none. Default 1. */
  changeSampling?: number
  /** Minimum level to emit. Default 'debug'. */
  minLevel?: LogiLevel
}
