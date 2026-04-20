/**
 * The logi nucl plugin. Emits LogiFrame on:
 *   - onCreate       → 'lifecycle' frame (level: debug)
 *   - onBeforeChange → 'change' frame    (level: info)
 *   - onDecay        → 'lifecycle' frame (level: debug)
 *
 * Fingerprint strategy: `${realm}.${id}` — id is the nucl's quark id, which
 * atom sets to `${atomName}.${prop}`. For standalone Nu without atom wrapping,
 * fingerprint degrades to `${realm}.${id}` or `${realm}.` if id is unset.
 *
 * Trace context: reads the current trace span (set by atom action wrapping).
 * Standalone mutations outside any action get a fresh `trace_id` equal to
 * `span_id` — a one-frame trace.
 */

import type { INucleonPlugin } from '@alaq/nucl/INucleonPlugin'
import type { INucleonCore } from '@alaq/nucl/INucleon'
import type { INuOptions } from '@alaq/nucl/options'
import type { LogiFrame, LogiPluginConfig, LogiTransport } from './types'
import { shapeOf } from './shape'
import { current as currentTrace } from './context/trace'
import { getBuild, getReload, formatRelease } from './release'

interface RuntimeState {
  config: Required<Omit<LogiPluginConfig, 'transport' | 'endpoint' | 'token' | 'version' | 'build' | 'kinds'>> & {
    transport: LogiTransport
    version: string
    release: string
    kinds: Set<LogiFrame['kind']>
  }
}

let runtime: RuntimeState | null = null

/** 10-char span id for standalone (no-action) mutations. */
function mkSpanId(): string {
  return Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7)
}

function shouldEmit(kind: LogiFrame['kind']): boolean {
  if (!runtime) return false
  return runtime.config.kinds.has(kind)
}

function buildFrame(
  kind: LogiFrame['kind'],
  realm: string,
  prop: string,
  atom: string,
): LogiFrame {
  const rt = runtime!
  const trace = currentTrace()
  const span_id = mkSpanId()
  return {
    ts: Date.now(),
    kind,
    level: kind === 'error' ? 'error' : kind === 'change' ? 'info' : 'debug',
    realm,
    atom,
    prop,
    fingerprint: `${realm || '_'}.${atom || '_'}.${prop || '_'}`,
    trace_id: trace ? trace.trace_id : span_id,
    span_id,
    parent_span: trace ? trace.span_id : '',
    release: rt.config.release,
  }
}

/**
 * Parse `id` set by atom: atoms call `setupQuarkAndOptions` with
 * `options.id = '${atomName}.${prop}'`. For bare Nu, id is whatever the
 * user passed (or undefined). We split once on '.' to recover atom/prop.
 */
function splitId(id: string | undefined): { atom: string; prop: string } {
  if (!id) return { atom: '', prop: '' }
  const dot = id.indexOf('.')
  if (dot < 0) return { atom: '', prop: id }
  return { atom: id.slice(0, dot), prop: id.slice(dot + 1) }
}

export interface LogiPlugin extends INucleonPlugin {
  /** Replace the active transport. Useful in tests. */
  __setTransport(t: LogiTransport): void
}

/**
 * Build the plugin instance. Called once at setup time.
 * Repeated calls replace the global runtime (last-wins).
 */
export function logiPlugin(config: LogiPluginConfig = {}): LogiPlugin {
  const version = config.version ?? '0.0.0'
  const build = getBuild(config.build)
  const reload = getReload()
  const release = formatRelease(version, build, reload)

  const kinds = new Set<LogiFrame['kind']>(
    config.kinds ?? ['change', 'action', 'error', 'lifecycle', 'bus'],
  )

  const transport: LogiTransport = config.transport ?? { send() { /* noop until installed */ } }

  runtime = {
    config: {
      transport,
      service: config.service ?? 'alaq',
      environment: config.environment ?? 'dev',
      version,
      release,
      debugValues: config.debugValues ?? false,
      kinds,
      changeSampling: config.changeSampling ?? 1,
      minLevel: config.minLevel ?? 'debug',
    },
  }

  const plugin: LogiPlugin = {
    name: 'logi',
    order: 10,

    onCreate(core: INucleonCore, options?: INuOptions) {
      if (!shouldEmit('lifecycle')) return
      const realm = (core as any).realm ?? options?.realm ?? ''
      const { atom, prop } = splitId((core as any).id ?? options?.id)
      const frame = buildFrame('lifecycle', realm, prop, atom)
      frame.message = 'nucl:create'
      frame.next_shape = shapeOf((core as any)._value)
      if (runtime!.config.debugValues) {
        try { frame.next_value = (core as any)._value } catch { /* ignore */ }
      }
      runtime!.config.transport.send(frame)
    },

    onBeforeChange(core: INucleonCore, nextValue: unknown) {
      if (!shouldEmit('change')) return
      if (runtime!.config.changeSampling < 1 && Math.random() >= runtime!.config.changeSampling) return

      const realm = (core as any).realm ?? ''
      const { atom, prop } = splitId((core as any).id)
      const prev = (core as any)._value

      const frame = buildFrame('change', realm, prop, atom)
      frame.prev_shape = shapeOf(prev)
      frame.next_shape = shapeOf(nextValue)
      if (runtime!.config.debugValues) {
        try {
          frame.prev_value = prev
          frame.next_value = nextValue
        } catch { /* ignore */ }
      }
      runtime!.config.transport.send(frame)
    },

    onDecay(core: INucleonCore) {
      if (!shouldEmit('lifecycle')) return
      const realm = (core as any).realm ?? ''
      const { atom, prop } = splitId((core as any).id)
      const frame = buildFrame('lifecycle', realm, prop, atom)
      frame.message = 'nucl:decay'
      runtime!.config.transport.send(frame)
    },

    __setTransport(t: LogiTransport) {
      if (runtime) runtime.config.transport = t
    },
  }

  return plugin
}

/**
 * Emit a synthetic frame from outside the plugin — used by atom-level
 * action wrapping to mark span begin/end.
 */
export function emitFrame(frame: Partial<LogiFrame> & Pick<LogiFrame, 'kind' | 'realm' | 'atom' | 'prop'>): void {
  if (!runtime) return
  if (!runtime.config.kinds.has(frame.kind)) return
  const trace = currentTrace()
  const span_id = frame.span_id ?? mkSpanId()
  const full: LogiFrame = {
    ts: frame.ts ?? Date.now(),
    level: frame.level ?? (frame.kind === 'error' ? 'error' : 'info'),
    fingerprint: frame.fingerprint ?? `${frame.realm || '_'}.${frame.atom || '_'}.${frame.prop || '_'}`,
    trace_id: frame.trace_id ?? (trace ? trace.trace_id : span_id),
    span_id,
    parent_span: frame.parent_span ?? (trace ? trace.span_id : ''),
    release: runtime.config.release,
    ...frame,
  } as LogiFrame
  runtime.config.transport.send(full)
}

export function __getRuntime(): RuntimeState | null {
  return runtime
}

export function __resetRuntime(): void {
  runtime = null
}
