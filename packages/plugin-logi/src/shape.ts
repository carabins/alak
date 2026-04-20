/**
 * Value shape extraction — PII-safe metadata about a value without the value itself.
 *
 * Used for `prev_shape` / `next_shape` / `args_shape`. When `debugValues: true`
 * is set on the plugin config, the raw value is captured alongside the shape;
 * otherwise only the shape is sent.
 */

import type { ValueShape } from './types'

export function shapeOf(v: unknown): ValueShape {
  if (v === null) return { t: 'primitive', kind: 'null' }
  if (v === undefined) return { t: 'primitive', kind: 'undefined' }
  const tp = typeof v
  if (tp === 'string') return { t: 'primitive', kind: 'string', len: (v as string).length }
  if (tp === 'number') return { t: 'primitive', kind: 'number' }
  if (tp === 'boolean') return { t: 'primitive', kind: 'boolean' }
  if (tp === 'function') return { t: 'function' }
  if (Array.isArray(v)) return { t: 'array', len: v.length }
  if (tp === 'object') {
    try {
      return { t: 'object', keys: Object.keys(v as object).length }
    } catch {
      return { t: 'unknown' }
    }
  }
  return { t: 'unknown' }
}

export function shapesOf(vs: unknown[]): ValueShape[] {
  const out: ValueShape[] = new Array(vs.length)
  for (let i = 0; i < vs.length; i++) out[i] = shapeOf(vs[i])
  return out
}
