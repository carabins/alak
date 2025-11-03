/**
 * Fusion Effects - Side-effect utilities
 * @module @alaq/nucl/fusion/effects
 */

import { createEffectWithStrategy } from './core'
import { strategies } from './strategies'

type AnyNucl = any

/**
 * aliveFusion - Side-effect utility with alive strategy
 *
 * Runs a side-effect function when all sources are truthy and change.
 * Does NOT create a new Nucl - just runs the callback.
 *
 * Returns a cleanup function (decay) to stop listening to changes.
 *
 * @example
 * const user = Nu({ name: 'John' })
 * const age = Nu(25)
 *
 * // Only runs when both user and age are truthy
 * const decay = aliveFusion([user, age], (user, age) => {
 *   console.log(`${user.name} is ${age} years old`)
 * })
 *
 * // Later: decay()
 */
export function aliveFusion<A>(
  sources: [any],
  fn: (a: A) => void
): () => void

export function aliveFusion<A, B>(
  sources: [any, any],
  fn: (a: A, b: B) => void
): () => void

export function aliveFusion<A, B, C>(
  sources: [any, any, any],
  fn: (a: A, b: B, c: C) => void
): () => void

export function aliveFusion<A, B, C, D>(
  sources: [any, any, any, any],
  fn: (a: A, b: B, c: C, d: D) => void
): () => void

export function aliveFusion<A, B, C, D, E>(
  sources: [any, any, any, any, any],
  fn: (a: A, b: B, c: C, d: D, e: E) => void
): () => void

export function aliveFusion(sources: AnyNucl[], fn: Function): () => void {
  return createEffectWithStrategy(sources, fn as any, strategies.alive)
}

/**
 * anyFusion - Side-effect utility with any strategy
 *
 * Runs a side-effect function on any source change, regardless of their values.
 * Does NOT create a new Nucl - just runs the callback.
 *
 * Returns a cleanup function (decay) to stop listening to changes.
 *
 * @example
 * const a = Nu(null)
 * const b = Nu(2)
 *
 * // Runs even when a is null
 * const decay = anyFusion([a, b], (a, b) => {
 *   console.log('Values:', a, b)
 * })
 *
 * // Later: decay()
 */
export function anyFusion<A>(
  sources: [any],
  fn: (a: A) => void
): () => void

export function anyFusion<A, B>(
  sources: [any, any],
  fn: (a: A, b: B) => void
): () => void

export function anyFusion<A, B, C>(
  sources: [any, any, any],
  fn: (a: A, b: B, c: C) => void
): () => void

export function anyFusion<A, B, C, D>(
  sources: [any, any, any, any],
  fn: (a: A, b: B, c: C, d: D) => void
): () => void

export function anyFusion<A, B, C, D, E>(
  sources: [any, any, any, any, any],
  fn: (a: A, b: B, c: C, d: D, e: E) => void
): () => void

export function anyFusion(sources: AnyNucl[], fn: Function): () => void {
  return createEffectWithStrategy(sources, fn as any, strategies.any)
}
