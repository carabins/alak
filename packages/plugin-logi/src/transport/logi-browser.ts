/**
 * Default transport using `@logi/browser`. Lazy and optional — if the SDK
 * is not installed, we fall back to a noop transport with a console.warn.
 *
 * Mapping LogiFrame -> Logi ingest event:
 * - `kind: 'change' | 'fusion' | 'bus' | 'lifecycle'` → Logi kind 'event'
 * - `kind: 'action'`  → Logi kind 'span' (phase='begin'|'end', duration_ms on end)
 * - `kind: 'error'`   → Logi kind 'error'
 *
 * Fingerprint is passed through as-is so `logi_list_issues` groups by atom+prop.
 */

import type { LogiFrame, LogiTransport } from '../types'

type LogiJS = typeof import('@logi/browser')

interface LogiEventPartial {
  ts?: string
  kind: 'error' | 'log' | 'span' | 'metric' | 'event'
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  trace_id: string
  span_id: string
  parent_span: string
  message: string
  fingerprint: string
  release: string
  attrs: Record<string, string>
  numeric: Record<string, number>
}

export interface LogiBrowserTransportOptions {
  endpoint: string
  token: string
  service?: string
  environment?: string
  release?: string
}

/**
 * Default dev endpoint: the Logi instance from `A:/source/logi/docker-compose.yml`.
 * Used when neither `transport` nor `endpoint` is passed — gives ИИ an
 * out-of-the-box observable sandbox without any boilerplate:
 *
 *   logiPlugin()  // just works in dev if Logi is running locally
 */
export const DEFAULT_DEV_ENDPOINT = 'http://localhost:8080'
export const DEFAULT_DEV_TOKEN = 'demo_project_token'

/**
 * Try to synchronously get `@logi/browser`. Callers that want a guaranteed
 * transport should `await import('@alaq/plugin-logi/transport/logi-browser')`
 * or pass a pre-built transport via config.transport.
 */
async function loadLogiJS(): Promise<LogiJS | null> {
  try {
    return (await import('@logi/browser')) as LogiJS
  } catch {
    return null
  }
}

function frameToLogi(f: LogiFrame): LogiEventPartial {
  const attrs: Record<string, string> = {
    realm: f.realm,
    atom: f.atom,
    prop: f.prop,
  }
  if (f.phase) attrs.phase = f.phase
  if (f.prev_shape) attrs.prev_shape = JSON.stringify(f.prev_shape)
  if (f.next_shape) attrs.next_shape = JSON.stringify(f.next_shape)
  if (f.args_shape) attrs.args_shape = JSON.stringify(f.args_shape)
  if (f.prev_value !== undefined) {
    try { attrs.prev_value = JSON.stringify(f.prev_value) } catch { /* circular */ }
  }
  if (f.next_value !== undefined) {
    try { attrs.next_value = JSON.stringify(f.next_value) } catch { /* circular */ }
  }
  if (f.args_value) {
    try { attrs.args_value = JSON.stringify(f.args_value) } catch { /* circular */ }
  }
  if (f.extra) Object.assign(attrs, f.extra)

  const numeric: Record<string, number> = {}
  if (typeof f.duration_ms === 'number') numeric.duration_ms = f.duration_ms

  let kind: LogiEventPartial['kind']
  switch (f.kind) {
    case 'action':   kind = 'span'; break
    case 'error':    kind = 'error'; break
    default:         kind = 'event'
  }

  return {
    kind,
    level: f.level === 'trace' ? 'trace' : f.level,
    trace_id: f.trace_id,
    span_id: f.span_id,
    parent_span: f.parent_span,
    message: f.message ?? `${f.kind}:${f.fingerprint}`,
    fingerprint: f.fingerprint,
    release: f.release,
    attrs,
    numeric,
  }
}

export async function createLogiBrowserTransport(
  opts: LogiBrowserTransportOptions,
): Promise<LogiTransport> {
  const sdk = await loadLogiJS()
  if (!sdk) {
    if (typeof console !== 'undefined') {
      console.warn(
        '[alaq/plugin-logi] @logi/browser not installed; frames will be dropped. ' +
        'Install it or pass a custom transport via config.transport.',
      )
    }
    return { send() { /* noop */ } }
  }

  sdk.init({
    endpoint: opts.endpoint,
    token: opts.token,
    service: opts.service ?? 'alaq',
    environment: opts.environment ?? 'dev',
    release: opts.release,
    autoCaptureErrors: false,   // the plugin emits its own error frames
    autoCaptureRejections: false,
    wrapConsole: false,
  })

  return {
    send(frame: LogiFrame) {
      const ev = frameToLogi(frame)
      sdk.captureEvent(ev)
    },
    async flush() {
      await sdk.flush()
    },
  }
}
